//! Error model for the vault core.
//!
//! Errors are deliberately terse and never include secret material or
//! cryptographic detail that could act as an oracle. A failed authentication is
//! indistinguishable from a wrong credential by design.

use thiserror::Error;

/// Errors produced by the vault core.
#[derive(Debug, Error)]
pub enum VaultError {
    /// Argon2id key derivation failed (invalid parameters or a library error).
    #[error("key derivation failed")]
    Kdf,

    /// A cryptographic operation failed for an internal reason.
    #[error("cryptographic operation failed")]
    Crypto,

    /// A container failed authentication: wrong key, tampering, or truncation.
    ///
    /// Intentionally generic: it must not reveal *which* of these occurred.
    #[error("authentication failed")]
    AuthenticationFailed,

    /// The supplied credential could not unwrap the vault data key.
    #[error("invalid credentials")]
    InvalidCredentials,

    /// The container declares a format version this build cannot read.
    #[error("unsupported format version {0}")]
    UnsupportedVersion(u32),

    /// The container is structurally malformed.
    #[error("corrupt container")]
    Corrupt,

    /// Serialization of a header/container failed.
    #[error("serialization failed")]
    Serialization(#[from] serde_json::Error),

    /// A filesystem operation failed.
    #[error("filesystem error")]
    Io(#[from] std::io::Error),
}
