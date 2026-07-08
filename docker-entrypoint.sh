#!/bin/sh
set -e

# Sync the schema into the database before serving. `prisma db push` is the
# project's schema workflow (no migration history); it is idempotent, so it is
# safe to run on every boot. Postgres is expected to be reachable already,
# docker-compose gates the app on the db healthcheck.
# Call the CLI's entry file directly: the standalone image has no npx-resolvable
# .bin shims, just the prisma package copied in for this one boot task.
echo "[entrypoint] applying database schema (prisma db push)…"
node node_modules/prisma/build/index.js db push --skip-generate

# server.js is Next's standalone server (reads PORT and HOSTNAME from the env).
echo "[entrypoint] starting Keystrok on port ${PORT:-3000}…"
exec node server.js
