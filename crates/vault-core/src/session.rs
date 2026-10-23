//! Unlocked-vault session and service layer.
//!
//! This module owns the unlocked [`Vault`] and the app-facing DTOs. It is pure
//! Rust with no GUI dependency, so the whole service layer is unit-testable
//! locally; the Tauri command surface is a thin wrapper over it.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::backup;
use crate::generator;
use crate::model::{Folder, Item, ItemType};
use crate::strength;
use crate::{KdfParams, Vault};

/// Default auto-lock window applied by the backend as a safety net.
pub const DEFAULT_AUTO_LOCK_SECS: u64 = 5 * 60;

/// Serializable item representation for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ItemDto {
    /// Item id.
    pub id: String,
    /// Item type as a snake_case string.
    pub item_type: String,
    /// Title.
    pub title: String,
    /// Folder id, if any.
    pub folder_id: Option<String>,
    /// Favourite flag.
    pub favorite: bool,
    /// Tags.
    pub tags: Vec<String>,
    /// Creation timestamp.
    pub created_at: i64,
    /// Update timestamp.
    pub updated_at: i64,
    /// Field map.
    pub fields: BTreeMap<String, String>,
    /// Notes.
    pub notes: String,
    /// History entry timestamps.
    pub history: Vec<i64>,
}

/// Input for creating or updating an item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemInput {
    /// Item type string.
    pub item_type: String,
    /// Title.
    pub title: String,
    /// Folder id.
    #[serde(default)]
    pub folder_id: Option<String>,
    /// Favourite flag.
    #[serde(default)]
    pub favorite: bool,
    /// Tags.
    #[serde(default)]
    pub tags: Vec<String>,
    /// Field map.
    #[serde(default)]
    pub fields: BTreeMap<String, String>,
    /// Notes.
    #[serde(default)]
    pub notes: String,
}

/// Serializable folder representation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FolderDto {
    /// Folder id.
    pub id: String,
    /// Folder name.
    pub name: String,
    /// Creation timestamp.
    pub created_at: i64,
}

/// Status snapshot returned to the frontend.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct VaultStatus {
    /// Whether a vault is currently unlocked.
    pub unlocked: bool,
    /// Number of items in the unlocked vault.
    pub item_count: usize,
    /// Number of folders.
    pub folder_count: usize,
    /// Path of the open vault, if any.
    pub path: Option<String>,
}

/// Result of creating a vault.
#[derive(Debug, Clone, Serialize)]
pub struct CreateVaultResult {
    /// The recovery key, shown once.
    pub recovery_key: String,
    /// Status after creation.
    pub status: VaultStatus,
}

/// Summary of a backup container.
#[derive(Debug, Clone, Serialize)]
pub struct BackupDto {
    /// Path.
    pub path: String,
    /// Created-at timestamp from the header (0 if unreadable).
    pub created_at: i64,
    /// File size in bytes.
    pub size: u64,
}

struct Inner {
    vault: Option<Vault>,
    path: Option<PathBuf>,
    last_activity: Instant,
}

/// Thread-safe unlocked-vault session.
pub struct VaultSession {
    inner: Mutex<Inner>,
}

impl Default for VaultSession {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Inner {
                vault: None,
                path: None,
                last_activity: Instant::now(),
            }),
        }
    }
}

fn parse_item_type(value: &str) -> ItemType {
    match value {
        "note" => ItemType::Note,
        "card" => ItemType::Card,
        "identity" => ItemType::Identity,
        "totp" => ItemType::Totp,
        _ => ItemType::Login,
    }
}

fn item_type_str(item_type: ItemType) -> String {
    match item_type {
        ItemType::Login => "login",
        ItemType::Note => "note",
        ItemType::Card => "card",
        ItemType::Identity => "identity",
        ItemType::Totp => "totp",
    }
    .to_string()
}

/// Convert a vault item into its DTO form.
pub fn item_to_dto(item: &Item) -> ItemDto {
    ItemDto {
        id: item.id.clone(),
        item_type: item_type_str(item.item_type),
        title: item.title.clone(),
        folder_id: item.folder_id.clone(),
        favorite: item.favorite,
        tags: item.tags.clone(),
        created_at: item.created_at,
        updated_at: item.updated_at,
        fields: item.fields.clone(),
        notes: item.notes.clone(),
        history: item
            .history
            .iter()
            .map(|revision| revision.updated_at)
            .collect(),
    }
}

fn folder_to_dto(folder: &Folder) -> FolderDto {
    FolderDto {
        id: folder.id.clone(),
        name: folder.name.clone(),
        created_at: folder.created_at,
    }
}

