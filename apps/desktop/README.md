# apps/desktop — app Tauri v2

Mostra a mesma interface do site (`apps/web`) e acrescenta o que o navegador não pode fazer:
falar com o OBS (WebSocket local) e ler o clip gravado por ele.

## Rodar

Pré-requisitos: Rust (rustup), Build Tools do Visual Studio (C++), WebView2, OBS 28+.

```bash
pnpm --filter @binguey/desktop tauri dev      # sobe o site (Vite) e abre o app
```

Primeira compilação: ~3 min. A senha do WebSocket do OBS é digitada no app (fica só no computador).

## Só o app e o OBS

- **Convite abre o app:** links `binguey://j/CODIGO` (botão "abrir no app" na página do convite) levam
  direto à tela de entrada da sala. Uma única instância do app: um segundo clique é entregue à janela aberta.
  A interface só aceita códigos de 6 caracteres do alfabeto de salas (`parseInvite`); o resto é ignorado.
  Em desenvolvimento o app registra o esquema em `HKCU\Software\Classes\binguey` (apontando para o
  executável de debug); na versão instalada, o instalador faz isso.
- **Senha do OBS:** lida de `%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json` (comando
  `read_obs_websocket_config`); ninguém digita nada.
- **OBS fechado:** o app o abre sozinho (comando `launch_obs`: instalação padrão, `--startreplaybuffer`,
  sem receber caminho da interface). Se o OBS já está aberto mas o WebSocket não responde, mostra como ativar.

## Como funciona um clip

1. O jogador toca na casa → `mark_cell` (RPC) e, em paralelo, uma espera de 2 s (pós-roll).
2. `SaveReplayBuffer` no OBS → evento `ReplayBufferSaved` traz o caminho do arquivo.
3. O comando Rust `read_clip` lê o arquivo (só `.mp4`/`.mkv` ≤ 50 MB dentro da pasta de gravação do OBS).
4. Envia ao bucket privado `clips` (`{sala}/{usuário}/{marcação}.mp4`) + miniatura JPEG e chama `attach_clip`.
5. Falhou? Fila persistida com reenvio exponencial (5 tentativas). Se a marcação perdeu a corrida
   ("alguém marcou primeiro"), o clip é descartado.

Código: `apps/web/src/lib/{obs,obsStore,clips}.ts`, `components/{ObsPanel,ClipGallery}.tsx`,
comandos Rust em `src-tauri/src/lib.rs`, permissões em `src-tauri/capabilities/default.json`.

## Teste ponta a ponta automático (só debug)

Com o OBS aberto (WebSocket e Replay Buffer ativados) e `OBS_PASSWORD` no `.env.local`:

```bash
BINGUEY_AUTOTEST=1 BINGUEY_AUTOTEST_OUT=e2e.txt node --env-file=../../.env.local node_modules/@tauri-apps/cli/tauri.js dev
```

O app cria uma sala, marca uma casa, espera o clip aparecer, baixa por URL assinada, confere que uma
marcação perdida não gera clip, escreve o relatório em `e2e.txt` e fecha. Em release esses comandos
(`dev_config`, `dev_report`, `dev_exit`) ficam desligados.

## Spikes

`spikes/s1-obs-replay.mjs` — salva um replay por comando, sem o app (ver `docs/analise-inicial.md`).
