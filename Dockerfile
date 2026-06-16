# Root Dockerfile = the main ERP (@infinity/app, app.infinitygroup.pt).
# Build context is the REPO ROOT (needed for the npm-workspace install), and
# this file lives at the root so Coolify finds it with default settings.
#   docker build -t infinity-app .
# Coolify (main app service): Base Directory = /  ·  Dockerfile Location = Dockerfile
# The parceiros / clientes apps keep their own Dockerfiles at apps/<name>/Dockerfile.

# ---- Base ----
FROM node:22-alpine AS base

# ---- Dependencies ----
FROM base AS deps
WORKDIR /repo

# Workspace manifests first (better layer caching).
COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/
COPY apps/parceiros/package.json apps/parceiros/
COPY apps/clientes/package.json apps/clientes/
COPY packages/config/package.json packages/config/
COPY packages/lib/package.json packages/lib/
COPY packages/ui/package.json packages/ui/
RUN npm ci

# ---- Build ----
FROM base AS builder
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build -w @infinity/app

# ---- Runner ----
FROM base AS runner
WORKDIR /repo

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Chromium + libs for puppeteer-core (PDF generation).
RUN apk add --no-cache \
    chromium nss freetype freetype-dev harfbuzz ca-certificates \
    ttf-freefont font-noto font-noto-emoji \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output is nested under apps/app/ because outputFileTracingRoot is the repo root.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/public ./apps/app/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/app/server.js"]
