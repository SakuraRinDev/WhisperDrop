mod db;
mod focus;
mod hotkey;
mod ollama;
mod paste;
mod sidecar;

use hotkey::{
    handle_cancel, handle_hotkey_press, HotkeyState, RecordingState, SharedHotkeyState, WrapStyle,
};
use sidecar::{send_command, spawn_sidecar, SharedSidecar};
use std::sync::Arc;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
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
    handle_hotkey_press(&app, &hotkey_state, &sidecar, WrapStyle::None).await;
    Ok(())
}

#[tauri::command]
async fn stop_recording(
    app: tauri::AppHandle,
    sidecar: tauri::State<'_, SharedSidecar>,
    hotkey_state: tauri::State<'_, SharedHotkeyState>,
) -> Result<(), String> {
    handle_hotkey_press(&app, &hotkey_state, &sidecar, WrapStyle::None).await;
    Ok(())
}

#[tauri::command]
async fn set_wrap_style(
    hotkey_state: tauri::State<'_, SharedHotkeyState>,
    style: String,
) -> Result<(), String> {
    let mut state = hotkey_state.lock().await;
    state.wrap_style = match style.as_str() {
        "ja_quote" => WrapStyle::JaQuote,
        "bracket" => WrapStyle::Bracket,
        "double_quote" => WrapStyle::DoubleQuote,
        "paren" => WrapStyle::Paren,
        _ => WrapStyle::None,
    };
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
async fn check_ollama(
    sidecar: tauri::State<'_, SharedSidecar>,
) -> Result<(), String> {
    let cmd = serde_json::json!({"action": "check_ollama"});
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
async fn check_whisper_model(
    sidecar: tauri::State<'_, SharedSidecar>,
    model: String,
) -> Result<(), String> {
    let cmd = serde_json::json!({"action": "check_model", "model": model});
    send_command(&sidecar, &cmd).await
}

#[tauri::command]
fn paste_text(text: String) -> Result<(), String> {
    paste::paste_text(&text)
}

const OVERLAY_WIDTH: f64 = 340.0;
const OVERLAY_HEIGHT: f64 = 80.0;
const OVERLAY_MARGIN: f64 = 16.0;

fn position_overlay(app: &tauri::AppHandle, position: &str) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        if let Ok(Some(monitor)) = overlay.current_monitor() {
            let screen = monitor.size();
            let scale = monitor.scale_factor();
            let win_width = (OVERLAY_WIDTH * scale) as u32;
            let win_height = (OVERLAY_HEIGHT * scale) as u32;
            let x = (screen.width / 2).saturating_sub(win_width / 2) as i32;
            let y = if position == "bottom" {
                (screen.height).saturating_sub(win_height + (OVERLAY_MARGIN * scale) as u32) as i32
            } else {
                (OVERLAY_MARGIN * scale) as i32
            };
            let _ = overlay.set_position(tauri::PhysicalPosition { x, y });
        }
    }
}

