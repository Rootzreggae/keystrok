# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
# ^ the builder stage sets NEXTAUTH_SECRET / ENCRYPTION_KEY to inert placeholders
# so `next build` can evaluate env, they are build-only, live only in the
# discarded builder stage, and never reach the final runtime image (which sets
# no such ENV). Real secrets are injected at runtime via the container env.

# Keystrok production image. Debian (glibc) base so Prisma's default query
# engine works without musl/binaryTargets juggling. Multi-stage: install +
# build with full deps, then run the built app with the deps it still needs.

# ---- deps: install all dependencies (incl. dev, needed to build) ------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# .npmrc carries legacy-peer-deps=true (next-auth@5 vs nodemailer peer conflict);
# without it `npm ci` ERESOLVE-fails, same as CI/Vercel.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ---- builder: generate Prisma client + build Next ---------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Inert placeholder env so the build can evaluate env without real secrets/DB.
# Values are deliberately zero-entropy (not real keys) and never leave this
# discarded builder stage; real values are supplied at runtime via the env.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    NEXTAUTH_SECRET=build-time-placeholder-not-a-secret \
    ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
RUN npx prisma generate && npm run build

# ---- runner: minimal runtime ------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# node_modules carries the Prisma CLI + client (used by the boot migration) and
# Next's runtime deps. .next/public/prisma carry the build and schema. Owned by
# the unprivileged `node` user so `next start` can write its runtime cache.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Run as the unprivileged user that ships with the node image.
USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
