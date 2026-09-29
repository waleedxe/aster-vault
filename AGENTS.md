# Project Memory — Aster Vault

> Canonical working memory. Read this first in any new session.
> Source of truth: `docs/reference/ASTER_VAULT_BUILD_BRIEF.md` (product brief)
> and `docs/specs/` (the Phase 0 specification set).

## 1. What this is
Aster Vault is a calm, private, **local-first, offline Windows password manager**.
Promise: *"Your secrets stay yours. Your backups stay recoverable."*
Working name only — check trademarks/domains before publishing. Never claim a
certification, an audit, or immunity to compromise.

## 2. Release scope
- **Release 1 (build now):** offline local vault — folders/collections; logins,
  notes, cards, identities, TOTP; search + favorites; password/passphrase
  generator; local strength + reuse warnings; copy with clipboard-clear timer;
  auto-lock (inactivity / screen lock / sleep / user switch); masked fields;
  Proton Pass + CSV import (explicit plaintext workflow); encrypted backup,
  restore, verification, recovery drills. No account, no cloud.
- **Release 2 (planned only, `docs/specs/06-browser-extension-r2.md`):** Chrome/
  Edge extension, narrow permissions, phishing-aware origin matching, autofill
  only after authenticated desktop communication. Separate security project.
- **Release 3 (not now):** optional encrypted sync — a separate security project.
  Do not claim zero-knowledge until independently assessed. Aliases, cross-device
  passkeys, sharing = separate designs.

## 3. Non-negotiable security rules
1. Random 256-bit DEK from OS CSPRNG; AES-256-GCM; unique nonces; authenticated
   metadata (AAD). Never invent a cipher or reuse a nonce.
2. Argon2id KEK from the master password with a unique salt; benchmark + store
   parameters; allow future upgrades; wrap the DEK.
3. Independent recovery-key wrapping path. Never store master/recovery key in the
   vault, logs, analytics, or backups.
4. **Encrypt metadata too** — names, URLs, usernames, tags, notes.
5. Backups are portable, versioned, authenticated, **DPAPI-independent**; restore
   on a clean Windows account from file + password/RK only.
6. Atomic backup export (temp → fsync → validate → rename); retention;
   restore-to-new-vault-first with preview + explicit confirm; prior vault kept
   until verified; tamper/wrong creds fail closed.
7. No silent plaintext export; warn on plaintext imports; local-only; no secrets in
   logs, crash reports, shell args, or fixtures. No secure-deletion promises.
8. Reviewed/pinned deps, signed releases, verified updates, independent review.
   Passing tests ≠ secure.

## 4. Explicit limits (state honestly, never contradict in copy)
Malware on an unlocked session can read secrets. Compromised OS/binary defeats the
app. Clipboard readers inside the clear window. Coercion. No secure deletion on
SSDs. No browser autofill/passkeys/aliases/cloud in R1. Lost password + lost
recovery key = unrecoverable by design. Supply-chain risk mitigated but not
removed. Independent review required before real passwords.

## 5. Stack (decided)
- Desktop: **Tauri 2** (NOT Electron).
- Frontend: **React 19 + TypeScript (strict) + Vite**.
- Styling: **Tailwind CSS v4** (`@tailwindcss/vite`).
- State: **Zustand**. i18n: **i18next + react-i18next** (EN + AR, RTL/LTR).
- Backend: **Rust**, workspace with a standalone **`vault-core`** crate (crypto +
  container + store + backup, no Tauri) + a thin `src-tauri` shell.
- Recovery: standalone **`vault-recovery-cli`** crate depending only on
  `vault-core`.
- Chosen over the brief's suggested .NET/WinUI because Rust gives reviewed crypto
  crates, a small hardened binary, and a proven Windows toolchain (see reference
  project). Documented decision.

## 6. Reference project
`C:\Users\walee\Desktop\PDFtool\PDFtool` — a shipped Tauri 2 + React + Rust PDF
toolkit. We mirror its architecture (thin Tauri command layer, testable core
crates), engineering loop, CI, and Windows MSVC release approach. Do **not** copy
its product code; reuse patterns only.

## 7. Engineering loop (after every major feature)
implement → format → lint → typecheck → `cargo fmt` → `clippy -D warnings` →
tests → real round-trip/restore test → prod build where relevant → fix critical
failures → continue. Never accumulate broken phases.

## 8. Environment notes
- WSL Ubuntu 20.04 on `/mnt/c` (slow filesystem; slow installs).
- Node 20 present. Rust via `~/.cargo/bin` (source `$HOME/.cargo/env`; not on the
  default non-login PATH).
- No Tauri Linux deps (WebKitGTK unavailable) → GUI crate checked/built on the
  Windows MSVC CI runner, as in the reference project. `vault-core` fully testable
  locally.
