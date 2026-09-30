# Changelog

All notable changes to Aster Vault are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/) and intends to use
[Semantic Versioning](https://semver.org/).

## [0.1.1]

### Added
- Final brand mark integrated (transparent PNG); app icon set regenerated and
  the mark now appears in-app (sidebar, unlock, onboarding).
- Full design system: tokens (with WCAG-AA verified mode-aware text colours),
  component library, and a dev-only component gallery.
- Rebuilt shell, vault list/grid, and item detail to match the approved mockup:
  greeting header, global search with Ctrl+K, sort + grid/list, monogram avatars,
  per-field cards with reveal/copy/open, and a backup-status card.
- Empty/loading/error states; toast notifications; accessible contrast.

### Changed
- Version bumped to 0.1.1 for the next Windows build.

## [0.1.0]

### Added
- Phase 0 specification set: threat model and explicit limits, portable vault and
  backup container format, architecture, screen map and visual tokens, phased
  implementation plan, and Release 2 browser-extension scoping.
- Tauri 2 + React 19 + TypeScript + Vite + Tailwind + Zustand + i18next project
  scaffold with English/Arabic and RTL/LTR support, persisted language, and a
  locked/unlocked app shell.
- `crates/vault-core`: random 256-bit vault data key, Argon2id key derivation,
  AES-256-GCM sealing/opening, master-password and independent recovery-key
  wrapping, portable versioned container header with authenticated metadata,
  key zeroization, and master-password rotation.
- Encrypted vault store: item model (login/note/card/identity/TOTP), folders,
  bounded revision history, CRUD, favorites, and local search — the whole graph
  sealed as one authenticated payload with no plaintext index on disk.
- Portable encrypted backups: atomic export, structural verification, restore to
  a new vault, retention, and backup age tracking.
- `crates/vault-recovery-cli`: standalone recovery tool (`version`, `verify`,
  `inspect`, `restore`) that needs only the file plus the password or recovery
  key; credentials are read from stdin, never arguments.
- Password and passphrase generator, and local strength/reuse analysis.
- Service layer (`vault-core::session`) and the full Tauri command surface.
- Frontend: onboarding wizard, wired unlock (password or recovery key), vault
  list + detail + editor, generator panel, backup center, settings, and local
  CSV / Proton Pass import.
- Security behaviours: auto-lock on inactivity, copy-with-clipboard-clear timer,
  masked fields, and local reuse warnings.

### Tests
- 45 Rust integration/unit tests across crypto, store, backup, generator and the
  session service; 9 frontend tests (i18n parity, direction, CSV import).

### Notes
- No independent security review has been performed. Do not trust this build with
  real passwords.
- The Windows installer is produced by the release workflow (MSVC). The app icon
  set is generated from `assets/brand/aster-mark.png` by `scripts/make-icon.py`
  (`npm run icon:build`).
