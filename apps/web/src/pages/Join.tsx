import { useState, type FormEvent } from "react";
import { isValidRoomCode, normalizeRoomCode } from "@binguey/shared";
import { Link } from "../components/Link";
import { joinRoomAs, validateNickname } from "../lib/actions";
import { errorMessage } from "../lib/errors";
import { navigate } from "../lib/router";
import { getNickname } from "../lib/storage";

export function Join({ code: raw }: { code: string }) {
  const code = normalizeRoomCode(raw);
  const [nick, setNick] = useState(getNickname);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isValidRoomCode(code)) {
    return (
      <>
        <div className="aviso erro">Esse link de convite não é válido.</div>
        <Link href="/">voltar ao início</Link>
      </>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const bad = validateNickname(nick);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      await joinRoomAs(nick, code);
      navigate(`/r/${code}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <p className="intro">
        Você foi convidado para a sala <span className="codigo">{code}</span>.
      </p>
      {error && (
        <div className="aviso erro" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={submit}>
        <label className="campo">
          <span className="rotulo">seu apelido</span>
          <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} autoFocus autoComplete="nickname" />
          <span className="rotulo dica">sem e-mail, sem senha</span>
        </label>
        <button className="botao" type="submit" disabled={busy}>
          {busy ? "entrando…" : "entrar"}
        </button>
      </form>
    </>
  );
}
