# Aster Vault — Vault & Backup Container Format

Status: Phase 0 specification. This is the most important document in the
project: a **documented, portable, versioned, authenticated encrypted format**
matters more than the framework. A broken desktop UI must not strand backups, so
the format is defined so that an independent recovery tool can read it.

> No custom crypto primitives. All primitives come from maintained, reviewed
> libraries (see §8). Nonces are never reused; the data key is generated with the
> OS CSPRNG.

## 1. Design goals

1. Every secret **and its metadata** is encrypted (names, URLs, usernames, tags,
   notes, TOTP seeds, card numbers, identities).
2. Backups restore on a **clean Windows account** from the file plus the master
   password or recovery key — no DPAPI, no Windows Hello, no machine binding.
3. Authentication is mandatory and failure is **fail-closed** (tamper, truncation,
   wrong password all refuse, never silently accept).
4. The format is **versioned** with an explicit migration strategy.
5. The format is **portable**: it records its own salts, KDF parameters, and
   version so any conforming tool can open it.

## 2. Terminology

- **DEK** — Vault Data Key: random 256-bit key, OS CSPRNG.
- **KEK** — Key Encryption Key: derived from the master password via Argon2id.
- **RK** — Recovery Key: high-entropy random key generated at setup.
- **Wrap** — encrypt the DEK under a KEK/RK with AES-256-GCM.
- **Record** — one logical item (login/note/card/identity/TOTP) plus its metadata.
- **Container** — the on-disk envelope holding the header, wrapped keys, and the
  encrypted record store. One format is used for both **live vault** and **backup**.

Both the live vault file and every backup use the **same container format**. The
only difference is operational: a backup is a point-in-time copy of the container.

## 3. Key model

### 3.1 Data key (DEK)
- 32 random bytes from the OS CSPRNG at vault creation.
- Never derived, never predictable, never transmitted.
- Held in memory only while unlocked.

### 3.2 Wrapping key (KEK)
- `KEK = Argon2id(master_password, salt = vault_salt, params)`.
- `vault_salt`: 16 random bytes, unique per vault, stored plaintext in the header.
- Parameters (`m_cost`, `t_cost`, `p_cost`) are **benchmarked** at setup for the
  target machine within a UX budget (default target ~0.5–1.0 s unlock), stored in
  the header, and upgradeable on next unlock.

### 3.3 Master-password wrap
- `wrapped_dek_master = AES-256-GCM(key = KEK, nonce = N1, plaintext = DEK, aad = header_core)`.
- Stored with its nonce and tag in the header.

### 3.4 Recovery-key wrap (independent path)
- At setup, generate a high-entropy **RK** (256-bit), present it to the user as a
  formatted recovery key, and require the user to confirm it is stored safely.
- `wrapped_dek_recovery = AES-256-GCM(key = KDF(RK), nonce = N2, plaintext = DEK, aad = header_core)`.
- The recovery path is **independent** of the master password: changing the master
  password rewraps `wrapped_dek_master` but does **not** invalidate the recovery
  key. The exact rule for restoring *old* backups after rotation is surfaced in
  the UI and documented in the recovery guide.

> Neither the master password nor the recovery key is ever stored in the vault,
> in logs, in analytics, or in backups.

## 4. Encryption

- **AEAD**: AES-256-GCM (from `aes-gcm`).
- **Nonce discipline**: a 96-bit nonce is used **once per key**. Two strategies,
  both enforced:
  - Wrapping keys (KEK/RK) are used for a **single** wrap operation, so their
    nonce is random and never reused.
  - The DEK encrypts many records, so per-record nonces are derived from a
    **monotonic counter** stored/verified in the container (counter || random
    prefix), guaranteeing uniqueness. Counter reuse is a hard error.
- **AAD (authenticated but not encrypted metadata)**: header core fields —
  format version, KDF params, salts, wrap descriptors, and the record index
  digest — are bound as additional authenticated data so header tampering fails.
- **Payload**: the record store (see §5) is serialized, then encrypted with the
  DEK as a single AEAD payload (per-record envelopes are also supported — see §5).

