# Binguey — análise inicial do documento de arquitetura

Base: `BingoClip_Arquitetura.pdf` v1.0 (10/10/2026). O projeto passa a se chamar **Binguey**
(deep link `binguey://j/CODIGO`, pacotes `@binguey/*`). O PDF continua com o nome antigo.

## Veredito

A arquitetura é sólida e o escopo do MVP é realista: Supabase único, UI única em duas cascas,
regras no Postgres, clips efêmeros. A ordem de fases (bingo web jogável antes de qualquer código
de OBS) está certa. Os pontos abaixo são o que eu corrigiria ou decidiria **antes** de construir.

## Pontos que precisam de decisão

1. **Identidade duplicada entre navegador e app (lacuna real).** O convidado entra no navegador
   com login anônimo; ao instalar o app, ele "faz o próprio login anônimo" (seção 7.2). São dois
   `auth.uid()` diferentes: a pessoa aparece duas vezes na sala e as marcações do app não ficam
   no mesmo jogador. Opções:
   - (a) o app é uma identidade nova e a aba web sai da sala (simples, perde histórico);
   - (b) RPC `claim_device(code)`: o navegador gera um código de uso único e o app o resgata,
     assumindo a mesma identidade (recomendado, pequeno);
   - (c) exigir Discord para quem usa o app (mais atrito).
   Sugestão: começar com (a) na Fase 2 e fazer (b) na Fase 3.
2. **Egress é o gargalo de verdade.** A própria tabela da seção 14 mostra ~9 partidas/mês dentro
   dos 5 GB. Para um grupo de amigos serve, mas: carregar o clip só ao clicar (nunca pré-carregar
   a galeria), miniaturas JPEG geradas localmente (o Storage gratuito não redimensiona), e decidir
   cedo o gatilho para migrar ao R2.
3. **Retenção inconsistente no PDF.** Texto diz 24 h após o fim; o esquema usa 48 h fixas. Nas
   migrations: clip expira em `ends_at + 24 h`; sala em 48 h após a criação.
4. **Tempo esgotado não vira estado sozinho.** Nenhuma regra muda `running → finished` por tempo.
   Adicionei `close_if_timeout` (cliente, ao zerar o relógio) e `sweep_rooms` (via `ping`, 12 h).
5. **Objetos órfãos no Storage** quando o jogador apaga um clip: a RPC `delete_my_clip` remove a
   linha, e o app remove o objeto. A Edge Function `purge-expired` (Fase 3) deve também varrer
   objetos sem linha correspondente.
6. **Keepalive só funciona enquanto o GitHub mantém o workflow ativo** (60 dias sem atividade
   desativa agendamentos). Registrado no próprio `keepalive.yml`.
7. **Login anônimo e abuso.** O limite de tentativas em `join_room` é por usuário, e usuário
   anônimo é descartável. Ligar CAPTCHA no login anônimo (Supabase Auth) antes de divulgar o link.
8. **Tauri no Windows**: o deep link exige o plugin `single-instance` para entregar o link a uma
   instância já aberta; o CSP precisa liberar `ws://127.0.0.1:4455` e o domínio Supabase.

## Mudanças em relação ao SQL do PDF

- RPCs recebem `int` (não `smallint`): `supabase-js`/testes passam literais inteiros.
- `upsert_profile`: login anônimo não tem apelido; o perfil é criado ao entrar.
- `rooms.result` (`won`/`timeout`) e `finished_at`.
- `profiles` legível só por quem divide sala (`shares_room`); sem isso o apelido não aparece.
- `events` com RLS ligada e sem policy: só service role e views (analytics).
- Permissões: `revoke` de `EXECUTE` para `anon`/`public`; só `ping` e `server_time` ficam abertos
  (o keepalive usa a anon key).
- `start_room` aceita objetivos personalizados e filtro de jogos; falta de objetivos aborta e
  desfaz a transação (`not_enough_goals`).
- Limites: 3 salas abertas por anfitrião, 10 tentativas de entrada/min, 12 marcações/min,
  10 clips por jogador, 50 MB por arquivo.
- O nome do objeto no Storage é `{room}/{user}/{mark}.mp4` (o bucket já se chama `clips`).

## Estado atual (o que existe e o que não foi validado)

| Item | Estado |
| --- | --- |
| `packages/shared` (linhas, código de sala, convites, cliente) | testes Vitest rodando |
| `supabase/migrations` + `seed.sql` | escritos, **não executados** (sem Docker/CLI instalados) |
| `supabase/tests/rules.test.sql` (pgTAP) | escrito, **não executado** |
| `apps/web` | só um placeholder que importa o pacote compartilhado |
| `apps/desktop` | não iniciado (sem Rust instalado) |

## Spikes

| Spike | Resultado |
| --- | --- |
| **S1** — salvar replay por comando e achar o arquivo | **Passou** (10/10/2026, OBS 32.2.2, obs-websocket 5.7.4): `SaveReplayBuffer` + evento `ReplayBufferSaved` entregou o caminho em 651 ms; arquivo dentro de `GetRecordDirectory`. `StartReplayBuffer` por comando funciona se o Replay Buffer estiver habilitado nas configurações (senão erro 604). Script: `apps/desktop/spikes/s1-obs-replay.mjs`. |

Pendências do S1:
- Ler a senha/porta do OBS automaticamente **não foi testado** (por ora o app pede a senha uma vez).
- O clip do teste tinha só ~3 s (buffer recém-ligado): medir o tamanho real de um buffer cheio de 20 s.
- No modo de saída Simples, o replay usa o bitrate da transmissão (6000 kbps no PC de teste, ~15 MB por 20 s,
  o dobro dos 7,5 MB previstos). Plano: o assistente cria um **perfil do OBS dedicado** ao Binguey
  (720p, 3 Mbps) por WebSocket, sem tocar no perfil normal do usuário. A validar no S1b.

## Próximos passos

1. Criar projeto Supabase **dev** em São Paulo e aplicar as migrations (`supabase db push`);
   rodar `supabase test db`. Habilitar login anônimo.
2. Spike S4 (latência Realtime) com dois navegadores.
3. Fase 1: telas de entrar/lobby/tabuleiro, assinatura Realtime, relógio com `server_time`.
4. Em paralelo, spike S1 (script que salva o replay do OBS) para destravar a Fase 2.
