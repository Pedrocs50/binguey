import { useState, type FormEvent } from "react";
import { maxLines, parseInvite, type BoardSize } from "@binguey/shared";
import { Link } from "../components/Link";
import { createRoomAs, validateNickname } from "../lib/actions";
import { errorMessage } from "../lib/errors";
import { navigate } from "../lib/router";
import { getNickname, getRecentRooms } from "../lib/storage";

export function Home() {
  const [nick, setNick] = useState(getNickname);
  const [size, setSize] = useState<BoardSize>(4);
  const [minutes, setMinutes] = useState(60);
  const [target, setTarget] = useState(2);
  const [clips, setClips] = useState<"optional" | "off">("optional");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recent = getRecentRooms();

  async function create(e: FormEvent) {
    e.preventDefault();
    const bad = validateNickname(nick);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      const room = await createRoomAs(nick, { size, durationS: minutes * 60, targetLines: target, clipPolicy: clips });
      navigate(`/r/${room.code}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const parsed = parseInvite(code);
    if (!parsed) return setError("Código inválido: são 6 letras e números (sem 0, O, 1 e I).");
    navigate(`/j/${parsed}`);
  }

  return (
    <>
      <p className="intro">Bingo cooperativo de videogame. Cumpra os objetivos em qualquer jogo, abrindo e fechando jogos como quiser; a sala marca o tabuleiro junto.</p>

      {error && (
        <div className="aviso erro" role="alert">
          {error}
        </div>
      )}

      <section className="secao" aria-labelledby="h-entrar">
        <h2 id="h-entrar">entrar com código</h2>
        <form onSubmit={join}>
          <label className="campo">
            <span className="rotulo">código ou link de convite</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="K7QF2M" autoCapitalize="characters" />
          </label>
          <button className="botao" type="submit">
            continuar
          </button>
        </form>
        {recent.length > 0 && (
          <p className="rotulo" style={{ marginTop: "1rem" }}>
            recentes:{" "}
            {recent.map((r) => (
              <Link key={r.code} href={`/r/${r.code}`} style={{ marginRight: "0.8rem" }}>
                {r.code}
              </Link>
            ))}
          </p>
        )}
      </section>

      <section className="secao" aria-labelledby="h-criar">
        <h2 id="h-criar">criar sala</h2>
        <form onSubmit={create}>
          <label className="campo">
            <span className="rotulo">seu apelido</span>
            <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} autoComplete="nickname" />
          </label>
          <div className="grade-campos">
            <label className="campo">
              <span className="rotulo">tabuleiro</span>
              <select
                value={size}
                onChange={(e) => {
                  const s = Number(e.target.value) as BoardSize;
                  setSize(s);
                  setTarget((t) => Math.min(t, maxLines(s)));
                }}
              >
                <option value={3}>3×3</option>
                <option value={4}>4×4</option>
                <option value={5}>5×5</option>
              </select>
            </label>
            <label className="campo">
              <span className="rotulo">duração</span>
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[15, 30, 60, 90, 120, 180].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span className="rotulo">linhas para vencer</span>
              <input
                type="number"
                min={1}
                max={maxLines(size)}
                value={target}
                onChange={(e) => setTarget(Math.max(1, Math.min(maxLines(size), Number(e.target.value) || 1)))}
              />
            </label>
            <label className="campo">
              <span className="rotulo">clips</span>
              <select value={clips} onChange={(e) => setClips(e.target.value as "optional" | "off")}>
                <option value="optional">opcionais</option>
                <option value="off">desligados</option>
              </select>
            </label>
          </div>
          <button className="botao" type="submit" disabled={busy}>
            {busy ? "criando…" : "criar sala"}
          </button>
        </form>
      </section>
    </>
  );
}
