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

## Estado atual (10/10/2026)

| Item | Estado |
| --- | --- |
| `packages/shared` (linhas, código de sala, convites, cliente) | 9 testes Vitest passando |
| `supabase/migrations` 0001–0006 + `seed.sql` | aplicados no projeto dev; 27 verificações em `pnpm --filter @binguey/shared smoke` passando |
| `supabase/tests/rules.test.sql` (pgTAP) | escrito, **não executado** (sem Docker/CLI do Supabase) |
| `apps/web` | jogo completo: entrar por link, lobby, tabuleiro em tempo real, timer, vitória, encerrar partida, galeria de clips |
| `apps/desktop` | app Tauri: OBS (abre sozinho, senha lida da config, perfil dedicado), envio de clips, deep link |
| Teste ponta a ponta no app com OBS real (`apps/desktop/README.md`) | 8 verificações passando (clip visível em ~3,6 s) |
| Não feito | vídeo final, limpeza automática no servidor, instalador/atualização/assinatura, publicação, estatísticas, testes com jogo real e com vários jogadores |

## Spikes

| Spike | Resultado |
| --- | --- |
| **S1** — salvar replay por comando e achar o arquivo | **Passou** (10/10/2026, OBS 32.2.2, obs-websocket 5.7.4): `SaveReplayBuffer` + evento `ReplayBufferSaved` entregou o caminho em 651 ms; arquivo dentro de `GetRecordDirectory`. `StartReplayBuffer` por comando funciona se o Replay Buffer estiver habilitado nas configurações (senão erro 604). Script: `apps/desktop/spikes/s1-obs-replay.mjs`. |

| **S2** — app Tauri conecta no OBS e lê o arquivo com permissões mínimas | **Passou** (10/10/2026, Tauri 2, Rust 1.99): o WebView conectou em `ws://127.0.0.1:4455` com a CSP `connect-src ... ws://127.0.0.1:4455` (sem outras permissões além de `core:default`); o comando Rust `read_clip` leu um clip de 9,26 MB (assinatura `ftyp` ok) em 763 ms somando salvar+ler, e **recusou** `C:/Windows/win.ini` e um caminho com `..`. Primeira compilação: 3 min 26 s. Código: `apps/desktop/src-tauri` e `apps/desktop/ui`. |

Notas do S2:
- `read_clip` só lê `.mp4`/`.mkv` de até 50 MB dentro da pasta informada pelo OBS (`GetRecordDirectory`),
  comparando caminhos já canonicalizados (resolve `..`, links e caixa). A pasta é definida pelo próprio
  WebView; o modelo de ameaça é o da UI local empacotada com CSP restritiva (não carrega página remota).
- A senha do OBS só chega ao app por variável de ambiente em build de debug (`spike_config`); em release
  o assistente pede a senha ao usuário e a guarda localmente.
- O CSP do app **não** precisou de `unsafe-eval` nem de domínios externos para falar com o OBS.

| **S1b** — perfil dedicado do OBS por WebSocket | **Passou** (10/10/2026): cria o perfil "Binguey" (saída 720p mantendo a proporção da tela, 30 fps, 3 Mbps, buffer de 20 s, pasta `Vídeos\Binguey`), reaproveita o encoder do perfil do jogador, recarrega o perfil para o OBS criar a saída do Replay Buffer e **devolve o perfil original** ao desativar, ao fechar o app e se algo falhar. Replays ficam guardados por padrão; "apagar depois de enviar" e "limpar agora" são opções do jogador e só atuam na pasta chamada `Binguey`. |

Pendências do S1:
- Senha/porta do OBS: **resolvido**. O OBS guarda `server_enabled`, `server_port`, `server_password` e
  `auth_required` em `%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json`; o comando Rust
  `read_obs_websocket_config` lê só esse arquivo e o app conecta sem o jogador digitar nada.
- **Correção ao PDF:** o WebSocket do OBS escuta em `0.0.0.0:4455` (todas as interfaces), não só em
  `127.0.0.1`, e o OBS não tem opção para restringir. A senha (auth_required) é a proteção; orientar a
  não liberar o OBS no firewall do Windows para redes públicas.
