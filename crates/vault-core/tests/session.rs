//! Service-layer (session) tests. These exercise the same code the Tauri
//! commands call, without any GUI dependency.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use vault_core::session::{ItemInput, VaultSession};

fn temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "aster-vault-session-{tag}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn login_input(title: &str, password: &str) -> ItemInput {
    let mut fields = BTreeMap::new();
    fields.insert("username".to_string(), "waleed".to_string());
    fields.insert("password".to_string(), password.to_string());
    ItemInput {
        item_type: "login".to_string(),
        title: title.to_string(),
        folder_id: None,
        favorite: false,
        tags: vec!["work".to_string()],
        fields,
        notes: String::new(),
    }
}

#[test]
fn session_lifecycle() {
    let dir = temp_dir("lifecycle");
    let path = dir.join("vault.avlt");
    let session = VaultSession::default();

    // Locked by default.
    assert!(!session.status().unlocked);
    assert!(session.list_items(None).is_err());

    // Create.
    let created = session.create_vault(&path, "master-pw").unwrap();
    assert!(!created.recovery_key.is_empty());
    assert!(created.status.unlocked);
    assert!(path.exists());

    // CRUD.
    let item = session
        .create_item(login_input("Northstar", "s3cret"))
        .unwrap();
    assert_eq!(item.item_type, "login");
    assert_eq!(session.list_items(None).unwrap().len(), 1);
    assert_eq!(session.list_items(Some("northstar")).unwrap().len(), 1);
    assert_eq!(session.list_items(Some("nothing")).unwrap().len(), 0);

    // Update.
    let mut updated = login_input("Northstar", "s3cret");
    updated.title = "Northstar Pro".to_string();
    let dto = session.update_item(&item.id, updated).unwrap();
    assert_eq!(dto.title, "Northstar Pro");
    assert_eq!(dto.history.len(), 1);

    // Favorite + folders.
    assert!(session
        .with_vault(|v| Ok(v.toggle_favorite(&item.id)))
        .unwrap());
    let folder = session.create_folder("Personal").unwrap();
    assert_eq!(session.list_folders().unwrap().len(), 1);
    assert!(session.delete_folder(&folder.id).unwrap());

    // Reuse detection.
    let other = session.create_item(login_input("Other", "s3cret")).unwrap();
    assert_eq!(session.reused_password_count().unwrap(), 1);

    // Save + backup.
    session
        .with_vault(|v| v.save_file(&path).map_err(|e| e.to_string()))
        .unwrap();
    let backup_path = session.export_backup(&dir).unwrap();
    assert!(PathBuf::from(&backup_path).exists());
    assert_eq!(session.list_backups(&dir).unwrap().len(), 1);

    // Lock drops access.
    session.lock();
    assert!(!session.status().unlocked);
    assert!(session.list_items(None).is_err());
    let _ = other;
}

/// A created item must survive a lock/reopen cycle without any explicit save:
/// the session persists each mutation itself.
#[test]
fn create_item_persists_across_lock_and_reopen() {
    let dir = temp_dir("persist-create");
    let path = dir.join("vault.avlt");

    let session = VaultSession::default();
    session.create_vault(&path, "master-pw").unwrap();
    let item = session
        .create_item(login_input("Northstar", "s3cret"))
        .unwrap();

    // No manual save: locking drops the in-memory vault.
    session.lock();
    assert!(!session.status().unlocked);

    // A fresh session reading the same file must see the item.
    let reopened = VaultSession::default();
    reopened.unlock_vault(&path, "master-pw").unwrap();
    let items = reopened.list_items(None).unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, item.id);
    assert_eq!(items[0].title, "Northstar");
    assert_eq!(
        items[0].fields.get("password").map(String::as_str),
        Some("s3cret")
    );
}

/// Updates and deletes must likewise be durable across a lock/reopen cycle.
#[test]
fn update_and_delete_persist_across_lock_and_reopen() {
    let dir = temp_dir("persist-update-delete");
    let path = dir.join("vault.avlt");

    let session = VaultSession::default();
    session.create_vault(&path, "master-pw").unwrap();
    let item = session
        .create_item(login_input("Northstar", "s3cret"))
        .unwrap();

    let mut updated = login_input("Northstar", "s3cret");
    updated.title = "Northstar Pro".to_string();
    session.update_item(&item.id, updated).unwrap();

    // Reopen: the update survived without a manual save.
    let reopened = VaultSession::default();
    reopened.unlock_vault(&path, "master-pw").unwrap();
    let items = reopened.list_items(None).unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].title, "Northstar Pro");

    // Delete, then reopen once more: the deletion also survived.
    assert!(reopened.delete_item(&item.id).unwrap());
    reopened.lock();

    let after_delete = VaultSession::default();
    after_delete.unlock_vault(&path, "master-pw").unwrap();
    assert!(after_delete.list_items(None).unwrap().is_empty());
}
