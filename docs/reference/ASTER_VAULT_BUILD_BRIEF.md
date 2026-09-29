# Aster Vault — Product, Brand & Autonomous Build Brief

## Product promise

**Aster Vault** is a calm, private Windows password manager. Its core promise: *Your secrets stay yours. Your backups stay recoverable.* This is a working name; check trademarks and domains before publishing. Do not claim a security certification, an audit, or absolute immunity to compromise.

## Scope and release sequence

**Release 1 — local, offline Windows vault:** Create and unlock a vault; folders or collections; logins, secure notes, payment cards, identities, and TOTP secrets; search and favorites; password and passphrase generator; strength and reuse warnings computed locally; copy with clipboard clearing timer; auto-lock on inactivity, screen lock, sleep and user switch; masked fields; import from Proton Pass export and generic CSV through an explicit, temporary plaintext workflow; encrypted backup, restore, verification and recovery drills. No account or cloud service required.

**Release 2 — browser integration:** Chrome/Edge extension with explicit user consent, narrow site permissions, phishing-aware origin matching, autofill only after authenticated communication with the desktop app, and security review. A desktop app alone cannot deliver browser autofill or passkey integration. Test each browser feature independently.

**Release 3 — optional encrypted sync:** Treat this as a separate security project. Local encryption before upload, untrusted remote storage, device enrollment and revocation, conflict handling, authenticated version history, rollback protection, deletion semantics, and key rotation. Do not describe this as zero-knowledge until independently assessed. Email aliases require an actual forwarding service and are outside the local-only release. Cross-device passkeys and sharing also require separate designs.

## Critical security and recovery model

1. Produce a written threat model covering theft of the vault file, stolen backups, malware on an unlocked PC, clipboard interception, malicious updates, tampered backups, accidental deletion, forgotten passwords, and lost Windows profiles. State what the product cannot protect against: malware with access to an unlocked session may read secrets.
2. Generate a random 256-bit vault data key with the operating system cryptographic RNG. Use a reviewed library for authenticated encryption such as AES-256-GCM, with unique nonces and authenticated metadata; never invent a cipher or reuse nonces. Protect item names, URLs, usernames, tags and notes as well as passwords. Define schema, format version, KDF settings and migration strategy explicitly.
3. Derive a wrapping key from the master password with Argon2id and a unique salt. Benchmark memory and time parameters on supported machines, store parameters with the vault, and allow future upgrades. Wrap the vault data key. Optionally create a second independent wrapping path for a high-entropy recovery key generated on setup. Never store the master password or recovery key in the vault, logs, analytics, or backup.
4. A backup is a portable, versioned, authenticated encrypted container, independent of the Windows profile and DPAPI. It includes all necessary salts, KDF parameters, wrapped keys, authenticated records and attachments, but no plaintext secrets. A backup must restore on a clean Windows account using only the backup and the master password or recovery key. DPAPI or Windows Hello may speed local unlock only; they must never be the sole way to decrypt portable backups.
5. Make backup export atomic: write to a temporary file, flush, validate format and authentication, then rename. Keep a configurable series of previous backups. Offer an encrypted scheduled backup to a user-selected folder, including an external disk or synced folder. Give a visible last successful backup date and a periodic restore reminder. Remote storage gets encrypted bytes only.
6. Restore to a new vault first, verify authentication and item counts, show a preview, and require explicit confirmation before replacing the active vault. Preserve the prior vault until the new one is verified. Wrong credentials and tampered files must fail safely. Specify whether the recovery key can restore old backups after master-password rotation and expose that rule in the UI.
7. Avoid silent plaintext export. Import flows clearly warn that Proton/CSV exports may be plaintext, work with the minimum files possible, never upload them, and guide the user to remove the source export afterward. Do not promise secure deletion on SSDs. Never put secrets in crash reports, UI snapshots, debug logs, shell arguments or test fixtures.
8. Use audited dependencies, pin versions, scan dependencies, sign releases, verify update signatures, perform code review and commission an independent security assessment before trusting the app with primary credentials. Passing automated tests alone is insufficient.

## Suggested implementation

- Windows 10/11 desktop, English UI first. Prefer .NET 10 with WinUI 3 or WPF for mature native integration, and a small isolated cryptography/storage core. Choose the UI framework after a proof of concept for accessibility and packaging. SQLite can hold encrypted records; never rely on database encryption alone without a reviewed key and metadata design. A documented, portable vault format matters more than the framework.
- Prefer maintained, reviewed cryptographic libraries. Document key lifecycle, process-memory exposure, and practical limitations of zeroization in managed runtimes. No custom crypto primitives.
- Build a deterministic, independent restore tool or recovery path, with documented file format, so a broken desktop UI does not strand backups. The tool must require the password or recovery key and support a clean machine.
- Source code and build instructions should be reproducible. Signed Windows release packages and signed update manifests are release gates.

## User experience

