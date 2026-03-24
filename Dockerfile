# syntax=docker/dockerfile:1.4
FROM --platform=linux/amd64 node:24-bookworm-slim AS base

WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# --- Install dependencies (root app only; no apps/* or packages/* workspace paths)
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# --- Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_OPTIONS="--max-old-space-size=4096 --dns-result-order=ipv4first"

# Optional: provide build-time env (e.g. `docker build --secret id=app_env,src=.env .`)
RUN --mount=type=secret,id=app_env,required=false \
    sh -c 'if [ -f /run/secrets/app_env ]; then cp /run/secrets/app_env /app/.env; fi'

RUN pnpm build

# --- Run minimal standalone output (see next.config.ts output: "standalone")
FROM --platform=linux/amd64 node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update -y && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