## 5. Record store

Items are stored as a single encrypted graph. The complete `VaultData`
(schema version, folders, items and their revision history) is serialized and
sealed with the DEK into the container payload.

- **Every field is encrypted**, including titles, URLs, usernames, tags, notes
  and TOTP seeds, because the whole graph is one AEAD payload.
- **No plaintext index is persisted.** Search runs over the decrypted graph in
  memory while unlocked; indexes are rebuilt on unlock and never written to disk.
- This single-payload design is deliberately simple and portable. If the vault
  grows very large, a future format version may move to per-record envelopes
  (each record sealed under the DEK with counter-derived nonces) backed by
  SQLite, with record bodies still AEAD-encrypted. That change is a versioned
  migration and does not alter the key model.
- `schema_version` in the payload is independent of the container
  `format_version`, so data-shape migrations and format migrations are tracked
  separately.

## 6. Backup container

A backup is a portable, versioned, authenticated encrypted container that is
**independent of the Windows profile and DPAPI**. It contains:

- Header core: format version, container kind (`vault`|`backup`), created_at,
  KDF params, salts, wrap descriptors, record-index digest.
- Wrapped DEK paths (master, recovery).
- The encrypted record store.
- Optional encrypted attachments.

It contains **no plaintext secrets** and no machine-bound material. It restores
on a clean machine using only the file and the master password or recovery key.

### 6.1 Atomic export
1. Write to a temporary file in the destination directory.
2. Flush to disk (`fsync`).
3. Re-read and validate the container format and authentication (verify the DEK
   wrap and record-store tag without needing the master password — validation of
   the DEK-wrap tag requires the KEK, so a **structural + digest** validation is
   performed at export; full authentication is verified on restore).
4. Atomically rename into place.
5. Retain a configurable series of previous backups.

An interrupted write never replaces the last good backup. Restore writes to a
**new vault first**, verifies authentication and item counts, shows a preview, and
requires explicit confirmation before replacing the active vault. The prior vault
is preserved until the new one is verified.

## 7. Versioning and migration

- `format_version` is an integer in the header core and is authenticated.
- Unknown **major** versions are refused with a clear message (do not attempt to
  guess).
- Migrations are explicit, forward-only steps with their own tests. A migration
  writes a new container atomically and keeps the old one until verified.
- KDF parameter upgrades are recorded so that older vaults can be opened with
  their stored parameters and then re-wrapped with stronger ones.

## 8. Cryptographic library choices (to be confirmed against official docs)

| Purpose | Crate | License | Notes |
|---------|-------|---------|-------|
| AEAD AES-256-GCM | `aes-gcm` (RustCrypto) | MIT/Apache-2.0 | reviewed, constant-time |
| Password KDF | `argon2` (RustCrypto) | MIT/Apache-2.0 | RFC 9106 Argon2id |
| CSPRNG | `rand` / `getrandom` | MIT/Apache-2.0 | OS entropy source |
| Constant-time compare | `subtle` | MIT/Apache-2.0 | tag/key comparisons |
| Secret zeroization | `zeroize` / `secrecy` | MIT/Apache-2.0 | memory hygiene |
| Serialization | `serde` + `serde_json`/`bincode` | MIT/Apache-2.0 | record store |
| Storage | `rusqlite` (bundled) or file-based store | MIT | TBD in Phase 2 |

Every engine/library recorded here — crate, license, purpose, bundled? — is also
mirrored into `THIRD_PARTY_LICENSES.md`.

## 9. Failure behaviour

| Condition | Behaviour |
|-----------|-----------|
| Wrong master password | Fail closed, generic error, no oracle beyond success/failure. |
| Wrong recovery key | Fail closed. |
| Tampered header | AAD authentication fails → refuse. |
| Truncated/modified record store | GCM tag fails → refuse. |
| Counter reuse detected | Hard error → refuse. |
| Unknown format version | Refuse with migration guidance. |
| Interrupted backup write | Last good backup untouched; temp file discarded. |
| Restore from a valid backup | Write new vault, verify, preview, confirm, then swap. |
