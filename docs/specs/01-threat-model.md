# Aster Vault — Threat Model & Explicit Limits

Status: Phase 0 specification. This document defines what Aster Vault (Release 1)
protects against, what it does **not** protect against, and the assumptions the
design relies on. It must be read alongside `02-vault-format.md` and
`03-architecture.md`.

> This is not a security certification, an audit, or a claim of immunity to
> compromise. Passing automated tests is not evidence of security. An independent
> assessment is a release gate (see `05-implementation-plan.md`).

## 1. System under consideration

Aster Vault is a local-first, offline Windows password manager (Release 1). It
stores secrets in an encrypted vault file on the user's device, unlocks with a
master password (optionally a recovery key), and produces portable encrypted
backups. There is no account, no server, no cloud, and no network transmission
of vault contents in Release 1.

**Assets**
- A1: Master password (never stored).
- A2: Recovery key (high-entropy, generated at setup, never stored in the vault).
- A3: Vault data key (random 256-bit, generated with the OS CSPRNG).
- A4: The plaintext of every secret (passwords, TOTP seeds, card numbers, notes,
  identities, usernames, URLs, tags, item titles).
- A5: The vault file and all backup containers.
- A6: Integrity of the vault and backups.

**Trust boundary**
- Trusted: the OS CSPRNG, the reviewed crypto libraries, the process memory
  while the vault is unlocked, and the user's own device (while not compromised).
- Untrusted: every file that enters the app (imports, backups), the filesystem at
  rest, remote storage where backups may be copied, and any code that is not part
  of this application.

## 2. Threats in scope — and how Aster Vault addresses them

| ID | Threat | Mitigation (Release 1) |
|----|--------|------------------------|
| T1 | **Theft of the vault file at rest.** Attacker copies `vault.avlt`. | Entire vault encrypted with AES-256-GCM under a random 256-bit data key. Data key wrapped by Argon2id-derived key from the master password. No plaintext metadata. |
| T2 | **Stolen backups.** Attacker obtains a backup container. | Backups are the same authenticated encrypted container format, portable and self-contained (salts + KDF params + wrapped keys). No plaintext secrets. |
| T3 | **Offline guessing of the master password.** | Argon2id with memory-hard parameters benchmarked on supported machines; parameters stored with the vault; unique salt. High-entropy recovery key as an independent wrapping path. |
| T4 | **Tampering / corruption of the vault or a backup.** | AES-256-GCM authentication tag over ciphertext plus authenticated metadata (AAD). Any modification or truncation fails closed and is reported, never silently accepted. |
| T5 | **Accidental deletion or a broken UI stranding backups.** | Atomic backup writes (temp → flush → validate → rename), retention of previous backups, a standalone recovery CLI that needs only the file + password/recovery key, and documented file format. |
| T6 | **Forgotten master password.** | Recovery key generated at setup, stored separately by the user, can unwrap the data key independently. Backups preserved until a restore is verified. |
| T7 | **Clipboard interception after copy.** | Copy action starts a configurable clipboard-clearing timer; the app clears the clipboard when it fires and reports it. (Cannot prevent a process that reads the clipboard within the window.) |
| T8 | **Secrets left exposed on an unlocked, idle machine.** | Auto-lock on inactivity, Windows session lock, sleep, and user switch. Masked fields by default. |
| T9 | **Plaintext import leakage.** | Import flows state plainly that Proton Pass / CSV exports may be plaintext, operate on the minimum files, are local-only, never upload, and advise removing the source export afterward. |
| T10 | **Secret leakage through logs, crash reports, or fixtures.** | Log scrubbing / redaction; no secrets in debug logs, shell arguments, telemetry, or test fixtures. Crash reports redact paths and filenames where possible and never attach documents. |
| T11 | **Master-password rotation.** | Vault format versioning makes rotation an explicit, documented operation; the rule for whether the recovery key can restore old backups is surfaced in the UI. |
| T12 | **Schema/format drift breaking restore.** | Explicit format version, KDF settings, and migration strategy defined in `02-vault-format.md`. |

