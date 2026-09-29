# Changelog

All notable changes to Aster Vault are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/) and intends to use
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
  key zeroization, and master-password rotation. 15 integration tests.
- `crates/vault-recovery-cli`: standalone recovery tool skeleton.

### Notes
- No independent security review has been performed. Do not trust this early
  build with real passwords.
