//! Backup, retention, and restore tests.

use std::fs;
use std::path::PathBuf;

use vault_core::backup;
use vault_core::container::header::ContainerKind;
use vault_core::{Item, ItemType, KdfParams, Vault, VaultError};

fn test_params() -> KdfParams {
    KdfParams {
        m_cost: 8,
        t_cost: 1,
        p_cost: 1,
    }
}

fn temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "aster-vault-backup-{tag}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn vault_with_three_items() -> Vault {
    let (mut vault, _r, _b) = Vault::create("pw", test_params()).unwrap();
    for i in 0..3 {
        let mut item = Item::new(ItemType::Login, format!("Item {i}"));
        item.set_field("password", format!("secret-{i}"));
        vault.add_item(item);
    }
    vault
}

#[test]
fn export_then_verify_structure() {
    let dir = temp_dir("export");
    let vault = vault_with_three_items();
    let path = backup::export(&vault, &dir).unwrap();
    assert!(path.exists());

    let bytes = fs::read(&path).unwrap();
    let manifest = backup::verify_structure(&bytes).unwrap();
    assert_eq!(manifest.kind, ContainerKind::Backup);
    assert!(!manifest.authenticated);
    assert_eq!(manifest.item_count, None);
}

#[test]
fn inspect_with_password_reports_counts() {
    let dir = temp_dir("inspect");
    let vault = vault_with_three_items();
    let path = backup::export(&vault, &dir).unwrap();
    let bytes = fs::read(path).unwrap();

    let manifest = backup::inspect(&bytes, "pw").unwrap();
    assert!(manifest.authenticated);
    assert_eq!(manifest.item_count, Some(3));
}

#[test]
fn inspect_with_wrong_password_fails_closed() {
    let dir = temp_dir("inspect-wrong");
    let vault = vault_with_three_items();
    let path = backup::export(&vault, &dir).unwrap();
    let bytes = fs::read(path).unwrap();

    assert!(matches!(
        backup::inspect(&bytes, "nope").unwrap_err(),
        VaultError::InvalidCredentials
    ));
}

#[test]
fn restore_writes_a_new_vault_file() {
    let dir = temp_dir("restore");
    let vault = vault_with_three_items();
    let backup_path = backup::export(&vault, &dir).unwrap();
    let bytes = fs::read(backup_path).unwrap();

    let dest = dir.join("restored.avlt");
    let manifest = backup::restore_to_path(&bytes, "pw", &dest).unwrap();
    assert_eq!(manifest.item_count, Some(3));

    let restored = Vault::open_file(&dest, "pw").unwrap();
    assert_eq!(restored.item_count(), 3);
    assert_eq!(restored.item("missing"), None);
}

#[test]
fn restore_with_recovery_key_works() {
    let dir = temp_dir("restore-rk");
    let (mut vault, recovery, _b) = Vault::create("pw", test_params()).unwrap();
    vault.add_item(Item::new(ItemType::Note, "n"));
    let backup_path = backup::export(&vault, &dir).unwrap();
    let bytes = fs::read(backup_path).unwrap();

    let dest = dir.join("restored-rk.avlt");
    let manifest = backup::restore_to_path_with_recovery(&bytes, &recovery, &dest).unwrap();
    assert_eq!(manifest.item_count, Some(1));
}

#[test]
fn tampered_backup_fails_closed() {
    let dir = temp_dir("tamper");
    let vault = vault_with_three_items();
    let path = backup::export(&vault, &dir).unwrap();
    let mut bytes = fs::read(path).unwrap();
    let last = bytes.len() - 1;
    bytes[last] ^= 0xff;

    // Structural verify still passes (framing intact), but authentication fails.
    assert!(backup::verify_structure(&bytes).is_ok());
    assert!(backup::inspect(&bytes, "pw").is_err());
}

#[test]
fn retention_keeps_only_the_most_recent() {
    let dir = temp_dir("retention");
    let vault = vault_with_three_items();

    // Create five distinct backups (sleep a second so names differ).
    for _ in 0..5 {
        backup::export(&vault, &dir).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(1100));
    }
    assert_eq!(backup::list_backups(&dir).unwrap().len(), 5);

    let removed = backup::apply_retention(&dir, 2).unwrap();
    assert_eq!(removed, 3);
    assert_eq!(backup::list_backups(&dir).unwrap().len(), 2);
}

#[test]
fn latest_backup_and_age() {
    let dir = temp_dir("latest");
    assert_eq!(backup::latest_backup(&dir).unwrap(), None);
    assert_eq!(backup::seconds_since_latest(&dir).unwrap(), None);

    let vault = vault_with_three_items();
    let path = backup::export(&vault, &dir).unwrap();
    let latest = backup::latest_backup(&dir).unwrap();
    assert_eq!(latest, Some(path));
    let age = backup::seconds_since_latest(&dir).unwrap().unwrap();
    assert!((0..5).contains(&age));
}

#[test]
fn retention_ignores_unrelated_files() {
    let dir = temp_dir("safe-retention");
    fs::write(dir.join("notes.txt"), b"do not delete").unwrap();
    fs::write(dir.join("other.avlt"), b"not ours").unwrap();

    let vault = vault_with_three_items();
    backup::export(&vault, &dir).unwrap();
    backup::apply_retention(&dir, 0).unwrap();

    assert!(dir.join("notes.txt").exists());
    assert!(dir.join("other.avlt").exists());
}
