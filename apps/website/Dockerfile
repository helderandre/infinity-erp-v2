# Monorepo Dockerfile for @infinity/website (public marketing/property site).
# Build context must be the REPO ROOT:
#   docker build -f apps/website/Dockerfile -t infinity-website .
# In Coolify: Base Directory = / , Dockerfile Location = apps/website/Dockerfile.

FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/
COPY apps/parceiros/package.json apps/parceiros/
COPY apps/clientes/package.json apps/clientes/
COPY apps/website/package.json apps/website/
COPY packages/config/package.json packages/config/
COPY packages/lib/package.json packages/lib/
COPY packages/ui/package.json packages/ui/
RUN npm ci

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @infinity/website

FROM base AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/website/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/website/.next/static ./apps/website/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/website/public ./apps/website/public

USER nextjs
EXPOSE 3004
ENV PORT=3004
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/website/server.js"]