Left navigation: All Items / Favorites / Logins / Notes / Cards / Identities / Archive / Settings. Main area: search, filters and item cards. Detail panel: reveal, copy, edit, history. Top status: Locked / Unlocked, backup health and last backup. Setup wizard: create strong master password, generate recovery key, confirm safe storage, create and test first backup. Backup center: create, schedule, verify, restore, choose destination, show versions and last verification. Keep warnings factual and short. Keyboard navigation, screen reader names, high contrast and reduced motion are required.

## Visual identity

- Working name: **Aster Vault**. Tagline: **Private by design. Ready to recover.**
- Concept: a four-point aster formed by four restrained, separated petals around protected negative space. Avoid lock, shield, fingerprint and cloud clichés. The mark should work at 16 px and in one color. Do not imitate Proton's colors, logo or layout.
- Mood: precise, warm, quiet, premium, trustworthy. Dense information with generous spacing; restrained gradients only for hero or empty states.
- Palette: Midnight `#101827`, Deep Slate `#1C2A3D`, Porcelain `#F7F8F5`, Mist `#E8EEE9`, Emerald `#2E866F`, Pale Mint `#D7EDE3`, Amber `#D9A957` for warnings or backup attention, Ink `#172231`, Muted `#657383`. Verify contrast ratios for every text and interactive state, including dark mode.
- Typography: **Inter** for UI with system fallback; use tabular numerals for codes and dates. Suggested desktop scale: 13/14 body, 16 section labels, 24 page titles, 32 welcome. Use weight and spacing before decorative color.
- Components: 8 px spacing base; 10–14 px radii; 1 px quiet borders; 44 px minimum primary controls; focus rings in Emerald; gentle 120–180 ms transitions and a reduced-motion mode. Never use color alone to signal risk.
- English microcopy: “Your vault is locked.” / “Backed up 2 hours ago.” / “Test your backup” / “Restore on this device” / “Keep your recovery key somewhere separate.” / “This file could not be verified.”

## Ready-to-paste autonomous build prompt

```text
You are the lead Windows desktop engineer, security architect, product designer, and QA owner for Aster Vault. Build a modern, English-first, offline Windows password manager following the attached Aster Vault product and brand brief. Work autonomously on reversible local development tasks. Make documented choices where unspecified; do not fake completion or security assurances.

Start by inspecting the repository and writing: (1) threat model and explicit limits, (2) architecture and portable vault/backup file format, (3) phased implementation plan with acceptance criteria, (4) visual tokens and screen map. Then implement Release 1 end to end. Keep cryptographic primitives in established, maintained libraries; use Argon2id for master-password key derivation, authenticated encryption with nonce discipline, random vault keys and an independent recovery-key wrapping path. Verify specific library/API behavior against official documentation before coding. Do not make DPAPI or Windows Hello necessary to restore on another Windows installation.

Build the actual screens: onboarding, unlock, vault list and detail, create/edit item, password generator, import, backup center, restore preview and settings. Include keyboard navigation, accessible labels, light and dark modes, lock on Windows session lock, and automatic clipboard clearing. Make the interface feel polished and calm using the exact palette and copy direction in the brief.

Implement portable encrypted backups with atomic writes, integrity verification, scheduled copies to a selected folder, retention, and clean-machine restoration using the master password or recovery key. Provide a separate recovery CLI or tool and a documented format. Test round-trip restore with hundreds of mixed records and attachments, a changed Windows account, wrong password, corrupt/truncated backup, interrupted write, and master-password rotation. Never overwrite the only good copy during restore.

Implement Proton Pass and generic CSV imports only after checking current official export formats; keep plaintext imports local and make the temporary exposure clear. Do not claim browser autofill, passkey storage, alias forwarding, cloud sync, third-party audit, or zero-knowledge service in Release 1. Put those in a separately scoped roadmap.

Deliver runnable source, build instructions, a Windows installable development build, architecture notes, threat model, vault-format specification, backup-and-recovery guide, test evidence, limitations, and a release checklist for signing and independent review. If a security-critical feature cannot be implemented safely, leave it disabled and explain the blocker. At every milestone, report what was built, what was tested, and remaining risks, then proceed to the next authorized local milestone.
```

## Acceptance gate

The release is not ready for real passwords until a clean-machine backup restore works, tampering fails closed, backup rotation is recoverable, no sensitive data appears in logs, update/build provenance is verified, and an independent security review is complete.

## References reviewed 2026-09-29

- Proton Pass product and Windows feature pages: https://proton.me/pass and https://proton.me/pass/download/windows
- Proton Pass export guidance: https://proton.me/support/pass-export
- OWASP Cryptographic Storage and Key Management Cheat Sheets: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html and https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
- RFC 9106 Argon2: https://www.rfc-editor.org/info/rfc9106/
- Microsoft DPAPI guidance: https://learn.microsoft.com/en-us/dotnet/standard/security/how-to-use-data-protection
- Microsoft Windows signing guidance: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
