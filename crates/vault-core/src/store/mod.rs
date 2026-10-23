//! Encrypted vault store.
//!
//! A [`Vault`] keeps the decrypted [`VaultData`] graph in memory while unlocked
//! and seals it into the portable container on save. The whole graph is one
//! authenticated payload, so every field (titles, URLs, usernames, tags, notes,
//! TOTP seeds) is encrypted at rest.
//!
//! No plaintext index is persisted; search runs over the in-memory graph.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use zeroize::{Zeroize, Zeroizing};

use crate::container::format::{self, DecodedContainer};
use crate::container::header::{ContainerKind, VaultHeader};
use crate::container::vault;
use crate::crypto::aead;
use crate::crypto::keys::{RecoveryKey, VaultKey};
use crate::crypto::rng::random_vec;
use crate::error::VaultError;
use crate::model::{Folder, Item, ItemType, VaultData, SCHEMA_VERSION};

/// A decrypted, unlocked vault.
pub struct Vault {
    key: VaultKey,
    header: VaultHeader,
    data: VaultData,
}

impl std::fmt::Debug for Vault {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never reveal key material or secret contents.
        f.debug_struct("Vault")
            .field("hydration", &"unlocked")
            .field("items", &self.data.items.len())
            .field("folders", &self.data.folders.len())
            .finish_non_exhaustive()
    }
}

/// Wipe a string map's keys and values, then drop the (now zeroed) entries.
///
/// `BTreeMap::iter_mut` only lends the keys immutably, so the map is taken
/// (leaving an empty one in its place) and consumed entry by entry.
fn zeroize_string_map(map: &mut std::collections::BTreeMap<String, String>) {
    for (mut key, mut value) in std::mem::take(map) {
        key.zeroize();
        value.zeroize();
    }
}

/// Overwrite every plaintext buffer owned by an item.
fn zeroize_item(item: &mut Item) {
    item.id.zeroize();
    item.title.zeroize();
    if let Some(folder_id) = item.folder_id.as_mut() {
        folder_id.zeroize();
    }
    for tag in item.tags.iter_mut() {
        tag.zeroize();
    }
    item.tags.clear();
    zeroize_string_map(&mut item.fields);
    item.notes.zeroize();
    for revision in item.history.iter_mut() {
        zeroize_string_map(&mut revision.fields);
        revision.notes.zeroize();
    }
    item.history.clear();
}

/// Wipe every plaintext buffer reachable from the decrypted graph.
///
/// Runs from [`Vault`]'s `Drop`, which fires on both an explicit lock (the
/// session drops the vault) and process teardown. Each `String`/`Vec`/map entry
/// is overwritten with zeroes *before* the allocator frees it, so decrypted
/// titles, usernames, passwords, notes and TOTP seeds do not linger in freed
/// heap pages. This is best-effort only — the OS may have paged the bytes to
/// disk or copied them — so it is not a secure-erase guarantee.
fn zeroize_vault_data(data: &mut VaultData) {
    for item in data.items.iter_mut() {
        zeroize_item(item);
    }
    data.items.clear();
    for folder in data.folders.iter_mut() {
        folder.name.zeroize();
    }
    data.folders.clear();
}

impl Drop for Vault {
    fn drop(&mut self) {
        // Locking (and process exit) drops the `Vault`; wipe the decrypted graph
        // before the allocator reclaims it. `VaultKey` zeroizes itself on drop.
        zeroize_vault_data(&mut self.data);
    }
}

impl Vault {
    /// Create a new vault in memory.
    ///
    /// Returns the vault, the recovery key to present once, and the serialized
    /// container bytes.
    pub fn create(
        master_password: &str,
        kdf: crate::crypto::kdf::KdfParams,
    ) -> Result<(Self, RecoveryKey, Vec<u8>), VaultError> {
        let created = vault::create(master_password, kdf)?;
        let vault = Vault {
            key: created.vault_key,
            header: created.header,
            data: VaultData::new(),
        };
        let bytes = vault.to_bytes()?;
        Ok((vault, created.recovery_key, bytes))
    }

    /// Create and atomically write a new vault file.
    pub fn create_file(
        path: &Path,
        master_password: &str,
        kdf: crate::crypto::kdf::KdfParams,
    ) -> Result<(Self, RecoveryKey), VaultError> {
        let (vault, recovery_key, bytes) = Self::create(master_password, kdf)?;
        atomic_write(path, &bytes)?;
        Ok((vault, recovery_key))
    }

    /// Open a vault file with the master password.
    pub fn open_file(path: &Path, master_password: &str) -> Result<Self, VaultError> {
        let bytes = fs::read(path)?;
        Self::from_bytes(&bytes, master_password)
    }

