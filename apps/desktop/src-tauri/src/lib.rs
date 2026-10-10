use std::{
    fs,
    io::Write,
    path::PathBuf,
    sync::Mutex,
};
use std::process::{Command, Stdio};
use tauri::{ipc::Response, AppHandle, Emitter, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;

const MAX_CLIP_BYTES: u64 = 50 * 1024 * 1024; // limite por arquivo do Storage gratuito

/// Pasta de gravação do OBS, informada pelo próprio OBS (GetRecordDirectory).
#[derive(Default)]
struct RecordDir(Mutex<Option<PathBuf>>);

#[tauri::command]
fn set_record_dir(dir: String, state: State<RecordDir>) -> Result<String, String> {
    let path = fs::canonicalize(&dir).map_err(|e| format!("pasta inválida: {e}"))?;
    if !path.is_dir() {
        return Err("o caminho não é uma pasta".into());
    }
    *state.0.lock().unwrap() = Some(path.clone());
    Ok(path.display().to_string())
}

/// Lê um clip. Só aceita arquivo .mp4/.mkv de até 50 MB dentro da pasta de gravação do OBS.
#[tauri::command]
fn read_clip(path: String, state: State<RecordDir>) -> Result<Response, String> {
    let dir = state
        .0
        .lock()
        .unwrap()
        .clone()
        .ok_or("a pasta de gravação ainda não foi definida")?;
    // canonicalize resolve "..", links simbólicos e caixa; só depois comparamos o prefixo.
    let file = fs::canonicalize(&path).map_err(|e| format!("arquivo inválido: {e}"))?;
    if !file.starts_with(&dir) {
        return Err("arquivo fora da pasta de gravação do OBS".into());
    }
    let ext = file
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext != "mp4" && ext != "mkv" {
        return Err(format!("extensão não permitida: .{ext}"));
    }
    let len = fs::metadata(&file).map_err(|e| e.to_string())?.len();
    if len > MAX_CLIP_BYTES {
        return Err(format!("arquivo grande demais: {len} bytes"));
    }
    fs::read(&file).map(Response::new).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct ObsWebsocketConfig {
    enabled: bool,
    port: u16,
    auth_required: bool,
    password: String,
}

/// Lê a configuração do WebSocket do OBS (arquivo fixo, somente leitura) para o jogador não ter de
/// digitar a senha. Só esse arquivo é lido; o caminho não vem da interface.
#[tauri::command]
fn read_obs_websocket_config() -> Result<ObsWebsocketConfig, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA indisponível".to_string())?;
    let path = PathBuf::from(appdata)
        .join("obs-studio")
        .join("plugin_config")
        .join("obs-websocket")
        .join("config.json");
    let text = fs::read_to_string(&path).map_err(|_| "configuração do OBS não encontrada".to_string())?;
    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|_| "configuração do OBS ilegível".to_string())?;
    Ok(ObsWebsocketConfig {
        enabled: json["server_enabled"].as_bool().unwrap_or(false),
        port: json["server_port"].as_u64().unwrap_or(4455) as u16,
        auth_required: json["auth_required"].as_bool().unwrap_or(true),
        password: json["server_password"].as_str().unwrap_or("").to_string(),
    })
}

// ---- Abrir o OBS --------------------------------------------------------------------------------

#[cfg(windows)]
fn hide_console(cmd: &mut Command) -> &mut Command {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000) // CREATE_NO_WINDOW
}
#[cfg(not(windows))]
fn hide_console(cmd: &mut Command) -> &mut Command {
    cmd
}

fn obs_is_running() -> bool {
    let mut cmd = Command::new("tasklist");
    hide_console(&mut cmd).args(["/FI", "IMAGENAME eq obs64.exe", "/NH"]);
    cmd.output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase().contains("obs64.exe"))
        .unwrap_or(false)
}

