# Contributing

Thanks for helping improve Aster Vault.

## Ground rules

1. Read `AGENTS.md` (project memory) and the specs in `docs/specs/` first.
2. **Never weaken the security model.** No custom crypto, no stored master or
   recovery keys, no plaintext metadata, no secrets in logs/fixtures.
3. Keep cryptography inside `crates/vault-core`. The Tauri layer stays thin and
   the frontend performs no crypto.
4. Never overwrite originals; restore swaps only after verification and explicit
   confirmation.

## Development loop

After every meaningful change:

```bash
cargo fmt --all
cargo clippy -p vault-core -p vault-recovery-cli --all-targets -- -D warnings
cargo test -p vault-core -p vault-recovery-cli

npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build

# Only when the brand mark changes:
npm run icon:build
```

Do not accumulate broken phases: get the gates green before moving on.

## Design system & brand

- UI primitives live in `src/components/ui`; tokens (palette, radii, type scale,
  motion) live in `src/index.css`. Reuse them rather than ad-hoc styles.
- A dev-only component gallery is reachable at `#gallery` — use it to check EN/AR
  and light/dark.
- The brand mark is `assets/brand/aster-mark.png`; `npm run icon:build`
  regenerates the app icon set from it. Do not edit the generated icons by hand.
- Keep the `muted` / `emerald-text` / `amber-text` text tokens for readable
  contrast (they adapt per theme); use `amber` directly only for decorative fills.

## Commits

Use logical, focused commits, e.g.:

- `chore: bootstrap aster vault`
- `feat: add argon2id key derivation`
- `feat: portable encrypted backup export`
- `test: add tamper and rotation coverage`

Never commit secrets, vault files (`*.avlt`), or real credentials.

## Reporting security issues

Do not open a public issue for a vulnerability. Report it privately to the
maintainer. This project has not yet had an independent security review.
