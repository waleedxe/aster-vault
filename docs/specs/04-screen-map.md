# Aster Vault — Screen Map & Visual Tokens

Status: Phase 0 specification. Derived from the product brief and the UI mockup
(`docs/reference/aster-vault-mockup.png`).

## 1. Navigation model

Left sidebar (RTL-aware, mirrored in Arabic):

- **All Items** — every item
- **Favorites**
- **Logins**
- **Notes**
- **Cards**
- **Identities**
- **Archive**
- **Backup**
- **Settings**

Top status strip: Locked / Unlocked · backup health · last backup time.

Main area: search box, filter/sort controls, item cards (list or grid).
Detail panel: reveal, copy, edit, history, TOTP code, strength/reuse warnings.

## 2. Screens

### 2.1 Onboarding / Setup wizard
1. Welcome — value statement ("Private by design. Ready to recover.").
2. Create master password — strength meter, confirmation, no recovery-by-email.
3. Generate recovery key — display once, require the user to confirm it is stored
   separately, explain it is independent of the master password.
4. Create and test first backup — choose destination, run a verification drill.
5. Done — vault unlocked.

### 2.2 Unlock
- Master-password field (masked), reveal toggle.
- "Use recovery key" path.
- Failed attempts: generic, rate-limited messaging; no information leak.
- Shows last backup age and backup-health hint.

### 2.3 Vault list
- Sidebar counts per category; search across (decrypted, in-memory) items.
- Sort by name / recently used.
- Item cards show icon, title, subtitle, favorite star, overflow menu.
- Empty states are calm and instruct (e.g. "Create your first login").

### 2.4 Item detail
- Fields per type (login: username, password, website, notes; card: number, expiry,
  CVV, holder; identity: name, email, phone, address; note: body; totp: seed + code).
- Reveal, copy (with clipboard-clear timer feedback), edit, history.
- Local strength + reuse warnings (factual, short, never colour-only).

### 2.5 Create / edit item
- Type selector, dynamic fields, folder picker, tags, favorite toggle.
- Generator shortcut for password fields.

### 2.6 Password / passphrase generator
- Length, character classes, exclude ambiguous, passphrase mode (word count),
  entropy estimate, copy action with clear timer.

### 2.7 Import
- Source selector: Proton Pass export / generic CSV.
- Explicit plaintext warning (the export may be unencrypted) and local-only notice.
- Column mapping preview, duplicate handling, then a reminder to delete the source.

### 2.8 Backup center
- Last successful backup (date/time) + health badge.
- Create backup now; schedule to a chosen folder (incl. external disk / synced
  folder — encrypted bytes only); verification drill; restore.
- Versions list with retention; choose destination.

### 2.9 Restore flow
- Pick file → enter master password or recovery key → decrypt to a **new vault** →
  verify authentication + item counts → preview → explicit confirm → swap.
- Prior vault preserved until the new one is verified. Wrong creds / tampered file
  fail safely with a clear message.

### 2.10 Settings
- Security: auto-lock timeout, lock on screen lock/sleep/user switch, clipboard
  clear timeout, KDF upgrade on unlock.
- Appearance: light/dark, reduced motion, high contrast.
- Language: English / Arabic.
- About: version, format version, licenses, privacy, limitations.

### 2.11 Locked-state overlay
- Fast re-unlock; all decrypted state zeroized in the backend.

## 3. Visual tokens (from the brief)

**Palette**

| Token | Hex | Use |
|-------|-----|-----|
| Midnight | `#101827` | primary dark surface |
| Deep Slate / Navy | `#1C2A3D` | raised dark surface |
| Porcelain | `#F7F8F5` | primary light surface |
| Mist | `#E8EEE9` | light secondary surface |
| Emerald | `#2E866F` | primary action, focus ring |
| Pale Mint | `#CFEADC` | subtle accent, brand petals |
| Amber | `#D9A957` | warnings / backup attention |
| Ink | `#172231` | primary text (light) |
| Muted | `#657383` | secondary text |

> The approved UI mockup shows Mint as `#CFEADC`; this supersedes the earlier
> brief value `#D7EDE3` and is the source of truth in `src/index.css`.

Verify contrast ratios for every text and interactive state, **including dark
mode**. Never use colour alone to signal risk.

**Type** — Inter with system fallback; tabular numerals for codes and dates.
Scale: 13/14 body, 16 section labels, 24 page titles, 32 welcome.

**Spacing & shape** — 8 px base; 10–14 px radii; 1 px quiet borders; 44 px minimum
primary controls; focus rings in Emerald; 120–180 ms transitions; reduced-motion
mode.

**Brand mark** — a four-point aster formed by four restrained, separated petals
around protected negative space. Must work at 16 px and in one colour. Avoid lock,
shield, fingerprint, cloud clichés. Do not imitate Proton's colours, logo, or
layout.

**Microcopy** — "Your vault is locked." / "Backed up 2 hours ago." / "Test your
backup" / "Restore on this device" / "Keep your recovery key somewhere separate." /
"This file could not be verified."

## 3a. Contrast (WCAG AA verified)

Audited ratios (normal text needs ≥ 4.5:1). Mode-aware text tokens were added so
the same class works in both themes: `muted`, `emerald-text`, `amber-text`.

| Pair | Ratio | Result |
|------|-------|--------|
| Ink on Porcelain | 15.0 | AA |
| Muted (light) on Porcelain | 5.9 | AA |
| Emerald-text (light) on Porcelain | 6.0 | AA |
| Emerald-text (light) on Mint | 5.0 | AA |
| Amber-text (light) on Porcelain | 5.0 | AA |
| White on Emerald-strong (primary button) | 5.6 | AA |
| Porcelain on Midnight | 16.7 | AA |
| Porcelain on Navy | 13.6 | AA |
| Muted (dark) on Navy | 6.7 | AA |
| Emerald-text (dark) on Navy | 6.4 | AA |
| Amber-text (dark) on Midnight | 7.6 | AA |

The gold star uses `amber` directly (decorative, non-text) and is never the only
signal for a state.

## 4. Accessibility requirements

- Full keyboard navigation; logical focus order; visible Emerald focus rings.
- Screen-reader names on every control and status.
- High-contrast and reduced-motion modes.
- RTL layout correctness for Arabic: navigation feels natural, arrows/icons
  mirrored where appropriate, forms stay readable.
