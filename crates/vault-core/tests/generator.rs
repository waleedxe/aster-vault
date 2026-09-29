//! Generator + strength tests.

use vault_core::generator::{
    generate_passphrase, generate_password, PassphraseOptions, PasswordOptions,
};
use vault_core::strength;

#[test]
fn password_respects_length_and_uses_os_randomness() {
    let options = PasswordOptions {
        length: 24,
        ..PasswordOptions::default()
    };
    let a = generate_password(&options);
    let b = generate_password(&options);
    assert_eq!(a.chars().count(), 24);
    assert_eq!(b.chars().count(), 24);
    assert_ne!(a, b, "two generated passwords should differ");
}

#[test]
fn password_honours_character_classes() {
    let options = PasswordOptions {
        length: 32,
        lowercase: false,
        uppercase: true,
        digits: true,
        symbols: false,
        exclude_ambiguous: true,
    };
    let password = generate_password(&options);
    assert!(password.chars().any(|c| c.is_ascii_uppercase()));
    assert!(password.chars().any(|c| c.is_ascii_digit()));
    assert!(!password.chars().any(|c| c.is_ascii_lowercase()));
}

#[test]
fn exclude_ambiguous_removes_confusing_characters() {
    let options = PasswordOptions {
        length: 64,
        symbols: false,
        exclude_ambiguous: true,
        ..PasswordOptions::default()
    };
    let password = generate_password(&options);
    for ch in ['0', 'O', 'o', '1', 'l', 'I'] {
        assert!(!password.contains(ch), "ambiguous char {ch} present");
    }
}

#[test]
fn empty_class_falls_back_to_lowercase() {
    let options = PasswordOptions {
        length: 12,
        lowercase: false,
        uppercase: false,
        digits: false,
        symbols: false,
        exclude_ambiguous: false,
    };
    let password = generate_password(&options);
    assert_eq!(password.chars().count(), 12);
}

#[test]
fn passphrase_has_expected_word_count() {
    let options = PassphraseOptions {
        words: 6,
        separator: ".".to_string(),
        capitalize: false,
    };
    let phrase = generate_passphrase(&options);
    assert_eq!(phrase.split('.').count(), 6);
}

#[test]
fn strength_buckets_are_sane() {
    assert_eq!(strength::estimate("password").score, 0);
    assert_eq!(strength::estimate("123456").score, 0);
    let strong = strength::estimate("correct-Horse-Battery-9!");
    assert!(strong.score >= 3, "expected strong, got {strong:?}");
    assert!(strength::estimate("password").is_common);
    assert!(!strength::estimate("Tr0ub4dour&3xtra").is_common);
}

#[test]
fn reuse_detection_counts_duplicates() {
    let passwords = vec![
        "same".to_string(),
        "same".to_string(),
        "unique".to_string(),
        String::new(),
        String::new(),
    ];
    assert_eq!(strength::reused_count(&passwords), 1);
}
