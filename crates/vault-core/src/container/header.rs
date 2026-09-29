//! Container header: the portable, self-describing envelope.

use serde::{Deserialize, Serialize};

use crate::crypto::kdf::KdfParams;
use crate::error::VaultError;

/// Current container format version.
pub const FORMAT_VERSION: u32 = 1;

/// Whether a container is a live vault or a point-in-time backup.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContainerKind {
    /// The active vault file.
    Vault,
    /// A portable backup copy.
    Backup,
}

/// A wrapped data key: the nonce and AEAD ciphertext (tag included).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WrapDescriptor {
    /// 96-bit GCM nonce.
    pub nonce: Vec<u8>,
    /// Ciphertext of the data key with the tag appended.
    pub wrapped_key: Vec<u8>,
}

/// The authenticated-but-not-encrypted metadata bound as AEAD associated data.
///
/// Deliberately stable across key rotation: it excludes salts, KDF parameters and
/// the wrap descriptors, so rewrapping one path cannot invalidate the other.
/// Tampering with any excluded field instead produces a wrong key and therefore a
/// failed authentication, which still fails closed.
#[derive(Debug, Serialize)]
struct HeaderAad {
    format_version: u32,
    kind: ContainerKind,
    created_at: i64,
}

/// The vault/backup container header.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultHeader {
    /// Format version. Unknown values are refused.
    pub format_version: u32,
    /// Vault or backup.
    pub kind: ContainerKind,
    /// Creation timestamp (Unix seconds).
    pub created_at: i64,
    /// Argon2id parameters used for both wrapping paths.
    pub kdf: KdfParams,
    /// Per-vault salt for the master-password wrapping key.
    pub master_salt: Vec<u8>,
    /// Wrapped data key under the master-password KEK.
    pub master_wrap: WrapDescriptor,
    /// Per-vault salt for the recovery-key wrapping key.
    pub recovery_salt: Vec<u8>,
    /// Wrapped data key under the recovery key.
    pub recovery_wrap: WrapDescriptor,
}

impl VaultHeader {
    /// Canonical associated data bound to both wraps and to the payload.
    pub fn aad(&self) -> Result<Vec<u8>, VaultError> {
        let aad = HeaderAad {
            format_version: self.format_version,
            kind: self.kind,
            created_at: self.created_at,
        };
        Ok(serde_json::to_vec(&aad)?)
    }

    /// Serialize the header to bytes.
    pub fn to_bytes(&self) -> Result<Vec<u8>, VaultError> {
        Ok(serde_json::to_vec(self)?)
    }

    /// Parse a header, refusing unsupported format versions.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, VaultError> {
        let header: VaultHeader = serde_json::from_slice(bytes).map_err(|_| VaultError::Corrupt)?;
        if header.format_version != FORMAT_VERSION {
            return Err(VaultError::UnsupportedVersion(header.format_version));
        }
        header.kdf.validate()?;
        if header.master_salt.is_empty() || header.recovery_salt.is_empty() {
            return Err(VaultError::Corrupt);
        }
        Ok(header)
    }
}
