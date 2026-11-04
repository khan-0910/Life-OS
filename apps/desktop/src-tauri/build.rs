// Declare app commands so each window only gets the ones its capability grants.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_state",
            "start_guard",
            "stop_guard",
            "add_rule",
            "remove_rule",
            "set_rule_close",
            "set_web_url",
            "get_pairing_secret",
            "reset_pairing",
            "get_interruption",
            "overlay_action",
        ]),
    ))
    .expect("failed to run tauri-build");
}