/// Abre o OBS (instalação padrão) com o Replay Buffer ligado. Não recebe caminho da interface.
/// Erros: "ja_aberto" (o OBS já está rodando) e "nao_encontrado".
#[tauri::command]
fn launch_obs() -> Result<String, String> {
    if obs_is_running() {
        return Err("ja_aberto".into());
    }
    let mut roots: Vec<PathBuf> = Vec::new();
    for (var, sub) in [
        ("ProgramFiles", "obs-studio"),
        ("ProgramFiles(x86)", "obs-studio"),
        ("LOCALAPPDATA", "Programs\\obs-studio"),
        ("ProgramFiles(x86)", "Steam\\steamapps\\common\\OBS Studio"),
    ] {
        if let Ok(base) = std::env::var(var) {
            roots.push(PathBuf::from(base).join(sub));
        }
    }
    let bin = roots
        .iter()
        .map(|r| r.join("bin").join("64bit"))
        .find(|d| d.join("obs64.exe").is_file())
        .ok_or("nao_encontrado")?;
    // O OBS precisa abrir com a pasta bin\64bit como diretório atual.
    Command::new(bin.join("obs64.exe"))
        .current_dir(&bin)
        .args(["--startreplaybuffer", "--disable-shutdown-check"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("falha ao abrir o OBS: {e}"))?;
    Ok(bin.join("obs64.exe").display().to_string())
}

// ---- Deep link: binguey://j/CODIGO --------------------------------------------------------------

/// Último link recebido, para a interface buscar caso o evento chegue antes dela estar pronta.
#[derive(Default)]
struct PendingLink(Mutex<Option<String>>);

#[tauri::command]
fn take_pending_link(state: State<PendingLink>) -> Option<String> {
    state.0.lock().unwrap().take()
}

fn handle_links(app: &AppHandle, urls: Vec<String>) {
    // Só repassa o esquema do app; quem valida o formato do código é a interface (parseInvite).
    if let Some(url) = urls.into_iter().find(|u| u.starts_with("binguey://")) {
        *app.state::<PendingLink>().0.lock().unwrap() = Some(url.clone());
        let _ = app.emit("binguey-deeplink", url);
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

// ---- Auxiliares de desenvolvimento (desligados em release) ------------------------------------------

#[derive(serde::Serialize)]
struct DevConfig {
    password: String,
    auto: bool,
}

/// Senha do OBS e modo automático vêm de variáveis de ambiente, somente em debug.
#[tauri::command]
fn dev_config() -> DevConfig {
    if cfg!(debug_assertions) {
        DevConfig {
            password: std::env::var("OBS_PASSWORD").unwrap_or_default(),
            auto: std::env::var("BINGUEY_AUTOTEST").is_ok(),
        }
    } else {
        DevConfig { password: String::new(), auto: false }
    }
}

/// Acrescenta uma linha ao arquivo indicado por BINGUEY_AUTOTEST_OUT (só em debug).
#[tauri::command]
fn dev_report(line: String) {
    if !cfg!(debug_assertions) {
        return;
    }
    if let Ok(out) = std::env::var("BINGUEY_AUTOTEST_OUT") {
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(out) {
            let _ = writeln!(f, "{line}");
        }
    }
}

#[tauri::command]
fn dev_exit(app: AppHandle) {
    if cfg!(debug_assertions) {
        app.exit(0);
    }
}

pub fn run() {
    tauri::Builder::default()
        // Deve ser o primeiro plugin: um segundo clique em convite entrega o link à janela já aberta.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .manage(RecordDir::default())
        .manage(PendingLink::default())
        .setup(|app| {
            // Em desenvolvimento o instalador não existe: registra o esquema binguey:// em tempo de execução.
            #[cfg(debug_assertions)]
            let _ = app.deep_link().register_all();
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                handle_links(app.handle(), urls.iter().map(|u| u.to_string()).collect());
            }
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                handle_links(&handle, event.urls().iter().map(|u| u.to_string()).collect());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_record_dir,
            read_clip,
            read_obs_websocket_config,
            launch_obs,
            take_pending_link,
            dev_config,
            dev_report,
            dev_exit
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o app Binguey");
}