## 3. Explicitly **out of scope** — what Aster Vault cannot protect against

These limits must be stated honestly in-product and must not be contradicted by
marketing copy.

- **L1 — Malware with access to an unlocked session can read secrets.** A keylogger,
  screen scraper, or process-memory reader running as the user (or as admin) can
  capture the master password, clipboard, or decrypted vault. Encryption cannot
  defend against a compromised endpoint while unlocked.
- **L2 — A compromised OS or a malicious update can defeat the app.** If the
  operating system, the runtime, or the running binary is attacker-controlled,
  no local encryption scheme is safe.
- **L3 — Clipboard readers acting inside the clearing window.** The clear timer
  reduces exposure but cannot make the clipboard atomic.
- **L4 — Coercion / "rubber-hose" attacks.** No duress PIN or hidden vault in
  Release 1.
- **L5 — Secure deletion on SSDs.** Deleting a file does not guarantee the bytes
  are unrecoverable on flash storage, wear-levelling, or snapshots. The product
  must not promise secure deletion.
- **L6 — Physical attacks and cold-boot memory attacks** on an unlocked machine.
- **L7 — Browser autofill, passkey storage, email alias forwarding, cloud sync,
  sharing, and zero-knowledge service claims.** These are **not** in Release 1 and
  must not be claimed. See `06-browser-extension-r2.md` for the separately-scoped
  browser integration plan.
- **L8 — Forgotten master password *and* lost recovery key.** Data is
  mathematically unrecoverable. This is intentional.
- **L9 — A malicious or buggy dependency / supply-chain compromise.** Mitigated by
  pinning versions, dependency scanning, signed releases, and verified update
  signatures — but not eliminated. Independent review is required before real use.

## 4. Assumptions

1. The device's OS CSPRNG is sound.
2. The user keeps the master password and recovery key secret and stores the
   recovery key separately from the vault.
3. The reviewed crypto libraries (`argon2`, `aes-gcm`, `rand`, `zeroize`,
   `secrecy`) are correct for the primitives they implement; no primitive is
   hand-rolled.
4. Backups are stored on media the user controls; remote storage receives
   encrypted bytes only.
5. The user's Windows account and OS are not already compromised.

## 5. Security requirements traceability

Each requirement from the build brief maps to concrete design decisions:

- Random 256-bit data key from OS RNG → `02-vault-format.md` §3.
- AES-256-GCM, unique nonces, authenticated metadata → `02-vault-format.md` §4.
- Encrypt all item metadata, not just passwords → `02-vault-format.md` §5.
- Argon2id wrapping key, per-vault salt, benchmarked params → `02-vault-format.md` §3.
- Independent recovery-key wrapping path → `02-vault-format.md` §3.4.
- Never store master/recovery key → `02-vault-format.md`, `03-architecture.md` §6.
- Portable, DPAPI-independent backups → `02-vault-format.md` §6.
- Atomic export, retention, restore-to-new-vault-first, fail-closed → `05-implementation-plan.md` Phase 3.
- No silent plaintext export; import warnings → `05-implementation-plan.md` Phase 6.
- No secrets in logs → `03-architecture.md` §6.
- Audited/pinned deps, signed releases, independent review → `05-implementation-plan.md` Phase 7.

## 6. Residual risks (Release 1)

- No independent security review has been performed yet. **Release 1 must not be
  trusted with primary credentials until it is.**
- Zeroization in a managed/GC runtime (the JS frontend) is not reliable; secrets
  should live in the Rust core and be handed to the UI only transiently.
- Argon2id parameters trade unlock cost against resistance to offline guessing;
  parameters are benchmarked and revisable, not absolute.
- A single-device vault has no conflict handling; Restore replaces the vault only
  after verification and explicit confirmation.
