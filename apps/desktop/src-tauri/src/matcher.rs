//! Matching the foreground process against the user's app list.
//! Pure functions: no Windows APIs here.

use crate::config::AppRule;

/// Never interrupted, whatever the list says: Windows shell, security,
/// accessibility and system tools, terminals, and the companion itself.
const PROTECTED: &[&str] = &[
    "explorer.exe", "taskmgr.exe", "lsass.exe", "csrss.exe", "winlogon.exe", "dwm.exe", "logonui.exe",
    "consent.exe", "sihost.exe", "smss.exe", "services.exe", "svchost.exe", "searchhost.exe",
    "searchapp.exe", "startmenuexperiencehost.exe", "shellexperiencehost.exe", "lockapp.exe",
    "securityhealthsystray.exe", "securityhealthhost.exe", "sechealthui.exe", "msmpeng.exe",
    "narrator.exe", "magnify.exe", "osk.exe", "atbroker.exe", "utilman.exe", "voiceaccess.exe",
    "sndvol.exe", "mmc.exe", "regedit.exe", "systemsettings.exe", "control.exe",
    "cmd.exe", "powershell.exe", "pwsh.exe", "windowsterminal.exe", "conhost.exe", "openconsole.exe",
    "msedgewebview2.exe", "lifeos-companion.exe",
];

pub const MAX_RULES: usize = 100;

/// "C:\\Apps\\Discord.exe", "discord", " Discord.EXE " → "discord.exe".
pub fn normalize_exe(input: &str) -> Result<String, String> {
    let name = input.trim().rsplit(['\\', '/']).next().unwrap_or("").trim().to_ascii_lowercase();
    if name.is_empty() {
        return Err("Enter the program's file name, like discord.exe.".into());
    }
    let name = if name.ends_with(".exe") { name } else { format!("{name}.exe") };
    if name.len() > 100 {
        return Err("That file name is too long.".into());
    }
    let stem = &name[..name.len() - 4];
    if stem.is_empty() || !stem.chars().all(|c| c.is_ascii_alphanumeric() || " ._-()+".contains(c)) {
        return Err("Use the program's .exe file name (letters, numbers, spaces, . _ - ( ) +).".into());
    }
    Ok(name)
}

fn under_windows_dir(path: &str) -> bool {
    let p = path.to_ascii_lowercase().replace('/', "\\");
    let root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into()).to_ascii_lowercase();
    p.starts_with(&format!("{}\\", root.trim_end_matches('\\')))
}

pub fn is_protected(exe: &str, path: Option<&str>) -> bool {
    let exe = exe.to_ascii_lowercase();
    PROTECTED.contains(&exe.as_str()) || path.map(under_windows_dir).unwrap_or(false)
}

/// The rule for this process, unless the process is protected.
pub fn match_rule<'a>(rules: &'a [AppRule], exe: &str, path: Option<&str>) -> Option<&'a AppRule> {
    if is_protected(exe, path) {
        return None;
    }
    let exe = exe.to_ascii_lowercase();
    rules.iter().find(|r| r.exe == exe)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(exe: &str) -> AppRule {
        AppRule { id: "r".into(), label: exe.into(), exe: exe.into(), allow_close: false }
    }

    #[test]
    fn normalizes_names_and_paths() {
        assert_eq!(normalize_exe(r"C:\Program Files\Discord\Discord.EXE").unwrap(), "discord.exe");
        assert_eq!(normalize_exe(" steam ").unwrap(), "steam.exe");
        assert!(normalize_exe("").is_err());
        assert!(normalize_exe("bad|name.exe").is_err());
    }

    #[test]
    fn matches_case_insensitively() {
        let rules = vec![rule("discord.exe")];
        assert!(match_rule(&rules, "Discord.exe", Some(r"C:\Users\me\AppData\Local\Discord\Discord.exe")).is_some());
        assert!(match_rule(&rules, "slack.exe", None).is_none());
    }

    #[test]
    fn never_matches_protected_or_system_processes() {
        let rules = vec![rule("taskmgr.exe"), rule("notepad.exe"), rule("lifeos-companion.exe")];
        assert!(match_rule(&rules, "taskmgr.exe", None).is_none());
        assert!(match_rule(&rules, "lifeos-companion.exe", None).is_none());
        assert!(match_rule(&rules, "notepad.exe", Some(r"C:\Windows\System32\notepad.exe")).is_none());
        assert!(is_protected("Narrator.exe", None));
    }
}
