//! Tauri command surface. Commands are thin: validate input, call the session
//! service, map errors. Crypto never happens in this layer.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use vault_core::backup;
use vault_core::generator::{self, PassphraseOptions, PasswordOptions};
use vault_core::session::{
    BackupDto, CreateVaultResult, FolderDto, ItemDto, ItemInput, VaultSession, VaultStatus,
};
use vault_core::strength;

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

/// Backend-generated password options.
#[derive(Debug, Deserialize)]
pub struct PasswordOptionsDto {
    /// Length.
    #[serde(default = "default_length")]
    pub length: usize,
    /// Include lowercase.
    #[serde(default = "default_true")]
    pub lowercase: bool,
    /// Include uppercase.
    #[serde(default = "default_true")]
    pub uppercase: bool,
    /// Include digits.
    #[serde(default = "default_true")]
    pub digits: bool,
    /// Include symbols.
    #[serde(default = "default_true")]
    pub symbols: bool,
    /// Exclude ambiguous characters.
    #[serde(default = "default_true")]
    pub exclude_ambiguous: bool,
}

fn default_length() -> usize {
    20
}
fn default_true() -> bool {
    true
}

/// Passphrase options from the frontend.
#[derive(Debug, Deserialize)]
pub struct PassphraseOptionsDto {
    /// Word count.
    #[serde(default = "default_words")]
    pub words: usize,
    /// Separator.
    #[serde(default = "default_separator")]
    pub separator: String,
    /// Capitalise words.
    #[serde(default = "default_true")]
    pub capitalize: bool,
}

fn default_words() -> usize {
    4
}
fn default_separator() -> String {
    "-".to_string()
}

