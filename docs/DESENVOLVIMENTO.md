# Binguey: guia de desenvolvimento

Para jogar e usar o app, veja o [README](../README.md). Este guia é para quem vai mexer no código.

## Estrutura

```
apps/web         React + Vite + TypeScript: o jogo (publicado no Cloudflare Pages) e também a interface do app
apps/desktop     Tauri v2 (Rust): ponte com o OBS, envio de clips, mini-tabuleiro, vídeo final, atualização
packages/shared  tipos, regras de linhas/vitória, escolha dos melhores momentos, cliente Supabase
supabase/        migrations (tabelas, RLS, RPCs), seed.sql (gerado), goals/ (biblioteca), functions/ (limpeza)
scripts/         utilitários (prints do README, teste da limpeza)
docs/            arquitetura, análise e este guia
```

## Rodar localmente

Requisitos: Node 20+, pnpm 9 (`npm i -g pnpm@9.12.3`). Para o app: Rust (rustup) e as Build Tools do Visual Studio
(carga "Desenvolvimento para desktop com C++"). OBS 28+ e ffmpeg para testar clips e o vídeo final.

```bash
pnpm install
pnpm dev          # site em http://localhost:5173
pnpm desktop      # app Tauri (sobe o site junto); a primeira compilação leva uns 3 min
pnpm test         # Vitest (lógica compartilhada)
pnpm typecheck
```

## Backend (Supabase)

1. Crie um projeto (região São Paulo) e ative **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
2. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. No **SQL Editor**, rode em ordem os arquivos de `supabase/migrations/` (0001 a 0008) e depois `supabase/seed.sql`.
4. Limpeza automática: veja [`supabase/functions/purge-expired/README.md`](../supabase/functions/purge-expired/README.md).

Regras do jogo vivem no Postgres (funções RPC `security definer`); o cliente só lê e chama RPCs.

## Biblioteca de objetivos

A fonte é `supabase/goals/library.mjs`. Depois de editar: `node supabase/goals/build.mjs` valida e gera
`supabase/seed.sql`, que se cola no SQL Editor (é idempotente: cria, atualiza e remove objetivos do sistema).
Escreva objetivos que **se vejam num clip de 20 s**.

## Testes

| O quê | Como |
| --- | --- |
| Unitários | `pnpm test` |
| Regras do banco, permissões, sorteio (contra o projeto Supabase do `.env.local`) | `pnpm --filter @binguey/shared smoke` |
| Jogador de teste | `pnpm --filter @binguey/shared bot -- CODIGO Apelido 1,4,7` |
| Ponta a ponta no app, com OBS real | veja [`apps/desktop/README.md`](../apps/desktop/README.md) (`BINGUEY_AUTOTEST=1`) |
| Limpeza automática | `node --env-file=.env.local scripts/purge-check.mjs [AAAA-MM-DD] [--apply]` |
| Prints do README | `node --env-file=.env.local scripts/capture-readme.mjs` |

Teste de mídia precisa **olhar o conteúdo** (o vídeo final já saiu 100% preto com todos os testes verdes).

## Publicar

- **Site:** todo `git push` na `main` publica sozinho no Cloudflare Pages (comando de build
  `pnpm --filter @binguey/web build`, saída `apps/web/dist`; variáveis `NODE_VERSION`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`).
- **App:** suba `version` em `apps/desktop/src-tauri/tauri.conf.json`, depois `git tag vX.Y.Z && git push origin vX.Y.Z`.
  O GitHub Actions (`release.yml`) gera o instalador, o `latest.json` das atualizações e o `sha256.txt`.
  Secrets do repositório: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, e para o keepalive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PURGE_URL`, `PURGE_SECRET`.
  **A chave privada de assinatura não pode ser perdida**: sem ela ninguém que já instalou recebe atualizações.

## Segurança em resumo

- RLS em todas as tabelas; sem políticas de escrita: tudo passa por RPC.
- A chave `anon` é pública por desenho; nenhuma chave de serviço fora do Supabase.
- O app não aceita comandos nem caminhos da interface: o Rust valida e monta tudo (leitura de clips só na pasta de
  gravação do OBS, ffmpeg com argumentos montados no Rust, apagar só na pasta "Binguey").
- O WebSocket do OBS escuta em todas as interfaces (limitação do OBS): a senha é a proteção.
