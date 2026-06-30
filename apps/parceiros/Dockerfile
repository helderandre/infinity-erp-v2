# Monorepo Dockerfile for @infinity/parceiros.
# Build context must be the REPO ROOT:
#   docker build -f apps/parceiros/Dockerfile -t infinity-parceiros .
# In Coolify: Base Directory = / , Dockerfile Location = apps/parceiros/Dockerfile.

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
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @infinity/parceiros

FROM base AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/parceiros/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/parceiros/.next/static ./apps/parceiros/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/parceiros/public ./apps/parceiros/public

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/parceiros/server.js"]