/// Strength result DTO.
#[derive(Debug, Serialize)]
pub struct StrengthDto {
    /// Bucket 0..4.
    pub score: u8,
    /// Estimated entropy in bits.
    pub entropy_bits: f64,
    /// Common-password flag.
    pub is_common: bool,
    /// Short English label.
    pub label: String,
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

/// Current lock state.
#[tauri::command]
pub fn vault_status(state: State<VaultSession>) -> VaultStatus {
    state.status()
}

/// Whether a vault file exists at the given path.
#[tauri::command]
pub fn vault_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

/// Create a new vault.
#[tauri::command]
pub fn create_vault(
    state: State<VaultSession>,
    path: String,
    master_password: String,
) -> Result<CreateVaultResult, String> {
    if master_password.len() < 8 {
        return Err("master password must be at least 8 characters".to_string());
    }
    state.create_vault(&PathBuf::from(path), &master_password)
}

/// Unlock a vault with the master password.
#[tauri::command]
pub fn unlock_vault(
    state: State<VaultSession>,
    path: String,
    master_password: String,
) -> Result<VaultStatus, String> {
    state.unlock_vault(&PathBuf::from(path), &master_password)
}

/// Unlock a vault with the recovery key.
#[tauri::command]
pub fn unlock_vault_with_recovery(
    state: State<VaultSession>,
    path: String,
    recovery_key: String,
) -> Result<VaultStatus, String> {
    state.unlock_vault_with_recovery(&PathBuf::from(path), &recovery_key)
}

/// Lock the vault and drop key material.
#[tauri::command]
pub fn lock_vault(state: State<VaultSession>) -> VaultStatus {
    state.lock();
    state.status()
}

/// Persist the unlocked vault to disk.
#[tauri::command]
pub fn save_vault(state: State<VaultSession>) -> Result<(), String> {
    state.save_vault()
}

/// Record user activity (resets the idle auto-lock timer).
#[tauri::command]
pub fn note_activity(state: State<VaultSession>) {
    state.note_activity();
}

/// List items, optionally filtered by search.
#[tauri::command]
pub fn list_items(
    state: State<VaultSession>,
    query: Option<String>,
) -> Result<Vec<ItemDto>, String> {
    state.list_items(query.as_deref())
}

/// Create an item.
#[tauri::command]
pub fn create_item(state: State<VaultSession>, input: ItemInput) -> Result<ItemDto, String> {
    state.create_item(input)
}

/// Update an item.
#[tauri::command]
pub fn update_item(
    state: State<VaultSession>,
    id: String,
    input: ItemInput,
) -> Result<ItemDto, String> {
    state.update_item(&id, input)
}

/// Delete an item.
#[tauri::command]
pub fn delete_item(state: State<VaultSession>, id: String) -> Result<bool, String> {
    state.with_vault(|v| Ok(v.delete_item(&id)))
}

/// Toggle an item's favourite flag.
#[tauri::command]
pub fn toggle_favorite(state: State<VaultSession>, id: String) -> Result<bool, String> {
    state.with_vault(|v| Ok(v.toggle_favorite(&id)))
}

/// List folders.
#[tauri::command]
pub fn list_folders(state: State<VaultSession>) -> Result<Vec<FolderDto>, String> {
    state.list_folders()
}

/// Create a folder.
#[tauri::command]
pub fn create_folder(state: State<VaultSession>, name: String) -> Result<FolderDto, String> {
    state.create_folder(&name)
}

/// Delete a folder (items are un-parented).
#[tauri::command]
pub fn delete_folder(state: State<VaultSession>, id: String) -> Result<bool, String> {
    state.delete_folder(&id)
}

/// Change the master password (vault must be unlocked).
#[tauri::command]
pub fn change_master_password(
    state: State<VaultSession>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.len() < 8 {
        return Err("new password must be at least 8 characters".to_string());
    }
    state.with_vault(|v| {
        v.change_master_password(&current_password, &new_password)
            .map_err(|_| "invalid credentials".to_string())
    })?;
    state.save_vault()
}

/// Generate a password.
#[tauri::command]
pub fn generate_password(options: PasswordOptionsDto) -> String {
    let opts = PasswordOptions {
        length: options.length,
        lowercase: options.lowercase,
        uppercase: options.uppercase,
        digits: options.digits,
        symbols: options.symbols,
        exclude_ambiguous: options.exclude_ambiguous,
    };
    generator::generate_password(&opts)
}

/// Generate a passphrase.
#[tauri::command]
pub fn generate_passphrase(options: PassphraseOptionsDto) -> String {
    let opts = PassphraseOptions {
        words: options.words,
        separator: options.separator,
        capitalize: options.capitalize,
    };
    generator::generate_passphrase(&opts)
}

/// Estimate password strength locally.
#[tauri::command]
pub fn password_strength(password: String) -> StrengthDto {
    let result = strength::estimate(&password);
    StrengthDto {
        score: result.score,
        entropy_bits: result.entropy_bits,
        is_common: result.is_common,
        label: result.label().to_string(),
    }
}

/// Count passwords reused across items in the unlocked vault.
#[tauri::command]
pub fn reused_password_count(state: State<VaultSession>) -> Result<usize, String> {
    state.reused_password_count()
}

/// Export an encrypted backup to `dir`. Returns the written path.
#[tauri::command]
pub fn export_backup(state: State<VaultSession>, dir: String) -> Result<String, String> {
    state.export_backup(&PathBuf::from(dir))
}

/// List backups in a directory.
#[tauri::command]
pub fn list_backups(state: State<VaultSession>, dir: String) -> Result<Vec<BackupDto>, String> {
    state.list_backups(&PathBuf::from(dir))
}

/// Structural verification of a backup file; returns its created-at timestamp.
#[tauri::command]
pub fn verify_backup(path: String) -> Result<i64, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let manifest = backup::verify_structure(&bytes).map_err(|e| e.to_string())?;
    Ok(manifest.created_at)
}

/// Restore a backup to a new vault file. The active vault is locked first.
#[tauri::command]
pub fn restore_backup(
    state: State<VaultSession>,
    path: String,
    master_password: String,
    destination: String,
) -> Result<VaultStatus, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let manifest = backup::restore_to_path(&bytes, &master_password, &PathBuf::from(&destination))
        .map_err(|_| "could not verify this file".to_string())?;
    state.lock();
    let mut status = state.status();
    if let Some(count) = manifest.item_count {
        status.item_count = count as usize;
    }
    Ok(status)
}

/// Seconds since the latest backup in `dir`, if any.
#[tauri::command]
pub fn seconds_since_latest_backup(dir: String) -> Result<Option<i64>, String> {
    backup::seconds_since_latest(&PathBuf::from(dir)).map_err(|e| e.to_string())
}

/// Apply backup retention, keeping the newest `keep` backups.
#[tauri::command]
pub fn apply_backup_retention(dir: String, keep: usize) -> Result<usize, String> {
    backup::apply_retention(&PathBuf::from(dir), keep).map_err(|e| e.to_string())
}
