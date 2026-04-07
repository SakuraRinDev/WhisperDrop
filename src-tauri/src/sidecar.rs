use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarMessage {
    pub status: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub level: Option<f64>,
    #[serde(default)]
    pub devices: Option<Vec<AudioDevice>>,
    #[serde(default)]
    pub models: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub percent: Option<f64>,
    #[serde(default)]
    pub pull_status: Option<String>,
    #[serde(default)]
    pub debug: Option<serde_json::Value>,
    #[serde(default)]
    pub cached: Option<bool>,
    #[serde(default)]
    pub connected: Option<bool>,
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: i32,
    pub name: String,
    pub channels: i32,
    pub sample_rate: f64,
    pub default: bool,
}

pub struct SidecarState {
    child: Option<CommandChild>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self { child: None }
    }
}

pub type SharedSidecar = Arc<Mutex<SidecarState>>;

pub fn spawn_sidecar(app: &AppHandle) -> Result<SharedSidecar, String> {
    let shell = app.shell();

    let (mut rx, child) = if cfg!(debug_assertions) {
        // Dev mode: run Python directly from sidecar/ directory
        let exe_dir = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?;
        let project_root = exe_dir
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .ok_or("Failed to resolve project root")?;
        let sidecar_dir = project_root.join("sidecar");

        let venv_python = if cfg!(target_os = "windows") {
            sidecar_dir.join(".venv").join("Scripts").join("python.exe")
        } else {
            sidecar_dir.join(".venv").join("bin").join("python")
        };

        let python_path = if venv_python.exists() {
            venv_python.to_string_lossy().to_string()
        } else {
            "python".to_string()
        };
        let main_py = sidecar_dir.join("main.py").to_string_lossy().to_string();
        eprintln!("Dev sidecar: {} {}", python_path, main_py);

        shell
            .command(&python_path)
            .args(["-u", &main_py])
            .env("PYTHONIOENCODING", "utf-8")
            .spawn()
            .map_err(|e| format!("Failed to spawn dev sidecar: {}", e))?
    } else {
        // Production: use Tauri bundled sidecar
        eprintln!("Production sidecar: whisper-sidecar");
        shell
            .sidecar("whisper-sidecar")
            .map_err(|e| format!("Failed to create sidecar command: {}", e))?
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?
    };

    let state = Arc::new(Mutex::new(SidecarState { child: Some(child) }));

    // Listen for stdout messages from Python sidecar
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line = String::from_utf8_lossy(&line);
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    if let Ok(msg) = serde_json::from_str::<SidecarMessage>(line) {
                        match msg.status.as_str() {
                            "audio_level" => {
                                let _ = app_handle.emit("audio-level", msg);
                            }
                            "recording_started" => {
                                let _ = app_handle.emit("recording-started", ());
                            }
                            "transcribing" => {
                                let _ = app_handle.emit("transcribing", ());
                            }
                            "postprocessing" => {
                                let _ = app_handle.emit("postprocessing", ());
                            }
                            "postprocessing_token" => {
                                let _ = app_handle.emit("postprocessing-token", &msg);
                            }
                            "done" => {
                                if let Some(dbg) = &msg.debug {
                                    eprintln!("[debug] {}", dbg);
                                }
                                let _ = app_handle.emit("transcription-done", &msg);
                            }
                            "error" => {
                                eprintln!("Sidecar error: {:?}", msg.message);
                                let _ = app_handle.emit("sidecar-error", &msg);
                            }
                            "ready" => {
                                let _ = app_handle.emit("sidecar-ready", ());
                            }
                            "devices" => {
                                let _ = app_handle.emit("devices-list", &msg);
                            }
                            "ollama_models" => {
                                let _ = app_handle.emit("ollama-models", &msg);
                            }
                            "ollama_status" => {
                                let _ = app_handle.emit("ollama-status", &msg);
                            }
                            "pull_start" | "pull_progress" | "pull_complete" | "pull_error" => {
                                let _ = app_handle.emit("ollama-pull", &msg);
                            }
                            _ => {
                                let _ = app_handle.emit("sidecar-message", &msg);
                            }
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line = String::from_utf8_lossy(&line);
                    eprintln!("Sidecar stderr: {}", line.trim());
                }
                CommandEvent::Error(err) => {
                    eprintln!("Sidecar process error: {}", err);
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("Sidecar terminated: {:?}", payload);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(state)
}

pub async fn send_command(state: &SharedSidecar, cmd: &serde_json::Value) -> Result<(), String> {
    let mut state = state.lock().await;
    if let Some(child) = &mut state.child {
        let msg = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
        child
            .write((msg + "\n").as_bytes())
            .map_err(|e| format!("Failed to write to sidecar: {}", e))?;
        Ok(())
    } else {
        Err("Sidecar not running".into())
    }
}
