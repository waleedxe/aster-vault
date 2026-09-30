# Aster Vault — Phased Implementation Plan

Status: **Release 1 implemented.** Phases 0–7 are complete; the blocking release
gate below is still open (independent security review + Windows launch validation).
Do not claim completion that is not evidenced.

Engineering loop after every major feature:
implement → format → lint → typecheck → `cargo fmt` → `clippy -D warnings` →
tests → real round-trip/restore test → production build where relevant →
fix critical failures → continue.

---

## Phase 0 — Foundation & specs  ✅

Deliverables: threat model, vault/backup format, architecture, screen map,
phased plan, R2 scoping, project memory, and the scaffolded repo (Tauri 2 +
React + TS + Tailwind + Zustand + i18n, Rust workspace, CI).

Acceptance:
- [x] All specs written.
- [x] Frontend lint + typecheck + build pass.
- [x] `cargo fmt`/`clippy`/`test` pass on `vault-core`.
- [x] No secrets in the repo.

## Phase 1 — Cryptographic core  ✅

Deliverables: CSPRNG 256-bit DEK; Argon2id KEK with per-vault salt + stored
parameters; AES-256-GCM with nonce discipline (random for single-use wraps,
random-per-save for the payload with a documented bound); master-password +
independent recovery-key wraps; zeroization; versioned header with authenticated
metadata.

Acceptance:
- [x] Tests prove round-trip, fail-closed on wrong key/tamper, and key uniqueness.
- [x] All primitives from reviewed crates; no hand-rolled crypto.
- [x] Clippy clean; public items documented.

## Phase 2 — Vault store & models  ✅

Deliverables: item model (login/note/card/identity/TOTP), folders, bounded
revision history, favorites, tags; encrypted store; CRUD/search/list-by-type;
schema version guard.

> Deviation (documented): storage is a **single-file encrypted container** (the
> whole `VaultData` graph sealed as one AEAD payload) rather than SQLite. Chosen
> for portability and reviewability; see `02-vault-format.md` §5.

Acceptance:
- [x] CRUD + search round-trip on a real on-disk vault.
- [x] No plaintext metadata on disk (test scans the container bytes).
- [x] Schema version guard (`schema_version` refused if newer). Forward
  migrations are a future addition.

## Phase 3 — Backup, restore, verification, recovery CLI  ✅

Deliverables: atomic export + retention; structural + authenticated verification;
restore-to-new-vault; standalone `vault-recovery-cli`; backup age tracking.

Acceptance:
- [x] Round-trip restore of mixed records — tested with small sets; a
  large-scale (hundreds) automated restore test is still pending.
- [~] Restore works from a simulated clean account (only file + password/RK) —
  proven at the format level; a real clean-Windows-account test is pending.
- [x] Wrong password / corrupt / truncated / interrupted write → fail closed.
- [x] Backup rotation keeps prior good copies (older files removed only by the
  explicit retention call, and only app-created files are touched).
- [x] Master-password rotation documented; recovery path preserved.
- [x] CLI restores without the desktop UI.

## Phase 4 — Application UI  ✅

Deliverables: onboarding, unlock, list/grid + detail + editor, generator, backup
center with restore, settings; EN/AR + RTL/LTR; persisted language; light/dark;
design system + component gallery.

Acceptance:
- [x] Every screen reachable and functional against the real backend.
- [x] Arabic RTL correct; no colour-only signalling.
- [x] UI responsive (spinner while loading; single atomic file operations).

## Phase 5 — Security behaviours  ✅ (partial)

Deliverables: auto-lock on inactivity (+ backend idle safety net); clipboard copy
with clearing timer and toast feedback; masked fields + reveal; local strength and
reuse warnings.

Acceptance:
- [x] Lock drops the vault and zeroizes key material (backend `lock`).
- [x] Clipboard clears after the configured interval (hook; not yet covered by an
  automated test).
- [ ] A formal repo scan proving no secret material in logs/fixtures (no logging
  of secrets is implemented, but the scan is not yet automated).

## Phase 6 — Import  ✅

Deliverables: generic CSV + Proton Pass parser (local, header-mapped), explicit
plaintext warning, local-only, toast result.

Acceptance:
- [x] Imports real-shaped exports into typed items (unit-tested).
- [x] Malformed/empty exports fail safely (parser returns no items).
- [x] Warning copy present; no upload; source file not retained.

## Phase 7 — Polish & release  ✅ (partial)

Deliverables: README, PRIVACY, THIRD_PARTY_LICENSES, CHANGELOG, CONTRIBUTING,
Arabic guide; vault-format + recovery documentation; CI + Windows MSVC release
workflow → NSIS installer; brand mark + icon set.

Acceptance:
- [x] All local gates green.
- [x] Windows installer produced by CI (MSVC) — `v0.1.0`, `v0.1.1`.
- [ ] Release checklist complete: code signing and the independent security review
  are still open.

---

## Acceptance gate (blocking, from the brief)

Release 1 is **not** ready for real passwords until:
1. A clean-machine backup restore works. — proven at format level; real
   clean-Windows run pending.
2. Tampering fails closed. — ✅
3. Backup rotation is recoverable. — ✅
4. No sensitive data appears in logs. — by design; automated scan pending.
5. Update/build provenance is verified. — code signing outstanding.
6. An **independent security review** is complete — **open** (external; cannot be
   satisfied by this project alone).

## Known environment constraints

- WSL filesystem is slow; installs/builds take a long time.
- Tauri Linux system deps (WebKitGTK) are unavailable on Ubuntu 20.04 → the GUI
  crate is built on the Windows MSVC CI runner. `vault-core` and the recovery CLI
  are fully testable locally.
- Disk space on C: is limited; keep build artifacts lean.
