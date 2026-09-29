//! AES-256-GCM authenticated encryption.
//!
//! This is the only place AEAD is invoked. Nonce discipline is the caller's
//! responsibility and is enforced by the container layer:
//!
//! - Single-use wrapping keys use a random 96-bit nonce (never reused, because
//!   each KEK/RK wraps exactly once).
//! - The long-lived vault data key uses counter-derived nonces (see the
//!   container record store) so uniqueness is structural rather than random.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};

use crate::error::VaultError;

/// AES-256 key length.
pub const KEY_LEN: usize = 32;
/// GCM nonce length (96 bits).
pub const NONCE_LEN: usize = 12;
/// GCM tag length (128 bits).
pub const TAG_LEN: usize = 16;

/// Seal `plaintext` under `key`/`nonce`, authenticating `aad`.
///
/// Returns ciphertext with the authentication tag appended.
pub fn seal(key: &[u8], nonce: &[u8], plaintext: &[u8], aad: &[u8]) -> Result<Vec<u8>, VaultError> {
    if key.len() != KEY_LEN || nonce.len() != NONCE_LEN {
        return Err(VaultError::Crypto);
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| VaultError::Crypto)?;
    let nonce = Nonce::from_slice(nonce);
    cipher
        .encrypt(
            nonce,
            Payload {
                msg: plaintext,
                aad,
            },
        )
        .map_err(|_| VaultError::Crypto)
}

/// Open a sealed message, verifying the tag and `aad`.
///
/// Any failure (wrong key, tampering, truncation) is reported as
/// [`VaultError::AuthenticationFailed`] and never returns partial plaintext.
pub fn open(
    key: &[u8],
    nonce: &[u8],
    ciphertext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, VaultError> {
    if key.len() != KEY_LEN || nonce.len() != NONCE_LEN {
        return Err(VaultError::AuthenticationFailed);
    }
    if ciphertext.len() < TAG_LEN {
        return Err(VaultError::AuthenticationFailed);
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| VaultError::Crypto)?;
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(
            nonce,
            Payload {
                msg: ciphertext,
                aad,
            },
        )
        .map_err(|_| VaultError::AuthenticationFailed)
}
