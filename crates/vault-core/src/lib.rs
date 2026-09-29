//! Aster Vault core crate.
//!
//! This crate owns every security-critical operation: key generation, key
//! derivation, authenticated encryption, key wrapping, and the portable
//! container format. It has no GUI or Tauri dependency so that it can be
//! reviewed and tested in isolation (see `docs/specs/03-architecture.md`).
//!
//! Rule: no custom crypto primitives. Everything here composes reviewed
//! libraries (`argon2`, `aes-gcm`, `rand`, `zeroize`).

pub mod container;
pub mod crypto;
pub mod error;

pub use container::header::{ContainerKind, VaultHeader, FORMAT_VERSION};
pub use container::vault::{
    change_master_password, create, unlock_with_password, unlock_with_recovery_key, CreatedVault,
};
pub use crypto::kdf::KdfParams;
pub use crypto::keys::{RecoveryKey, VaultKey};
pub use error::VaultError;
