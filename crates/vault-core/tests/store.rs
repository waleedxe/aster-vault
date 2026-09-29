//! Store + model integration tests: persistence, CRUD, search, tamper safety,
//! rotation, and backup conversion.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use vault_core::container::header::ContainerKind;
use vault_core::store::atomic_write;
use vault_core::{Folder, Item, ItemType, KdfParams, Vault, VaultError};

fn test_params() -> KdfParams {
    KdfParams {
        m_cost: 8,
        t_cost: 1,
        p_cost: 1,
    }
}

fn temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aster-vault-test-{tag}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn make_login(title: &str, url: &str, username: &str, password: &str) -> Item {
    let mut item = Item::new(ItemType::Login, title);
    item.set_field("url", url);
    item.set_field("username", username);
    item.set_field("password", password);
    item
}

#[test]
fn creates_and_opens_a_vault_file() {
    let dir = temp_dir("create-open");
    let path = dir.join("vault.avlt");

    let (vault, _recovery) = Vault::create_file(&path, "master-pw", test_params()).unwrap();
    assert_eq!(vault.item_count(), 0);
    assert!(path.exists());

    let reopened = Vault::open_file(&path, "master-pw").unwrap();
    assert_eq!(reopened.item_count(), 0);
}

#[test]
fn wrong_password_on_file_fails_closed() {
    let dir = temp_dir("wrong-pw");
    let path = dir.join("vault.avlt");
    Vault::create_file(&path, "master-pw", test_params()).unwrap();

    assert!(matches!(
        Vault::open_file(&path, "not-the-pw").unwrap_err(),
        VaultError::InvalidCredentials
    ));
}

#[test]
fn recovery_key_opens_the_file() {
    let dir = temp_dir("recovery");
    let path = dir.join("vault.avlt");
    let (_, recovery) = Vault::create_file(&path, "master-pw", test_params()).unwrap();

    let vault = Vault::open_file_with_recovery(&path, &recovery).unwrap();
    assert_eq!(vault.item_count(), 0);
}

#[test]
fn crud_search_and_favorites_round_trip() {
    let (mut vault, _recovery, _bytes) = Vault::create("pw", test_params()).unwrap();

    let login = vault.add_item(make_login(
        "Northstar",
        "https://northstar.app",
        "waleed@northstar.app",
        "S3cret!",
    ));
    let note = vault.add_item(Item::new(ItemType::Note, "Wifi codes"));
    let folder = vault.add_folder(Folder::new("Personal"));

    assert_eq!(vault.item_count(), 2);
    assert_eq!(vault.folder_count(), 1);

    // Search matches title, url, username, and notes.
    assert_eq!(vault.search("northstar").len(), 1);
    assert_eq!(vault.search("northstar").first().unwrap().id, login);
    assert_eq!(vault.search("waleed@").len(), 1);
    assert_eq!(vault.search("wifi").first().unwrap().id, note);

    // Favorites.
    assert!(vault.toggle_favorite(&login));
    assert_eq!(vault.favorites().len(), 1);

    // Filter by type.
    assert_eq!(vault.items_by_type(ItemType::Login).len(), 1);
    assert_eq!(vault.items_by_type(ItemType::Note).len(), 1);

    // Delete.
    assert!(vault.delete_item(&note));
    assert_eq!(vault.item_count(), 1);

    // Folder deletion un-parents items rather than deleting them.
    let mut item = vault.item(&login).cloned().unwrap();
    item.folder_id = Some(folder.clone());
    let data_item = item;
    vault.delete_item(&login);
    vault.add_item(data_item);
    assert!(vault.delete_folder(&folder));
    assert_eq!(vault.item(&login).unwrap().folder_id, None);
}

