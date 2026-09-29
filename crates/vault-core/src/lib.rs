//! Aster Vault core crate.
//!
//! This crate owns every security-critical operation: key generation, key
//! derivation, authenticated encryption, key wrapping, the portable container
//! format, and the encrypted vault store. It has no GUI or Tauri dependency so
//! that it can be reviewed and tested in isolation (see
//! `docs/specs/03-architecture.md`).
//!
//! Rule: no custom crypto primitives. Everything here composes reviewed
//! libraries (`argon2`, `aes-gcm`, `rand`, `zeroize`).

pub mod backup;
pub mod container;
pub mod crypto;
pub mod error;
pub mod generator;
pub mod model;
pub mod session;
pub mod store;
pub mod strength;

pub use container::header::{ContainerKind, VaultHeader, FORMAT_VERSION};
pub use container::vault::{
    change_master_password, create, unlock_with_password, unlock_with_recovery_key, CreatedVault,
};
pub use crypto::kdf::KdfParams;
pub use crypto::keys::{RecoveryKey, VaultKey};
pub use error::VaultError;
pub use model::{Folder, Item, ItemType, VaultData, SCHEMA_VERSION};
pub use store::Vault;
