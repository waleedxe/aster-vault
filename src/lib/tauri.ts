import { invoke } from "@tauri-apps/api/core";

/**
 * Typed wrapper over the Tauri bridge.
 *
 * This is the only module allowed to call `invoke` directly. Components import
 * small, named functions so the command surface stays auditable.
 */

/** Static application information. */
export interface AppInfo {
  name: string;
  version: string;
  format_version: number;
}

/** Lock/unlock status snapshot. */
export interface VaultStatus {
  unlocked: boolean;
  item_count: number;
  folder_count: number;
  path: string | null;
}

/** Result of creating a vault. */
export interface CreateVaultResult {
  recovery_key: string;
  status: VaultStatus;
}

/** Item type discriminator. */
export type ItemType = "login" | "note" | "card" | "identity" | "totp";

/** Item as returned by the backend. */
export interface ItemDto {
  id: string;
  item_type: ItemType;
  title: string;
  folder_id: string | null;
  favorite: boolean;
  tags: string[];
  created_at: number;
  updated_at: number;
  fields: Record<string, string>;
  notes: string;
  history: number[];
}

/** Input for creating/updating an item. */
export interface ItemInput {
  item_type: ItemType;
  title: string;
  folder_id?: string | null;
  favorite?: boolean;
  tags?: string[];
  fields?: Record<string, string>;
  notes?: string;
}

/** Folder DTO. */
export interface FolderDto {
  id: string;
  name: string;
  created_at: number;
}

/** Backup DTO. */
export interface BackupDto {
  path: string;
  created_at: number;
  size: number;
}

/** Password strength DTO. */
export interface StrengthDto {
  score: number;
  entropy_bits: number;
  is_common: boolean;
  label: string;
}

/** Password generation options. */
export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  exclude_ambiguous: boolean;
}

/** Passphrase generation options. */
export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
}

/** Application metadata. */
export function appInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

/** Current lock state. */
export function vaultStatus(): Promise<VaultStatus> {
  return invoke<VaultStatus>("vault_status");
}

/** Whether a vault file exists at a path. */
export function vaultExists(path: string): Promise<boolean> {
  return invoke<boolean>("vault_exists", { path });
}

/** Create a new vault. */
export function createVault(
  path: string,
  masterPassword: string,
): Promise<CreateVaultResult> {
  return invoke<CreateVaultResult>("create_vault", { path, masterPassword });
}

/** Unlock with the master password. */
export function unlockVault(
  path: string,
  masterPassword: string,
): Promise<VaultStatus> {
  return invoke<VaultStatus>("unlock_vault", { path, masterPassword });
}

/** Unlock with the recovery key. */
export function unlockVaultWithRecovery(
  path: string,
  recoveryKey: string,
): Promise<VaultStatus> {
  return invoke<VaultStatus>("unlock_vault_with_recovery", {
    path,
    recoveryKey,
  });
}

/** Lock the vault. */
export function lockVault(): Promise<VaultStatus> {
  return invoke<VaultStatus>("lock_vault");
}

/** Persist the unlocked vault. */
export function saveVault(): Promise<void> {
  return invoke<void>("save_vault");
}

/** Record user activity (resets the auto-lock timer). */
export function noteActivity(): Promise<void> {
  return invoke<void>("note_activity");
}

/** List items, optionally filtered. */
export function listItems(query?: string): Promise<ItemDto[]> {
  return invoke<ItemDto[]>("list_items", { query: query ?? null });
}

/** Create an item. */
export function createItem(input: ItemInput): Promise<ItemDto> {
  return invoke<ItemDto>("create_item", { input });
}

/** Update an item. */
export function updateItem(id: string, input: ItemInput): Promise<ItemDto> {
  return invoke<ItemDto>("update_item", { id, input });
}

/** Delete an item. */
export function deleteItem(id: string): Promise<boolean> {
  return invoke<boolean>("delete_item", { id });
}

/** Toggle an item's favourite flag. */
export function toggleFavorite(id: string): Promise<boolean> {
  return invoke<boolean>("toggle_favorite", { id });
}

/** List folders. */
export function listFolders(): Promise<FolderDto[]> {
  return invoke<FolderDto[]>("list_folders");
}

/** Create a folder. */
export function createFolder(name: string): Promise<FolderDto> {
  return invoke<FolderDto>("create_folder", { name });
}

/** Delete a folder. */
export function deleteFolder(id: string): Promise<boolean> {
  return invoke<boolean>("delete_folder", { id });
}

/** Change the master password. */
export function changeMasterPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return invoke<void>("change_master_password", {
    currentPassword,
    newPassword,
  });
}

/** Generate a password. */
export function generatePassword(options: PasswordOptions): Promise<string> {
  return invoke<string>("generate_password", { options });
}

/** Generate a passphrase. */
export function generatePassphrase(
  options: PassphraseOptions,
): Promise<string> {
  return invoke<string>("generate_passphrase", { options });
}

/** Estimate password strength. */
export function passwordStrength(password: string): Promise<StrengthDto> {
  return invoke<StrengthDto>("password_strength", { password });
}

/** Count reused passwords. */
export function reusedPasswordCount(): Promise<number> {
  return invoke<number>("reused_password_count");
}

/** Export an encrypted backup to a directory. */
export function exportBackup(dir: string): Promise<string> {
  return invoke<string>("export_backup", { dir });
}

/** List backups in a directory. */
export function listBackups(dir: string): Promise<BackupDto[]> {
  return invoke<BackupDto[]>("list_backups", { dir });
}

/** Structurally verify a backup; returns its created-at timestamp. */
export function verifyBackup(path: string): Promise<number> {
  return invoke<number>("verify_backup", { path });
}

/** Restore a backup to a new vault file. */
export function restoreBackup(
  path: string,
  masterPassword: string,
  destination: string,
): Promise<VaultStatus> {
  return invoke<VaultStatus>("restore_backup", {
    path,
    masterPassword,
    destination,
  });
}

/** Seconds since the latest backup in a directory. */
export function secondsSinceLatestBackup(dir: string): Promise<number | null> {
  return invoke<number | null>("seconds_since_latest_backup", { dir });
}

/** Apply backup retention. */
export function applyBackupRetention(
  dir: string,
  keep: number,
): Promise<number> {
  return invoke<number>("apply_backup_retention", { dir, keep });
}