- Disk on C: is tight (~20 GB free) — keep `target/` artifacts lean.

## 9. Specs map
- `docs/specs/01-threat-model.md` — threats, limits, assumptions.
- `docs/specs/02-vault-format.md` — container/backup format + key model.
- `docs/specs/03-architecture.md` — layers, layout, security rules.
- `docs/specs/04-screen-map.md` — screens + visual tokens.
- `docs/specs/05-implementation-plan.md` — phases + acceptance criteria.
- `docs/specs/06-browser-extension-r2.md` — R2 planning.

## 10. Status log
- **Session 1:**
  1. Read the brief + UI mockup; studied the reference PDF toolkit's proven
     architecture, engineering loop, and Windows MSVC release approach.
  2. Decided the stack (Tauri 2 + React 19 + TS + Rust) and wrote all Phase 0
     specs: threat model, portable vault/backup format, architecture, screen map
     + visual tokens, phased implementation plan, R2 browser-extension scoping.
  3. Scaffolded the repo: frontend (Vite/React/TS-strict/Tailwind v4/Zustand/
     i18next EN+AR with RTL), Tauri 2 shell, Rust workspace, CI + release
     workflows, and release docs (README, PRIVACY, CONTRIBUTING,
     THIRD_PARTY_LICENSES, CHANGELOG).
  4. **Phase 1 crypto core done** in `crates/vault-core`: CSPRNG 256-bit data key,
     Argon2id KDF, AES-256-GCM seal/open, master-password + independent
     recovery-key wrapping, portable versioned container header with authenticated
     metadata, key zeroization, and master-password rotation. **15 integration
     tests pass.** `cargo fmt`, `clippy -D warnings`, and the recovery CLI all
     green.
  5. **Gate green** (frontend): `typecheck`, `lint`, 4 Vitest tests, `vite build`.
  6. **Next:** Phase 2 — encrypted record store + item models (login/note/card/
     identity/TOTP), folders/collections, search, schema versioning.

- **Session 2 — Phases 2–6 implemented:**
  1. **Phase 2 — store/model:** item model (login/note/card/identity/TOTP),
     folders, bounded revision history, CRUD, favorites, local search. Chose a
     **single-file encrypted container** (whole `VaultData` graph sealed as one
     AEAD payload; no plaintext index) over SQLite for portability and
     reviewability — documented in `docs/specs/02-vault-format.md` §5.
  2. **Phase 3 — backup/recovery:** atomic export, structural verify, inspect,
     restore-to-new-vault, retention, backup age. Standalone `vault-recovery-cli`
     (`version`/`verify`/`inspect`/`restore`, credentials via stdin only).
  3. **Phase 4 — service + commands:** moved the service layer into
     `vault-core::session` (testable without a GUI); full Tauri command surface
     (create/unlock/lock, CRUD, folders, generator, strength/reuse, backup).
  4. **Phase 4/5 — frontend:** onboarding wizard, wired unlock, vault list/detail/
     editor, generator panel, backup center, restore flow, settings (auto-lock,
     clipboard timer, reduced motion, language, change password), local CSV /
     Proton Pass import. Auto-lock hook + clipboard-clear timer + masked fields.
  5. **Phase 6 — import:** local CSV parser (generic + Proton Pass headers) with
     plaintext warning; imported via the same create-item path.
  6. **Tests:** 45 Rust tests + 9 frontend tests. Rust `fmt`/`clippy -D warnings`
     green; frontend `format:check`/`lint`/`typecheck`/`test`/`build` green.
  7. **Phase 7 — release prep:** generated an original Aster Vault icon set
     (`assets/generate-icon.py` → `npm run tauri icon`), completing the last
     requirement for the Windows (MSVC) release workflow to emit an installer.
  8. **Still open:** native launch validation on Windows (the GUI crate is
     checked on the Windows MSVC CI runner; no WebKitGTK locally) and the
     external independent security review required by the release gate.

- **Session 3 — published:**
  1. Created private GitHub repo **`waleedxe/aster-vault`**, pushed `main`.
  2. CI (frontend + Rust) passed; tagged **`v0.1.0`**.
  3. The **Windows (MSVC) release workflow passed** and produced:
     `Aster.Vault_0.1.0_x64-setup.exe` (NSIS installer) and `aster-vault.exe`
     (standalone). This is the **first real compile of the Tauri app crate** —
     it built successfully on Windows.
  4. Downloaded both artifacts to
     `C:\Users\walee\Desktop\aster-vault-release\`.
  5. **Next / open:** run the installer on Windows to validate launch and the
     full flow; publish the draft release when ready; revoke the temporary token;
     independent security review still required.
