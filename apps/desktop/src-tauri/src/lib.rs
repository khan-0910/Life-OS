//! LifeOS Companion: a visible, user-controlled focus helper for Windows.
//!
//! While a focus guard is active (started here or by a signed LifeOS link), it
//! checks the foreground app once a second. If that app is on the user's list,
//! it shows a reminder window. It never kills processes, never blocks system,
//! security or accessibility tools, needs no elevation, and keeps everything on
//! this computer. It is best-effort: it can be bypassed, and it says so.

mod config;
mod deeplink;
mod guard;
mod matcher;
mod monitor;

use std::{
    sync::{Arc, Mutex, MutexGuard},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

use config::{AppRule, Config, Store};
use deeplink::Action;
use guard::{Guard, Source};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Interruption {
    exe: String,
    label: String,
    allow_close: bool,
    #[serde(skip)]
    hwnd: isize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LinkEvent {
    at: i64,
    ok: bool,
    detail: String,
}

struct Inner {
    store: Store,
    config: Config,
    guard: Guard,
    nonces: deeplink::NonceCache,
    interruption: Option<Interruption>,
    last_link: Option<LinkEvent>,
}

type Shared = Arc<Mutex<Inner>>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StateView {
    guard_until: Option<i64>,
    source: Option<Source>,
    rules: Vec<AppRule>,
    web_url: String,
    interruption: Option<Interruption>,
    last_link: Option<LinkEvent>,
    supported: bool,
}

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

fn lock(m: &Mutex<Inner>) -> MutexGuard<'_, Inner> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn view(s: &Inner) -> StateView {
    let now = now_ms();
    StateView {
        guard_until: s.guard.active_until(now),
        source: s.guard.source(now),
        rules: s.config.rules.clone(),
        web_url: s.config.web_url.clone(),
        interruption: s.interruption.clone(),
        last_link: s.last_link.clone(),
        supported: monitor::SUPPORTED,
    }
}

/// Refresh the tray tooltip and tell open windows to re-read state.
fn changed(app: &AppHandle, s: &Inner) {
    let tip = match s.guard.active_until(now_ms()) {
        Some(_) => "LifeOS Companion — focus guard ON",
        None => "LifeOS Companion — idle",
    };
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(tip));
    }
    let _ = app.emit("state-changed", ());
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn show_overlay(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(w) = handle.get_webview_window("overlay") {
            let _ = w.show();
            let _ = w.set_focus();
            let _ = handle.emit_to("overlay", "interruption", ());
            return;
        }
        let _ = WebviewWindowBuilder::new(&handle, "overlay", WebviewUrl::App("overlay.html".into()))
            .title("LifeOS focus reminder")
            .inner_size(520.0, 360.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .center()
            .focused(true)
            .build();
    });
}

fn hide_overlay(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.hide();
    }
}

fn stop_everything(app: &AppHandle, s: &mut Inner) {
    s.guard.stop();
    s.interruption = None;
    hide_overlay(app);
    changed(app, s);
}

// ---------- commands (main window) ----------

#[tauri::command]
fn get_state(state: State<'_, Shared>) -> StateView {
    view(&lock(&state))
}

#[tauri::command]
fn start_guard(app: AppHandle, state: State<'_, Shared>, minutes: u32) -> Result<StateView, String> {
    if !(1..=240).contains(&minutes) {
        return Err("Choose between 1 and 240 minutes.".into());
    }
    let mut s = lock(&state);
    let now = now_ms();
    s.guard.start(now + i64::from(minutes) * 60_000, now, Source::Manual)?;
    changed(&app, &s);
    Ok(view(&s))
}

/// Emergency stop. Always available, always succeeds.
#[tauri::command]
fn stop_guard(app: AppHandle, state: State<'_, Shared>) -> StateView {
    let mut s = lock(&state);
    stop_everything(&app, &mut s);
    view(&s)
}

