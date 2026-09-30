# Aster Vault — Architecture

Status: implemented (Release 1). Reflects the code as of `v0.1.1`.

## 1. Guiding rule

> UI → Tauri command → `vault-core::session` → `vault-core` engine → reviewed primitive.

The React UI never touches cryptography directly. The Tauri layer is thin. All
security-critical logic lives in a standalone Rust crate, `vault-core`, that has
no Tauri/GUI dependency and is unit-testable everywhere. This mirrors the proven
adapter pattern from the reference PDF toolkit and keeps the crypto reviewable.

## 2. Repository layout

```text
src/                          # React 19 + TypeScript (strict) frontend
  app/                        # App, AppShell, GalleryView (dev component gallery)
  components/
    common/                   # Sidebar, LanguageSwitcher
    ui/                       # design-system primitives (see §3.1)
  features/
    onboarding/               # setup wizard: master password, recovery key, first backup
    unlock/                   # unlock screen (password or recovery key)
    vault/                    # list + grid + detail + item editor
    generator/                # password & passphrase generator panel
    import/                   # Proton Pass / CSV import (+ local CSV parser)
    backup/                   # backup center: create, verify, restore
    settings/                 # security, appearance, language, about
  stores/                     # Zustand: vaultStore, settingsStore, themeStore
  hooks/                      # useAutoLock, useClipboard
  lib/                        # typed Tauri bridge (tauri.ts), paths, toast, cx
  i18n/                       # en.json, ar.json, index, direction, changeLanguage
  test/                       # vitest setup
src-tauri/                    # thin Tauri 2 app shell
  src/
    commands/mod.rs           # #[tauri::command] surface only
    lib.rs                    # plugin + command registration
crates/
  vault-core/                 # crypto + container + store + backup (NO Tauri)
    src/
      crypto/                 # aead.rs, kdf.rs, keys.rs, rng.rs
      container/              # header.rs, format.rs, vault.rs (framing + key wraps)
      model/                  # item types, folders, history, VaultData
      store/                  # Vault: open/create/save, CRUD, search, atomic write
      backup/                 # export, verify, restore, retention, age
      generator.rs            # password + passphrase generation
      strength.rs             # local strength + reuse analysis
      session.rs              # VaultSession service layer + app DTOs (GUI-free)
      error.rs
    tests/                    # crypto, store, backup, generator, session
  vault-recovery-cli/         # standalone CLI: verify/inspect/restore without the UI
assets/
  brand/aster-mark.png        # brand mark (transparent)
  icon-source.png             # mark composited on the tile (icon input)
scripts/make-icon.py          # builds icon-source.png (stdlib only)
docs/specs/                   # this specification set
docs/reference/               # product brief + UI mockup + brand source
docs/PROJECT-AR.md            # Arabic project guide
.github/workflows/            # CI + Windows release
```

## 3. Layers

### 3.1 Frontend (`src/`)
- React 19 + TypeScript (strict, incl. `exactOptionalPropertyTypes`), Vite,
  Tailwind CSS v4, Zustand, i18next/react-i18next.
- **Design system** in `components/ui`: Button, IconButton, Input, Textarea,
  Select, Checkbox, Switch, Card, Badge, Spinner, Avatar, Menu, Dialog, Tabs,
  Toast/Toaster, EmptyState, ErrorBanner, Logo. Tokens live in `src/index.css`
  (palette, radii, elevation, type scale, motion) with class-based light/dark
  theming. A dev-only **component gallery** is reachable at `#gallery`.
- English + Arabic with full RTL/LTR switching and persisted language.
- **No crypto.** Secrets received from the backend are held only transiently and
  cleared; the frontend is not a safe long-term store.
- Talks to the backend only through `src/lib/tauri.ts` (a typed wrapper over
  `invoke`).

### 3.2 Tauri shell (`src-tauri/`)
- Registers plugins (dialog, opener) and commands.
- `commands/` are thin: validate input, call `vault-core::session`, map errors,
  return DTOs.
- The unlocked-vault session (`VaultSession`) and its DTOs live in
  `vault-core::session` — GUI-free, so the whole service layer is tested without
  Tauri. `VaultSession` owns the in-memory vault, the idle auto-lock timer, and
  drops key material on `lock()`.

### 3.3 Core (`crates/vault-core`)
- The single place that performs cryptography, container (de)serialization,
  storage, backup, and restore.
- Public API is engine-agnostic and stable; tests run without a GUI, which lets
  the engineering loop run locally on Linux where the Tauri GUI crate cannot.
- The recovery CLI depends on `vault-core` only — so a broken UI cannot strand
  backups.

## 4. State & data flow

```text
create vault:   master password → Argon2id → KEK → wrap(random DEK)
                generate RK    → wrap DEK   → show RK once, confirm storage
unlock:         master password → KEK → unwrap DEK → decrypt payload → VaultData
item CRUD:      UI → command → VaultSession → vault-core (encrypt payload) → file
backup:         VaultSession → backup::export (atomic, validated) → file
restore:        file + password/RK → decrypt to NEW vault → verify → confirm → replace
auto-lock:      idle timer → lock() → zeroize in-memory DEK, drop decrypted state
```

## 5. Async model

The KDF is the only long operation (≈0.5–1 s). Frontend mutations call commands
and refresh; the store exposes a `busy` flag so the UI can show a spinner.
Backups and restores are single atomic file operations. There is no long-running
job queue in Release 1.

## 6. Security-specific architecture rules

1. **Crypto only in `vault-core`.** No `aes-gcm`/`argon2` usage in `src-tauri` or
   `src`.
2. **No secrets in logs.** Never log passwords, keys, decrypted records, or
   plaintext import contents.
3. **No secrets in shell arguments.** The recovery CLI reads credentials from
   stdin only; secrets are never passed as process args.
4. **Zeroize** key material on lock/drop (`zeroize`).
5. **Fail closed.** Any authentication/format error refuses and surfaces a clear
   message; never fall back to plaintext.
6. **Never overwrite.** The prior vault is preserved; restore writes a new file
   and only replaces after verification + explicit confirmation.
7. **Input is untrusted.** Validate file types and paths; handle malformed files.
8. **No silent plaintext export.** Import flows warn and work with the minimum
   data.

## 7. Portability & DPAPI

- The portable container is the only required path to decrypt.
- DPAPI / Windows Hello, if used at all, may only **speed up local unlock** on the
  original machine. They must never be the sole way to decrypt a backup, and the
  portable path must always work on a clean Windows account.

## 8. Build & CI

- Local gates: frontend `format:check`, `lint`, `typecheck`, Vitest, `vite build`;
  Rust `cargo fmt --check`, `clippy -D warnings`, `cargo test` across core crates.
- The Tauri GUI crate is built on the **Windows MSVC** CI runner (the Linux box in
  this environment lacks the WebKitGTK deps).
- Release on version tag: Windows MSVC build → NSIS installer → uploaded artifact.
  `v0.1.0` and `v0.1.1` were produced this way.
- App icons: `npm run icon:build` (`scripts/make-icon.py` → `tauri icon`).
