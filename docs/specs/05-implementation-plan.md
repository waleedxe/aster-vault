# Aster Vault — Phased Implementation Plan

Status: Phase 0 specification. Each phase has explicit acceptance criteria. Do
not advance past a phase with unmet criteria, and never claim completion that is
not evidenced ("do not fake completion or security assurances").

Engineering loop after every major feature:
implement → format → lint → typecheck → `cargo fmt` → `clippy -D warnings` →
tests → real round-trip/restore test → production build where relevant →
fix critical failures → continue.

---

## Phase 0 — Foundation & specs  ✅ (this document set)

Deliverables:
- Threat model + explicit limits (`01-threat-model.md`).
- Vault/backup container format (`02-vault-format.md`).
- Architecture (`03-architecture.md`).
- Screen map + visual tokens (`04-screen-map.md`).
- Phased plan + acceptance criteria (this file).
- Browser-extension R2 scoping (`06-browser-extension-r2.md`).
- Project memory (`AGENTS.md`).
- Scaffolded repo: Tauri 2 + React + TS + Tailwind + Zustand + i18n, lint/typecheck,
  Rust workspace with `vault-core`, CI skeleton.

Acceptance:
- [ ] All specs written and consistent.
- [ ] Frontend dev build + lint + typecheck pass.
- [ ] `cargo fmt`/`clippy`/`test` pass on `vault-core` skeleton.
- [ ] No secrets anywhere in the repo.

## Phase 1 — Cryptographic core (`crates/vault-core`)

Deliverables:
- CSPRNG DEK (256-bit).
- Argon2id KEK with per-vault salt + benchmarked, stored parameters.
- AES-256-GCM AEAD adapter with nonce discipline (random for single-use wraps,
  counter-based for record payloads).
- Master-password wrap + independent recovery-key wrap.
- Zeroization/secrecy of all key material.
- Container header, format version, AAD binding.
- Unit tests: known-answer for KDF, AEAD round-trip, wrong-key failure, nonce
  uniqueness, tamper detection, zeroize behaviour.

Acceptance:
- [ ] Tests prove round-trip, fail-closed on wrong key/tamper, no nonce reuse.
- [ ] All primitives from reviewed crates; no hand-rolled crypto.
- [ ] Clippy clean; docs on every public item.

## Phase 2 — Vault store & models

Deliverables:
- Item model: login/note/card/identity/TOTP; folders/collections; history;
  favorites; tags; attachments (optional).
- Encrypted record store (SQLite-based, record bodies AEAD-encrypted; no plaintext
  index persisted).
- Repositories: create/read/update/delete/search/list-by-type.
- Schema versioning + migration scaffold.

Acceptance:
- [ ] CRUD + search round-trip on a real on-disk vault.
- [ ] No plaintext metadata on disk (verified by scanning the DB file).
- [ ] Tests for schema/migration.

## Phase 3 — Backup, restore, verification, recovery CLI

Deliverables:
- Atomic export (temp → fsync → validate → rename) + retention.
- Scheduled encrypted backup to a user-selected folder.
- Verification drill (structural + authentication).
- Restore-to-new-vault-first, verify + preview + explicit confirm, preserve prior.
- Standalone `vault-recovery-cli` (open/verify/restore with password/recovery key).
- Last-successful-backup tracking + restore reminder.

Acceptance:
- [ ] Round-trip restore of hundreds of mixed records + attachments.
- [ ] Restore works from a **simulated clean account** (only file + password/RK).
- [ ] Wrong password, corrupt/truncated backup, interrupted write → fail closed.
- [ ] Backup rotation keeps prior good copies.
- [ ] Master-password rotation rule documented + UI-surfaced.
- [ ] CLI restores without the desktop UI.

## Phase 4 — Application UI

Deliverables:
- Onboarding wizard, unlock, vault list + detail, create/edit, generator, backup
  center, restore preview, settings, locked-state overlay.
- English + Arabic with RTL/LTR, persisted language, light/dark.
- Keyboard navigation, screen-reader labels, high contrast, reduced motion.

Acceptance:
- [ ] Every screen reachable and functional against the real backend.
- [ ] Arabic RTL correct; no colour-only signalling.
- [ ] UI responsive during long operations (progress + cancel where practical).

## Phase 5 — Security behaviours

Deliverables:
- Auto-lock on inactivity, screen lock, sleep, user switch (zeroize on lock).
- Clipboard copy + clearing timer with user feedback.
- Masked fields; reveal; strength + reuse warnings computed locally.
- Log scrubbing / redaction policy; no secrets in logs or fixtures.

Acceptance:
- [ ] Lock zeroizes key material (test).
- [ ] Clipboard cleared after the configured interval (test).
- [ ] Repo scan proves no secret material in logs/fixtures.

## Phase 6 — Import (Proton Pass + generic CSV)

Deliverables:
- Proton Pass export + generic CSV parsers, verified against current official
  export formats at implementation time.
- Explicit plaintext warning, minimal-file workflow, local-only, cleanup guidance.
- Column mapping + duplicate handling.

Acceptance:
- [ ] Imports real-shaped exports into typed items.
- [ ] Malformed exports fail safely.
- [ ] Warning copy present; no upload; no source retention.

## Phase 7 — Polish & release

Deliverables:
- README, PRIVACY, THIRD_PARTY_LICENSES, CHANGELOG, CONTRIBUTING.
- Vault-format spec + backup-and-recovery guide (user-facing).
- CI (lint/typecheck/tests + Rust fmt/clippy/test) and Windows MSVC release
  workflow → NSIS installer.
- Release checklist: signing, update provenance, independent security review.
- Limitations doc; optionally `BLOCKERS.md`.

Acceptance:
- [ ] All local gates green.
- [ ] Windows installer produced by CI (MSVC).
- [ ] Release checklist complete or explicitly blocked with rationale.

---

## Acceptance gate (blocking, from the brief)

Release 1 is **not** ready for real passwords until:
1. A clean-machine backup restore works.
2. Tampering fails closed.
3. Backup rotation is recoverable.
4. No sensitive data appears in logs.
5. Update/build provenance is verified.
6. An **independent security review** is complete (external — cannot be satisfied
   by this project alone; tracked as an explicit open item).

## Known environment constraints

- WSL filesystem is slow; installs/builds take a long time.
- Tauri Linux system deps (WebKitGTK) are unavailable on Ubuntu 20.04 → the GUI
  crate is checked/built on the Windows MSVC CI runner, matching the reference
  project. `vault-core` and the recovery CLI are fully testable locally.
- Disk space on C: is limited (~20 GB free); keep build artifacts lean.
