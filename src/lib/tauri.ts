import { invoke } from "@tauri-apps/api/core";

/** Static application information returned by the backend. */
export interface AppInfo {
  name: string;
  version: string;
  format_version: number;
}

/**
 * Typed wrapper over the Tauri bridge.
 *
 * This is the only module allowed to call `invoke` directly. Components import
 * small, named functions so the command surface stays auditable.
 */
export function appInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}
