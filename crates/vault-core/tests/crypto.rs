//! Integration tests for the Aster Vault cryptographic core.
//!
//! These exercise the public API end to end: create, unlock, recovery, rotation,
//! tamper detection, and serialization. They must fail closed.

use vault_core::container::header::{ContainerKind, VaultHeader, FORMAT_VERSION};
use vault_core::crypto::aead;
use vault_core::crypto::keys::{RecoveryKey, VaultKey};
use vault_core::{
    change_master_password, create, unlock_with_password, unlock_with_recovery_key, KdfParams,
    VaultError,
};

/// Fast KDF parameters for tests (production defaults are much heavier).
fn test_params() -> KdfParams {
    KdfParams {
        m_cost: 8,
        t_cost: 1,
        p_cost: 1,
    }
}

#[test]
fn create_then_unlock_with_password() {
    let created = create("correct horse battery staple", test_params()).unwrap();
    let header_bytes = created.header.to_bytes().unwrap();
    let header = VaultHeader::from_bytes(&header_bytes).unwrap();

    let unlocked = unlock_with_password(&header, "correct horse battery staple").unwrap();
    assert_eq!(unlocked.as_array(), created.vault_key.as_array());
}

#[test]
fn wrong_password_fails_closed() {
    let created = create("right-password", test_params()).unwrap();
    let header = VaultHeader::from_bytes(&created.header.to_bytes().unwrap()).unwrap();

    let err = unlock_with_password(&header, "wrong-password").unwrap_err();
    assert!(matches!(err, VaultError::InvalidCredentials));
}

#[test]
fn recovery_key_unlocks_independently() {
    let created = create("pw", test_params()).unwrap();
    let header = VaultHeader::from_bytes(&created.header.to_bytes().unwrap()).unwrap();

    let unlocked = unlock_with_recovery_key(&header, &created.recovery_key).unwrap();
    assert_eq!(unlocked.as_array(), created.vault_key.as_array());
}

#[test]
fn recovery_key_round_trips_through_display_form() {
    let created = create("pw", test_params()).unwrap();
    let displayed = created.recovery_key.encode();
    let decoded = RecoveryKey::decode(&displayed).unwrap();
    let header = VaultHeader::from_bytes(&created.header.to_bytes().unwrap()).unwrap();

    let unlocked = unlock_with_recovery_key(&header, &decoded).unwrap();
    assert_eq!(unlocked.as_array(), created.vault_key.as_array());
}

#[test]
fn wrong_recovery_key_fails_closed() {
    let created = create("pw", test_params()).unwrap();
    let header = VaultHeader::from_bytes(&created.header.to_bytes().unwrap()).unwrap();

    let other = RecoveryKey::generate();
    let err = unlock_with_recovery_key(&header, &other).unwrap_err();
    assert!(matches!(err, VaultError::InvalidCredentials));
}

#[test]
fn header_serialization_round_trips() {
    let created = create("pw", test_params()).unwrap();
    let bytes = created.header.to_bytes().unwrap();
    let parsed = VaultHeader::from_bytes(&bytes).unwrap();
    assert_eq!(parsed, created.header);
    assert_eq!(parsed.kind, ContainerKind::Vault);
    assert_eq!(parsed.format_version, FORMAT_VERSION);
}

#[test]
fn tampered_wrapped_key_fails_closed() {
    let created = create("pw", test_params()).unwrap();
    let mut header = created.header.clone();
    header.master_wrap.wrapped_key[0] ^= 0x01;

    let err = unlock_with_password(&header, "pw").unwrap_err();
    assert!(matches!(
        err,
        VaultError::InvalidCredentials | VaultError::AuthenticationFailed
    ));
}

#[test]
fn tampered_aad_field_fails_closed() {
    // Changing an AAD-bound field (created_at) must break authentication even
    // with the correct password, because the AAD no longer matches.
    let created = create("pw", test_params()).unwrap();
    let mut header = created.header.clone();
    header.created_at += 1;

    let err = unlock_with_password(&header, "pw").unwrap_err();
    assert!(matches!(
        err,
        VaultError::InvalidCredentials | VaultError::AuthenticationFailed
    ));
}

#[test]
fn backup_kind_does_not_break_the_wrap() {
    // `kind` is intentionally outside the AAD so a copy can be marked as a
    // backup without invalidating the wrapped keys.
    let created = create("pw", test_params()).unwrap();
    let mut header = created.header.clone();
    header.kind = ContainerKind::Backup;

    let unlocked = unlock_with_password(&header, "pw").unwrap();
    assert_eq!(unlocked.as_array(), created.vault_key.as_array());
}

#[test]
fn truncated_wrapped_key_fails_closed() {
    let created = create("pw", test_params()).unwrap();
    let mut header = created.header.clone();
    header.master_wrap.wrapped_key.truncate(4);

    let err = unlock_with_password(&header, "pw").unwrap_err();
    assert!(matches!(
        err,
        VaultError::InvalidCredentials | VaultError::AuthenticationFailed
    ));
}

