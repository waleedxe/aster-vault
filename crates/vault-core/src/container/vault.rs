//! High-level vault operations: create, unlock, and master-password rotation.

use std::time::{SystemTime, UNIX_EPOCH};

use zeroize::Zeroizing;

use crate::container::header::{ContainerKind, VaultHeader, WrapDescriptor, FORMAT_VERSION};
use crate::crypto::aead;
use crate::crypto::kdf::{self, KdfParams, SALT_LEN};
use crate::crypto::keys::{RecoveryKey, VaultKey, KEY_LEN};
use crate::crypto::rng::{random_array, random_vec};
use crate::error::VaultError;

/// Result of creating a vault: the header plus the freshly generated keys.
///
/// The recovery key is returned **once** so the UI can present it; it is never
/// stored anywhere by the core.
pub struct CreatedVault {
    /// The container header.
    pub header: VaultHeader,
    /// The vault data key (held in memory while unlocked).
    pub vault_key: VaultKey,
    /// The recovery key to show the user.
    pub recovery_key: RecoveryKey,
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Build a header with placeholder wraps so the AAD can be computed first.
fn skeleton_header(
    kind: ContainerKind,
    params: KdfParams,
    master_salt: Vec<u8>,
    recovery_salt: Vec<u8>,
) -> VaultHeader {
    let empty = WrapDescriptor {
        nonce: vec![0u8; aead::NONCE_LEN],
        wrapped_key: Vec::new(),
    };
    VaultHeader {
        format_version: FORMAT_VERSION,
        kind,
        created_at: now_unix(),
        kdf: params,
        master_salt,
        master_wrap: empty.clone(),
        recovery_salt,
        recovery_wrap: empty,
    }
}

/// Generate a random 96-bit nonce for a single-use wrap.
fn wrap_nonce() -> Vec<u8> {
    random_vec(aead::NONCE_LEN)
}

/// Create a new vault with a master password and a recovery key.
pub fn create(master_password: &str, params: KdfParams) -> Result<CreatedVault, VaultError> {
    create_with_kind(master_password, params, ContainerKind::Vault)
}

/// Create a new container of the given kind (used for backups in Phase 3).
pub fn create_with_kind(
    master_password: &str,
    params: KdfParams,
    kind: ContainerKind,
) -> Result<CreatedVault, VaultError> {
    params.validate()?;

    let vault_key = VaultKey::generate();
    let recovery_key = RecoveryKey::generate();

    let master_salt = random_array::<SALT_LEN>().to_vec();
    let recovery_salt = random_array::<SALT_LEN>().to_vec();

    let mut header = skeleton_header(kind, params, master_salt, recovery_salt);
    let aad = header.aad()?;

    // Wrap under the master password.
    let kek = kdf::derive_key(master_password.as_bytes(), &header.master_salt, params)?;
    let master_nonce = wrap_nonce();
    let master_wrapped = aead::seal(&kek[..], &master_nonce, vault_key.expose(), &aad)?;
    header.master_wrap = WrapDescriptor {
        nonce: master_nonce,
        wrapped_key: master_wrapped,
    };

    // Wrap under the recovery key (independent path).
    let rek = kdf::derive_key(recovery_key.expose(), &header.recovery_salt, params)?;
    let recovery_nonce = wrap_nonce();
    let recovery_wrapped = aead::seal(&rek[..], &recovery_nonce, vault_key.expose(), &aad)?;
    header.recovery_wrap = WrapDescriptor {
        nonce: recovery_nonce,
        wrapped_key: recovery_wrapped,
    };

    Ok(CreatedVault {
        header,
        vault_key,
        recovery_key,
    })
}

fn unwrap_key_bytes(bytes: Vec<u8>) -> Result<VaultKey, VaultError> {
    let bytes = Zeroizing::new(bytes);
    if bytes.len() != KEY_LEN {
        return Err(VaultError::Corrupt);
    }
    let mut arr = [0u8; KEY_LEN];
    arr.copy_from_slice(&bytes);
    Ok(VaultKey::from_bytes(arr))
}

/// Unlock a vault using the master password.
pub fn unlock_with_password(
    header: &VaultHeader,
    master_password: &str,
) -> Result<VaultKey, VaultError> {
    let aad = header.aad()?;
    let kek = kdf::derive_key(master_password.as_bytes(), &header.master_salt, header.kdf)?;
    let plaintext = aead::open(
        &kek[..],
        &header.master_wrap.nonce,
        &header.master_wrap.wrapped_key,
        &aad,
    )
    .map_err(|_| VaultError::InvalidCredentials)?;
    unwrap_key_bytes(plaintext)
}

/// Unlock a vault using the recovery key (parsed from its display form).
pub fn unlock_with_recovery_key(
    header: &VaultHeader,
    recovery_key: &RecoveryKey,
) -> Result<VaultKey, VaultError> {
    let aad = header.aad()?;
    let rek = kdf::derive_key(recovery_key.expose(), &header.recovery_salt, header.kdf)?;
    let plaintext = aead::open(
        &rek[..],
        &header.recovery_wrap.nonce,
        &header.recovery_wrap.wrapped_key,
        &aad,
    )
    .map_err(|_| VaultError::InvalidCredentials)?;
    unwrap_key_bytes(plaintext)
}

/// Re-wrap the data key under a new master password, preserving the recovery
/// path and the creation timestamp.
///
/// The vault must first be unlocked with the current password, proving the
/// caller is authorised to rotate it.
pub fn change_master_password(
    header: &VaultHeader,
    current_password: &str,
    new_password: &str,
) -> Result<VaultHeader, VaultError> {
    let vault_key = unlock_with_password(header, current_password)?;

    let master_salt = random_array::<SALT_LEN>().to_vec();
    let mut updated = skeleton_header(
        header.kind,
        header.kdf,
        master_salt,
        header.recovery_salt.clone(),
    );
    // Preserve the original creation timestamp so the AAD stays stable.
    updated.created_at = header.created_at;
    let aad = updated.aad()?;

    let kek = kdf::derive_key(new_password.as_bytes(), &updated.master_salt, updated.kdf)?;
    let nonce = wrap_nonce();
    let wrapped = aead::seal(&kek[..], &nonce, vault_key.expose(), &aad)?;
    updated.master_wrap = WrapDescriptor {
        nonce,
        wrapped_key: wrapped,
    };
    // Keep the existing recovery wrap (its AAD is unchanged: same kind/created_at,
    // and salts are not part of the AAD).
    updated.recovery_wrap = header.recovery_wrap.clone();

    Ok(updated)
}
