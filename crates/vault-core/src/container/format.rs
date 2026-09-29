//! Binary container framing.
//!
//! Layout (little-endian):
//!
//! ```text
//! magic           6 bytes  b"AVLT1\0"
//! header_len      u32
//! header_json     header_len bytes   (see header.rs)
//! payload_nonce   12 bytes
//! payload_ct      remaining bytes    (AEAD ciphertext with tag appended)
//! ```
//!
//! The header is parseable without the key so an unknown format version or a
//! truncated file is rejected early. The payload nonce is random per save; a
//! 96-bit random nonce is safe for up to 2^32 saves under one data key, far above
//! any realistic use (NIST SP 800-38D guidance).

use crate::container::header::VaultHeader;
use crate::crypto::aead;
use crate::error::VaultError;

/// Magic prefix identifying an Aster Vault container.
pub const MAGIC: &[u8; 6] = b"AVLT1\0";

/// Domain-separation prefix for the payload AAD.
const PAYLOAD_DOMAIN: &[u8] = b"aster-vault/payload/v1";

/// Associated data for the payload: a domain separator plus the header AAD.
pub fn payload_aad(header: &VaultHeader) -> Result<Vec<u8>, VaultError> {
    let mut aad = Vec::with_capacity(PAYLOAD_DOMAIN.len() + 64);
    aad.extend_from_slice(PAYLOAD_DOMAIN);
    aad.extend_from_slice(&header.aad()?);
    Ok(aad)
}

/// Encode a container from its parts.
pub fn encode(
    header: &VaultHeader,
    nonce: &[u8],
    ciphertext: &[u8],
) -> Result<Vec<u8>, VaultError> {
    if nonce.len() != aead::NONCE_LEN {
        return Err(VaultError::Crypto);
    }
    let header_json = header.to_bytes()?;
    let header_len = u32::try_from(header_json.len()).map_err(|_| VaultError::Corrupt)?;

    let mut out = Vec::with_capacity(10 + header_json.len() + nonce.len() + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&header_len.to_le_bytes());
    out.extend_from_slice(&header_json);
    out.extend_from_slice(nonce);
    out.extend_from_slice(ciphertext);
    Ok(out)
}

/// A decoded container: header, payload nonce, payload ciphertext.
pub struct DecodedContainer {
    /// Parsed and version-checked header.
    pub header: VaultHeader,
    /// Payload nonce.
    pub nonce: Vec<u8>,
    /// Payload ciphertext (tag appended).
    pub ciphertext: Vec<u8>,
}

/// Decode and structurally validate a container.
pub fn decode(bytes: &[u8]) -> Result<DecodedContainer, VaultError> {
    const MIN: usize = 6 + 4 + aead::NONCE_LEN + aead::TAG_LEN;
    if bytes.len() < MIN || &bytes[0..6] != MAGIC {
        return Err(VaultError::Corrupt);
    }
    let header_len = u32::from_le_bytes([bytes[6], bytes[7], bytes[8], bytes[9]]) as usize;
    let header_start: usize = 10;
    let header_end = header_start
        .checked_add(header_len)
        .ok_or(VaultError::Corrupt)?;
    if bytes.len() < header_end + aead::NONCE_LEN {
        return Err(VaultError::Corrupt);
    }
    let header = VaultHeader::from_bytes(&bytes[header_start..header_end])?;
    let nonce = bytes[header_end..header_end + aead::NONCE_LEN].to_vec();
    let ciphertext = bytes[header_end + aead::NONCE_LEN..].to_vec();
    if ciphertext.len() < aead::TAG_LEN {
        return Err(VaultError::Corrupt);
    }
    Ok(DecodedContainer {
        header,
        nonce,
        ciphertext,
    })
}
