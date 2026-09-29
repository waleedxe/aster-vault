import { create } from "zustand";

import * as api from "../lib/tauri";
import type { FolderDto, ItemDto, VaultStatus } from "../lib/tauri";

/** Sidebar view identifiers. */
export type View =
  | "all"
  | "favorites"
  | "logins"
  | "notes"
  | "cards"
  | "identities"
  | "archive"
  | "backup"
  | "settings";

const EMPTY_STATUS: VaultStatus = {
  unlocked: false,
  item_count: 0,
  folder_count: 0,
  path: null,
};

interface VaultStoreState {
  status: VaultStatus;
  items: ItemDto[];
  folders: FolderDto[];
  view: View;
  query: string;
  selectedId: string | null;
  error: string | null;
  busy: boolean;
  setView: (view: View) => void;
  setQuery: (query: string) => void;
  select: (id: string | null) => void;
  setError: (error: string | null) => void;
  refresh: () => Promise<void>;
  init: () => Promise<void>;
  lock: () => Promise<void>;
}

export const useVaultStore = create<VaultStoreState>((set, get) => ({
  status: EMPTY_STATUS,
  items: [],
  folders: [],
  view: "all",
  query: "",
  selectedId: null,
  error: null,
  busy: false,

  setView: (view) => set({ view, selectedId: null }),
  setQuery: (query) => set({ query }),
  select: (id) => set({ selectedId: id }),
  setError: (error) => set({ error }),

  refresh: async () => {
    set({ busy: true, error: null });
    try {
      const status = await api.vaultStatus();
      if (!status.unlocked) {
        set({ status, items: [], folders: [], selectedId: null, busy: false });
        return;
      }
      const [items, folders] = await Promise.all([
        api.listItems(get().query || undefined),
        api.listFolders(),
      ]);
      set({ status, items, folders, busy: false });
    } catch (err) {
      set({ error: String(err), busy: false });
    }
  },

  init: async () => {
    set({ busy: true, error: null });
    try {
      const status = await api.vaultStatus();
      set({ status, busy: false });
    } catch (err) {
      set({ error: String(err), busy: false });
    }
  },

  lock: async () => {
    try {
      const status = await api.lockVault();
      set({ status, items: [], folders: [], selectedId: null });
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));

/** Which items belong to the current sidebar view (before search). */
export function filterByView(items: ItemDto[], view: View): ItemDto[] {
  switch (view) {
    case "favorites":
      return items.filter((item) => item.favorite);
    case "logins":
      return items.filter((item) => item.item_type === "login");
    case "notes":
      return items.filter((item) => item.item_type === "note");
    case "cards":
      return items.filter((item) => item.item_type === "card");
    case "identities":
      return items.filter((item) => item.item_type === "identity");
    default:
      return items;
  }
}
