//! Tauri command surface. Commands are thin: validate input, call a service,
//! map errors. Crypto never happens in this layer.

use serde::Serialize;

/// Basic application metadata for the About screen and diagnostics.
#[derive(Debug, Serialize)]
pub struct AppInfo {
    /// Product name.
    pub name: String,
    /// Application version.
    pub version: String,
    /// Supported container format version.
    pub format_version: u32,
}

/// Return static application information.
#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: "Aster Vault".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        format_version: vault_core::FORMAT_VERSION,
    }
}