#[tauri::command]
fn add_rule(app: AppHandle, state: State<'_, Shared>, label: String, exe: String, allow_close: bool) -> Result<StateView, String> {
    let exe = matcher::normalize_exe(&exe)?;
    if matcher::is_protected(&exe, None) {
        return Err(format!("{exe} is a Windows, security, accessibility or terminal tool and can't be listed."));
    }
    let label: String = label.trim().chars().take(60).collect();
    let mut s = lock(&state);
    if s.config.rules.len() >= matcher::MAX_RULES {
        return Err("The list is full (100 apps).".into());
    }
    if s.config.rules.iter().any(|r| r.exe == exe) {
        return Err(format!("{exe} is already on the list."));
    }
    let label = if label.is_empty() { exe.clone() } else { label };
    s.config.rules.push(AppRule { id: config::new_id(), label, exe, allow_close });
    s.store.save(&s.config)?;
    changed(&app, &s);
    Ok(view(&s))
}

#[tauri::command]
fn remove_rule(app: AppHandle, state: State<'_, Shared>, id: String) -> Result<StateView, String> {
    let mut s = lock(&state);
    s.config.rules.retain(|r| r.id != id);
    s.store.save(&s.config)?;
    changed(&app, &s);
    Ok(view(&s))
}

#[tauri::command]
fn set_rule_close(app: AppHandle, state: State<'_, Shared>, id: String, allow_close: bool) -> Result<StateView, String> {
    let mut s = lock(&state);
    let rule = s.config.rules.iter_mut().find(|r| r.id == id).ok_or("That app is no longer on the list.")?;
    rule.allow_close = allow_close;
    s.store.save(&s.config)?;
    changed(&app, &s);
    Ok(view(&s))
}

#[tauri::command]
fn set_web_url(app: AppHandle, state: State<'_, Shared>, url: String) -> Result<StateView, String> {
    let url = config::validate_web_url(&url)?;
    let mut s = lock(&state);
    s.config.web_url = url;
    s.store.save(&s.config)?;
    changed(&app, &s);
    Ok(view(&s))
}

#[tauri::command]
fn get_pairing_secret(state: State<'_, Shared>) -> String {
    lock(&state).config.pairing_secret.clone()
}

/// Invalidates every link signed with the old secret.
#[tauri::command]
fn reset_pairing(state: State<'_, Shared>) -> Result<String, String> {
    let mut s = lock(&state);
    s.config.pairing_secret = config::new_secret();
    s.nonces = deeplink::NonceCache::default();
    s.store.save(&s.config)?;
    Ok(s.config.pairing_secret.clone())
}

// ---------- commands (overlay window) ----------

#[tauri::command]
fn get_interruption(state: State<'_, Shared>) -> Option<Interruption> {
    lock(&state).interruption.clone()
}

#[tauri::command]
fn overlay_action(app: AppHandle, state: State<'_, Shared>, action: String) -> Result<(), String> {
    let mut s = lock(&state);
    let now = now_ms();
    match action.as_str() {
        "back" => {
            s.interruption = None;
            hide_overlay(&app);
            let url = s.config.web_url.clone();
            changed(&app, &s);
            drop(s);
            app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())?;
        }
        "snooze" => {
            if let Some(i) = s.interruption.take() {
                s.guard.snooze(&i.exe, now);
            }
            hide_overlay(&app);
            changed(&app, &s);
        }
        "close_app" => {
            let i = s.interruption.take().ok_or("Nothing to close.")?;
            let allowed = s.config.rules.iter().any(|r| r.exe == i.exe && r.allow_close);
            hide_overlay(&app);
            changed(&app, &s);
            if !allowed {
                return Err("Closing isn't turned on for this app.".into());
            }
            if !monitor::request_close(i.hwnd, &i.exe) {
                return Err("The window was already gone.".into());
            }
        }
        "stop_guard" => stop_everything(&app, &mut s),
        _ => return Err("Unknown action.".into()),
    }
    Ok(())
}

// ---------- deep links ----------

