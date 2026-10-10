import { useEffect, useState } from "react";

export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Contagem regressiva local sobre o `ends_at` do servidor. Avisa quando chega a zero. */
export function Relogio({ endsAt, offset, onZero }: { endsAt: string; offset: number; onZero: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((Date.parse(endsAt) - (now + offset)) / 1000));

  // Enquanto a sala continuar 'running' depois de zerar, tenta fechar a cada 2 s.
  useEffect(() => {
    if (remaining > 0) return;
    onZero();
    const id = setInterval(onZero, 2000);
    return () => clearInterval(id);
  }, [remaining, onZero]);

  return (
    <span className={`relogio${remaining === 0 ? " fim" : ""}`} role="timer" aria-live="off">
      {formatTime(remaining)}
    </span>
  );
}
