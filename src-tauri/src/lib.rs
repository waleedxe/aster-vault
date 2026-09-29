//! Tauri application entry point.
//!
//! This layer is intentionally thin: it registers plugins and commands and
//! delegates all real work to the `vault` service, which in turn calls the
//! engine-agnostic `vault-core` crate. No cryptography lives here.

mod commands;

/// Run the Aster Vault desktop application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![commands::app_info])
        .run(tauri::generate_context!())
        .expect("error while running Aster Vault");
}