fn input_to_item(input: &ItemInput) -> Item {
    let mut item = Item::new(parse_item_type(&input.item_type), input.title.clone());
    item.folder_id = input.folder_id.clone();
    item.favorite = input.favorite;
    item.tags = input.tags.clone();
    item.fields = input.fields.clone();
    item.notes = input.notes.clone();
    item
}

impl VaultSession {
    /// Run `f` against the unlocked vault, or return an error if locked.
    pub fn with_vault<T>(
        &self,
        f: impl FnOnce(&mut Vault) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut inner = self.inner.lock().map_err(|_| "state poisoned")?;
        if inner.vault.is_none() {
            return Err("vault is locked".to_string());
        }
        // Auto-lock safety net: if idle too long, drop the vault.
        if inner.last_activity.elapsed() > Duration::from_secs(DEFAULT_AUTO_LOCK_SECS) {
            inner.vault = None;
            return Err("vault auto-locked".to_string());
        }
        let vault = inner.vault.as_mut().expect("checked above");
        let result = f(vault);
        if result.is_ok() {
            inner.last_activity = Instant::now();
        }
        result
    }

    /// Read-only access helper.
    pub fn read<T>(&self, f: impl FnOnce(&Vault) -> T) -> Result<T, String> {
        let inner = self.inner.lock().map_err(|_| "state poisoned")?;
        let vault = inner.vault.as_ref().ok_or("vault is locked")?;
        Ok(f(vault))
    }

