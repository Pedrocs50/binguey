# Binguey

Bingo cooperativo de videogame com clips automáticos. Um grupo entra numa sala, recebe o mesmo
tabuleiro de objetivos e cada um joga o seu jogo; ao marcar uma casa, o app (via OBS) salva os
últimos segundos e o clip aparece na sala. Custo zero: Supabase + Cloudflare Pages + GitHub.

Documento de arquitetura original: [docs/BingoClip_Arquitetura.pdf](docs/BingoClip_Arquitetura.pdf)
(nome antigo: BingoClip). Análise e decisões em aberto: [docs/analise-inicial.md](docs/analise-inicial.md).

## Estrutura

```
apps/web         React + Vite + TS (UI do bingo, publicada no Cloudflare Pages)
apps/desktop     Tauri v2 (Fase 2: ponte com o OBS)
packages/shared  tipos, regras de linhas/vitória, códigos de sala, cliente Supabase
supabase/        migrations (tabelas, RLS, RPCs), seed, testes pgTAP
docs/            arquitetura, análise, ADRs
```

## Começando

Requisitos: Node 20+, pnpm 9 (`npm i -g pnpm`).

```bash
pnpm install
pnpm test        # Vitest no pacote compartilhado
pnpm dev         # front em http://localhost:5173
```

Backend: crie um projeto Supabase (dev, região São Paulo), ative o login anônimo, copie
`.env.example` para `.env.local` e aplique `supabase/migrations/` com a CLI do Supabase.