    /// Open a vault file with the recovery key.
    pub fn open_file_with_recovery(
        path: &Path,
        recovery_key: &RecoveryKey,
    ) -> Result<Self, VaultError> {
        let bytes = fs::read(path)?;
        Self::from_bytes_with_recovery(&bytes, recovery_key)
    }

    /// Unlock from container bytes using the master password.
    pub fn from_bytes(bytes: &[u8], master_password: &str) -> Result<Self, VaultError> {
        let decoded = format::decode(bytes)?;
        let key = vault::unlock_with_password(&decoded.header, master_password)?;
        Self::finish_unlock(key, decoded)
    }

    /// Unlock from container bytes using the recovery key.
    pub fn from_bytes_with_recovery(
        bytes: &[u8],
        recovery_key: &RecoveryKey,
    ) -> Result<Self, VaultError> {
        let decoded = format::decode(bytes)?;
        let key = vault::unlock_with_recovery_key(&decoded.header, recovery_key)?;
        Self::finish_unlock(key, decoded)
    }

    fn finish_unlock(key: VaultKey, decoded: DecodedContainer) -> Result<Self, VaultError> {
        let aad = format::payload_aad(&decoded.header)?;
        let plaintext = Zeroizing::new(
            aead::open(key.expose(), &decoded.nonce, &decoded.ciphertext, &aad)
                .map_err(|_| VaultError::AuthenticationFailed)?,
        );
        let data: VaultData =
            serde_json::from_slice(&plaintext).map_err(|_| VaultError::Corrupt)?;
        if data.schema_version > SCHEMA_VERSION {
            return Err(VaultError::Corrupt);
        }
        Ok(Vault {
            key,
            header: decoded.header,
            data,
        })
    }

    /// Serialize and seal the vault into container bytes.
    pub fn to_bytes(&self) -> Result<Vec<u8>, VaultError> {
        let plaintext = Zeroizing::new(serde_json::to_vec(&self.data)?);
        let aad = format::payload_aad(&self.header)?;
        let nonce = random_vec(aead::NONCE_LEN);
        let ciphertext = aead::seal(self.key.expose(), &nonce, &plaintext, &aad)?;
        format::encode(&self.header, &nonce, &ciphertext)
    }

    /// Serialize as a **backup** container (same key material, kind = Backup).
    pub fn to_backup_bytes(&self) -> Result<Vec<u8>, VaultError> {
        let mut header = self.header.clone();
        header.kind = ContainerKind::Backup;
        let plaintext = Zeroizing::new(serde_json::to_vec(&self.data)?);
        let aad = format::payload_aad(&header)?;
        let nonce = random_vec(aead::NONCE_LEN);
        let ciphertext = aead::seal(self.key.expose(), &nonce, &plaintext, &aad)?;
        format::encode(&header, &nonce, &ciphertext)
    }

    /// Atomically save to a file (temp → fsync → rename).
    pub fn save_file(&self, path: &Path) -> Result<(), VaultError> {
        let bytes = self.to_bytes()?;
        atomic_write(path, &bytes)
    }

    /// The container header.
    pub fn header(&self) -> &VaultHeader {
        &self.header
    }

    /// Read-only access to the decrypted graph.
    pub fn data(&self) -> &VaultData {
        &self.data
    }

    /// Number of items.
    pub fn item_count(&self) -> usize {
        self.data.items.len()
    }

    /// Number of folders.
    pub fn folder_count(&self) -> usize {
        self.data.folders.len()
    }

    // ---- Items -------------------------------------------------------------

    /// Add a new item, returning its id.
    pub fn add_item(&mut self, item: Item) -> String {
        let id = item.id.clone();
        self.data.items.push(item);
        id
    }

    /// Replace an item by id, snapshotting history.
    pub fn update_item(
        &mut self,
        id: &str,
        title: String,
        fields: std::collections::BTreeMap<String, String>,
        notes: String,
    ) -> Result<(), VaultError> {
        let item = self
            .data
            .items
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or(VaultError::Corrupt)?;
        item.apply_edit(title, fields, notes);
        Ok(())
    }

    /// Remove an item by id. Returns whether it existed.
    pub fn delete_item(&mut self, id: &str) -> bool {
        let before = self.data.items.len();
        self.data.items.retain(|item| item.id != id);
        self.data.items.len() != before
    }

    /// Get an item by id.
    pub fn item(&self, id: &str) -> Option<&Item> {
        self.data.items.iter().find(|item| item.id == id)
    }