#[tauri::command]
fn set_overlay_position(app: tauri::AppHandle, position: String) {
    position_overlay(&app, &position);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
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
            // Auto-start Ollama in the background if it's not already running.
            // This runs on a separate thread so we don't delay app startup if
            // Ollama takes a moment to bind its port.
            let ollama_state: ollama::SharedOllama =
                Arc::new(std::sync::Mutex::new(ollama::OllamaState::new()));
            {
                let ollama_state = ollama_state.clone();
                std::thread::spawn(move || {
                    if let Some(child) = ollama::ensure_ollama_running() {
                        if let Ok(mut s) = ollama_state.lock() {
                            s.child = Some(child);
                        }
                    }
                });
            }
            app.manage(ollama_state);

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

            // Position overlay window (default: top)
            position_overlay(app.handle(), "top");

            // Register global shortcuts
            // macOS: Cmd-based, Windows/Linux: Ctrl-based
            #[cfg(target_os = "macos")]
            let mod_prefix = "Cmd+Shift";
            #[cfg(not(target_os = "macos"))]
            let mod_prefix = "Ctrl+Shift";

            let shortcut_record: Shortcut = format!("{mod_prefix}+Space").parse().unwrap();
            let shortcut_escape: Shortcut = "Escape".parse().unwrap();

            let app_handle = app.handle().clone();
            let sidecar_for_shortcut = sidecar_state.clone();
            let hotkey_for_shortcut = hotkey_state.clone();
            let app_handle_esc = app.handle().clone();
            let sidecar_for_esc = sidecar_state.clone();
            let hotkey_for_esc = hotkey_state.clone();

            app.handle()
                .plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |_app, shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }
                            let key_str = shortcut.to_string();

                            if key_str.contains("Space") {
                                let app_h = app_handle.clone();
                                let sc = sidecar_for_shortcut.clone();
                                let hk = hotkey_for_shortcut.clone();
                                tauri::async_runtime::spawn(async move {
                                    handle_hotkey_press(&app_h, &hk, &sc, WrapStyle::None).await;
                                });
                            } else if key_str.contains("Escape") {
                                let app_h = app_handle_esc.clone();
                                let sc = sidecar_for_esc.clone();
                                let hk = hotkey_for_esc.clone();
                                tauri::async_runtime::spawn(async move {
                                    handle_cancel(&app_h, &hk, &sc).await;
                                });
                            }
                        })
                        .build(),
                )
                .expect("Failed to register global shortcut plugin");

            let gs = app.global_shortcut();
            gs.register(shortcut_record)
                .expect("Failed to register record shortcut");
            gs.register(shortcut_escape)
                .expect("Failed to register Escape shortcut");

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
                    let saved_hwnd = state.previous_window.take();
                    let wrap = state.wrap_style.clone();
                    drop(state);

                    let payload = event.payload();
                    let mut should_paste = false;
                    let mut paste_text_str = String::new();

                    if let Ok(msg) =
                        serde_json::from_str::<sidecar::SidecarMessage>(payload)
                    {
                        if let Some(text) = &msg.text {
                            if !text.is_empty() {
                                let wrapped = wrap.wrap(text);
                                let preview: String = wrapped.chars().take(100).collect();
                                eprintln!("[paste] text={:?} (len={})", preview, wrapped.len());
                                should_paste = true;
                                paste_text_str = wrapped;
                            } else {
                                eprintln!("[paste] empty text, skipping paste");
                            }
                        } else {
                            eprintln!("[paste] no text field in done message");
                        }
                    }

                    if let Some(overlay) = app_h.get_webview_window("overlay") {
                        let _ = overlay.hide();
                    }
                    let _ = app_h.emit("recording-state", "idle");

                    if should_paste {
                        std::thread::spawn(move || {
                            // Restore focus to the window that was active before recording
                            if let Some(hwnd) = saved_hwnd {
                                focus::restore_foreground_window(hwnd);
                                std::thread::sleep(std::time::Duration::from_millis(100));
                            }
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

            // Close → hide to tray instead of quitting
            let app_handle_close = app.handle().clone();
            if let Some(main_window) = app.get_webview_window("main") {
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(w) = app_handle_close.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                });
            }

            // Build tray menu (right-click)
            let quit_item = MenuItemBuilder::with_id("quit", "終了").build(app)?;
            let show_item = MenuItemBuilder::with_id("show", "表示").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            // Build tray icon
            let app_handle_tray = app.handle().clone();
            let app_handle_menu = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("WhisperDrop")
                .menu(&tray_menu)
                .on_menu_event(move |_app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app_handle_menu.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app_handle_menu.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = app_handle_tray.get_webview_window("main") {
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
            set_wrap_style,
            send_sidecar_config,
            check_whisper_model,
            check_ollama,
            list_ollama_models,
            pull_ollama_model,
            list_audio_devices,
            get_history,
            paste_text,
            set_overlay_position,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Tear down ollama if WhisperDrop spawned it.
                if let Some(state) = app_handle.try_state::<ollama::SharedOllama>() {
                    if let Ok(mut s) = state.lock() {
                        s.shutdown();
                    }
                }
            }
        });
}