- Buffer cheio de 20 s a 6000 kbps (tela de monitor quase parada): **10,4 MB em 624 ms**. Com jogo em
  movimento deve chegar perto de 15 MB; medir num jogo real (S3). O primeiro teste deu só 2,3 MB porque
  o script tinha acabado de ligar o buffer.
- No modo de saída Simples, o replay usa o bitrate da transmissão (6000 kbps no PC de teste, ~15 MB por 20 s,
  o dobro dos 7,5 MB previstos). Plano: o assistente cria um **perfil do OBS dedicado** ao Binguey
  (720p, 3 Mbps) por WebSocket, sem tocar no perfil normal do usuário. A validar no S1b.

## Fase 2 — app e clips (implementada em 10/10/2026)

Teste ponta a ponta automático no app Tauri com o OBS real (`apps/desktop/README.md`):

| Critério | Resultado |
| --- | --- |
| Clip visível na sala ≤ 10 s após a marcação | **3,96 s** (inclui 2 s de pós-roll) |
| Clip de 15,5 s, 11,4 MB, miniatura gerada | ok |
| Download pelo Storage com URL assinada (privado) | ok (HTTP 206, MP4 válido) |
| Marcação perdida ("alguém marcou primeiro") não gera clip | ok |
| `clips_active` na sala | **pendente**: exige aplicar `supabase/migrations/20261010000500_clips_active.sql` |

Ainda **não testado**: jogo real em tela cheia (S3), conexão de internet caindo no meio do envio
(fila existe, mas não foi forçada a falhar), mais de um jogador com clips ao mesmo tempo, vídeo final
(Fase 3), instalador/atualização/assinatura (Fase 3).

Decisões tomadas:
- O app **não apaga** os arquivos que o OBS grava; eles se acumulam na pasta de gravação. Solução
  prevista: o perfil dedicado do S1b grava numa pasta temporária própria.
- O app é uma identidade nova (login anônimo próprio, outro armazenamento que o navegador): é a opção
  (a) da seção "Pontos que precisam de decisão". A (b), `claim_device`, fica para a Fase 3.
- CSP do app libera apenas `self`, `ws://127.0.0.1:4455` e `*.supabase.co` (https/wss).

## A ideia central: qualquer jogo (esclarecida em 10/10/2026)

O bingo é para **cumprir os objetivos em qualquer jogo**; o jogador abre e fecha jogos durante a partida.
Consequências já implementadas:
- **Biblioteca**: ~75 objetivos genéricos (servem para qualquer jogo, incluindo "jogar um jogo que nunca abriu"
  e "voltar a um jogo de hoje") + extras de 15 jogos. Migration `0007_goal_library.sql` (idempotente).
- **Sorteio**: sem escolher jogos, o tabuleiro usa **só** objetivos genéricos; jogos específicos são extra
  opcional do anfitrião (antes, "vazio = todos" misturava Minecraft com Elden Ring).
- **Captura**: o app monta no OBS uma coleção de cenas "Binguey" com uma fonte que acompanha qualquer jogo:
  monitor principal (padrão; serve para janela e tela cheia) ou Captura de Jogo em "qualquer aplicativo em
  tela cheia" (só o jogo, mas não pega janela comum) ou a cena do próprio jogador. Perfil e cena do jogador
  são devolvidos ao desativar, ao fechar o app e em falhas; se o OBS está transmitindo/gravando, não mexe.
- **Pós-roll** reduzido de 2 s para 0,5 s e miniatura do meio do clip: o jogador cumpre o objetivo no jogo e
  só depois volta ao app para marcar; o que importa está antes do clique.

Decisão pendente (maior impacto de usabilidade): **marcar sem sair do jogo**. Hoje é preciso dar Alt+Tab
para clicar na casa. Proposta: mini-tabuleiro sempre-no-topo (segunda janela do app) aberto por atalho global.
Funciona em janela sem bordas; em tela cheia exclusiva depende do jogo.

## Próximos passos

1. Criar projeto Supabase **dev** em São Paulo e aplicar as migrations (`supabase db push`);
   rodar `supabase test db`. Habilitar login anônimo.
2. Spike S4 (latência Realtime) com dois navegadores.
3. Fase 1: telas de entrar/lobby/tabuleiro, assinatura Realtime, relógio com `server_time`.
4. Em paralelo, spike S1 (script que salva o replay do OBS) para destravar a Fase 2.
