# Aster Vault — Vault & Backup Container Format

Status: Phase 0 specification. This is the most important document in the
project: a **documented, portable, versioned, authenticated encrypted format**
matters more than the framework. A broken desktop UI must not strand backups, so
the format is defined so that an independent recovery tool can read it.

> No custom crypto primitives. All primitives come from maintained, reviewed
> libraries (see §8). Nonces are never reused; the data key is generated with the
> OS CSPRNG.

> **As implemented (2026-10-23).** This document was written in Phase 0 as a
> design. Where the shipped code differs, the difference is called out inline
> below. The container format, version and AAD are **frozen** — the corrections
> here describe the code, they do not change it. In short: the payload nonce is
> **random per save** (not counter-derived); the payload/header AAD is
> `{format_version, created_at}` plus a domain-separator prefix (no KDF params,
> salts, wrap descriptors or record-index digest); KDF parameters are a
> hardcoded recommended default (64 MiB / t=3 / p=1), not benchmarked at setup;
> and there is no unlock rate-limiting.

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
- Parameters (`m_cost`, `t_cost`, `p_cost`) are stored in the header.
  **As implemented:** they are a hardcoded recommended default
  (`KdfParams::recommended()` = 64 MiB, t=3, p=1), **not** benchmarked at setup.
  A `kdf::benchmark` helper exists but is not called by the app; parameters are
  read back from the header on unlock, so a future version can raise them without
  locking anyone out.

### 3.3 Master-password wrap
- `wrapped_dek_master = AES-256-GCM(key = KEK, nonce = N1, plaintext = DEK, aad = AAD)`.
- `AAD` is `{format_version, created_at}` (see §4).
- Stored with its nonce and tag in the header.

### 3.4 Recovery-key wrap (independent path)
- At setup, generate a high-entropy **RK** (256-bit), present it to the user as a
  formatted recovery key, and require the user to confirm it is stored safely.
- `wrapped_dek_recovery = AES-256-GCM(key = Argon2id(RK, recovery_salt, params), nonce = N2, plaintext = DEK, aad = AAD)` (same `AAD` as §3.3).
- The recovery path is **independent** of the master password: changing the master
  password rewraps `wrapped_dek_master` but does **not** invalidate the recovery
  key. The exact rule for restoring *old* backups after rotation is surfaced in
  the UI and documented in the recovery guide.

> Neither the master password nor the recovery key is ever stored in the vault,
> in logs, in analytics, or in backups.

## 4. Encryption

- **AEAD**: AES-256-GCM (from `aes-gcm`).
- **Nonce discipline**: a 96-bit nonce is used **once per key**. **As
  implemented:**
  - Wrapping keys (KEK/RK) are used for a **single** wrap operation, so their
    nonce is random and never reused.
  - The DEK encrypts the whole store as **one payload per save**, so its nonce is
    **random per save**. A 96-bit random nonce is safe for up to ~2³² saves under
    one data key (NIST SP 800-38D guidance), far above any realistic use. There is
    **no counter** and therefore no counter-reuse failure mode.
  - *(Original design, not implemented:* a monotonic counter `counter || random
    prefix` guaranteeing uniqueness structurally. It was dropped in favour of the
    simpler single-payload design, whose random-nonce bound is documented in
    `container/format.rs`.*)*
- **AAD (authenticated but not encrypted metadata)**: **as implemented**, the AAD
  is the header's `{format_version, created_at}` (serialized) plus a fixed
  domain-separator prefix (`aster-vault/payload/v1`) for the payload. KDF params,
  salts, wrap descriptors and `kind` are deliberately **excluded** so a rewrap or
  a backup conversion cannot invalidate the other wrap; tampering with an excluded
  field instead yields the wrong key and fails authentication. *(Original design:*
  bind the full header core including salts, wrap descriptors and a record-index
  digest. *No record-index digest exists in the format.)*
- **Payload**: the record store (see §5) is serialized, then encrypted with the
  DEK as a single AEAD payload, under a random per-save nonce. (Per-record
  envelopes are a possible future format version, not implemented.)

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
  (each record sealed under the DEK with unique nonces) backed by SQLite, with
  record bodies still AEAD-encrypted. That change is a versioned migration and
  does not alter the key model.
- `schema_version` in the payload is independent of the container
  `format_version`, so data-shape migrations and format migrations are tracked
  separately.

## 6. Backup container

A backup is a portable, versioned, authenticated encrypted container that is
**independent of the Windows profile and DPAPI**. It contains:

- Header: format version, container kind (`vault`|`backup`), created_at, KDF
  params, salts, wrap descriptors. (The AAD actually binds only
  `format_version` and `created_at` — see §4; there is no record-index digest.)
- Wrapped DEK paths (master, recovery).
- The encrypted record store.
- Optional encrypted attachments.

It contains **no plaintext secrets** and no machine-bound material. It restores
on a clean machine using only the file and the master password or recovery key.

### 6.1 Atomic export
1. Write to a temporary file in the destination directory.
2. Flush to disk (`fsync`).
3. Re-read and validate the container format (**structural** validation: magic,
   format version, header, framing and tag length). The DEK-wrap tag cannot be
   verified without the KEK, and there is no record-index digest, so full
   authentication is verified on restore (or on demand with a credential).
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
| Secret zeroization | `zeroize` | MIT/Apache-2.0 | memory hygiene |
| Serialization | `serde` + `serde_json`/`bincode` | MIT/Apache-2.0 | record store |
| Storage | file-based encrypted container | — | implemented; the graph is one sealed payload |

Every engine/library recorded here — crate, license, purpose, bundled? — is also
mirrored into `THIRD_PARTY_LICENSES.md`.

## 9. Failure behaviour

| Condition | Behaviour |
|-----------|-----------|
| Wrong master password | Fail closed, generic error, no oracle beyond success/failure. |
| Wrong recovery key | Fail closed. |
| Tampered AAD field (`format_version`, `created_at`) | AAD authentication fails → refuse. |
| Tampered non-AAD header field (salts, KDF params, wrap descriptors) | Wrong key → authentication fails → refuse. |
| Truncated/modified record store | GCM tag fails → refuse. |
| Unknown format version | Refuse with migration guidance. |
| Interrupted backup write | Last good backup untouched; temp file discarded. |
| Restore from a valid backup | Write new vault, verify, preview, confirm, then swap. |
