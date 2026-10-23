//! Portable encrypted backups.
//!
//! A backup is the same authenticated container as the live vault, marked with
//! `kind = Backup`. It is self-contained (salts, KDF parameters and wrapped keys
//! travel with it) and restores on a clean machine using only the file plus the
//! master password or recovery key. No DPAPI or machine binding is involved.
//!
//! Exports are atomic (temp → fsync → rename) so an interrupted write never
//! replaces the last good backup. See `docs/specs/02-vault-format.md` §6.

use std::fs;
use std::path::{Path, PathBuf};

use crate::container::format;
use crate::container::header::ContainerKind;
use crate::crypto::keys::RecoveryKey;
use crate::error::VaultError;
use crate::model::now_unix;
use crate::store::{atomic_write, Vault};

/// Filename prefix for backups produced by this app.
pub const BACKUP_PREFIX: &str = "aster-vault-backup-";
/// Filename extension for vault/backup containers.
pub const BACKUP_EXT: &str = "avlt";

/// Summary of a backup container.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupManifest {
    /// Creation timestamp (Unix seconds).
    pub created_at: i64,
    /// Container kind (normally `Backup`).
    pub kind: ContainerKind,
    /// Item count, if the backup was opened with a valid credential.
    pub item_count: Option<u64>,
    /// Whether the payload authenticated successfully.
    pub authenticated: bool,
}

/// Build a backup path for a timestamp inside `dir`.
fn backup_path(dir: &Path, created_at: i64) -> PathBuf {
    dir.join(format!("{BACKUP_PREFIX}{created_at}.{BACKUP_EXT}"))
}

/// Export an unlocked vault to `dir` as an atomic backup file.
///
/// Returns the path written.
pub fn export(vault: &Vault, dir: &Path) -> Result<PathBuf, VaultError> {
    fs::create_dir_all(dir)?;
    let path = backup_path(dir, now_unix());
    let bytes = vault.to_backup_bytes()?;
    atomic_write(&path, &bytes)?;
    Ok(path)
}

/// Structurally validate a backup file without any credential.
///
/// Confirms the magic, format version, header, framing and tag length. It cannot
/// prove the payload is authentic without the key, so `authenticated` is false.
pub fn verify_structure(bytes: &[u8]) -> Result<BackupManifest, VaultError> {
    let decoded = format::decode(bytes)?;
    Ok(BackupManifest {
        created_at: decoded.header.created_at,
        kind: decoded.header.kind,
        item_count: None,
        authenticated: false,
    })
}

/// Build a manifest from an already-opened (authenticated) vault.
fn manifest_of(vault: &Vault) -> BackupManifest {
    BackupManifest {
        created_at: vault.header().created_at,
        kind: vault.header().kind,
        item_count: Some(vault.item_count() as u64),
        authenticated: true,
    }
}

/// Reject a restore destination that cannot safely receive a vault file.
///
/// The destination must be a *file* path: a directory (such as the backup
/// folder the UI used to pre-fill) would make the final atomic rename fail, and
/// a path with no file name is ambiguous. Refusing the vault file that is
/// currently open is the session layer's job, since only it knows that path.
fn ensure_file_destination(destination: &Path) -> Result<(), VaultError> {
    if destination.is_dir() || destination.file_name().is_none() {
        return Err(VaultError::InvalidDestination);
    }
    Ok(())
}

/// Open a backup with the master password and report item count.
pub fn inspect(bytes: &[u8], master_password: &str) -> Result<BackupManifest, VaultError> {
    let vault = Vault::from_bytes(bytes, master_password)?;
    Ok(manifest_of(&vault))
}

/// Authenticate a backup with the master password and report item count.
///
/// Unlike [`verify_structure`], this actually decrypts the payload, so a
/// byte-flipped backup fails. Alias of [`inspect`] with a name that says what
/// it proves.
pub fn verify_with_password(
    bytes: &[u8],
    master_password: &str,
) -> Result<BackupManifest, VaultError> {
    inspect(bytes, master_password)
}

