mod db;
mod hotkey;
mod paste;
mod sidecar;

use hotkey::{
    handle_cancel, handle_hotkey_press, HotkeyState, RecordingState, SharedHotkeyState,
};
use sidecar::{send_command, spawn_sidecar, SharedSidecar};
use std::sync::Arc;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Listener, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tokio::sync::Mutex;

#[tauri::command]
async fn start_recording(
    app: tauri::AppHandle,
    sidecar: tauri::State<'_, SharedSidecar>,
    hotkey_state: tauri::State<'_, SharedHotkeyState>,
) -> Result<(), String> {
    handle_hotkey_press(&app, &hotkey_state, &sidecar).await;
    Ok(())
}

#[tauri::command]
async fn stop_recording(
    app: tauri::AppHandle,
    sidecar: tauri::State<'_, SharedSidecar>,
    hotkey_state: tauri::State<'_, SharedHotkeyState>,
) -> Result<(), String> {
    handle_hotkey_press(&app, &hotkey_state, &sidecar).await;
    Ok(())
}

#[tauri::command]
async fn cancel_recording(
    app: tauri::AppHandle,
    sidecar: tauri::State<'_, SharedSidecar>,
    hotkey_state: tauri::State<'_, SharedHotkeyState>,
) -> Result<(), String> {
    handle_cancel(&app, &hotkey_state, &sidecar).await;
    Ok(())
}

#[tauri::command]
async fn send_sidecar_config(
    sidecar: tauri::State<'_, SharedSidecar>,
    config: serde_json::Value,
) -> Result<(), String> {
    let cmd = serde_json::json!({"action": "set_config", "config": config});
    send_command(&sidecar, &cmd).await
}

#[tauri::command]
async fn list_ollama_models(
    sidecar: tauri::State<'_, SharedSidecar>,
) -> Result<(), String> {
    let cmd = serde_json::json!({"action": "list_ollama_models"});
    send_command(&sidecar, &cmd).await
}

#[tauri::command]
async fn pull_ollama_model(
    sidecar: tauri::State<'_, SharedSidecar>,
    model: String,
) -> Result<(), String> {
    let cmd = serde_json::json!({"action": "pull_ollama_model", "model": model});
    send_command(&sidecar, &cmd).await
}

#[tauri::command]
async fn list_audio_devices(
    sidecar: tauri::State<'_, SharedSidecar>,
) -> Result<(), String> {
    let cmd = serde_json::json!({"action": "list_devices"});
    send_command(&sidecar, &cmd).await
}

#[tauri::command]
async fn get_history(
    _app: tauri::AppHandle,
) -> Result<Vec<db::HistoryEntry>, String> {
    // History is managed via SQL plugin from frontend
    Ok(vec![])
}

#[tauri::command]
fn paste_text(text: String) -> Result<(), String> {
    paste::paste_text(&text)
}

fn position_overlay(app: &tauri::AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        if let Ok(Some(monitor)) = overlay.current_monitor() {
            let screen = monitor.size();
            let scale = monitor.scale_factor();
            let win_width = (440.0 * scale) as u32;
            let win_height = (88.0 * scale) as u32;
            let x = (screen.width / 2).saturating_sub(win_width / 2) as i32;
            let y = (screen.height).saturating_sub(win_height + (40.0 * scale) as u32) as i32;
            let _ = overlay.set_position(tauri::PhysicalPosition { x, y });
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:whisperdrop.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "Create history table",
                        sql: db::CREATE_TABLE_SQL,
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .setup(|app| {
            // Spawn Python sidecar
            let sidecar_state = match spawn_sidecar(&app.handle()) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("Warning: Could not spawn sidecar: {}", e);
                    Arc::new(Mutex::new(sidecar::SidecarState::new()))
                }
            };
            app.manage(sidecar_state.clone());

            // Hotkey state
            let hotkey_state: SharedHotkeyState = Arc::new(Mutex::new(HotkeyState::new()));
            app.manage(hotkey_state.clone());

            // Position overlay window
            position_overlay(app.handle());

            // Register global shortcut (Ctrl+Shift+Space)
            let shortcut: Shortcut = "Ctrl+Shift+Space".parse().unwrap();
            let app_handle = app.handle().clone();
            let sidecar_for_shortcut = sidecar_state.clone();
            let hotkey_for_shortcut = hotkey_state.clone();

            app.handle()
                .plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |_app, _shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                let app_h = app_handle.clone();
                                let sc = sidecar_for_shortcut.clone();
                                let hk = hotkey_for_shortcut.clone();
                                tauri::async_runtime::spawn(async move {
                                    handle_hotkey_press(&app_h, &hk, &sc).await;
                                });
                            }
                        })
                        .build(),
                )
                .expect("Failed to register global shortcut plugin");

            app.global_shortcut()
                .register(shortcut)
                .expect("Failed to register Ctrl+Shift+Space shortcut");

            // Listen for transcription completion to auto-paste
            let app_handle2 = app.handle().clone();
            let hotkey_state2 = hotkey_state.clone();
            app.listen("transcription-done", move |event| {
                let hk = hotkey_state2.clone();
                let app_h = app_handle2.clone();

                tauri::async_runtime::spawn(async move {
                    let mut state = hk.lock().await;

                    if state.recording_state == RecordingState::Idle {
                        return;
                    }
                    state.recording_state = RecordingState::Idle;
                    drop(state);

                    let payload = event.payload();
                    let mut should_paste = false;
                    let mut paste_text_str = String::new();

                    if let Ok(msg) =
                        serde_json::from_str::<sidecar::SidecarMessage>(payload)
                    {
                        if let Some(text) = &msg.text {
                            if !text.is_empty() {
                                should_paste = true;
                                paste_text_str = text.clone();
                            }
                        }
                    }

                    if let Some(overlay) = app_h.get_webview_window("overlay") {
                        let _ = overlay.hide();
                    }
                    let _ = app_h.emit("recording-state", "idle");

                    if should_paste {
                        std::thread::spawn(move || {
                            if let Err(e) = paste::paste_text(&paste_text_str) {
                                eprintln!("Paste error: {}", e);
                            }
                        });
                    }
                });
            });

            // Listen for sidecar errors — reset state and hide overlay
            let app_handle3 = app.handle().clone();
            let hotkey_state3 = hotkey_state.clone();
            app.listen("sidecar-error", move |_event| {
                let hk = hotkey_state3.clone();
                let app_h = app_handle3.clone();

                tauri::async_runtime::spawn(async move {
                    let mut state = hk.lock().await;
                    if state.recording_state == RecordingState::Idle {
                        return;
                    }
                    state.recording_state = RecordingState::Idle;
                    state.locked = false;
                    drop(state);

                    if let Some(overlay) = app_h.get_webview_window("overlay") {
                        let _ = overlay.hide();
                    }
                    let _ = app_h.emit("recording-state", "idle");
                });
            });

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("WhisperDrop")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            cancel_recording,
            send_sidecar_config,
            list_ollama_models,
            pull_ollama_model,
            list_audio_devices,
            get_history,
            paste_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
