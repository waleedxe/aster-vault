//! Integration tests for the Aster Vault cryptographic core.
//!
//! These exercise the public API end to end: create, unlock, recovery, rotation,
//! tamper detection, and serialization. They must fail closed.

use vault_core::container::header::{ContainerKind, VaultHeader, FORMAT_VERSION};
use vault_core::crypto::aead;
use vault_core::crypto::kdf;
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

// ---------------------------------------------------------------------------
// Known-answer (KAT) vectors
//
// These assert exact expected bytes rather than round-trips, so a change to a
// crate version, an algorithm choice, or a parameter fails the build instead of
// passing a test that only checks itself.
// ---------------------------------------------------------------------------

/// Decode a hex string. Only used to spell the KAT vectors legibly.
fn hex(text: &str) -> Vec<u8> {
    text.as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let digits = std::str::from_utf8(pair).expect("ascii hex");
            u8::from_str_radix(digits, 16).expect("valid hex")
        })
        .collect()
}

#[test]
fn argon2id_matches_rfc9106_test_vector() {
    // RFC 9106 §5.3 (Argon2id) known-answer vector, as shipped in the `argon2`
    // crate's own tests: `argon2-0.5.3/tests/kat.rs`, test `argon2id_v0x13`
    // (the same vector appears in draft-irtf-cfrg-argon2-12 §5).
    //
    // Parameters: m = 32 KiB, t = 3, p = 4, 32-byte tag; password = 0x01 * 32,
    // salt = 0x02 * 16, secret = 0x03 * 8, associated data = 0x04 * 12.
    //
    // The app's `kdf::derive_key` wrapper derives without a secret or associated
    // data, so the primitive is exercised directly here with the same `argon2`
    // crate the app depends on.
    use argon2::{Algorithm, Argon2, AssociatedData, ParamsBuilder, Version};

    let params = ParamsBuilder::new()
        .m_cost(32)
        .t_cost(3)
        .p_cost(4)
        .data(AssociatedData::new(&[0x04; 12]).unwrap())
        .build()
        .unwrap();
    let context =
        Argon2::new_with_secret(&[0x03; 8], Algorithm::Argon2id, Version::V0x13, params).unwrap();

    let mut tag = [0u8; 32];
    context
        .hash_password_into(&[0x01; 32], &[0x02; 16], &mut tag)
        .unwrap();

    assert_eq!(
        tag.to_vec(),
        hex("0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659")
    );
}

#[test]
fn argon2id_kdf_wrapper_matches_reference_vector() {
    // Argon2 reference-implementation KAT (phc-winner-argon2 `src/test.c`), as
    // shipped in `argon2-0.5.3/tests/kat.rs`, test
    // `reference_argon2id_v0x13_2_16_1`: m = 65536 KiB, t = 2, p = 1, 32-byte
    // tag, password "password", salt "somesalt". No secret/associated data, so
    // it runs through the app's own `kdf::derive_key` wrapper.
    let derived = kdf::derive_key(
        b"password",
        b"somesalt",
        KdfParams {
            m_cost: 65536,
            t_cost: 2,
            p_cost: 1,
        },
    )
    .unwrap();

    assert_eq!(
        derived.as_slice(),
        hex("09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7").as_slice()
    );
}

#[test]
fn aes256gcm_matches_nist_cavs_vector() {
    // NIST CAVP AES-256-GCM known-answer vector from `gcmEncryptExtIV256.rsp`,
    // as shipped in `aes-gcm-0.10.3/tests/aes256gcm.rs`: key, nonce, plaintext
    // and AAD map to the exact ciphertext and tag below.
    let key = hex("92e11dcdaa866f5ce790fd24501f92509aacf4cb8b1339d50c9c1240935dd08b");
    let nonce = hex("ac93a1a6145299bde902f21a");
    let plaintext = hex("2d71bcfa914e4ac045b2aa60955fad24");
    let aad = hex("1e0889016f67601c8ebea4943bc23ad6");

    let sealed = aead::seal(&key, &nonce, &plaintext, &aad).unwrap();
    // `seal` returns the ciphertext with the 16-byte tag appended.
    assert_eq!(
        sealed,
        hex("8995ae2e6df3dbf96fac7b7137bae67feca5aa77d51d4a0a14d9c51e1da474ab")
    );
    // Opening with the same inputs returns the plaintext; a different AAD fails.
    assert_eq!(aead::open(&key, &nonce, &sealed, &aad).unwrap(), plaintext);
    assert!(aead::open(&key, &nonce, &sealed, b"other-aad").is_err());
}