    /// Mark activity (resets the idle timer).
    pub fn note_activity(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.last_activity = Instant::now();
        }
    }

    /// Status snapshot.
    pub fn status(&self) -> VaultStatus {
        match self.inner.lock() {
            Ok(inner) => VaultStatus {
                unlocked: inner.vault.is_some(),
                item_count: inner.vault.as_ref().map(Vault::item_count).unwrap_or(0),
                folder_count: inner.vault.as_ref().map(Vault::folder_count).unwrap_or(0),
                path: inner
                    .path
                    .as_ref()
                    .map(|path| path.to_string_lossy().to_string()),
            },
            Err(_) => VaultStatus {
                unlocked: false,
                item_count: 0,
                folder_count: 0,
                path: None,
            },
        }
    }

    /// Replace the unlocked vault (after create/unlock/restore).
    pub fn set_vault(&self, vault: Vault, path: PathBuf) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.vault = Some(vault);
            inner.path = Some(path);
            inner.last_activity = Instant::now();
        }
    }

    /// Drop the unlocked vault and its key material.
    ///
    /// Every mutating service method persists to disk before returning, so
    /// there is nothing left to flush here and no save is attempted (which
    /// keeps lock-time behaviour unchanged when there is no vault path).
    pub fn lock(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.vault = None;
        }
    }

    /// The open vault path, if any.
    pub fn path(&self) -> Option<PathBuf> {
        self.inner.lock().ok().and_then(|inner| inner.path.clone())
    }

    // ---- Service operations ------------------------------------------------

    /// Create a vault file and return its recovery key plus status.
    pub fn create_vault(
        &self,
        path: &Path,
        master_password: &str,
    ) -> Result<CreateVaultResult, String> {
        let (vault, recovery) = Vault::create_file(path, master_password, KdfParams::recommended())
            .map_err(|e| e.to_string())?;
        let recovery_key = recovery.encode();
        self.set_vault(vault, path.to_path_buf());
        Ok(CreateVaultResult {
            recovery_key,
            status: self.status(),
        })
    }

    /// Unlock a vault file with the master password.
    pub fn unlock_vault(&self, path: &Path, master_password: &str) -> Result<VaultStatus, String> {
        let vault = Vault::open_file(path, master_password)
            .map_err(|_| "invalid credentials".to_string())?;
        self.set_vault(vault, path.to_path_buf());
        Ok(self.status())
    }

    /// Unlock with the recovery key.
    pub fn unlock_vault_with_recovery(
        &self,
        path: &Path,
        recovery_key: &str,
    ) -> Result<VaultStatus, String> {
        let key = crate::RecoveryKey::decode(recovery_key)
            .map_err(|_| "invalid recovery key".to_string())?;
        let vault = Vault::open_file_with_recovery(path, &key)
            .map_err(|_| "invalid credentials".to_string())?;
        self.set_vault(vault, path.to_path_buf());
        Ok(self.status())
    }

    /// Save the unlocked vault back to its file.
    pub fn save_vault(&self) -> Result<(), String> {
        let path = self.path().ok_or("no vault path")?;
        self.with_vault(|vault| vault.save_file(&path).map_err(|e| e.to_string()))
    }

    /// Apply a mutation to the unlocked vault and persist it to disk.
    ///
    /// The in-memory change is applied first; if it succeeds the vault is
    /// written back to its file, so a mutation is durable even if the session
    /// is locked (auto-lock, window close) before any explicit save. A failed
    /// write is returned to the caller rather than swallowed.
    fn mutate<T>(&self, f: impl FnOnce(&mut Vault) -> Result<T, String>) -> Result<T, String> {
        let path = self.path().ok_or("no vault path")?;
        self.with_vault(|vault| {
            let value = f(vault)?;
            vault.save_file(&path).map_err(|e| e.to_string())?;
            Ok(value)
        })
    }

    /// Create a new item.
    pub fn create_item(&self, input: ItemInput) -> Result<ItemDto, String> {
        self.mutate(|vault| {
            let item = input_to_item(&input);
            let id = vault.add_item(item);
            let item = vault.item(&id).expect("just added");
            Ok(item_to_dto(item))
        })
    }

    /// Update an existing item.
    pub fn update_item(&self, id: &str, input: ItemInput) -> Result<ItemDto, String> {
        self.mutate(|vault| {
            vault
                .update_item(
                    id,
                    input.title.clone(),
                    input.fields.clone(),
                    input.notes.clone(),
                )
                .map_err(|_| "item not found".to_string())?;
            let item = vault.item(id).ok_or("item not found")?;
            Ok(item_to_dto(item))
        })
    }

    /// Delete an item.
    pub fn delete_item(&self, id: &str) -> Result<bool, String> {
        self.mutate(|vault| Ok(vault.delete_item(id)))
    }

    /// Toggle an item's favourite flag.
    pub fn toggle_favorite(&self, id: &str) -> Result<bool, String> {
        self.mutate(|vault| Ok(vault.toggle_favorite(id)))
    }

    /// List items, optionally filtered by search.
    pub fn list_items(&self, query: Option<&str>) -> Result<Vec<ItemDto>, String> {
        self.read(|vault| {
            let items: Vec<&Item> = match query {
                Some(q) if !q.trim().is_empty() => vault.search(q),
                _ => vault.data().items.iter().collect(),
            };
            items.into_iter().map(item_to_dto).collect()
        })
    }

    /// List folders.
    pub fn list_folders(&self) -> Result<Vec<FolderDto>, String> {
        self.read(|vault| vault.data().folders.iter().map(folder_to_dto).collect())
    }

    /// Create a folder.
    pub fn create_folder(&self, name: &str) -> Result<FolderDto, String> {
        self.mutate(|vault| {
            let folder = Folder::new(name);
            let id = vault.add_folder(folder);
            let folder = vault
                .data()
                .folders
                .iter()
                .find(|f| f.id == id)
                .ok_or("folder not found")?;
            Ok(folder_to_dto(folder))
        })
    }

    /// Delete a folder (items are un-parented).
    pub fn delete_folder(&self, id: &str) -> Result<bool, String> {
        self.mutate(|vault| Ok(vault.delete_folder(id)))
    }

    /// Count reused passwords.
    pub fn reused_password_count(&self) -> Result<usize, String> {
        self.read(|vault| {
            let passwords: Vec<String> = vault
                .data()
                .items
                .iter()
                .filter_map(|item| item.field("password").map(str::to_string))
                .collect();
            strength::reused_count(&passwords)
        })
    }

    /// Export an encrypted backup to `dir`.
    pub fn export_backup(&self, dir: &Path) -> Result<String, String> {
        self.with_vault(|vault| {
            let path = backup::export(vault, dir).map_err(|e| e.to_string())?;
            Ok(path.to_string_lossy().to_string())
        })
    }

    /// List backups in a directory, newest first.
    pub fn list_backups(&self, dir: &Path) -> Result<Vec<BackupDto>, String> {
        let paths = backup::list_backups(dir).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for path in paths.into_iter().rev() {
            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            let created_at = std::fs::read(&path)
                .ok()
                .and_then(|bytes| backup::verify_structure(&bytes).ok())
                .map(|manifest| manifest.created_at)
                .unwrap_or(0);
            out.push(BackupDto {
                path: path.to_string_lossy().to_string(),
                created_at,
                size,
            });
        }
        Ok(out)
    }
}

/// Generate a password from options (thin re-export for the command layer).
pub fn generate_password(options: &generator::PasswordOptions) -> String {
    generator::generate_password(options)
}