#[test]
fn kdf_parameters_are_clamped_at_upper_bounds() {
    use vault_core::crypto::kdf::{MAX_M_COST, MAX_P_COST, MAX_T_COST};

    let at_cap = KdfParams {
        m_cost: MAX_M_COST,
        t_cost: MAX_T_COST,
        p_cost: MAX_P_COST,
    };
    // Values exactly at the cap are accepted.
    assert!(at_cap.validate().is_ok());

    // Anything above a cap is rejected with the existing error type.
    assert!(matches!(
        KdfParams {
            m_cost: MAX_M_COST + 1,
            ..at_cap
        }
        .validate(),
        Err(VaultError::Kdf)
    ));
    assert!(matches!(
        KdfParams {
            t_cost: MAX_T_COST + 1,
            ..at_cap
        }
        .validate(),
        Err(VaultError::Kdf)
    ));
    assert!(matches!(
        KdfParams {
            p_cost: MAX_P_COST + 1,
            ..at_cap
        }
        .validate(),
        Err(VaultError::Kdf)
    ));

    // Lower bounds are still enforced.
    assert!(KdfParams {
        m_cost: 7,
        ..at_cap
    }
    .validate()
    .is_err());
    assert!(KdfParams {
        t_cost: 0,
        ..at_cap
    }
    .validate()
    .is_err());
    assert!(KdfParams {
        p_cost: 0,
        ..at_cap
    }
    .validate()
    .is_err());
}

#[test]
fn crafted_header_with_huge_memory_cost_is_rejected_at_decode() {
    // A file that asks for ~4 GiB of Argon2 memory must be refused when the
    // header is parsed, before any derivation is attempted.
    let created = create("pw", test_params()).unwrap();
    let mut header = created.header.clone();
    header.kdf.m_cost = u32::MAX;

    let err = VaultHeader::from_bytes(&header.to_bytes().unwrap()).unwrap_err();
    assert!(matches!(err, VaultError::Kdf));
}

#[test]
fn unsupported_format_version_is_refused() {
    let created = create("pw", test_params()).unwrap();
    let mut header = created.header.clone();
    header.format_version = 999;

    let err = VaultHeader::from_bytes(&header.to_bytes().unwrap()).unwrap_err();
    assert!(matches!(err, VaultError::UnsupportedVersion(999)));
}

#[test]
fn master_password_rotation_preserves_recovery_path() {
    let created = create("old-password", test_params()).unwrap();
    let header = VaultHeader::from_bytes(&created.header.to_bytes().unwrap()).unwrap();

    let rotated = change_master_password(&header, "old-password", "new-password").unwrap();

    // Old password no longer works.
    assert!(unlock_with_password(&rotated, "old-password").is_err());
    // New password unwraps the same data key.
    let unlocked = unlock_with_password(&rotated, "new-password").unwrap();
    assert_eq!(unlocked.as_array(), created.vault_key.as_array());
    // Recovery path is untouched and still opens the same data key.
    let via_recovery = unlock_with_recovery_key(&rotated, &created.recovery_key).unwrap();
    assert_eq!(via_recovery.as_array(), created.vault_key.as_array());
}

#[test]
fn rotation_requires_the_current_password() {
    let created = create("old-password", test_params()).unwrap();
    let header = VaultHeader::from_bytes(&created.header.to_bytes().unwrap()).unwrap();

    let err = change_master_password(&header, "not-the-password", "new-password").unwrap_err();
    assert!(matches!(err, VaultError::InvalidCredentials));
}

#[test]
fn aead_detects_tampering() {
    let key = VaultKey::generate();
    let nonce = [7u8; aead::NONCE_LEN];
    let aad = b"header";
    let ct = aead::seal(key.expose(), &nonce, b"secret payload", aad).unwrap();

    // Correct open succeeds.
    let pt = aead::open(key.expose(), &nonce, &ct, aad).unwrap();
    assert_eq!(pt, b"secret payload");

    // Modified ciphertext fails.
    let mut bad = ct.clone();
    bad[0] ^= 0xff;
    assert!(aead::open(key.expose(), &nonce, &bad, aad).is_err());

    // Modified AAD fails.
    assert!(aead::open(key.expose(), &nonce, &ct, b"other-header").is_err());

    // Wrong key fails.
    let other = VaultKey::generate();
    assert!(aead::open(other.expose(), &nonce, &ct, aad).is_err());
}

#[test]
fn distinct_keys_and_nonces_are_not_reused() {
    let a = VaultKey::generate();
    let b = VaultKey::generate();
    assert_ne!(a.as_array(), b.as_array());

    let n1 = vault_core::crypto::rng::random_vec(aead::NONCE_LEN);
    let n2 = vault_core::crypto::rng::random_vec(aead::NONCE_LEN);
    assert_ne!(n1, n2);
}

#[test]
fn debug_output_redacts_key_material() {
    let key = VaultKey::generate();
    let rendered = format!("{key:?}");
    assert!(rendered.contains("redacted"));
    assert!(!rendered.contains(&format!("{:02x}", key.as_array()[0])));
}
