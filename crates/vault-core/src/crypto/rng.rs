//! OS-backed randomness.
//!
//! All key material and nonces come from the operating system CSPRNG. We never
//! seed a userspace PRNG ourselves.

use rand::rngs::OsRng;
use rand::RngCore;

/// Fill `buf` with cryptographically secure random bytes from the OS.
pub fn fill(buf: &mut [u8]) {
    OsRng.fill_bytes(buf);
}

/// Return an array of `N` cryptographically secure random bytes.
pub fn random_array<const N: usize>() -> [u8; N] {
    let mut out = [0u8; N];
    OsRng.fill_bytes(&mut out);
    out
}

/// Return a `Vec` of `len` cryptographically secure random bytes.
pub fn random_vec(len: usize) -> Vec<u8> {
    let mut out = vec![0u8; len];
    OsRng.fill_bytes(&mut out);
    out
}
