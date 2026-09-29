import { open, save } from "@tauri-apps/plugin-dialog";

const VAULT_PATH_KEY = "aster-vault.path";
const BACKUP_DIR_KEY = "aster-vault.backupDir";

/** Remember the vault path (local only; not a secret). */
export function rememberVaultPath(path: string): void {
  try {
    localStorage.setItem(VAULT_PATH_KEY, path);
  } catch {
    // ignore
  }
}

/** The remembered vault path, if any. */
export function getRememberedVaultPath(): string | null {
  try {
    return localStorage.getItem(VAULT_PATH_KEY);
  } catch {
    return null;
  }
}

/** Remember the chosen backup directory. */
export function rememberBackupDir(dir: string): void {
  try {
    localStorage.setItem(BACKUP_DIR_KEY, dir);
  } catch {
    // ignore
  }
}

/** The remembered backup directory, if any. */
export function getRememberedBackupDir(): string | null {
  try {
    return localStorage.getItem(BACKUP_DIR_KEY);
  } catch {
    return null;
  }
}

/** Ask the user where to save a new vault file. */
export async function pickSaveVaultPath(): Promise<string | null> {
  const chosen = await save({
    title: "Choose where to create your vault",
    defaultPath: "aster-vault.avlt",
    filters: [{ name: "Aster Vault", extensions: ["avlt"] }],
  });
  return chosen ?? null;
}

/** Ask the user to select an existing vault file. */
export async function pickExistingVault(): Promise<string | null> {
  const chosen = await open({
    title: "Open an Aster Vault file",
    multiple: false,
    filters: [{ name: "Aster Vault", extensions: ["avlt"] }],
  });
  return typeof chosen === "string" ? chosen : null;
}

/** Ask the user to select a directory. */
export async function pickDirectory(title: string): Promise<string | null> {
  const chosen = await open({
    title,
    directory: true,
    multiple: false,
  });
  return typeof chosen === "string" ? chosen : null;
}
