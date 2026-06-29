---
name: encrypted-field
description: Add encryption-at-rest to a sensitive Prisma string field in Keystrok (API keys, tokens, credentials, secrets) using the AES-256-GCM helpers in lib/crypto. Use when adding or changing any model field that stores a credential the app must later read back, or when the user asks to "encrypt" a stored secret / "store this securely".
---

# Encrypted Field

How to store a reversible secret (one the app must use later — e.g. a platform API key) encrypted at rest in Keystrok. This is DISTINCT from scanner-discovered keys, which are one-way hashed via `hashKey()` and never recovered.

The reference implementation is `Platform.apiKey`. Follow the same five-point pattern for any new secret field.

## The pattern

Use the helpers in `lib/crypto.ts`: `encryptSecret`, `decryptSecret`, `isEncrypted`, `isMaskedSecret`, `maskApiKey`.

1. **Schema** — the column stays a plain `String` (the envelope `enc:v1:...` is just text); no special column type. Requires `ENCRYPTION_KEY` in the environment (32 bytes, base64 — see `.env.example`).

2. **Write paths — encrypt, with a masked-value guard.** On every create/update that accepts the secret:
   ```ts
   apiKey: value && !isMaskedSecret(value) ? encryptSecret(value) : ''   // create
   ...(value && !isMaskedSecret(value) && { apiKey: encryptSecret(value) }) // update (skip if unchanged/masked)
   ```
   The `isMaskedSecret` guard prevents re-encrypting a masked placeholder that an edit form resubmits. Find ALL write paths (server action + every API route) — `grep -rn "apiKey:" app/`.

3. **Read paths — never return key material to the client.** Replace the field with a server-computed masked preview:
   ```ts
   apiKey: stored ? maskApiKey(decryptSecret(stored)) : ''
   ```
   Apply in the server action AND every API route that returns the record (list/detail). For pickers that don't need it, strip it entirely (`const { apiKey, ...rest } = row`).

4. **Point of use — decrypt only where the plaintext is actually needed**, never returning it to the client:
   ```ts
   const apiKey = decryptSecret(platform.apiKey) // e.g. inside the connection-test route
   ```

5. **Migration + proof.** For existing rows, write an idempotent migrator modeled on `scripts/encrypt-existing-platform-keys.ts` (skip `isEncrypted` and empty values), run it with `node --env-file=.env.local scripts/<name>.ts`. Then prove it with a script modeled on `scripts/verify-encryption.ts` that reads the RAW row and asserts ciphertext + round-trip.

## Gotchas

- Don't log the plaintext or the key. Audit for `console.log` near the secret.
- `decryptSecret` tolerates legacy plaintext (returns as-is) so reads don't break before the migration runs — but the migration must still run.
- Rotating `ENCRYPTION_KEY` requires re-encrypting every row; the `enc:v1:` prefix is the hook for a future versioned rotation.
- After wiring, run the `keystrok-security-test` skill — its encryption-at-rest check covers this field once you add it to the proof.
