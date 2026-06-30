# Deploying Keystrok

Keystrok is a standard Next.js 15 app backed by PostgreSQL and SMTP email.
There is no Vercel lock-in. It runs anywhere you can run Node 20+ and reach a
Postgres database.

Two paths are described below:

- **A. Bundled stack (`docker compose`)**: app + Postgres + a MailHog-style
  mail catcher, fully self-contained. Best for trying it out or single-box
  self-hosting.
- **B. Bring-your-own infra**: managed Postgres + real SMTP (or Resend),
  deploying the container (or a plain `next build`) however you like.

---

## A. Bundled stack (one box, `docker compose`)

Requires Docker with Compose v2.

```bash
# 1. Generate the two required secrets into a local .env (compose reads it).
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"  >> .env

# 2. Allow yourself in (invite-only by default).
echo "ALLOWED_EMAILS=you@example.com" >> .env

# 3. Build and start app + Postgres + Mailpit.
docker compose up --build
```

Then:

- App: <http://localhost:3001>
- Inbox (sign-in + waitlist emails land here): <http://localhost:8025>

Sign in at `/auth/signin` with the email you allowlisted, open the Mailpit UI,
and click the magic link. On boot the app runs `prisma db push` to create the
schema, so the database is ready on first start.

> **Mail catcher.** The compose file uses [Mailpit](https://mailpit.axllent.org/),
> the maintained, multi-arch, MailHog-compatible inbox (SMTP on `:1025`, web
> UI on `:8025`). It works natively on Apple Silicon. No mail leaves your machine.

### Use the prebuilt image (skip the build)

CI publishes a multi-stage image to `ghcr.io/rootzreggae/keystrok`. To pull it
instead of building locally:

```bash
docker compose pull && docker compose up
```

The compose file points `app` at that image, with `build:` kept as a fallback,
so `docker compose up --build` still builds from source when you want to.

To stop and wipe the database volume: `docker compose down -v`.

---

## B. Bring-your-own infra (production)

1. **Database**: provision PostgreSQL (Neon, RDS, Cloud SQL, your own…) and set
   `DATABASE_URL`. Apply the schema once with `npx prisma db push` (or wire it
   into your release step). The container does this automatically on boot.

2. **Email**: pick one:
   - **SMTP**: set `EMAIL_TRANSPORT=smtp` and the `EMAIL_SERVER_*` vars. Leave
     `EMAIL_SERVER_USER` empty for unauthenticated relays.
   - **Resend**: set `EMAIL_TRANSPORT=resend` and `RESEND_API_KEY`. `EMAIL_FROM`
     must be on a Resend-verified domain.

   Both magic-link sign-in and the waitlist confirmation go through the same
   mailer (`lib/mailer.ts`).

3. **Run it**: either deploy the image built from the `Dockerfile`, or build on
   the host:

   ```bash
   npm ci
   npx prisma generate
   npm run build
   npx prisma db push      # once, or on each release
   npm run start           # serves on $PORT (default 3000)
   ```

   Put a TLS-terminating reverse proxy in front and set `NEXTAUTH_URL` to the
   public HTTPS origin.

---

## Connecting GitHub (optional)

Scanning GitHub repos needs a GitHub App, but you don't create one by hand or
set any env vars. The instance operator (the first user to sign in) opens
**Discovery, Connect a source, GitHub** and Keystrok creates a private,
read-only App on their GitHub account via GitHub's App Manifest flow, then
stores its credentials (private key encrypted) in the database. Local-folder
scanning needs no setup at all.

Advanced: to supply a pre-made App instead, set `GITHUB_APP_ID`,
`GITHUB_APP_SLUG`, and `GITHUB_APP_PRIVATE_KEY_BASE64`. These are the fallback
used only when no App has been set up in-app.

---

## Required environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. |
| `NEXTAUTH_URL` | ✅ | Public origin, e.g. `https://keystrok.example.com`. |
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32`. |
| `ENCRYPTION_KEY` | ✅ | Encrypts platform API keys at rest (AES-256-GCM). Must decode to **32 bytes**: `openssl rand -base64 32`. See rotation note below. |
| `EMAIL_TRANSPORT` | - | `smtp` \| `resend`. Auto-detected if unset. |
| `EMAIL_SERVER_HOST` / `_PORT` / `_USER` / `_PASSWORD` | for SMTP | `_USER` empty ⇒ no SMTP auth (e.g. Mailpit). |
| `RESEND_API_KEY` | for Resend | Hosted email API key. |
| `EMAIL_FROM` | ✅ | From address/name for outbound mail. |
| `ALLOWED_EMAILS` | - | Comma-separated allowlist (invite-only gate). |
| `ALLOWED_EMAIL_DOMAINS` | - | Comma-separated domain allowlist. |
| `AUTH_OPEN_REGISTRATION` | - | `true` lets anyone sign up on your instance. |
| `ALLOW_PRIVATE_PLATFORM_URLS` | - | `true` permits connection-tests to private/internal IPs (SSRF guard opt-out). |
| `PORT` | - | Listen port (default `3000`). |

See `.env.example` for the annotated template.

---

## Access control

Keystrok is **invite-only by default**. Grant access by any of:

- listing the address in `ALLOWED_EMAILS`,
- allowing its domain via `ALLOWED_EMAIL_DOMAINS`,
- approving a waitlist entry: `node --env-file=.env.local scripts/allow-user.ts <email>`,
- or opening the instance entirely with `AUTH_OPEN_REGISTRATION=true`.

---

## Schema management

The project uses `prisma db push` (no migration history). The container applies
it on boot; to run manually: `npx prisma db push`. For visual inspection:
`npx prisma studio` (the compose stack exposes Postgres on `localhost:5432`).

---

## Security notes

- **Never commit `.env` / `.env.local`**: only `.env.example` is tracked.
- **`ENCRYPTION_KEY` rotation** re-keys stored secrets: existing `Platform.apiKey`
  rows are encrypted under the current key. Rotating it requires decrypting with
  the old key and re-encrypting with the new one (see `scripts/`). Don't rotate
  it casually once real credentials are stored.
- Run the security battery before shipping changes that touch auth, API routes,
  or credential storage: `bash scripts/security-check.sh` (dev server on :3001).