    /// Toggle an item's favourite flag.
    pub fn toggle_favorite(&mut self, id: &str) -> bool {
        if let Some(item) = self.data.items.iter_mut().find(|item| item.id == id) {
            item.favorite = !item.favorite;
            return item.favorite;
        }
        false
    }

    /// All items of a given type.
    pub fn items_by_type(&self, item_type: ItemType) -> Vec<&Item> {
        self.data
            .items
            .iter()
            .filter(|item| item.item_type == item_type)
            .collect()
    }

    /// Favourite items.
    pub fn favorites(&self) -> Vec<&Item> {
        self.data
            .items
            .iter()
            .filter(|item| item.favorite)
            .collect()
    }

    /// Case-insensitive search across title, tags, notes and field values.
    pub fn search(&self, query: &str) -> Vec<&Item> {
        let needle = query.trim().to_lowercase();
        if needle.is_empty() {
            return self.data.items.iter().collect();
        }
        self.data
            .items
            .iter()
            .filter(|item| {
                item.title.to_lowercase().contains(&needle)
                    || item.notes.to_lowercase().contains(&needle)
                    || item
                        .tags
                        .iter()
                        .any(|tag| tag.to_lowercase().contains(&needle))
                    || item
                        .fields
                        .values()
                        .any(|value| value.to_lowercase().contains(&needle))
            })
            .collect()
    }

    // ---- Folders -----------------------------------------------------------

    /// Add a folder, returning its id.
    pub fn add_folder(&mut self, folder: Folder) -> String {
        let id = folder.id.clone();
        self.data.folders.push(folder);
        id
    }

    /// Remove a folder by id; items are un-parented, not deleted.
    pub fn delete_folder(&mut self, id: &str) -> bool {
        let before = self.data.folders.len();
        self.data.folders.retain(|folder| folder.id != id);
        for item in self.data.items.iter_mut() {
            if item.folder_id.as_deref() == Some(id) {
                item.folder_id = None;
            }
        }
        self.data.folders.len() != before
    }

    /// Change the master password; the vault must be unlocked.
    pub fn change_master_password(
        &mut self,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), VaultError> {
        let updated = vault::change_master_password(&self.header, current_password, new_password)?;
        self.header = updated;
        Ok(())
    }
}

/// Atomically write `bytes` to `path`: write temp, fsync, rename.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), VaultError> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(dir)?;
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "vault".to_string());
    let tmp: PathBuf = dir.join(format!(".{}.{}.tmp", file_name, uuid::Uuid::new_v4()));
    {
        let mut file = File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Revision;
    use std::collections::BTreeMap;

    /// The wipe helper must empty every plaintext collection. We cannot portably
    /// observe the freed bytes, so this asserts the reachable graph is emptied
    /// (which is what `Drop for Vault` guarantees before deallocation).
    #[test]
    fn zeroize_vault_data_empties_the_graph() {
        let mut data = VaultData::new();
        let mut item = Item::new(ItemType::Login, "TOPSECRET-TITLE");
        item.set_field("password", "TOPSECRET-PASSWORD");
        item.notes = "TOPSECRET-NOTES".to_string();
        item.tags.push("TOPSECRET-TAG".to_string());
        item.folder_id = Some("TOPSECRET-FOLDER-ID".to_string());
        item.history.push(Revision {
            updated_at: 0,
            fields: BTreeMap::from([("password".to_string(), "OLD-SECRET".to_string())]),
            notes: "OLD-NOTES".to_string(),
        });
        data.items.push(item);
        data.folders.push(Folder::new("TOPSECRET-FOLDER"));

        zeroize_vault_data(&mut data);

        assert!(data.items.is_empty());
        assert!(data.folders.is_empty());
    }

    /// A `Vault` must keep behaving normally with the `Drop` impl in place:
    /// mutations, serialization, and reopen all still round-trip.
    #[test]
    fn vault_still_behaves_with_drop_impl() {
        let params = crate::crypto::kdf::KdfParams {
            m_cost: 8,
            t_cost: 1,
            p_cost: 1,
        };
        let (mut vault, _recovery, _bytes) = Vault::create("pw", params).unwrap();
        let mut item = Item::new(ItemType::Login, "Roundtrip");
        item.set_field("password", "s3cret");
        vault.add_item(item);
        let bytes = vault.to_bytes().unwrap();
        drop(vault);

        let reopened = Vault::from_bytes(&bytes, "pw").unwrap();
        assert_eq!(reopened.item_count(), 1);
        assert_eq!(
            reopened
                .item(&reopened.data().items[0].id)
                .unwrap()
                .field("password"),
            Some("s3cret")
        );
    }
}
