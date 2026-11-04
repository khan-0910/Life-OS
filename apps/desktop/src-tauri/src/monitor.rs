//! Foreground-window process lookup. Reads only the executable path of the
//! process that owns the window the user is looking at. No window titles,
//! contents, keystrokes or screenshots; no injection; no elevation.

pub struct Foreground {
    pub exe: String,
    pub path: String,
    /// Window handle as an integer so it can cross threads.
    pub hwnd: isize,
}

pub const SUPPORTED: bool = cfg!(windows);

#[cfg(windows)]
mod imp {
    use super::Foreground;
    use windows_sys::Win32::Foundation::{CloseHandle, HWND};
    use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId, IsWindow, PostMessageW, WM_CLOSE};

    /// (lowercase exe name, full path) of the process owning `hwnd`.
    unsafe fn process_of(hwnd: HWND) -> Option<(String, String)> {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None; // e.g. an elevated process: skip it rather than escalate
        }
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut len);
        CloseHandle(handle);
        if ok == 0 {
            return None;
        }
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        let exe = path.rsplit('\\').next().unwrap_or("").to_ascii_lowercase();
        Some((exe, path))
    }

    pub fn foreground() -> Option<Foreground> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            let (exe, path) = process_of(hwnd)?;
            Some(Foreground { exe, path, hwnd: hwnd as isize })
        }
    }

    pub fn request_close(hwnd: isize, expected_exe: &str) -> bool {
        let hwnd = hwnd as HWND;
        unsafe {
            if IsWindow(hwnd) == 0 {
                return false;
            }
            // The handle must still belong to the app the user agreed to close.
            match process_of(hwnd) {
                Some((exe, _)) if exe == expected_exe => PostMessageW(hwnd, WM_CLOSE, 0, 0) != 0,
                _ => false,
            }
        }
    }
}

#[cfg(windows)]
pub use imp::foreground;

/// Ask a window to close the normal way (same as clicking its X). The app may
/// ask to save or refuse. Never terminates a process.
#[cfg(windows)]
pub fn request_close(hwnd: isize, expected_exe: &str) -> bool {
    imp::request_close(hwnd, expected_exe)
}

#[cfg(not(windows))]
pub fn foreground() -> Option<Foreground> {
    None
}

#[cfg(not(windows))]
pub fn request_close(_hwnd: isize, _expected_exe: &str) -> bool {
    false
}
