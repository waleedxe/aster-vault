//! Cryptographic building blocks.
//!
//! - [`rng`] — OS-backed randomness.
//! - [`kdf`] — Argon2id key derivation.
//! - [`aead`] — AES-256-GCM sealing/opening.
//! - [`keys`] — vault data key and recovery key types.

pub mod aead;
pub mod kdf;
pub mod keys;
pub mod rng;