/// Authenticate a backup with a recovery key and report item count.
pub fn verify_with_recovery(
    bytes: &[u8],
    recovery_key: &RecoveryKey,
) -> Result<BackupManifest, VaultError> {
    let vault = Vault::from_bytes_with_recovery(bytes, recovery_key)?;
    Ok(manifest_of(&vault))
}

/// Authenticate a backup with **either** a master password or a recovery key.
///
/// Tries the master password first; if that does not unwrap the key, the
/// credential is parsed as a recovery key. Fails closed if neither path
/// authenticates. The manifest reports the item count on success.
pub fn verify_with_credential(
    bytes: &[u8],
    credential: &str,
) -> Result<BackupManifest, VaultError> {
    match Vault::from_bytes(bytes, credential) {
        Ok(vault) => Ok(manifest_of(&vault)),
        Err(VaultError::InvalidCredentials) => {
            let key = RecoveryKey::decode(credential)?;
            verify_with_recovery(bytes, &key)
        }
        Err(other) => Err(other),
    }
}

/// Restore a backup's contents to a **new** file, leaving any existing file alone
/// until the caller confirms. The destination is written atomically.
pub fn restore_to_path(
    bytes: &[u8],
    master_password: &str,
    destination: &Path,
) -> Result<BackupManifest, VaultError> {
    ensure_file_destination(destination)?;
    let vault = Vault::from_bytes(bytes, master_password)?;
    vault.save_file(destination)?;
    Ok(manifest_of(&vault))
}

/// Restore using the recovery key instead of the master password.
pub fn restore_to_path_with_recovery(
    bytes: &[u8],
    recovery_key: &RecoveryKey,
    destination: &Path,
) -> Result<BackupManifest, VaultError> {
    ensure_file_destination(destination)?;
    let vault = Vault::from_bytes_with_recovery(bytes, recovery_key)?;
    vault.save_file(destination)?;
    Ok(manifest_of(&vault))
}

/// Restore using either a master password or a recovery key.
///
/// Auto-detects the credential the same way [`verify_with_credential`] does, so
/// the recovery-key path is reachable from the desktop app as well as the CLI.
pub fn restore_to_path_with_credential(
    bytes: &[u8],
    credential: &str,
    destination: &Path,
) -> Result<BackupManifest, VaultError> {
    ensure_file_destination(destination)?;
    match Vault::from_bytes(bytes, credential) {
        Ok(vault) => {
            vault.save_file(destination)?;
            Ok(manifest_of(&vault))
        }
        Err(VaultError::InvalidCredentials) => {
            let key = RecoveryKey::decode(credential)?;
            restore_to_path_with_recovery(bytes, &key, destination)
        }
        Err(other) => Err(other),
    }
}

/// List backups in `dir`, oldest first.
pub fn list_backups(dir: &Path) -> Result<Vec<PathBuf>, VaultError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut paths: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with(BACKUP_PREFIX) && name.ends_with(BACKUP_EXT))
                .unwrap_or(false)
        })
        .collect();
    paths.sort();
    Ok(paths)
}

/// The most recent backup in `dir`, if any.
pub fn latest_backup(dir: &Path) -> Result<Option<PathBuf>, VaultError> {
    Ok(list_backups(dir)?.pop())
}

/// Delete the oldest backups so that at most `keep` remain.
///
/// Only files created by this app (matching [`BACKUP_PREFIX`]) are ever touched.
/// Returns the number of files removed.
pub fn apply_retention(dir: &Path, keep: usize) -> Result<usize, VaultError> {
    let mut backups = list_backups(dir)?;
    if backups.len() <= keep {
        return Ok(0);
    }
    let remove_count = backups.len() - keep;
    let mut removed = 0;
    for path in backups.drain(0..remove_count) {
        fs::remove_file(path)?;
        removed += 1;
    }
    Ok(removed)
}

/// Seconds since the latest backup, if one exists.
pub fn seconds_since_latest(dir: &Path) -> Result<Option<i64>, VaultError> {
    match latest_backup(dir)? {
        None => Ok(None),
        Some(path) => {
            let bytes = fs::read(path)?;
            let manifest = verify_structure(&bytes)?;
            Ok(Some(now_unix().saturating_sub(manifest.created_at)))
        }
    }
}
