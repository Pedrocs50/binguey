//! Vídeo final: monta os clips escolhidos em um MP4 com legendas, chamando o ffmpeg como processo separado.
//!
//! Segurança: a interface NÃO passa argumentos nem caminhos ao ffmpeg. Ela envia uma lista de segmentos
//! (URL assinada do Storage + duas linhas de legenda); este módulo valida e monta o comando sozinho, e o
//! arquivo de saída sempre cai em Vídeos\Binguey.
use std::{
    fs,
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    time::Instant,
};
use tauri::{AppHandle, Emitter, State};

const MAX_SEGMENTS: usize = 16;

#[derive(Default)]
pub struct LastRender(Mutex<Option<PathBuf>>);

#[cfg(windows)]
fn quiet(cmd: &mut Command) -> &mut Command {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000) // CREATE_NO_WINDOW
}
#[cfg(not(windows))]
fn quiet(cmd: &mut Command) -> &mut Command {
    cmd
}

fn works(exe: &Path) -> bool {
    let mut cmd = Command::new(exe);
    quiet(&mut cmd).arg("-version").stdout(Stdio::null()).stderr(Stdio::null());
    cmd.status().map(|s| s.success()).unwrap_or(false)
}

/// Procura o ffmpeg: PATH, atalhos do winget, pacote do winget e pastas comuns.
fn locate_ffmpeg() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = vec![PathBuf::from("ffmpeg")];
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let winget = PathBuf::from(local).join("Microsoft").join("WinGet");
        candidates.push(winget.join("Links").join("ffmpeg.exe"));
        if let Ok(pkgs) = fs::read_dir(winget.join("Packages")) {
            for pkg in pkgs.flatten().filter(|p| p.file_name().to_string_lossy().starts_with("Gyan.FFmpeg")) {
                if let Ok(builds) = fs::read_dir(pkg.path()) {
                    for b in builds.flatten() {
                        candidates.push(b.path().join("bin").join("ffmpeg.exe"));
                    }
                }
            }
        }
    }
    if let Ok(pf) = std::env::var("ProgramFiles") {
        candidates.push(PathBuf::from(pf).join("ffmpeg").join("bin").join("ffmpeg.exe"));
    }
    candidates.push(PathBuf::from("C:\\ffmpeg\\bin\\ffmpeg.exe"));
    candidates.into_iter().find(|c| works(c))
}

fn ffprobe_of(ffmpeg: &Path) -> PathBuf {
    match ffmpeg.parent() {
        Some(dir) if !dir.as_os_str().is_empty() => dir.join("ffprobe.exe"),
        _ => PathBuf::from("ffprobe"),
    }
}

/// Caminho do ffmpeg instalado, ou nulo se não houver.
#[tauri::command]
pub fn find_ffmpeg() -> Option<String> {
    locate_ffmpeg().map(|p| p.display().to_string())
}

