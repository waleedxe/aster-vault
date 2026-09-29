//! Portable container format.
//!
//! The live vault file and every backup share one format: a self-describing
//! header (version, KDF parameters, salts, wrapped data key) followed by an
//! authenticated encrypted payload. See `docs/specs/02-vault-format.md`.

pub mod header;
pub mod vault;

pub use header::{ContainerKind, VaultHeader, WrapDescriptor, FORMAT_VERSION};
pub use vault::{
    change_master_password, create, unlock_with_password, unlock_with_recovery_key, CreatedVault,
};
