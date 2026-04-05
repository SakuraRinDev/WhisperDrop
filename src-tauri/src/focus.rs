#[cfg(target_os = "windows")]
mod platform {
    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn SetForegroundWindow(hwnd: isize) -> i32;
    }

    pub fn save_foreground_window() -> Option<isize> {
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd != 0 {
            eprintln!("[focus] save hwnd={:#x}", hwnd);
            Some(hwnd)
        } else {
            eprintln!("[focus] save hwnd=NULL (no foreground window)");
            None
        }
    }

    pub fn restore_foreground_window(hwnd: isize) -> bool {
        let ok = unsafe { SetForegroundWindow(hwnd) != 0 };
        eprintln!("[focus] restore hwnd={:#x} success={}", hwnd, ok);
        ok
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    pub fn save_foreground_window() -> Option<isize> {
        None
    }

    pub fn restore_foreground_window(_hwnd: isize) -> bool {
        false
    }
}

pub use platform::*;
