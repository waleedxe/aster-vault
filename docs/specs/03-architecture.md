# Aster Vault — Architecture

Status: Phase 0 specification.

## 1. Guiding rule

> UI → Tauri command → Vault service → engine/crypto adapter (core crate) → primitive.

The React UI never touches cryptography directly. The Tauri layer is thin. All
security-critical logic lives in a standalone Rust crate, `vault-core`, that has
no Tauri/GUI dependency and is unit-testable everywhere. This mirrors the proven
adapter pattern from the reference PDF toolkit and keeps the crypto reviewable.

## 2. Repository layout

```text
src/                         # React 19 + TypeScript (strict) frontend
  app/                       # App root, shell, router
  components/
    common/                  # shared primitives (Sidebar, LanguageSwitcher, ...)
    vault/                   # item list, item detail, item editor
    file-drop/               # import/backup file pickers
  features/
    onboarding/              # setup wizard: master password, recovery key, first backup
    unlock/                  # unlock screen
    vault/                   # list + detail + search
    generator/               # password & passphrase generator
    import/                  # Proton Pass / CSV import
    backup/                  # backup center (create, schedule, verify, restore)
    settings/                # security, lock behaviour, appearance
  stores/                    # Zustand stores
  hooks/
  lib/                       # typed Tauri bridge, path helpers, dialogs
  i18n/                      # en.json, ar.json, direction helpers
  types/
src-tauri/                   # thin Tauri 2 app shell
  src/
    commands/                # #[tauri::command] surface only
    vault/                   # service layer: calls vault-core, owns app state
    lib.rs                   # plugin + command registration
crates/
  vault-core/                # crypto + container + storage (NO Tauri)
    src/
      crypto/                # kdf, aead, keys, rng, zeroize
      container/             # header, wrap, record store, format versioning
      store/                 # persistence (SQLite or file), repositories
      model/                 # item types, folders, history
      backup/                # atomic export, retention, verify, restore
      recovery/              # standalone recovery path
      error.rs
    tests/                   # round-trip, tamper, wrong-password, migration
crates/
  vault-recovery-cli/        # standalone CLI: open/verify/restore without the UI
assets/fonts/                # if an Arabic/glyph font is ever needed
tests/fixtures/              # legally safe fixtures (generated, never secret)
docs/specs/                  # this specification set
docs/reference/              # product brief + UI mockup
.github/workflows/           # CI + Windows release
```

## 3. Layers

### 3.1 Frontend (`src/`)
- React 19 + TypeScript (strict, incl. `exactOptionalPropertyTypes`), Vite,
  Tailwind CSS v4, Zustand, i18next/react-i18next.
- English + Arabic with full RTL/LTR switching and persisted language.
- **No crypto.** Secrets received from the backend are held only transiently and
  cleared; the frontend is not a safe long-term store.
- Talks to the backend only through `src/lib/tauri.ts` (a typed wrapper over
  `invoke`).

### 3.2 Tauri shell (`src-tauri/`)
- Registers plugins (dialog, opener) and commands.
- `commands/` are thin: validate input, call the service, map errors, return DTOs.
- `vault/` service owns the in-memory unlocked state, the auto-lock timer, and
  clipboard clearing. It never reimplements crypto.

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
unlock:         master password → KEK → unwrap DEK → decrypt record store
item CRUD:      UI → command → service → vault-core (encrypt record) → store
backup:         service → vault-core.backup.export (atomic, validated) → file
restore:        file + password/RK → decrypt to NEW vault → verify → preview → confirm → swap
auto-lock:      timer/session-lock/sleep/user-switch → zeroize in-memory DEK, drop decrypted state
```

## 5. Job / async model

Long operations (KDF benchmark, import of large exports, backup of a large vault,
restore verification) run off the UI thread and report progress events, matching
the job-state model proven in the reference project:
`idle → queued → running → completed | failed | cancelled`. Cancellation is
supported where practical; heavy work never blocks the React thread.

## 6. Security-specific architecture rules

1. **Crypto only in `vault-core`.** No `aes-gcm`/`argon2` usage in `src-tauri` or
   `src`.
2. **No secrets in logs.** A logging policy scrubs secret fields; never log
   passwords, keys, decrypted records, or plaintext import contents.
3. **No secrets in shell arguments.** Never pass secrets via process args/env to
   helper processes; pass via stdin or in-process only.
4. **Zeroize** key material on lock/drop (`zeroize`/`secrecy`).
5. **Fail closed.** Any authentication/format error refuses and surfaces a clear
   message; never fall back to plaintext.
6. **Never overwrite.** Originals and prior vaults are preserved; outputs get safe
   incremented names; restore swaps only after verification.
7. **Input is untrusted.** Validate file types and paths, enforce resource limits,
   guard against path traversal, never execute content from files.
8. **No silent plaintext export.** Import/export flows warn and work with the
   minimum data.

## 7. Portability & DPAPI

- The portable container is the only required path to decrypt.
- DPAPI / Windows Hello, if used at all, may only **speed up local unlock** on the
  original machine. They must never be the sole way to decrypt a backup, and the
  portable path must always work on a clean Windows account.

## 8. Build & CI

- Local gates: frontend `format:check`, `lint`, `typecheck`, Vitest, `vite build`;
  Rust `cargo fmt --check`, `clippy -D warnings`, `cargo test` across core crates.
- The Tauri GUI crate is checked/built on the **Windows MSVC** CI runner (the
  Linux box in this environment lacks the WebKitGTK deps and a GNU cross-build
  produces a non-runnable exe — a lesson from the reference project).
- Release on version tag: Windows MSVC build → NSIS installer → uploaded artifact.
