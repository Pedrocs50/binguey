import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Cell, type Clip, type Mark, type Room, type RoomMember } from "@binguey/shared";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";

export interface RoomData {
  room: Room;
  members: RoomMember[];
  nicknames: Record<string, string>;
  cells: Cell[];
  marks: Mark[];
  clips: Clip[];
}

export type Phase = "loading" | "ready" | "notfound" | "error";

/**
 * Mantém o instantâneo da sala (banco = verdade) e aplica as mudanças do Realtime.
 * Marcações chegam de forma incremental; qualquer outra mudança recarrega o instantâneo.
 */
export function useRoom(code: string) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<RoomData | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // servidor - relógio local, em ms
  const [notice, setNotice] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setPhase("notfound");
      return;
    }
    setMe(sess.session.user.id);

    const r = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
    if (r.error) return setPhase("error");
    if (!r.data) return setPhase("notfound"); // não existe ou o usuário não é membro (RLS)
    const room = r.data as Room;

    const [m, c, k, cl] = await Promise.all([
      supabase.from("room_members").select("*").eq("room_id", room.id),
      supabase.from("cells").select("*").eq("room_id", room.id).order("idx"),
      supabase.from("marks").select("*").eq("room_id", room.id),
      supabase.from("clips").select("*").eq("room_id", room.id).order("expires_at"),
    ]);
    if (m.error || c.error || k.error || cl.error) return setPhase("error");
    const members = m.data as RoomMember[];

    const p = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", members.map((x) => x.user_id));
    const nicknames: Record<string, string> = {};
    for (const row of (p.data ?? []) as { id: string; nickname: string }[]) nicknames[row.id] = row.nickname;

    setRoomId(room.id);
    // Mantém marcações otimistas ainda em voo (id "tmp-"): o instantâneo não as conhece.
    setData((prev) => {
      const fresh = k.data as Mark[];
      const inFlight = (prev?.marks ?? []).filter(
        (x) => x.id.startsWith("tmp-") && !fresh.some((f) => f.cell_idx === x.cell_idx),
      );
      return { room, members, nicknames, cells: c.data as Cell[], marks: [...fresh, ...inFlight], clips: cl.data as Clip[] };
    });
    setPhase("ready");
  }, [code]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setPhase("loading");
    setData(null);
    setRoomId(null);
    void load();
  }, [load]);

  // Diferença entre o relógio do servidor e o local (compensando metade da ida e volta).
  useEffect(() => {
    if (!roomId) return;
    const t0 = Date.now();
    api
      .serverTime(supabase)
      .then((iso) => setOffset(Date.parse(iso) - (t0 + Date.now()) / 2))
      .catch(() => {});
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "marks", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const mark = payload.new as Mark;
          setData((d) => d && { ...d, marks: [...d.marks.filter((x) => x.cell_idx !== mark.cell_idx), mark] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () =>
        void loadRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => void loadRef.current(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "clips", filter: `room_id=eq.${roomId}` }, () =>
        void loadRef.current(),
      )
      // Ao (re)conectar, recarrega: cobre o intervalo em que o canal esteve fora.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void loadRef.current();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const markCell = useCallback(
    async (idx: number): Promise<Mark | null> => {
      if (!data || !me) return null;
      const tmpId = `tmp-${idx}`;
      const optimistic: Mark = {
        id: tmpId,
        room_id: data.room.id,
        cell_idx: idx,
        user_id: me,
        marked_at: new Date().toISOString(),
      };
      setNotice(null);
      setData((d) => d && { ...d, marks: [...d.marks, optimistic] });
      try {
        const mark = await api.markCell(supabase, data.room.id, idx);
        setData((d) => d && { ...d, marks: [...d.marks.filter((x) => x.cell_idx !== idx), mark] });
        return mark;
      } catch (e) {
        setData((d) => d && { ...d, marks: d.marks.filter((x) => x.id !== tmpId) });
        setNotice(errorMessage(e));
        void loadRef.current(); // mostra quem marcou primeiro / o estado real da sala
        return null;
      }
    },
    [data, me],
  );

  const closeTimeout = useCallback(async () => {
    if (!data) return;
    try {
      await api.closeIfTimeout(supabase, data.room.id);
    } catch {
      /* tenta de novo no próximo tique */
    }
    void loadRef.current();
  }, [data]);

  return { phase, data, me, offset, notice, setNotice, reload: load, markCell, closeTimeout };
}
