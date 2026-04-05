use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

use crate::sidecar::{send_command, SharedSidecar};

#[derive(Debug, Clone, PartialEq)]
pub enum RecordingState {
    Idle,
    Recording,
    Transcribing,
}

pub struct HotkeyState {
    pub recording_state: RecordingState,
    pub last_press: Option<Instant>,
    pub locked: bool,
    pub previous_window: Option<isize>,
}

impl HotkeyState {
    pub fn new() -> Self {
        Self {
            recording_state: RecordingState::Idle,
            last_press: None,
            locked: false,
            previous_window: None,
        }
    }
}

pub type SharedHotkeyState = Arc<Mutex<HotkeyState>>;

pub async fn handle_hotkey_press(
    app: &AppHandle,
    hotkey_state: &SharedHotkeyState,
    sidecar: &SharedSidecar,
) {
    let mut state = hotkey_state.lock().await;
    let now = Instant::now();

    match state.recording_state {
        RecordingState::Idle => {
            // Check for double-tap (within 400ms)
            let is_double_tap = state
                .last_press
                .map(|t| now.duration_since(t).as_millis() < 400)
                .unwrap_or(false);

            state.last_press = Some(now);

            if is_double_tap {
                // Lock mode: start recording, stays on until next double-tap
                state.locked = true;
            } else {
                state.locked = false;
            }

            state.recording_state = RecordingState::Recording;

            // Save the currently focused window before stealing focus
            state.previous_window = crate::focus::save_foreground_window();

            // Show overlay
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.show();
                let _ = overlay.set_focus();
            }
            let _ = app.emit("recording-state", "listening");

            // Tell sidecar to start recording (non-fatal if sidecar not running)
            let cmd = serde_json::json!({"action": "start_recording"});
            if let Err(e) = send_command(sidecar, &cmd).await {
                eprintln!("Sidecar not available: {}", e);
            }
        }
        RecordingState::Recording => {
            // Check for double-tap to stop locked recording
            let is_double_tap = state
                .last_press
                .map(|t| now.duration_since(t).as_millis() < 400)
                .unwrap_or(false);
            state.last_press = Some(now);

            if state.locked && is_double_tap {
                // Stop locked recording
                state.locked = false;
                state.recording_state = RecordingState::Transcribing;
                let _ = app.emit("recording-state", "transcribing");

                let cmd = serde_json::json!({"action": "stop_recording"});
                if let Err(e) = send_command(sidecar, &cmd).await {
                    eprintln!("Failed to stop recording: {}", e);
                }
            } else if !state.locked {
                // Push-to-talk: stop on second press
                state.recording_state = RecordingState::Transcribing;
                let _ = app.emit("recording-state", "transcribing");

                let cmd = serde_json::json!({"action": "stop_recording"});
                if let Err(e) = send_command(sidecar, &cmd).await {
                    eprintln!("Failed to stop recording: {}", e);
                }
            }
        }
        RecordingState::Transcribing => {
            // Allow cancel during transcription/postprocessing
            state.last_press = Some(now);
            state.recording_state = RecordingState::Idle;
            state.locked = false;
            let saved_hwnd = state.previous_window.take();
            drop(state);

            let _ = app.emit("recording-state", "idle");
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.hide();
            }

            if let Some(hwnd) = saved_hwnd {
                crate::focus::restore_foreground_window(hwnd);
            }

            let cmd = serde_json::json!({"action": "cancel"});
            if let Err(e) = send_command(sidecar, &cmd).await {
                eprintln!("Failed to cancel: {}", e);
            }
        }
    }
}

pub async fn handle_cancel(
    app: &AppHandle,
    hotkey_state: &SharedHotkeyState,
    sidecar: &SharedSidecar,
) {
    let mut state = hotkey_state.lock().await;
    if state.recording_state == RecordingState::Idle {
        return;
    }
    state.recording_state = RecordingState::Idle;
    state.locked = false;
    let saved_hwnd = state.previous_window.take();
    drop(state);

    let _ = app.emit("recording-state", "idle");
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }

    if let Some(hwnd) = saved_hwnd {
        crate::focus::restore_foreground_window(hwnd);
    }

    let cmd = serde_json::json!({"action": "cancel"});
    let _ = send_command(sidecar, &cmd).await;
}
