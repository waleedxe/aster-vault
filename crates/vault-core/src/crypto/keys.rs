//! Key types.
//!
//! [`VaultKey`] is the random 256-bit data key that encrypts the record store.
//! [`RecoveryKey`] is a high-entropy key generated at setup that provides an
//! independent wrapping path to the same data key.
//!
//! Both clear their bytes on drop and never implement a revealing `Debug`.

use std::fmt;

use base64::Engine;
use zeroize::Zeroize;

use crate::crypto::rng::random_array;

/// Length of a vault data key or recovery key in bytes.
pub const KEY_LEN: usize = 32;

/// The vault data key (DEK): 32 random bytes from the OS CSPRNG.
pub struct VaultKey([u8; KEY_LEN]);

impl VaultKey {
    /// Generate a new random data key.
    pub fn generate() -> Self {
        Self(random_array())
    }

    /// Construct from raw bytes.
    pub fn from_bytes(bytes: [u8; KEY_LEN]) -> Self {
        Self(bytes)
    }

    /// Borrow the raw key bytes.
    pub fn expose(&self) -> &[u8] {
        &self.0
    }

    /// Borrow the raw key bytes as an array reference.
    pub fn as_array(&self) -> &[u8; KEY_LEN] {
        &self.0
    }
}

impl Drop for VaultKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl fmt::Debug for VaultKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("VaultKey([redacted])")
    }
}

/// The recovery key: 32 random bytes generated at setup, shown to the user once.
pub struct RecoveryKey([u8; KEY_LEN]);

impl RecoveryKey {
    /// Generate a new random recovery key.
    pub fn generate() -> Self {
        Self(random_array())
    }

    /// Construct from raw bytes.
    pub fn from_bytes(bytes: [u8; KEY_LEN]) -> Self {
        Self(bytes)
    }

    /// Borrow the raw key bytes.
    pub fn expose(&self) -> &[u8] {
        &self.0
    }

    /// Encode as a URL-safe base64 string for display/typing.
    pub fn encode(&self) -> String {
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(self.0)
    }

    /// Decode a recovery key from its display form.
    pub fn decode(s: &str) -> Result<Self, crate::error::VaultError> {
        let trimmed = s.trim();
        let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(trimmed)
            .map_err(|_| crate::error::VaultError::InvalidCredentials)?;
        if bytes.len() != KEY_LEN {
            return Err(crate::error::VaultError::InvalidCredentials);
        }
        let mut arr = [0u8; KEY_LEN];
        arr.copy_from_slice(&bytes);
        Ok(Self(arr))
    }
}

impl Drop for RecoveryKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl fmt::Debug for RecoveryKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("RecoveryKey([redacted])")
    }
}
