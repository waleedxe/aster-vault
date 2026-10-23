# Security Policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue with
details, proof-of-concept code, or affected files.

- **Preferred:** use GitHub's **Security → Report a vulnerability** on this
  repository (Private Vulnerability Reporting).
- If private reporting is unavailable, open a **minimal** public issue asking for
  a private channel. Do **not** include vulnerability details in that issue.

Please include:

- The affected version or commit (a release tag such as `v0.1.2`, or a commit
  SHA).
- Steps to reproduce, or a small proof of concept.
- The impact you believe it has.

## Audit status

Aster Vault has **not been independently audited**. It is pre-1.0 beta software
and should not yet be trusted with your most important secrets. Read the
[threat model](docs/specs/01-threat-model.md) for what it does and does not
protect against.

## Scope

**In scope:** the Aster Vault desktop application in this repository and its Rust
crates (`src-tauri`, `crates/vault-core`, `crates/vault-recovery-cli`).

**Out of scope:**

- Third-party GitHub Actions used by the CI workflow in `.github/workflows`.
- Issues that require an already-compromised machine (for example, malware
  running with the user's privileges).

## Supported versions

Only the latest release is supported. Aster Vault is pre-1.0, so fixes ship in
the newest release rather than being backported to older ones.

## Response expectations

This is a personal, unpaid project. Reports are acknowledged and handled on a
best-effort basis; there is no guaranteed response or fix timeline.
