# Privacy

Aster Vault is built so that your secrets stay on your device.

## Local-only processing

- No PDFs, secrets, imports, or backups are ever uploaded.
- There is no cloud conversion, no remote service, and no account.
- There is no analytics or telemetry containing filenames, item names, or any
  document or vault contents.
- No hidden third-party processing is performed.

## What is stored on your device

- `vault.avlt` — the encrypted vault container. All contents, **including item
  names, URLs, usernames, tags, and notes**, are encrypted.
- Encrypted backups you create, in the destination you choose.
- A small local settings record (for example, your chosen language and lock
  timeout). It contains no secrets.

## Logs and crash reports

- Secrets are never written to logs, crash reports, or shell arguments.
- Where diagnostic logging exists, paths and filenames are redacted and documents
  are never attached.

## Imports

Proton Pass and CSV exports may be **plaintext**. Import flows state this
clearly, operate on the minimum files, keep everything local, never upload, and
remind you to remove the source export afterward. Secure deletion on SSDs is not
promised.

## Deletion

Deleting a vault or backup file removes it from the filesystem, but flash storage
and snapshots may retain recoverable bytes. Aster Vault makes no secure-deletion
guarantee.

## What this app cannot protect against

Malware with access to an unlocked session can read secrets. A compromised
operating system or binary defeats any local encryption. See
`docs/specs/01-threat-model.md` for the full threat model and explicit limits.
