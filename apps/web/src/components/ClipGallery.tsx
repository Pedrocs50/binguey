import { useEffect, useState } from "react";
import { api, type Cell, type Clip, type Mark } from "@binguey/shared";
import { supabase } from "../lib/supabase";

interface Props {
  clips: Clip[];
  cells: Cell[];
  marks: Mark[];
  nicknames: Record<string, string>;
  me: string;
}

/** Galeria da sala. Miniaturas vêm em lote; o vídeo só é baixado quando alguém clica (poupa tráfego). */
export function ClipGallery({ clips, cells, marks, nicknames, me }: Props) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const thumbKey = clips.map((c) => c.thumb_path ?? "").join("|");
  useEffect(() => {
    const paths = clips.map((c) => c.thumb_path).filter((p): p is string => !!p);
    if (paths.length === 0) return;
    let cancelled = false;
    void supabase.storage
      .from("clips")
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        for (const row of data) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
        setThumbs(map);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbKey]);

  if (clips.length === 0) return null;

  const markOf = (c: Clip) => marks.find((m) => m.id === c.mark_id);
  const goalOf = (c: Clip) => cells.find((x) => x.idx === markOf(c)?.cell_idx)?.goal_text ?? "…";

  async function play(c: Clip) {
    setError(null);
    const { data, error: e } = await supabase.storage.from("clips").createSignedUrl(c.storage_path, 600);
    if (e || !data) return setError("Não foi possível abrir o clip.");
    setPlaying({ id: c.id, url: data.signedUrl });
  }

  async function remove(c: Clip) {
    setError(null);
    try {
      const path = await api.deleteMyClip(supabase, c.id);
      await supabase.storage.from("clips").remove([path, ...(c.thumb_path ? [c.thumb_path] : [])]);
      if (playing?.id === c.id) setPlaying(null);
    } catch {
      setError("Não foi possível apagar o clip.");
    }
  }

  return (
    <section className="secao">
      <h2>clips ({clips.length})</h2>
      {error && <div className="aviso erro">{error}</div>}
      <ul className="galeria">
        {clips.map((c) => (
          <li key={c.id} className="clip">
            {playing?.id === c.id ? (
              <video className="clip-video" src={playing.url} controls autoPlay />
            ) : (
              <button type="button" className="clip-thumb" onClick={() => void play(c)} aria-label={`Assistir: ${goalOf(c)}`}>
                {c.thumb_path && thumbs[c.thumb_path] ? <img src={thumbs[c.thumb_path]} alt="" /> : <span>▶</span>}
              </button>
            )}
            <div className="clip-info">
              <span>{goalOf(c)}</span>
              <span className="rotulo">
                {nicknames[c.user_id] ?? "?"}
                {c.bytes ? ` · ${(c.bytes / 1024 / 1024).toFixed(1)} MB` : ""}
                {c.user_id === me && (
                  <>
                    {" · "}
                    <button type="button" className="link" onClick={() => void remove(c)}>
                      apagar
                    </button>
                  </>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
