use std::{
    fs,
    io::Write,
    path::PathBuf,
    sync::Mutex,
};
use tauri::{ipc::Response, AppHandle, State};

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
        .manage(RecordDir::default())
        .invoke_handler(tauri::generate_handler![
            set_record_dir,
            read_clip,
            dev_config,
            dev_report,
            dev_exit
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o app Binguey");
}
