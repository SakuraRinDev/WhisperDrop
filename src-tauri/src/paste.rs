use arboard::Clipboard;
use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

pub fn paste_text(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    let old_text = clipboard.get_text().ok();

    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;

    // Wait for user to release modifier keys from the global shortcut (Ctrl+Shift+Space)
    thread::sleep(Duration::from_millis(150));

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to create enigo: {}", e))?;

    // Ensure all modifier keys are released before simulating Ctrl+V
    let _ = enigo.key(Key::Control, enigo::Direction::Release);
    let _ = enigo.key(Key::Shift, enigo::Direction::Release);
    let _ = enigo.key(Key::Space, enigo::Direction::Release);
    thread::sleep(Duration::from_millis(30));

    enigo
        .key(Key::Control, enigo::Direction::Press)
        .map_err(|e| format!("Key press error: {}", e))?;
    enigo
        .key(Key::Unicode('v'), enigo::Direction::Click)
        .map_err(|e| format!("Key press error: {}", e))?;
    enigo
        .key(Key::Control, enigo::Direction::Release)
        .map_err(|e| format!("Key release error: {}", e))?;

    if let Some(old) = old_text {
        thread::sleep(Duration::from_millis(200));
        let _ = clipboard.set_text(old);
    }

    Ok(())
}
