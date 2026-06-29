#!/bin/sh
set -e

# Sync the schema into the database before serving. `prisma db push` is the
# project's schema workflow (no migration history); it is idempotent, so it is
# safe to run on every boot. Postgres is expected to be reachable already —
# docker-compose gates the app on the db healthcheck.
echo "[entrypoint] applying database schema (prisma db push)…"
npx prisma db push --skip-generate

echo "[entrypoint] starting Keystrok on port ${PORT:-3000}…"
exec node_modules/.bin/next start -p "${PORT:-3000}"
