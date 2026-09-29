# Aster Vault — Browser Integration (Release 2) Scoping

Status: **Planning only.** Release 2 is deliberately **not** built now. This
document fixes the scope, security requirements, and acceptance gates so that the
Release 1 architecture does not prevent it, and so no Release 1 claim pretends
browser features already exist.

> A desktop app alone cannot deliver browser autofill or passkey integration.
> Each browser feature must be tested independently. Release 2 is a separate
> security project.

## 1. Why it is separate

Release 1 is fully offline. Release 2 adds a **Chrome/Edge extension** that talks
to the desktop app. That introduces a new attack surface: the browser extension
context, native messaging, origin matching, and the consent model. It cannot be
bolted on casually.

## 2. Scope (candidate, to be confirmed)

- Chrome/Edge extension (Manifest V3).
- Explicit user consent before any interaction.
- **Narrow site permissions** — request the minimum; prefer active-tab / on-demand
  permissions over broad host access.
- **Phishing-aware origin matching** — match on registrable domain (eTLD+1), warn
  on lookalike/punycode/IDN homograph origins, never autofill into a mismatched or
  insecure (non-HTTPS) origin without an explicit warning.
- **Autofill only after authenticated communication with the desktop app.**
- No passkey storage, no alias forwarding, no cloud sync in R2 (those remain R3 /
  separate projects).

## 3. Communication model (native messaging)

```text
browser extension
   │  (native messaging host, OS-mediated)
   ▼
named pipe / stdio bridge
   │
   ▼
Aster Vault desktop app
   │  session-scoped authorization token, user-visible
   ▼
vault-core (unchanged crypto boundary)
```

Requirements:
- Native messaging host manifest with a **strict allowed-origin list**.
- The desktop app must **authenticate the extension** and require an **unlocked,
  user-approved session**; never expose secrets to an unknown caller.
- Secrets cross the boundary only on explicit user action (e.g. autofill click),
  never in bulk.
- The extension never stores secrets; it requests them per use.
- Rate-limit and log (redacted) native messages.

## 4. Security requirements

1. Threat model extension for the browser context (malicious page, malicious
   extension, spoofed native host, permission creep, origin confusion).
2. Strict CSP / MV3 constraints; no remote code; no `eval`.
3. Origin matching reviewed against known phishing techniques; unit-tested with a
   corpus of homograph/punycode cases.
4. Consent UI is explicit and revocable; revocation tears down the session.
5. Independent review of the messaging bridge and origin matching is a gate.

## 5. Acceptance gates (R2)

- [ ] Consent required; permissions minimal; revocation works.
- [ ] Origin matching passes a phishing/homograph test corpus.
- [ ] Autofill only with an authenticated, unlocked desktop session.
- [ ] Extension never persists secrets; native messages redacted in logs.
- [ ] Each browser tested independently; store review considerations documented.
- [ ] Independent security review complete.

## 6. What Release 1 must do to not block R2

- Keep secrets behind the `vault-core` boundary so a future bridge can request a
  single item without exposing the store.
- Keep the service layer decoupled from the UI so a native-messaging host can call
  the same service API.
- Keep the DEK/KEK model intact; R2 adds no new key material beyond a session
  authorization token.