/// Instala o ffmpeg pelo winget (pacote Gyan.FFmpeg). Só roda quando o jogador clica no botão.
#[tauri::command(async)]
pub fn install_ffmpeg() -> Result<String, String> {
    let mut cmd = Command::new("winget");
    quiet(&mut cmd)
        .args([
            "install", "--id", "Gyan.FFmpeg", "-e", "--silent",
            "--accept-source-agreements", "--accept-package-agreements",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    let status = cmd
        .status()
        .map_err(|_| "O winget não está disponível neste Windows. Instale o ffmpeg em ffmpeg.org e tente de novo.".to_string())?;
    // Código 0 = instalado; o winget também usa um código próprio para "já instalado".
    if !status.success() && locate_ffmpeg().is_none() {
        return Err(format!("A instalação pelo winget falhou (código {}).", status.code().unwrap_or(-1)));
    }
    locate_ffmpeg().map(|p| p.display().to_string()).ok_or_else(|| {
        "Instalei, mas não achei o ffmpeg. Feche e abra o app de novo.".to_string()
    })
}

#[derive(serde::Deserialize)]
pub struct Segment {
    url: String,
    line1: String,
    line2: String,
    duration_ms: u64,
}

#[derive(serde::Deserialize)]
pub struct RenderPlan {
    segments: Vec<Segment>,
    title: String,
}

#[derive(serde::Serialize)]
pub struct RenderResult {
    path: String,
    seconds: f64,
    bytes: u64,
    encoder: String,
    duration_s: f64,
    /// Fração do vídeo que está preta (0..1). Perto de 1 = a captura do OBS não pegou imagem.
    black_ratio: f64,
}

fn valid_url(url: &str) -> bool {
    url.starts_with("https://")
        && url.contains(".supabase.co/storage/v1/")
        && url.len() < 2048
        && !url.chars().any(|c| c.is_control() || c == ' ')
}

fn clean(text: &str, max: usize) -> String {
    text.chars().filter(|c| !c.is_control()).take(max).collect()
}

fn has_audio(ffprobe: &Path, url: &str) -> bool {
    let mut cmd = Command::new(ffprobe);
    quiet(&mut cmd).args(["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", url]);
    cmd.output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("audio"))
        .unwrap_or(false)
}

/// Escolhe o melhor encoder H.264 disponível: libx264, depois hardware, depois o do Windows.
fn pick_encoder(ffmpeg: &Path) -> (String, Vec<String>) {
    let mut cmd = Command::new(ffmpeg);
    quiet(&mut cmd).args(["-hide_banner", "-encoders"]);
    let list = cmd.output().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
    let s = |v: &[&str]| v.iter().map(|x| x.to_string()).collect::<Vec<_>>();
    if list.contains("libx264") {
        ("libx264".into(), s(&["-c:v", "libx264", "-preset", "veryfast", "-crf", "22"]))
    } else if list.contains("h264_nvenc") {
        ("h264_nvenc".into(), s(&["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "23"]))
    } else if list.contains("h264_qsv") {
        ("h264_qsv".into(), s(&["-c:v", "h264_qsv", "-global_quality", "23"]))
    } else if list.contains("h264_amf") {
        ("h264_amf".into(), s(&["-c:v", "h264_amf", "-quality", "quality"]))
    } else {
        ("h264_mf".into(), s(&["-c:v", "h264_mf", "-b:v", "5M"]))
    }
}

fn font_path() -> String {
    let windir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
    for name in ["consola.ttf", "segoeui.ttf", "arial.ttf"] {
        let p = Path::new(&windir).join("Fonts").join(name);
        if p.is_file() {
            // No filtro do ffmpeg, "/" separa pastas e ":" precisa de escape.
            return p.display().to_string().replace('\\', "/").replace(':', "\\:");
        }
    }
    "C\\:/Windows/Fonts/arial.ttf".into()
}

fn videos_dir() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE").map_err(|_| "USERPROFILE indisponível".to_string())?;
    let dir = PathBuf::from(home).join("Videos").join("Binguey");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Monta o vídeo final. Emite "binguey-render-progress" (0..100) enquanto o ffmpeg trabalha.
#[tauri::command(async)]
pub fn render_highlights(app: AppHandle, plan: RenderPlan, last: State<LastRender>) -> Result<RenderResult, String> {
    let started = Instant::now();
    if plan.segments.is_empty() || plan.segments.len() > MAX_SEGMENTS {
        return Err(format!("A lista precisa ter de 1 a {MAX_SEGMENTS} clips."));
    }
    if let Some(bad) = plan.segments.iter().find(|s| !valid_url(&s.url)) {
        return Err(format!("Endereço de clip não permitido: {}", clean(&bad.url, 60)));
    }
    let ffmpeg = locate_ffmpeg().ok_or("ffmpeg_ausente")?;
    let ffprobe = ffprobe_of(&ffmpeg);
    let (encoder, enc_args) = pick_encoder(&ffmpeg);

    let work = std::env::temp_dir().join(format!("binguey-render-{}", started.elapsed().as_nanos() ^ std::process::id() as u128));
    fs::create_dir_all(&work).map_err(|e| e.to_string())?;
    let font = font_path();

    // Um arquivo de legenda por clip (evita escapar texto do usuário dentro do filtro).
    let mut graph = String::new();
    let mut concat_inputs = String::new();
    let mut total_ms: u64 = 0;
    for (i, seg) in plan.segments.iter().enumerate() {
        let caption = format!("{}\n{}", clean(&seg.line1, 90), clean(&seg.line2, 60));
        fs::write(work.join(format!("cap{i}.txt")), caption).map_err(|e| e.to_string())?;
        let dur = (seg.duration_ms.max(1000) as f64) / 1000.0;
        total_ms += seg.duration_ms.max(1000);
        graph.push_str(&format!(
            "[{i}:v:0]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,\
             setsar=1,fps=30,format=yuv420p,\
             drawtext=fontfile='{font}':textfile=cap{i}.txt:expansion=none:fontcolor=white:fontsize=26:line_spacing=6:\
             box=1:boxcolor=black@0.55:boxborderw=14:x=28:y=h-th-28[v{i}];"
        ));
        if has_audio(&ffprobe, &seg.url) {
            graph.push_str(&format!("[{i}:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a{i}];"));
        } else {
            graph.push_str(&format!("anullsrc=r=48000:cl=stereo,atrim=duration={dur:.3}[a{i}];"));
        }
        concat_inputs.push_str(&format!("[v{i}][a{i}]"));
    }
    graph.push_str(&format!("{concat_inputs}concat=n={}:v=1:a=1[v][a]", plan.segments.len()));

    let safe_title: String = plan
        .title
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == ' ' || *c == '-')
        .take(40)
        .collect();
    let stamp = {
        let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        format!("{secs}")
    };
    let out = videos_dir()?.join(format!("Binguey {} {}.mp4", safe_title.trim(), stamp));

    let mut cmd = Command::new(&ffmpeg);
    quiet(&mut cmd).current_dir(&work).args(["-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-y"]);
    for seg in &plan.segments {
        cmd.args(["-i", &seg.url]);
    }
    cmd.args(["-filter_complex", &graph, "-map", "[v]", "-map", "[a]"])
        .args(&enc_args)
        .args(["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"])
        .arg(&out)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("não consegui iniciar o ffmpeg: {e}"))?;

    let stderr = child.stderr.take();
    let err_thread = std::thread::spawn(move || {
        let mut text = String::new();
        if let Some(mut s) = stderr {
            let _ = s.read_to_string(&mut text);
        }
        text
    });
    if let Some(stdout) = child.stdout.take() {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(us) = line.strip_prefix("out_time_us=").or_else(|| line.strip_prefix("out_time_ms=")) {
                if let Ok(us) = us.trim().parse::<u64>() {
                    let pct = ((us as f64 / 1000.0) / total_ms as f64 * 100.0).clamp(0.0, 99.0);
                    let _ = app.emit("binguey-render-progress", pct as u32);
                }
            }
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let stderr_text = err_thread.join().unwrap_or_default();
    let _ = fs::remove_dir_all(&work);
    if !status.success() {
        let tail: String = stderr_text.lines().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join(" | ");
        return Err(format!("O ffmpeg falhou: {}", clean(&tail, 400)));
    }
    let bytes = fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
    let mut probe = Command::new(&ffprobe);
    quiet(&mut probe).args(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0"]).arg(&out);
    let duration_s = probe
        .output()
        .ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok())
        .unwrap_or(0.0);
    let mut bd = Command::new(&ffmpeg);
    quiet(&mut bd)
        .args(["-hide_banner", "-v", "info", "-i"])
        .arg(&out)
        .args(["-vf", "blackdetect=d=0.5:pic_th=0.98", "-an", "-f", "null", "-"]);
    let black_ratio = bd
        .output()
        .map(|o| {
            let text = String::from_utf8_lossy(&o.stderr).to_string();
            let black: f64 = text
                .split("black_duration:")
                .skip(1)
                .filter_map(|p| p.split_whitespace().next().and_then(|n| n.parse::<f64>().ok()))
                .sum();
            if duration_s > 0.0 { (black / duration_s).clamp(0.0, 1.0) } else { 0.0 }
        })
        .unwrap_or(0.0);
    *last.0.lock().unwrap() = Some(out.clone());
    let _ = app.emit("binguey-render-progress", 100u32);
    Ok(RenderResult {
        path: out.display().to_string(),
        seconds: started.elapsed().as_secs_f64(),
        bytes,
        encoder,
        duration_s,
        black_ratio,
    })
}

/// Mostra no Explorer o último vídeo montado.
#[tauri::command]
pub fn reveal_render(last: State<LastRender>) -> Result<(), String> {
    let path = last.0.lock().unwrap().clone().ok_or("nenhum vídeo montado nesta sessão")?;
    Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
