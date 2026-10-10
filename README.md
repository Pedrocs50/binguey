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

## Publicar uma versão do app

1. Suba a versão em `apps/desktop/src-tauri/tauri.conf.json` (campo `version`).
2. `git tag vX.Y.Z && git push origin vX.Y.Z`: o GitHub Actions monta o instalador e cria a Release.
3. Quem já tem o app recebe o aviso "Nova versão" e atualiza com um clique (assinado com a chave do Tauri).

Secrets do repositório: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` (release) e `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PURGE_URL`, `PURGE_SECRET` (keepalive).
**Guarde a chave privada de assinatura** (fora do repositório): sem ela não é possível publicar atualizações
para quem já instalou.