fn handle_links(app: &AppHandle, urls: Vec<String>) {
    let shared = app.state::<Shared>();
    let mut guard = lock(&shared);
    let s: &mut Inner = &mut guard;
    for url in urls {
        let now = now_ms();
        let secret = s.config.pairing_secret.clone();
        let event = match deeplink::verify(&url, &secret, now, &mut s.nonces) {
            Ok(cmd) => match cmd.action {
                Action::Start => match s.guard.start(cmd.until, now, Source::LifeOs) {
                    Ok(()) => LinkEvent { at: now, ok: true, detail: "Focus guard started by LifeOS.".into() },
                    Err(e) => LinkEvent { at: now, ok: false, detail: e },
                },
                Action::Stop => {
                    s.guard.stop();
                    s.interruption = None;
                    hide_overlay(app);
                    LinkEvent { at: now, ok: true, detail: "Focus guard stopped by LifeOS.".into() }
                }
            },
            // The link itself is never logged: it carries a signature.
            Err(reason) => LinkEvent { at: now, ok: false, detail: format!("Ignored a LifeOS link ({reason}).") },
        };
        s.last_link = Some(event);
    }
    changed(app, s);
}

// ---------- monitor ----------

fn spawn_monitor(app: AppHandle, shared: Shared) {
    thread::spawn(move || {
        let mut was_active = false;
        loop {
            let now = now_ms();
            let active = lock(&shared).guard.active_until(now).is_some();
            if active != was_active {
                was_active = active;
                let mut s = lock(&shared);
                if !active {
                    s.interruption = None;
                    hide_overlay(&app);
                }
                changed(&app, &s);
            }
            if !active {
                thread::sleep(Duration::from_millis(1500));
                continue;
            }
            if let Some(fg) = monitor::foreground() {
                let mut s = lock(&shared);
                let hit = matcher::match_rule(&s.config.rules, &fg.exe, Some(&fg.path)).cloned();
                if let Some(rule) = hit {
                    if s.guard.should_interrupt(&rule.exe, now) {
                        let is_new = s.interruption.as_ref().map(|i| i.exe != rule.exe).unwrap_or(true);
                        s.interruption = Some(Interruption { exe: rule.exe, label: rule.label, allow_close: rule.allow_close, hwnd: fg.hwnd });
                        if is_new {
                            drop(s);
                            show_overlay(&app);
                        }
                    }
                }
            }
            thread::sleep(Duration::from_millis(1000));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| show_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_state,
            start_guard,
            stop_guard,
            add_rule,
            remove_rule,
            set_rule_close,
            set_web_url,
            get_pairing_secret,
            reset_pairing,
            get_interruption,
            overlay_action
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                match window.label() {
                    // Closing the window keeps the app in the tray; "Quit" in the tray exits.
                    "main" => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    "overlay" => {
                        let shared = window.app_handle().state::<Shared>();
                        lock(&shared).interruption = None;
                    }
                    _ => {}
                }
            }
        })
        .setup(|app| {
            let store = Store::new(app.path().app_config_dir()?);
            let config = store.load();
            let shared: Shared = Arc::new(Mutex::new(Inner {
                store,
                config,
                guard: Guard::default(),
                nonces: deeplink::NonceCache::default(),
                interruption: None,
                last_link: None,
            }));
            app.manage(shared.clone());

            let open = MenuItem::with_id(app, "open", "Open LifeOS Companion", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "Stop focus guard now", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit LifeOS Companion", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &stop, &sep, &quit])?;
            let icon = app.default_window_icon().cloned().ok_or("missing app icon")?;
            TrayIconBuilder::with_id("main")
                .icon(icon)
                .tooltip("LifeOS Companion — idle")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "stop" => {
                        let shared = app.state::<Shared>();
                        let mut s = lock(&shared);
                        stop_everything(app, &mut s);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Installed builds register the scheme via the installer; dev builds register at runtime.
            #[cfg(debug_assertions)]
            {
                let _ = app.deep_link().register_all();
            }
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                handle_links(&handle, event.urls().into_iter().map(|u| u.to_string()).collect());
            });
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                handle_links(app.handle(), urls.into_iter().map(|u| u.to_string()).collect());
            }

            spawn_monitor(app.handle().clone(), shared);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LifeOS Companion");
}
