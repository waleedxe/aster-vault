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
        .manage(vault_core::session::VaultSession::default())
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::vault_status,
            commands::vault_exists,
            commands::create_vault,
            commands::unlock_vault,
            commands::unlock_vault_with_recovery,
            commands::lock_vault,
            commands::save_vault,
            commands::note_activity,
            commands::list_items,
            commands::create_item,
            commands::update_item,
            commands::delete_item,
            commands::toggle_favorite,
            commands::list_folders,
            commands::create_folder,
            commands::delete_folder,
            commands::change_master_password,
            commands::generate_password,
            commands::generate_passphrase,
            commands::password_strength,
            commands::reused_password_count,
            commands::export_backup,
            commands::list_backups,
            commands::verify_backup,
            commands::restore_backup,
            commands::seconds_since_latest_backup,
            commands::apply_backup_retention
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aster Vault");
}
