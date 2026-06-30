# Monorepo Dockerfile for @infinity/clientes.
# Build context must be the REPO ROOT:
#   docker build -f apps/clientes/Dockerfile -t infinity-clientes .
# In Coolify: Base Directory = / , Dockerfile Location = apps/clientes/Dockerfile.

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
RUN npm run build -w @infinity/clientes

FROM base AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/clientes/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/clientes/.next/static ./apps/clientes/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/clientes/public ./apps/clientes/public

USER nextjs
EXPOSE 3003
ENV PORT=3003
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/clientes/server.js"]
