# Third-Party Licenses

Aster Vault bundles no external cryptographic engines. All cryptography is
composed from maintained Rust crates and the standard library. This file records
each dependency, its license, and its purpose.

## Rust core (`crates/vault-core`)

| Dependency | License | Purpose | Bundled |
|------------|---------|---------|---------|
| `aes-gcm` (RustCrypto) | MIT OR Apache-2.0 | AES-256-GCM authenticated encryption | yes |
| `argon2` (RustCrypto) | MIT OR Apache-2.0 | Argon2id password KDF (RFC 9106) | yes |
| `rand` | MIT OR Apache-2.0 | OS-backed CSPRNG access | yes |
| `zeroize` | MIT OR Apache-2.0 | Clear key material from memory | yes |
| `serde` / `serde_json` | MIT OR Apache-2.0 | Container header serialization | yes |
| `thiserror` | MIT OR Apache-2.0 | Error model | yes |
| `base64` | MIT OR Apache-2.0 | Recovery-key display encoding | yes |
| `getrandom` (transitive) | MIT OR Apache-2.0 | OS entropy source | yes |

## Desktop shell (`src-tauri`)

| Dependency | License | Purpose | Bundled |
|------------|---------|---------|---------|
| `tauri` | MIT OR Apache-2.0 | Desktop application framework | yes |
| `tauri-plugin-dialog` | MIT OR Apache-2.0 | Native file dialogs | yes |
| `tauri-plugin-opener` | MIT OR Apache-2.0 | Open files/folders | yes |
| `tauri-build` | MIT OR Apache-2.0 | Build-time codegen | build-only |

## Frontend

| Dependency | License | Purpose |
|------------|---------|---------|
| `react`, `react-dom` | MIT | UI |
| `i18next`, `react-i18next` | MIT | English/Arabic localization |
| `zustand` | MIT | State management |
| `lucide-react` | ISC | Icons |
| `vite`, `typescript`, `vitest`, `tailwindcss`, `eslint`, `prettier` | MIT / Apache-2.0 / ISC | Build, test, and tooling |

## Notes

- No license requires public redistribution of source in a way that conflicts
  with a public binary distribution. Final legal review is still recommended
  before release.
- This list is updated as dependencies are added. Do not bundle any component
  with an incompatible license without documenting it here first.
