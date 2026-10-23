//! Argon2id key derivation (RFC 9106).
//!
//! The master password is run through Argon2id with a per-vault salt to produce
//! a 256-bit key-encryption key (KEK). Parameters are stored with the vault so
//! they can be benchmarked and upgraded later without locking anyone out.

use argon2::{Algorithm, Argon2, Params, Version};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use crate::error::VaultError;

/// Length of the per-vault KDF salt.
pub const SALT_LEN: usize = 16;
/// Length of the derived key (256 bits).
pub const KEY_LEN: usize = 32;

/// Upper bound on the Argon2id memory cost, in kibibytes (512 MiB).
///
/// Parameters travel in the file header, so a crafted container could otherwise
/// ask for gigabytes of memory and stall or exhaust the machine at unlock time.
/// This cap keeps a hostile header cheap to reject while staying far above any
/// legitimate setting (the recommended default is 64 MiB).
pub const MAX_M_COST: u32 = 512 * 1024;
/// Upper bound on the number of passes.
pub const MAX_T_COST: u32 = 10;
/// Upper bound on the degree of parallelism.
pub const MAX_P_COST: u32 = 4;

/// Argon2id parameters, stored in the vault header.
///
/// Defaults target roughly 0.5–1.0 s of unlock work on a modern desktop; they
/// are benchmarked at setup and may be raised on future unlocks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct KdfParams {
    /// Memory cost in kibibytes.
    pub m_cost: u32,
    /// Number of passes.
    pub t_cost: u32,
    /// Degree of parallelism.
    pub p_cost: u32,
}

impl KdfParams {
    /// Recommended default parameters (64 MiB, 3 passes, 1 lane).
    pub const fn recommended() -> Self {
        Self {
            m_cost: 64 * 1024,
            t_cost: 3,
            p_cost: 1,
        }
    }

    /// Validate that the parameters are within sane, supported bounds.
    ///
    /// Both the lower and upper bounds are enforced. The upper bounds reject a
    /// crafted header that would otherwise turn unlock into a denial-of-service
    /// (see [`MAX_M_COST`], [`MAX_T_COST`], [`MAX_P_COST`]).
    pub fn validate(&self) -> Result<(), VaultError> {
        if self.m_cost < 8 || self.m_cost > MAX_M_COST {
            return Err(VaultError::Kdf);
        }
        if self.t_cost < 1 || self.t_cost > MAX_T_COST {
            return Err(VaultError::Kdf);
        }
        if self.p_cost < 1 || self.p_cost > MAX_P_COST {
            return Err(VaultError::Kdf);
        }
        Ok(())
    }
}

impl Default for KdfParams {
    fn default() -> Self {
        Self::recommended()
    }
}

/// Derive a 256-bit KEK from `password` and `salt` using Argon2id.
///
/// The result is wrapped in [`Zeroizing`] so it is cleared from memory on drop.
pub fn derive_key(
    password: &[u8],
    salt: &[u8],
    params: KdfParams,
) -> Result<Zeroizing<[u8; KEY_LEN]>, VaultError> {
    params.validate()?;
    if salt.len() < 8 {
        // Argon2 requires at least 8 bytes of salt.
        return Err(VaultError::Kdf);
    }

    let argon_params = Params::new(params.m_cost, params.t_cost, params.p_cost, Some(KEY_LEN))
        .map_err(|_| VaultError::Kdf)?;

    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);

    let mut out = Zeroizing::new([0u8; KEY_LEN]);
    argon
        .hash_password_into(password, salt, out.as_mut_slice())
        .map_err(|_| VaultError::Kdf)?;

    Ok(out)
}

/// Time a single derivation with the given parameters.
///
/// Used by setup to benchmark a suitable cost on the current machine.
pub fn benchmark(params: KdfParams) -> Result<std::time::Duration, VaultError> {
    let salt = [0u8; SALT_LEN];
    let start = std::time::Instant::now();
    let _ = derive_key(b"benchmark", &salt, params)?;
    Ok(start.elapsed())
}
