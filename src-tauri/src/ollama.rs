//! Ollama lifecycle management.
//!
//! On app startup we check whether an Ollama server is already running on
//! `localhost:11434`. If not, we try to find the `ollama` binary on disk and
//! spawn `ollama serve` in the background. We only kill the process on app
//! exit if **we** are the ones who started it — a pre-existing user-managed
//! Ollama is left untouched.

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

pub struct OllamaState {
    /// `Some(child)` if WhisperDrop spawned ollama itself; `None` if Ollama
    /// was already running or could not be started.
    pub child: Option<Child>,
}

impl OllamaState {
    pub fn new() -> Self {
        Self { child: None }
    }

    /// Stop the spawned Ollama process if WhisperDrop owns it.
    ///
    /// Important: on Windows, `ollama serve` actually spawns a separate
    /// llama-server child process that holds the loaded model in VRAM. A
    /// plain `child.kill()` only terminates the parent we hold a handle to,
    /// leaving the LLM worker as an orphan eating ~1GB+ of RAM. We use
    /// `taskkill /T` (tree kill) on Windows to take the whole process group
    /// down.
    pub fn shutdown(&mut self) {
        if let Some(mut child) = self.child.take() {
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                let pid = child.id();
                let _ = Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = child.kill();
            }
            let _ = child.wait();
        }
    }
}

pub type SharedOllama = std::sync::Arc<Mutex<OllamaState>>;

/// Probe `localhost:11434` to see if an Ollama server is already responsive.
/// Uses a short TCP connect — no HTTP parsing needed.
fn is_ollama_running() -> bool {
    use std::net::{SocketAddr, TcpStream};
    let addr: SocketAddr = "127.0.0.1:11434".parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

/// Search well-known install locations for the `ollama` executable.
fn find_ollama_binary() -> Option<PathBuf> {
    // 1. PATH lookup via `where`/`which`
    #[cfg(target_os = "windows")]
    let probe_cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let probe_cmd = "which";

    if let Ok(output) = Command::new(probe_cmd).arg("ollama").output() {
        if output.status.success() {
            if let Some(line) = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                let p = PathBuf::from(line);
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }

    // 2. Platform-specific defaults
    #[cfg(target_os = "windows")]
    {
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(localappdata).join("Programs/Ollama/ollama.exe");
            if p.exists() {
                return Some(p);
            }
        }
        let pf = PathBuf::from("C:/Program Files/Ollama/ollama.exe");
        if pf.exists() {
            return Some(pf);
        }
    }

    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/Applications/Ollama.app/Contents/Resources/ollama",
            "/usr/local/bin/ollama",
            "/opt/homebrew/bin/ollama",
        ];
        for c in candidates {
            let p = PathBuf::from(c);
            if p.exists() {
                return Some(p);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let candidates = ["/usr/local/bin/ollama", "/usr/bin/ollama"];
        for c in candidates {
            let p = PathBuf::from(c);
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

/// Try to make sure an Ollama server is running. Returns the spawned child
/// process if WhisperDrop started it, or `None` if Ollama was already up
/// (or could not be started — in which case LLM post-processing will simply
/// be unavailable until the user starts Ollama themselves).
pub fn ensure_ollama_running() -> Option<Child> {
    if is_ollama_running() {
        eprintln!("[ollama] already running, leaving it alone");
        return None;
    }

    let Some(bin) = find_ollama_binary() else {
        eprintln!("[ollama] binary not found, skipping auto-start");
        return None;
    };

    eprintln!("[ollama] spawning {:?} serve", bin);

    let mut cmd = Command::new(&bin);
    cmd.arg("serve")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null());

    // On Windows, prevent the spawned ollama.exe from popping a console window.
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => {
            // Give the server a moment to bind the port. We don't block long
            // because the sidecar will retry connections lazily anyway.
            for _ in 0..20 {
                if is_ollama_running() {
                    eprintln!("[ollama] server is up");
                    return Some(child);
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            eprintln!("[ollama] spawned but not yet responsive, returning child anyway");
            Some(child)
        }
        Err(e) => {
            eprintln!("[ollama] spawn failed: {}", e);
            None
        }
    }
}
