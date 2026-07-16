# Self-hosting

Keystrok is built to run on your own machine, next to the keys it watches. One Docker stack: the app, Postgres, and a local mail catcher. No external services required to get started.

## Quick start

```bash
git clone https://github.com/Rootzreggae/keystrok && cd keystrok
cp .env.example .env
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"  >> .env
echo "ALLOWED_EMAILS=you@example.com"             >> .env
docker compose up --build
```

Then:

- App: `http://localhost:3001`
- Magic-link inbox (Mailpit): `http://localhost:8025`

Sign in with the email you allowlisted. The sign-in link lands in the Mailpit inbox at `:8025`, not your real inbox. The first user to sign in becomes the admin.

Prefer the prebuilt image? `docker compose pull && docker compose up` uses the published `ghcr.io/rootzreggae/keystrok:latest` instead of building locally.

## Mail: the one thing that will surprise you

The bundled mail catcher (Mailpit) traps **all** outgoing email locally. That is what makes solo use work with zero email setup, and it is also why **team invites will never reach a real inbox** until you configure real delivery. When you are ready to invite people, set either:

- `EMAIL_SERVER_HOST` / `EMAIL_SERVER_PORT` / `EMAIL_SERVER_USER` / `EMAIL_SERVER_PASSWORD` (any SMTP server), or
- `RESEND_API_KEY` (Resend)

The Team page always shows where mail is currently being delivered, so you can check what your instance is actually doing.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | The URL your instance is served at |
| `NEXTAUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | AES-256-GCM key for credentials stored at rest (`openssl rand -base64 32`) |
| `ALLOWED_EMAILS` | Comma-separated sign-in allowlist |
| `ALLOWED_EMAIL_DOMAINS` | Allowlist whole domains instead of single addresses |
| `AUTH_OPEN_REGISTRATION` | `true` opens sign-up to anyone. One instance is one shared workspace, so only do this if you mean it |
| `EMAIL_SERVER_*` / `EMAIL_FROM` | SMTP for magic links and invites |
| `RESEND_API_KEY` | Alternative to SMTP |
| `CRON_SECRET` | Authorizes the scheduled-job endpoints below |
| `ALLOW_PRIVATE_PLATFORM_URLS` | Lets platform base URLs point at private networks. Off by default as an SSRF guard; turn it on only if your Grafana or similar genuinely lives on a private address |

## Scheduled jobs

Keystrok does not ship a scheduler. If you want continuous behavior, point anything that can run a curl on a timer (cron, systemd timers, your NAS) at these endpoints with your `CRON_SECRET` as a Bearer token or `?key=`:

- `POST /api/cron/scan` re-scans every connected GitHub source and surfaces new leaks into Discovery. It is heavy (clones repos), so daily is a good cadence. Each source has a 6-hour floor, so an over-eager schedule cannot thrash.
- `POST /api/cron/tick` is the light pass: liveness re-checks and alert delivery. Run it as often as you like; every 15 minutes is plenty.

Without a scheduler, everything still works manually: scans run when you click them.

## Updating

Pull the new image and restart. Schema changes apply themselves at boot (`prisma db push` runs in the entrypoint before the server starts).

```bash
docker compose pull && docker compose up -d
```

Your data lives in the Postgres volume. Keystrok never stores full secret values, but the database does hold your platform credentials (encrypted) and your findings history, so back the volume up like you would any database.