#[test]
fn edits_create_bounded_history() {
    let (mut vault, _r, _b) = Vault::create("pw", test_params()).unwrap();
    let mut item = Item::new(ItemType::Login, "Original");
    item.set_field("username", "old");
    let id = vault.add_item(item);

    for i in 0..15 {
        let mut fields = BTreeMap::new();
        fields.insert("username".to_string(), format!("user{i}"));
        vault
            .update_item(&id, format!("Title {i}"), fields, String::new())
            .unwrap();
    }

    let stored = vault.item(&id).unwrap();
    assert_eq!(stored.title, "Title 14");
    assert_eq!(stored.field("username"), Some("user14"));
    // History is bounded.
    assert!(stored.history.len() <= 10);
}

#[test]
fn persistence_round_trips_items() {
    let dir = temp_dir("persist");
    let path = dir.join("vault.avlt");
    let (mut vault, _recovery) = Vault::create_file(&path, "pw", test_params()).unwrap();
    vault.add_item(make_login("GitHub", "https://github.com", "dev", "hunter2"));
    vault.save_file(&path).unwrap();
    drop(vault);

    let reopened = Vault::open_file(&path, "pw").unwrap();
    assert_eq!(reopened.item_count(), 1);
    let item = &reopened.search("github")[0];
    assert_eq!(item.field("password"), Some("hunter2"));
}

#[test]
fn tampered_file_fails_closed() {
    let (vault, _r, _bytes) = Vault::create("pw", test_params()).unwrap();
    let mut mutable = vault;
    mutable.add_item(make_login("A", "u", "x", "y"));
    let mut bytes = mutable.to_bytes().unwrap();

    // Flip a byte in the ciphertext region.
    let last = bytes.len() - 1;
    bytes[last] ^= 0xff;
    assert!(Vault::from_bytes(&bytes, "pw").is_err());
}

#[test]
fn truncated_file_fails_closed() {
    let (vault, _r, bytes) = Vault::create("pw", test_params()).unwrap();
    let _ = vault;
    let truncated = &bytes[..bytes.len() - 2];
    assert!(Vault::from_bytes(truncated, "pw").is_err());
}

#[test]
fn no_plaintext_secret_appears_on_disk() {
    let (mut vault, _r, _b) = Vault::create("pw", test_params()).unwrap();
    vault.add_item(make_login(
        "TOPSECRET-TITLE",
        "https://TOPSECRET.example",
        "TOPSECRET-USER",
        "TOPSECRET-PASSWORD",
    ));
    let bytes = vault.to_bytes().unwrap();

    for needle in [
        b"TOPSECRET-TITLE".as_slice(),
        b"TOPSECRET.example",
        b"TOPSECRET-USER",
        b"TOPSECRET-PASSWORD",
    ] {
        assert!(
            !bytes.windows(needle.len()).any(|w| w == needle),
            "plaintext leaked into the container bytes"
        );
    }
}

#[test]
fn master_password_change_is_persistable() {
    let dir = temp_dir("rotate");
    let path = dir.join("vault.avlt");
    let (mut vault, _recovery) = Vault::create_file(&path, "old-pw", test_params()).unwrap();
    vault.add_item(make_login("Keep", "u", "x", "y"));

    vault.change_master_password("old-pw", "new-pw").unwrap();
    vault.save_file(&path).unwrap();

    assert!(Vault::open_file(&path, "old-pw").is_err());
    let reopened = Vault::open_file(&path, "new-pw").unwrap();
    assert_eq!(reopened.item_count(), 1);
}

#[test]
fn backup_bytes_are_marked_and_openable() {
    let (mut vault, _recovery, _bytes) = Vault::create("pw", test_params()).unwrap();
    vault.add_item(make_login("Backed", "u", "x", "y"));

    let backup = vault.to_backup_bytes().unwrap();
    let info = vault_core::container::format::decode(&backup).unwrap();
    assert_eq!(info.header.kind, ContainerKind::Backup);

    let restored = Vault::from_bytes(&backup, "pw").unwrap();
    assert_eq!(restored.item_count(), 1);
}

#[test]
fn atomic_write_is_non_destructive_on_success() {
    let dir = temp_dir("atomic");
    let path = dir.join("out.avlt");
    atomic_write(&path, b"first").unwrap();
    atomic_write(&path, b"second").unwrap();
    assert_eq!(fs::read(&path).unwrap(), b"second");
}
