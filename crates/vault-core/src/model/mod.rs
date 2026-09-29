//! Vault item model.
//!
//! The entire [`VaultData`] graph is sealed in one authenticated payload, so
//! every field here — titles, URLs, usernames, tags, notes, TOTP seeds — is
//! encrypted at rest. Storage layout is described in
//! `docs/specs/02-vault-format.md`.

use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// Current data schema version, independent of the container format version.
pub const SCHEMA_VERSION: u32 = 1;

/// Milliseconds/seconds timestamp helper (Unix seconds).
pub fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// The kind of an item.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemType {
    /// A website or application login.
    Login,
    /// A free-form secure note.
    Note,
    /// A payment card.
    Card,
    /// A personal identity record.
    Identity,
    /// A standalone TOTP secret.
    Totp,
}

/// A prior revision of an item, kept for the detail panel's history view.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Revision {
    /// When this revision was superseded.
    pub updated_at: i64,
    /// Field map at that time.
    pub fields: BTreeMap<String, String>,
    /// Notes at that time.
    pub notes: String,
}

/// A single vault item.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Item {
    /// Stable random identifier.
    pub id: String,
    /// Item kind.
    pub item_type: ItemType,
    /// Human-readable title (encrypted like everything else).
    pub title: String,
    /// Owning folder id, if any.
    pub folder_id: Option<String>,
    /// Favourite flag.
    pub favorite: bool,
    /// Free-form tags.
    pub tags: Vec<String>,
    /// Creation timestamp (Unix seconds).
    pub created_at: i64,
    /// Last-updated timestamp (Unix seconds).
    pub updated_at: i64,
    /// Type-specific fields; all values are encrypted at rest.
    pub fields: BTreeMap<String, String>,
    /// Free-form notes.
    pub notes: String,
    /// Bounded revision history.
    #[serde(default)]
    pub history: Vec<Revision>,
}

/// Maximum number of revisions retained per item.
pub const MAX_HISTORY: usize = 10;

impl Item {
    /// Create a new item of the given type and title.
    pub fn new(item_type: ItemType, title: impl Into<String>) -> Self {
        let now = now_unix();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            item_type,
            title: title.into(),
            folder_id: None,
            favorite: false,
            tags: Vec::new(),
            created_at: now,
            updated_at: now,
            fields: BTreeMap::new(),
            notes: String::new(),
            history: Vec::new(),
        }
    }

    /// Look up a field value.
    pub fn field(&self, key: &str) -> Option<&str> {
        self.fields.get(key).map(String::as_str)
    }

    /// Set a field value.
    pub fn set_field(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.fields.insert(key.into(), value.into());
    }

    /// Apply an edit, snapshotting the previous state into history.
    pub fn apply_edit(&mut self, title: String, fields: BTreeMap<String, String>, notes: String) {
        self.history.push(Revision {
            updated_at: self.updated_at,
            fields: std::mem::take(&mut self.fields),
            notes: std::mem::take(&mut self.notes),
        });
        if self.history.len() > MAX_HISTORY {
            let excess = self.history.len() - MAX_HISTORY;
            self.history.drain(0..excess);
        }
        self.title = title;
        self.fields = fields;
        self.notes = notes;
        self.updated_at = now_unix();
    }
}

/// A folder or collection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Folder {
    /// Stable random identifier.
    pub id: String,
    /// Folder name (encrypted at rest).
    pub name: String,
    /// Creation timestamp (Unix seconds).
    pub created_at: i64,
}

impl Folder {
    /// Create a new folder.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.into(),
            created_at: now_unix(),
        }
    }
}

/// The complete decrypted vault graph.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultData {
    /// Data schema version.
    pub schema_version: u32,
    /// All folders.
    pub folders: Vec<Folder>,
    /// All items.
    pub items: Vec<Item>,
}

impl Default for VaultData {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            folders: Vec::new(),
            items: Vec::new(),
        }
    }
}

impl VaultData {
    /// An empty vault graph.
    pub fn new() -> Self {
        Self::default()
    }
}
