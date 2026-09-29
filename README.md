# Aster Vault

**Private by design. Ready to recover.**

Aster Vault is a calm, private, **local-first Windows password manager**. Your
secrets stay on your device; your encrypted backups stay portable and
recoverable. No account, no cloud, no hidden uploads.

> **Status: early development.** The cryptographic core, encrypted store,
> portable backups, recovery CLI, and the main app screens are built and tested.
> The application is not yet packaged (requires the icon set) and has **not** had
> an independent security review. See [Limitations](#limitations).

## What it is (Release 1)

- Offline vault: folders/collections; logins, secure notes, payment cards,
  identities, and TOTP secrets.
- Search and favorites; password and passphrase generator.
- Local strength and reuse warnings (computed on your device).
- Copy with a clipboard-clearing timer; masked fields.
- Auto-lock on inactivity, screen lock, sleep, and user switch.
- Import from Proton Pass export and generic CSV through an explicit, local-only
  plaintext workflow.
- **Encrypted backup, restore, verification, and recovery drills.** Backups are
  portable and independent of the Windows profile.

## Privacy

Files and secrets are processed entirely on your device. There are no uploads, no
cloud conversion, and no telemetry containing filenames or document contents. See
[`PRIVACY.md`](PRIVACY.md).

## Security model (summary)

- A random **256-bit vault data key** from the OS CSPRNG encrypts everything,
  including item names, URLs, usernames, tags, and notes.
- The data key is wrapped with a key derived from your master password using
  **Argon2id**. An **independent recovery key** provides a second wrapping path.
- **AES-256-GCM** with unique nonces and authenticated metadata; tampering and
  wrong credentials fail closed.
- Backups use the same portable authenticated format and restore on a clean
  Windows account using only the file plus your master password or recovery key.
- A standalone recovery CLI means a broken UI cannot strand your backups.

Full detail: [`docs/specs/01-threat-model.md`](docs/specs/01-threat-model.md) and
[`docs/specs/02-vault-format.md`](docs/specs/02-vault-format.md).

**What it cannot protect against:** malware with access to an unlocked session can
read secrets; a compromised OS or binary defeats any local encryption; the
clipboard cannot be made atomic; there is no secure deletion on SSDs; losing both
your master password and your recovery key makes the data unrecoverable by
design. This project has **not** had an independent security review.

## Architecture

Tauri 2 (desktop) + React 19 / TypeScript / Vite (frontend) + Rust (backend).
All cryptography and the container format live in the standalone, GUI-free
`crates/vault-core`; the Tauri layer is a thin command surface. See
[`docs/specs/03-architecture.md`](docs/specs/03-architecture.md).

```text
UI → Tauri command → vault service → vault-core → reviewed crypto libraries
```

## Build & develop

Requirements: Node 20+, Rust (stable) with `rustfmt`/`clippy`, and the Tauri
prerequisites for your platform.

```bash
npm install            # frontend deps
npm run dev            # Vite dev server (frontend only)
npm run tauri dev      # full desktop app (needs Tauri system deps)

npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run test           # vitest
npm run build          # production frontend build

cargo fmt --all -- --check
cargo clippy -p vault-core -p vault-recovery-cli --all-targets -- -D warnings
cargo test -p vault-core -p vault-recovery-cli
```

The Windows installer is produced by the release workflow (MSVC) — see
`.github/workflows/`.

## Repository layout

```text
src/                     React frontend
src-tauri/               thin Tauri 2 shell
crates/vault-core/       crypto + container + storage (no GUI)
crates/vault-recovery-cli/ standalone recovery tool
docs/specs/              threat model, vault format, architecture, plan
docs/reference/          product brief + UI mockup
```

## Limitations

- No independent security review yet — not safe for primary credentials.
- Release 1 is offline only. No browser autofill, passkeys, aliases, or cloud
  sync (these are separately scoped: see
  [`docs/specs/06-browser-extension-r2.md`](docs/specs/06-browser-extension-r2.md)).
- The desktop app is packaged by the Windows (MSVC) release workflow; native
  launch validation has not been performed on this Linux development box.

## Roadmap

Release 2: browser extension with narrow permissions, phishing-aware origin
matching, and consented autofill. Release 3: optional encrypted sync as a
separate security project.

## License

MIT. Third-party licenses are recorded in
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
