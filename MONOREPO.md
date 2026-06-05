# Infinity Apps — Monorepo

npm-workspace monorepo holding three Next.js apps that share one Supabase backend
and a set of shared packages. One repo, one `node_modules` (hoisted), three
independently deployable apps.

## Structure

```
infinity-apps/
├── package.json            # private "infinity-apps", workspaces: apps/*, packages/*
├── apps/
│   ├── app/        @infinity/app        → app.infinitygroup.pt        (the main ERP, moved as-is)
│   ├── parceiros/  @infinity/parceiros  → parceiros.infinitygroup.pt  (referrals, payments, pipelines)
│   └── clientes/   @infinity/clientes   → clientes.infinitygroup.pt   (client portal)
└── packages/
    ├── config/  @infinity/config  # shared tsconfig bases
    ├── lib/     @infinity/lib     # shared Supabase clients + role helpers
    └── ui/      @infinity/ui      # shared cn() + Button/Card + Tailwind tokens
```

## Dev

```bash
npm install              # once, at the root — links workspaces, hoists deps
npm run dev:app          # main ERP        → http://localhost:3000
npm run dev:parceiros    # partners        → http://localhost:3001
npm run dev:clientes     # clients         → http://localhost:3003
```

> Port **3002 is avoided** — it is bugged on the dev machine. Clients uses 3003.

## Build

```bash
npm run build            # build every workspace that has a build script (-ws --if-present)
npm run build:app        # single app
npm run build:parceiros
npm run build:clientes
```

## Shared packages

The new apps consume shared code via subpath exports (raw `.ts`, compiled by each
app through `transpilePackages: ['@infinity/ui', '@infinity/lib']`):

```ts
import { createClient } from '@infinity/lib/supabase/server'   // or /client, /admin
import { canAccessSurface } from '@infinity/lib/auth/roles'
import { Button } from '@infinity/ui/button'
```

`@infinity/lib/auth/roles` defines `canAccessSurface('app' | 'parceiros' | 'clientes', roles)`
— the single source of truth for which role may use which subdomain. Admins pass on all.

> The **main app was moved as-is** and still uses its own local `lib/`, `components/`,
> `types/` via the `@/*` alias. It does NOT yet consume `packages/*`. Migrating it onto
> the shared packages is a later, incremental step.

## Deploy (Coolify / Docker)

Each app has its own Dockerfile. **Build context must be the repo root** (so npm can
install the whole workspace and the standalone trace can reach hoisted deps).

In Coolify, create three services, all pointing at this repo:

| Service     | Base Directory | Dockerfile Location        | Domain                     | Port |
|-------------|----------------|----------------------------|----------------------------|------|
| infinity-app| `/`            | `apps/app/Dockerfile`      | app.infinitygroup.pt       | 3000 |
| parceiros   | `/`            | `apps/parceiros/Dockerfile`| parceiros.infinitygroup.pt | 3001 |
| clientes    | `/`            | `apps/clientes/Dockerfile` | clientes.infinitygroup.pt  | 3003 |

Each needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(+ `SUPABASE_SERVICE_ROLE_KEY` and the app's other secrets) as build args / env.

## Gotchas baked into this setup

- **`outputFileTracingRoot`** is set to the repo root in every `next.config.ts` so
  `output: 'standalone'` traces the hoisted `node_modules`. Standalone output lands at
  `apps/<name>/.next/standalone/apps/<name>/server.js`.
- **`apps/app/app/globals.css`** imports shadcn's stylesheet via an explicit hoisted path
  `../../../node_modules/shadcn/dist/tailwind.css` — a bare specifier hits shadcn's
  `exports` field (no `style` condition) and fails.
- Shared `.env.local` is copied into each app dir for local dev (gitignored).
