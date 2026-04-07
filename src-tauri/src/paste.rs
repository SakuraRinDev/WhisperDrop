use arboard::Clipboard;
use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

pub fn paste_text(text: &str) -> Result<(), String> {
    eprintln!("[paste] start, text_len={}", text.len());

    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    let old_text = clipboard.get_text().ok();

    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;
    eprintln!("[paste] clipboard set");

    thread::sleep(Duration::from_millis(150));

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to create enigo: {}", e))?;

    // Release any modifiers that might still be held from the global hotkey
    let _ = enigo.key(Key::Control, enigo::Direction::Release);
    let _ = enigo.key(Key::Shift, enigo::Direction::Release);
    let _ = enigo.key(Key::Space, enigo::Direction::Release);
    #[cfg(target_os = "macos")]
    let _ = enigo.key(Key::Meta, enigo::Direction::Release);
    thread::sleep(Duration::from_millis(30));

    // macOS uses Cmd+V, every other platform uses Ctrl+V
    #[cfg(target_os = "macos")]
    let modifier = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;

    #[cfg(target_os = "windows")]
    {
        extern "system" {
            fn GetForegroundWindow() -> isize;
        }
        let hwnd = unsafe { GetForegroundWindow() };
        eprintln!("[paste] foreground at Ctrl+V time: hwnd={:#x}", hwnd);
    }

    // On macOS, sending `Key::Unicode('v')` routes the synthetic keystroke
    // through the active Input Method (IMKInputSession_Legacy when a Japanese
    // IME is selected), which then calls TSMSetKeyboardLayoutOverride and
    // crashes the host process inside CFPasteboard XPC. Sending the raw
    // virtual keycode (kVK_ANSI_V = 0x09) bypasses the IME's Unicode path.
    #[cfg(target_os = "macos")]
    let v_key = Key::Other(0x09);
    #[cfg(not(target_os = "macos"))]
    let v_key = Key::Unicode('v');

    enigo
        .key(modifier, enigo::Direction::Press)
        .map_err(|e| format!("Key press error: {}", e))?;
    enigo
        .key(v_key, enigo::Direction::Click)
        .map_err(|e| format!("Key press error: {}", e))?;
    enigo
        .key(modifier, enigo::Direction::Release)
        .map_err(|e| format!("Key release error: {}", e))?;
    eprintln!("[paste] paste shortcut sent");

    if let Some(old) = old_text {
        thread::sleep(Duration::from_millis(200));
        let _ = clipboard.set_text(old);
    }

    Ok(())
}
