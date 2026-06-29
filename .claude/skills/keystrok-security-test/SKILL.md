---
name: keystrok-security-test
description: Run Keystrok's security battery — prove platform credentials are encrypted at rest, that protected API routes reject unauthenticated access, and scan for leaked secrets and vulnerable dependencies. Use when the user asks to "check security", "verify the app is secure", "run the security tests", before a release, or after touching auth, API routes, or credential storage.
---

# Keystrok Security Test

Run the repeatable checks that Keystrok's core security guarantees still hold. Use this before merging anything that touches authentication, API routes, the Prisma schema, or credential storage — and any time the user wants reassurance the app is secure.

## Quick run

The dev server must be running on port 3001 first (`npm run dev -- -p 3001`). Then:

```bash
bash scripts/security-check.sh
```

This runs the following checks and exits non-zero on any hard failure:

1. **Encryption at rest** — `scripts/verify-encryption.ts` creates a throwaway platform, reads the raw DB row, and asserts the stored `apiKey` is `enc:v1:` ciphertext (not plaintext) and that `decryptSecret` round-trips.
2. **SSRF guard** — `scripts/verify-ssrf.ts` asserts the connection-test URL validator blocks cloud-metadata / loopback / private / non-http targets and allows public ones.
3. **Invite-only access** — `scripts/verify-allowlist.ts` asserts only allowlisted / domain / waitlist-approved emails pass, unknown emails are denied, and `AUTH_OPEN_REGISTRATION=true` opens it up. Approve an email with `node --env-file=.env.local scripts/allow-user.ts <email>`.
4. **Rate limiting** — `scripts/verify-rate-limit.ts` asserts the DB-backed fixed-window limiter (`lib/rate-limit.ts`) allows up to the limit, blocks the excess with a `retryAfterMs`, isolates keys, and resets after the window. Live: POST `/api/waitlist` >5×/hr from one IP → 429 with `Retry-After`; request >4 magic links/15min for one email → `EmailSignin` error (no send).
5. **Auth gate** — unauthenticated requests to protected `/api/*` routes (incl. the mail-sending `/api/test-email`) must return 401 (or a redirect), never 200.
6. **Secret scan** — `gitleaks` over the repo (intentional fixtures live in `test-scanner/` — confirm any hits are those).
7. **Dependency audit** — `npm audit --audit-level=high`.

## Deeper checks (run when scope warrants — audits, pre-launch)

- **IDOR matrix:** seed two users A and B; for every `/api/*/[id]` route assert B gets 404/401 on A's records. There is no `middleware.ts`, so each route enforces its own ownership check — verify with `findFirst({ where: { id, userId } })` before any mutate/delete.
- **No demo-user fallback:** confirm server actions in `app/(authenticated)/**/actions.ts` resolve the user via `session.user.id` and throw on no session (never `getOrCreateUser`/`demo@keystrok.com`).
- **SSRF on connection-test:** covered by `scripts/verify-ssrf.ts` (unit) and `lib/ssrf.ts`. For a live check, create a platform with `apiUrl=http://169.254.169.254/` and call `POST /api/platforms/[id]/test` — expect a "Blocked" result. Self-host operators can opt out with `ALLOW_PRIVATE_PLATFORM_URLS=true`.
- **No key material to the client:** grep responses/HTML for `enc:v1:` (ciphertext leak) and for known plaintext; read paths must return only masked previews (`maskApiKey(decryptSecret(...))`).
- **Security headers:** `curl -I` the app; expect CSP / HSTS / X-Frame-Options / X-Content-Type-Options (open finding until added in `next.config.ts`).
- **Static analysis:** `semgrep --config p/owasp-top-ten --config p/nextjs`.
- **Dogfood:** point Keystrok's own scanner at the Keystrok repo — it should not surface real secrets.

## Reporting

Summarize as pass/fail per check with file:line for any failure, then a one-line verdict. Treat encryption-at-rest and auth-gate failures as release blockers.
