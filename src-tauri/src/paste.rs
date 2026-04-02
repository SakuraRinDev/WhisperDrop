use arboard::Clipboard;
use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

pub fn paste_text(text: &str) -> Result<(), String> {
    // Save current clipboard, set new text, paste, restore
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    let old_text = clipboard.get_text().ok();

    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;

    // Small delay to ensure clipboard is set
    thread::sleep(Duration::from_millis(50));

    // Simulate Ctrl+V
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to create enigo: {}", e))?;

    enigo
        .key(Key::Control, enigo::Direction::Press)
        .map_err(|e| format!("Key press error: {}", e))?;
    enigo
        .key(Key::Unicode('v'), enigo::Direction::Click)
        .map_err(|e| format!("Key press error: {}", e))?;
    enigo
        .key(Key::Control, enigo::Direction::Release)
        .map_err(|e| format!("Key release error: {}", e))?;

    // Restore original clipboard after a delay
    if let Some(old) = old_text {
        thread::sleep(Duration::from_millis(200));
        let _ = clipboard.set_text(old);
    }

    Ok(())
}
