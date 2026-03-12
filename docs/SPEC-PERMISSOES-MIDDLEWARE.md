# Permissões & Middleware — Documentação Técnica

**Última actualização:** 2026-03-13

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Middleware de Autenticação](#middleware-de-autenticação)
3. [Estrutura de Roles e Permissões](#estrutura-de-roles-e-permissões)
4. [Constantes Centralizadas de Roles](#constantes-centralizadas-de-roles)
5. [Helper Server-Side — lib/auth/permissions.ts](#helper-server-side)
6. [Hook useUser — Obtenção de Dados e Permissões](#hook-useuser)
7. [Hook usePermissions — Verificação de Permissões](#hook-usepermissions)
8. [Protecção do Frontend (Sidebar & Páginas)](#protecção-do-frontend)
9. [Protecção do Backend (API Routes)](#protecção-do-backend)
10. [Mapeamento de Módulos e Permissões](#mapeamento-de-módulos)
11. [Fluxo Completo — Exemplo End-to-End](#fluxo-completo)
12. [Lacunas Conhecidas e Recomendações](#lacunas-e-recomendações)

---

## 1. Visão Geral

O sistema de permissões do ERP Infinity é **baseado em roles (RBAC)** com suporte a **multi-role por utilizador**. A arquitectura divide-se em três camadas:

| Camada | Ficheiro(s) | O que faz |
|--------|-------------|-----------|
| **Middleware** | `middleware.ts` | Autenticação (login obrigatório) |
| **Frontend** | `hooks/use-permissions.ts`, `hooks/use-user.ts`, `app-sidebar.tsx` | Filtragem de UI por permissões |
| **Backend** | `lib/auth/permissions.ts`, `lib/auth/roles.ts`, `app/api/**/route.ts` | Autenticação + autorização por role/módulo |

**Modelo actual:** O sistema valida **autenticação** em todas as camadas e **autorização granular** por módulo em todas as API routes (via `requirePermission()`) e em todas as páginas do dashboard (via `PermissionGuard` em layouts por secção). Adicionalmente, **10 API routes de processos** usam `requireRoles()` para verificação de role específica.

---

## 2. Middleware de Autenticação

**Ficheiro:** `middleware.ts`

### Funcionamento

```
Pedido HTTP
  │
  ├─ É rota pública? (/login, /forgot-password, /verify-otp, /reset-password)
  │   ├─ Utilizador autenticado → Redirecionar para /dashboard
  │   └─ Utilizador não autenticado → Permitir acesso
  │
  ├─ É rota protegida? (tudo o resto excepto /, assets, API)
  │   ├─ Utilizador autenticado → Permitir acesso
  │   └─ Utilizador não autenticado → Redirecionar para /login?redirect=<path>
  │
  └─ É rota de API? (/api/*)
      └─ NÃO passa pelo middleware (excluída no matcher)
```

### Rotas Públicas

```typescript
const publicPaths = ['/login', '/forgot-password', '/verify-otp', '/reset-password']
```

### Matcher (rotas processadas pelo middleware)

```typescript
// Exclui:
// - /api/* (API routes autenticam-se internamente)
// - /_next/static/* (ficheiros estáticos)
// - /_next/image/* (optimização de imagens)
// - /favicon.ico
// - Ficheiros com extensão de imagem (.svg, .png, .jpg, etc.)
'/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
```

### Redirect com Parâmetro

Quando um utilizador não autenticado tenta aceder a uma rota protegida, é redirecionado para:
```
/login?redirect=/dashboard/imoveis
```
Isto permite que, após login, o utilizador seja encaminhado de volta à página que tentou aceder.

### Limitações do Middleware

- **Não verifica permissões granulares** — apenas confirma que o utilizador está autenticado (a autorização por módulo é feita pelos `PermissionGuard` layouts e `requirePermission()` nas API routes)
- **API routes são excluídas** — autenticam-se e autorizam-se internamente via `requirePermission()`/`requireRoles()`

---

## 3. Estrutura de Roles e Permissões

### Tabelas na Base de Dados

```
roles
├── id (UUID, PK)
├── name (varchar, unique)         ← ex: "Broker/CEO", "Consultor"
├── description (text)
├── permissions (jsonb)            ← objecto com 22 módulos booleanos
├── created_at, updated_at

user_roles (tabela junction — M:N)
├── user_id (UUID, FK → dev_users.id)
├── role_id (UUID, FK → roles.id)
├── assigned_at (timestamptz)
├── assigned_by (UUID, FK → dev_users.id)
```

### Roles Existentes

| Role | Descrição |
|------|-----------|
| `admin` | Acesso total (superadmin) |
| `Broker/CEO` | Todas as permissões (superadmin) |
| `Consultor` | Acesso base a imóveis, leads, processos |
| `Consultora Executiva` | Permissões expandidas |
| `Gestor Processual` | Foco em processos e documentos |
| `Marketing` | Acesso a marketing e campanhas |
| `Office Manager` | Gestão administrativa |
| `Team Leader` | Líder de equipa |
| `Recrutador` | Módulo de recrutamento |
| `Intermediário de Crédito` | Crédito e financeiro |
| `Cliente` | Acesso mínimo |

### Formato do Objecto `permissions` (JSONB)

```json
{
  "dashboard": true,
  "properties": true,
  "leads": true,
  "processes": false,
  "documents": true,
  "consultants": false,
  "owners": false,
  "teams": false,
  "commissions": false,
  "marketing": false,
  "templates": false,
  "settings": false,
  "goals": false,
  "store": false,
  "users": false,
  "buyers": false,
  "credit": false,
  "calendar": false,
  "pipeline": false,
  "financial": false,
  "integration": false,
  "recruitment": false
}
```

### Multi-Role — Lógica de Merge

Um utilizador pode ter **múltiplas roles** via `user_roles`. As permissões são combinadas com **OR lógico**:

```
Role A: { properties: true,  leads: false, processes: true  }
Role B: { properties: false, leads: true,  processes: false }
───────────────────────────────────────────────────────────
Resultado: { properties: true, leads: true, processes: true }
```

Se **qualquer role** concede a permissão, o utilizador tem-na.

**Excepção:** Se o utilizador tiver a role `admin` ou `Broker/CEO`, recebe automaticamente **todas as 22 permissões** como `true`.

---

## 4. Constantes Centralizadas de Roles

**Ficheiro:** `lib/auth/roles.ts`

Fonte única de verdade para todos os agrupamentos de roles. Qualquer ficheiro que precise verificar roles por nome **deve importar daqui**.

### Constantes Disponíveis

```typescript
/** Roles com acesso total (superadmin) */
export const ADMIN_ROLES = ['admin', 'Broker/CEO'] as const

/** Roles que podem aprovar/rejeitar/pausar/cancelar/devolver processos */
export const PROCESS_MANAGER_ROLES = ['Broker/CEO', 'Gestor Processual', 'admin'] as const

/** Roles que podem criar/remover tarefas ad-hoc e reverter tarefas concluídas */
export const ADHOC_TASK_ROLES = ['admin', 'Broker/CEO', 'Gestor Processual'] as const

/** Roles consideradas "consultores" (não back-office/admin) */
export const CONSULTANT_ROLES = ['Consultor', 'Consultora Executiva', 'Team Leader'] as const

/** Roles que recebem notificações de aprovação/gestão */
export const APPROVER_NOTIFICATION_ROLES = ['Broker/CEO', 'Gestor Processual'] as const

/** Lista completa de todos os módulos de permissão (22 módulos) */
export const ALL_PERMISSION_MODULES = [
  'dashboard', 'properties', 'leads', 'processes', 'documents',
  'consultants', 'owners', 'teams', 'commissions', 'marketing',
  'templates', 'settings', 'goals', 'store', 'users', 'buyers',
  'credit', 'calendar', 'pipeline', 'financial', 'integration', 'recruitment',
] as const

/** Todos os agrupamentos disponíveis (para referência) */
export const ROLE_GROUPS = {
  admin: ADMIN_ROLES,
  processManager: PROCESS_MANAGER_ROLES,
  adhocTask: ADHOC_TASK_ROLES,
  consultant: CONSULTANT_ROLES,
  approverNotification: APPROVER_NOTIFICATION_ROLES,
} as const
```

### Retrocompatibilidade

O ficheiro `lib/constants.ts` faz re-export de `ADHOC_TASK_ROLES` para não quebrar imports existentes:

```typescript
// lib/constants.ts
export { ADHOC_TASK_ROLES } from '@/lib/auth/roles'
```

### Onde Cada Constante é Usada

| Constante | Utilização |
|-----------|-----------|
| `ADMIN_ROLES` | `hooks/use-user.ts` (detecção admin), `hooks/use-permissions.ts` (`isBroker()`) |
| `PROCESS_MANAGER_ROLES` | 6 API routes de processo (approve, reject, return, hold, cancel, re-template) |
| `ADHOC_TASK_ROLES` | 4 API routes de tarefas ad-hoc + 2 componentes frontend |
| `CONSULTANT_ROLES` | `app/api/consultants/route.ts`, `app/dashboard/consultores/page.tsx` |
| `APPROVER_NOTIFICATION_ROLES` | 4 API routes que enviam notificações a gestores |
| `ALL_PERMISSION_MODULES` | `hooks/use-user.ts` (admin all-permissions), `lib/auth/permissions.ts` |

---

## 5. Helper Server-Side — lib/auth/permissions.ts

**Ficheiro:** `lib/auth/permissions.ts`

Helper reutilizável para verificar autenticação + autorização em API routes. Elimina a duplicação de ~20 linhas de código de auth em cada route.

### Tipos Exportados

```typescript
export type PermissionModule = (typeof ALL_PERMISSION_MODULES)[number]

export interface AuthResult {
  authorized: true
  user: { id: string; email?: string }
  roles: string[]
  permissions: Record<string, boolean>
}

export interface AuthError {
  authorized: false
  response: NextResponse
}
```

### Funções Disponíveis

#### `requireAuth()` — Apenas autenticação

```typescript
const auth = await requireAuth()
if (!auth.authorized) return auth.response
// auth.user, auth.roles, auth.permissions disponíveis
```

- Retorna 401 se não autenticado
- Carrega roles e permissões numa única query
- Merge de permissões com OR lógico (admin/Broker recebe tudo)

#### `requirePermission(module)` — Autenticação + permissão por módulo

```typescript
const auth = await requirePermission('properties')
if (!auth.authorized) return auth.response
```

- Retorna 401 se não autenticado, 403 se sem permissão
- Útil para proteger API routes por módulo

#### `requireRoles(allowedRoles)` — Autenticação + verificação de role

```typescript
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const auth = await requireRoles(PROCESS_MANAGER_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

- Retorna 401 se não autenticado, 403 se sem role autorizado
- Admin/Broker tem sempre acesso (bypass automático)
- **Usado em 10 API routes de processos** (approve, reject, return, hold, cancel, re-template, tasks, taskId, subtasks, subtaskId)

### Exemplo Completo — Antes vs Depois

**Antes (20+ linhas por route):**
```typescript
const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
}
const { data: devUser } = await supabase
  .from('dev_users')
  .select(`*, user_roles!user_roles_user_id_fkey!inner(role:roles(name))`)
  .eq('id', user.id)
  .single()
const userRoles = ((devUser as any)?.user_roles || []).map((ur: any) => ur.role?.name) as string[]
const canApprove = userRoles.some((role) =>
  ['Broker/CEO', 'Gestora Processual', 'admin'].includes(role) // ⚠️ nome errado!
)
if (!canApprove) {
  return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
}
```

**Depois (3 linhas):**
```typescript
const auth = await requireRoles(PROCESS_MANAGER_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

---

## 6. Hook useUser

**Ficheiro:** `hooks/use-user.ts`

### Responsabilidades

1. Obter o utilizador autenticado via `supabase.auth.getUser()`
2. Carregar dados de `dev_users` com roles aninhadas via `user_roles`
3. Combinar permissões de todas as roles (OR lógico)
4. Subscrever alterações de autenticação (`onAuthStateChange`)

### Interface de Retorno

```typescript
interface UserWithRole extends DevUser {
  role: Role | null       // Role base com permissões combinadas
  auth_user: User | null  // Objecto auth.User do Supabase
}

// Retorno do hook:
{
  user: UserWithRole | null
  loading: boolean
  error: Error | null
  isAuthenticated: boolean  // !!user
}
```

### Query de Dados

```typescript
const { data: devUser } = await supabase
  .from('dev_users')
  .select(`
    *,
    user_roles!user_roles_user_id_fkey!inner(
      role:roles(*)
    )
  `)
  .eq('id', authUser.id)
  .single()
```

### Algoritmo de Merge de Permissões

```typescript
import { ADMIN_ROLES, ALL_PERMISSION_MODULES } from '@/lib/auth/roles'

// 1. Verificar se tem role admin/Broker (usa constante centralizada)
const hasAdminRole = userData.user_roles?.some(
  (ur) => ADMIN_ROLES.some((ar) => ar.toLowerCase() === ur.role.name?.toLowerCase())
)

// 2. Se admin → todas as permissões = true (usa constante centralizada)
if (hasAdminRole) {
  ALL_PERMISSION_MODULES.forEach((module) => mergedPermissions[module] = true)
}

// 3. Senão → OR merge de todas as roles
else {
  userData.user_roles?.forEach((userRole) => {
    const permissions = userRole.role.permissions
    Object.keys(permissions).forEach((key) => {
      if (permissions[key] === true) {
        mergedPermissions[key] = true
      }
    })
  })
}

// 4. Usar primeiro role como base, substituir permissions pelas combinadas
const combinedRole = { ...baseRole, permissions: mergedPermissions }
```

### Notas Importantes

- O merge acontece **no cliente** — se uma role for alterada na BD, o utilizador precisa de recarregar a página
- O hook subscreve `onAuthStateChange` e re-fetcha quando o estado de auth muda
- Usa `ADMIN_ROLES` e `ALL_PERMISSION_MODULES` de `lib/auth/roles.ts` (fonte única de verdade)

---

## 7. Hook usePermissions

**Ficheiro:** `hooks/use-permissions.ts`

### API Disponível

```typescript
const {
  hasPermission,       // (module: PermissionModule) => boolean
  hasAnyPermission,    // (modules: PermissionModule[]) => boolean
  hasAllPermissions,   // (modules: PermissionModule[]) => boolean
  isBroker,            // () => boolean — verifica contra ADMIN_ROLES
  isTeamLeader,        // () => boolean
  loading,             // boolean
  permissions,         // Record<string, boolean>
} = usePermissions()
```

### Tipo PermissionModule

Derivado da constante centralizada `ALL_PERMISSION_MODULES`:

```typescript
import type { ALL_PERMISSION_MODULES } from '@/lib/auth/roles'
type PermissionModule = (typeof ALL_PERMISSION_MODULES)[number]
```

Os 22 módulos: `dashboard`, `properties`, `leads`, `processes`, `documents`, `consultants`, `owners`, `teams`, `commissions`, `marketing`, `templates`, `settings`, `goals`, `store`, `users`, `buyers`, `credit`, `calendar`, `pipeline`, `financial`, `integration`, `recruitment`

### Agrupamento dos Módulos

| Grupo | Módulos |
|-------|---------|
| **Core** | dashboard, properties, leads, owners, processes, documents |
| **Pessoas** | consultants, teams, users, buyers, recruitment |
| **Negócio** | pipeline, commissions, financial, goals, credit |
| **Sistema** | marketing, templates, calendar, store, integration, settings |

### Função isBroker()

Usa a constante centralizada `ADMIN_ROLES` para verificar se o utilizador é admin:

```typescript
import { ADMIN_ROLES } from '@/lib/auth/roles'

const isBroker = (): boolean => {
  return ADMIN_ROLES.some((r) => r.toLowerCase() === user?.role?.name?.toLowerCase())
}
```

### Exemplos de Uso

```tsx
// Verificar uma permissão
const { hasPermission } = usePermissions()
if (hasPermission('properties')) { /* mostrar secção */ }

// Verificar múltiplas (qualquer uma)
if (hasAnyPermission(['marketing', 'settings'])) { /* mostrar */ }

// Verificar todas
if (hasAllPermissions(['properties', 'leads'])) { /* mostrar */ }

// Verificar role específica (admin ou Broker/CEO)
if (isBroker()) { /* acções de admin */ }
```

---

## 8. Protecção do Frontend

### Sidebar — Filtragem de Menu

**Ficheiro:** `components/layout/app-sidebar.tsx`

O menu principal é filtrado com base nas permissões:

```typescript
const visibleMenuItems = menuItems.filter((item) =>
  hasPermission(item.permission as any)
)
```

**Menu Principal (10 itens):**

| Item | Permissão Requerida |
|------|---------------------|
| Dashboard | `dashboard` |
| Imóveis | `properties` |
| Leads | `leads` |
| Processos | `processes` |
| Documentos | `documents` |
| Proprietários | `owners` |
| Consultores | `consultants` |
| Equipas | `teams` |
| Comissões | `commissions` |
| Definições | `settings` |

**Secções Colapsáveis (condicionais):**

| Secção | Permissão Requerida | Sub-itens |
|--------|---------------------|-----------|
| Recrutamento | `recruitment` | Candidatos, Formulário |
| Marketing | `marketing` | Loja, Gestão, Redes Sociais |
| Meta & Instagram | `marketing` | Meta Ads, Instagram, Integrações Meta |
| Automações | `settings` | Dashboard, Fluxos, Execuções, WhatsApp |
| Builder | `settings` | Templates Email/Processos/Documentos/Variáveis |

### Verificação de Roles no Frontend (ADHOC_TASK_ROLES)

Dois componentes frontend verificam a role do utilizador para mostrar/esconder acções de tarefas ad-hoc:

- `app/dashboard/processos/[id]/page.tsx` — botão de criar/eliminar tarefas ad-hoc
- `components/processes/task-detail-actions.tsx` — acções de gestão de tarefas

```typescript
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'

const canDeleteAdhoc = !!user?.role?.name && ADHOC_TASK_ROLES.includes(user.role.name as any)
```

### Guard de Página — PermissionGuard + Layouts por Secção

**Ficheiro:** `components/shared/permission-guard.tsx`

Componente client que verifica se o utilizador tem permissão para o módulo. Se não tiver, redireciona para `/dashboard`. Mostra spinner de loading enquanto carrega permissões.

```typescript
'use client'
import { usePermissions } from '@/hooks/use-permissions'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function PermissionGuard({ module, children }: { module: PermissionModule; children: React.ReactNode }) {
  const { hasPermission, loading } = usePermissions()
  const router = useRouter()
  const allowed = hasPermission(module as any)

  useEffect(() => {
    if (!loading && !allowed) router.replace('/dashboard')
  }, [loading, allowed, router])

  if (loading) return <Spinner />
  if (!allowed) return null
  return <>{children}</>
}
```

**Cada secção do dashboard tem um layout dedicado** que envolve todas as sub-páginas com `PermissionGuard`:

```typescript
// Exemplo: app/dashboard/imoveis/layout.tsx
import { PermissionGuard } from '@/components/shared/permission-guard'

export default function ImoveisLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="properties">{children}</PermissionGuard>
}
```

**17 layouts criados:**

| Layout | Permissão | Páginas protegidas |
|--------|-----------|-------------------|
| `app/dashboard/imoveis/layout.tsx` | `properties` | listagem, novo, [id], editar |
| `app/dashboard/leads/layout.tsx` | `leads` | listagem, novo, [id], negócios |
| `app/dashboard/processos/layout.tsx` | `processes` | listagem, [id], templates/* |
| `app/dashboard/documentos/layout.tsx` | `documents` | listagem |
| `app/dashboard/consultores/layout.tsx` | `consultants` | listagem, novo, [id], editar |
| `app/dashboard/proprietarios/layout.tsx` | `owners` | listagem, [id] |
| `app/dashboard/equipas/layout.tsx` | `teams` | listagem |
| `app/dashboard/comissoes/layout.tsx` | `commissions` | listagem |
| `app/dashboard/definicoes/layout.tsx` | `settings` | listagem, integrações |
| `app/dashboard/marketing/layout.tsx` | `marketing` | todas as sub-páginas |
| `app/dashboard/recrutamento/layout.tsx` | `recruitment` | todas as sub-páginas |
| `app/dashboard/automacao/layout.tsx` | `settings` | todas as sub-páginas |
| `app/dashboard/templates-email/layout.tsx` | `settings` | listagem, novo, [id] |
| `app/dashboard/templates-documentos/layout.tsx` | `settings` | listagem, novo, [id] |
| `app/dashboard/templates-variaveis/layout.tsx` | `settings` | listagem |
| `app/dashboard/meta-ads/layout.tsx` | `marketing` | todas as sub-páginas |
| `app/dashboard/instagram/layout.tsx` | `marketing` | página |

**Páginas sem guard** (acessíveis a todos os utilizadores autenticados):
- `/dashboard` — permissão `dashboard` é geralmente `true` para todos
- `/dashboard/notificacoes` — todos os utilizadores recebem notificações

### Layout do Dashboard

**Ficheiro:** `app/dashboard/layout.tsx`

O layout raiz **não verifica permissões** — apenas renderiza o `<AppSidebar>` e o conteúdo. A protecção de autenticação é delegada ao middleware. A protecção de permissões é delegada aos **layouts de secção** acima.

---

## 9. Protecção do Backend (API Routes)

### Padrão Actual — Quatro Níveis de Protecção

#### Nível 1: Autenticação + Permissão por Módulo (maioria das routes)

Todas as API routes com lógica de negócio usam `requirePermission(module)`:

```typescript
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  const auth = await requirePermission('properties')
  if (!auth.authorized) return auth.response

  const supabase = await createClient()
  // auth.user.id disponível para queries
}
```

**Mapeamento API → Módulo de Permissão:**

| Módulo | API Routes |
|--------|-----------|
| `properties` | `/api/properties/*`, `/api/properties/[id]/media/*` |
| `leads` | `/api/leads/*`, `/api/negocios/*` (incluindo chat, fill-from-text, transcribe, summary, matches, interessados) |
| `consultants` | `/api/consultants/*`, `/api/consultants/[id]/photo` |
| `owners` | `/api/owners/*` |
| `documents` | `/api/documents/*`, `/api/owners/[id]/documents` |
| `processes` | `/api/processes/[id]` (GET/DELETE), `/api/processes/[id]/tasks/*`, `/api/acquisitions/*` |
| `settings` | `/api/templates/*`, `/api/libraries/*`, `/api/emails` |
| `recruitment` | `/api/form-templates/*` |

#### Nível 2: Autenticação + Verificação de Role (6 routes de acções de processo)

Usam o helper centralizado `requireRoles()` para acções administrativas específicas:

```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

export async function POST(request: Request, { params }) {
  const auth = await requireRoles(PROCESS_MANAGER_ROLES)
  if (!auth.authorized) return auth.response
  const user = auth.user
  // Apenas Broker/CEO, Gestor Processual, admin chegam aqui
}
```

**Routes com `requireRoles(PROCESS_MANAGER_ROLES)`:**

| Route | Acção |
|-------|-------|
| `POST /api/processes/[id]/approve` | Aprovar processo |
| `POST /api/processes/[id]/reject` | Rejeitar processo |
| `POST /api/processes/[id]/return` | Devolver processo |
| `POST /api/processes/[id]/hold` | Pausar/reactivar processo |
| `POST /api/processes/[id]/cancel` | Cancelar processo |
| `POST /api/processes/[id]/re-template` | Alterar template do processo |

#### Nível 3: Permissão por Módulo + Verificação de Role (routes de tarefas ad-hoc)

Estas routes usam **dois níveis de verificação**: primeiro `requirePermission('processes')` para garantir acesso ao módulo, depois `ADHOC_TASK_ROLES` para restringir quem pode criar/eliminar tarefas:

| Route | Acção | Verificações |
|-------|-------|-------------|
| `POST /api/processes/[id]/tasks` | Criar tarefa ad-hoc | `requirePermission('processes')` + `ADHOC_TASK_ROLES` |
| `DELETE /api/processes/[id]/tasks/[taskId]` | Eliminar tarefa ad-hoc | `requirePermission('processes')` + `ADHOC_TASK_ROLES` |
| `PUT /api/processes/[id]/tasks/[taskId]` | Reset de tarefa (case `reset`) | `requirePermission('processes')` + `ADHOC_TASK_ROLES` |
| `POST /api/processes/[id]/tasks/[taskId]/subtasks` | Criar subtarefa ad-hoc | `requirePermission('processes')` + `ADHOC_TASK_ROLES` |
| `DELETE /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]` | Eliminar subtarefa | `requirePermission('processes')` + `ADHOC_TASK_ROLES` |

#### Nível 4: Notificações por Role (4 routes)

Usam `APPROVER_NOTIFICATION_ROLES` para notificar gestores:

```typescript
import { APPROVER_NOTIFICATION_ROLES } from '@/lib/auth/roles'

const approverIds = await notificationService.getUserIdsByRoles([...APPROVER_NOTIFICATION_ROLES])
```

| Route | Evento |
|-------|--------|
| `POST /api/acquisitions` | Angariação criada |
| `POST /api/acquisitions/[id]/finalize` | Transição para pending_approval |
| `DELETE /api/processes/[id]` | Processo eliminado (soft delete) |
| `PUT /api/processes/[id]/tasks/[taskId]` (complete) | Tarefa concluída |

### O que é verificado (actualmente)

- ✅ Autenticação (utilizador tem sessão válida) — **todas as routes**
- ✅ Autorização por módulo — **~47 routes** via `requirePermission(module)`
- ✅ Autorização por role — **6 routes de acções de processo** via `requireRoles(PROCESS_MANAGER_ROLES)`
- ✅ Autorização dupla (módulo + role) — **5 routes de tarefas ad-hoc** via `requirePermission('processes')` + `ADHOC_TASK_ROLES`
- ✅ Notificações por role — **4 routes** via `APPROVER_NOTIFICATION_ROLES`

### O que NÃO é verificado

- ❌ Se o utilizador tem permissão para a acção (ex: criar vs. apenas ler) — todas as acções CRUD usam a mesma permissão de módulo
- ❌ Se o utilizador tem acesso ao recurso específico (ex: propriedades do seu consultor) — requer RLS

---

## 10. Mapeamento Completo — Módulos, Rotas e Permissões

### Mapa de Módulos → Rotas UI → API Routes → Permissão Frontend → Permissão Backend

| Módulo | Rota UI | API Routes | Guard Frontend | Permissão Backend |
|--------|---------|------------|----------------|-------------------|
| Dashboard | `/dashboard` | — | — (acessível a todos) | — |
| Imóveis | `/dashboard/imoveis/*` | `/api/properties/*` | ✅ `PermissionGuard('properties')` | ✅ `requirePermission('properties')` |
| Leads | `/dashboard/leads/*` | `/api/leads/*`, `/api/negocios/*` | ✅ `PermissionGuard('leads')` | ✅ `requirePermission('leads')` |
| Processos | `/dashboard/processos/*` | `/api/processes/*`, `/api/acquisitions/*` | ✅ `PermissionGuard('processes')` | ✅ `requirePermission('processes')` + `requireRoles()` (6 routes) |
| Documentos | `/dashboard/documentos` | `/api/documents/*` | ✅ `PermissionGuard('documents')` | ✅ `requirePermission('documents')` |
| Proprietários | `/dashboard/proprietarios` | `/api/owners/*` | ✅ `PermissionGuard('owners')` | ✅ `requirePermission('owners')` |
| Consultores | `/dashboard/consultores` | `/api/consultants/*` | ✅ `PermissionGuard('consultants')` | ✅ `requirePermission('consultants')` |
| Equipas | `/dashboard/equipas` | — | ✅ `PermissionGuard('teams')` | — |
| Comissões | `/dashboard/comissoes` | — | ✅ `PermissionGuard('commissions')` | — |
| Marketing | `/dashboard/marketing/*` | — | ✅ `PermissionGuard('marketing')` | — |
| Meta Ads | `/dashboard/meta-ads/*` | — | ✅ `PermissionGuard('marketing')` | — |
| Instagram | `/dashboard/instagram` | — | ✅ `PermissionGuard('marketing')` | — |
| Recrutamento | `/dashboard/recrutamento/*` | `/api/form-templates/*` | ✅ `PermissionGuard('recruitment')` | ✅ `requirePermission('recruitment')` |
| Automações | `/dashboard/automacao/*` | — | ✅ `PermissionGuard('settings')` | — |
| Builder | `/dashboard/templates-*` | `/api/templates/*`, `/api/libraries/*` | ✅ `PermissionGuard('settings')` | ✅ `requirePermission('settings')` |
| Definições | `/dashboard/definicoes/*` | — | ✅ `PermissionGuard('settings')` | — |

---

## 11. Fluxo Completo — Exemplo End-to-End

### Cenário: Utilizador "Maria" (role: Consultora Executiva) acede ao módulo Imóveis

```
1. Maria navega para /dashboard/imoveis
   │
   ├─ MIDDLEWARE (middleware.ts)
   │   ├─ Verifica: Maria está autenticada? ✅ Sim
   │   └─ Resultado: NextResponse.next() — permite acesso
   │
   ├─ LAYOUT (app/dashboard/layout.tsx)
   │   ├─ Renderiza <AppSidebar>
   │   │   ├─ useUser() → carrega dev_users + user_roles + roles
   │   │   ├─ usePermissions() → hasPermission('properties') → ✅ true
   │   │   └─ Menu "Imóveis" visível no sidebar
   │   └─ Renderiza {children}
   │
   ├─ LAYOUT SECÇÃO (app/dashboard/imoveis/layout.tsx)
   │   ├─ <PermissionGuard module="properties">
   │   │   ├─ usePermissions() → hasPermission('properties') → ✅ true
   │   │   └─ Renderiza {children}
   │
   ├─ PÁGINA (app/dashboard/imoveis/page.tsx)
   │   └─ Chama GET /api/properties
   │
   └─ API ROUTE (app/api/properties/route.ts)
       ├─ requirePermission('properties') → ✅ Maria tem permissão
       └─ Retorna propriedades
```

### Cenário: Gestor Processual aprova um processo

```
1. Gestor navega para /dashboard/processos/[id] e clica "Aprovar"
   │
   ├─ FRONTEND: ADHOC_TASK_ROLES.includes(user.role.name) → mostra botões de gestão
   │
   └─ API ROUTE (POST /api/processes/[id]/approve)
       ├─ requireRoles(PROCESS_MANAGER_ROLES)
       │   ├─ requireAuth() → ✅ Autenticado
       │   ├─ Carrega roles numa query
       │   └─ Verifica: role "Gestor Processual" ∈ PROCESS_MANAGER_ROLES → ✅
       └─ Prossegue com a aprovação
```

### Cenário Protegido: Utilizador "João" (role: Cliente, sem permissão `properties`)

```
1. João digita /dashboard/imoveis directamente no browser
   │
   ├─ MIDDLEWARE → ✅ João está autenticado, permite acesso
   │
   ├─ LAYOUT SECÇÃO (app/dashboard/imoveis/layout.tsx)
   │   ├─ <PermissionGuard module="properties">
   │   │   ├─ usePermissions() → hasPermission('properties') → ❌ false
   │   │   └─ router.replace('/dashboard') — REDIRECIONA para dashboard
   │
   ├─ SIDEBAR → Menu "Imóveis" NÃO aparece (hasPermission('properties') = false)
   │
   └─ Se João tentasse chamar a API directamente:
       └─ API ROUTE (GET /api/properties)
           ├─ requirePermission('properties') → ❌ 403 Forbidden
           └─ Retorna: { error: "Sem permissão para o módulo: properties" }

   RESULTADO: João é redirecionado para /dashboard. API retorna 403.
```

---

## 12. Lacunas Conhecidas e Recomendações

### Lacunas de Segurança

| # | Lacuna | Severidade | Estado | Descrição |
|---|--------|------------|--------|-----------|
| 1 | ~~Sem autorização na maioria das API routes~~ | ~~🔴 Alta~~ | ✅ Resolvida | Todas as API routes com lógica de negócio usam `requirePermission(module)`. |
| 2 | ~~Sem guards nas páginas~~ | ~~🔴 Alta~~ | ✅ Resolvida | 17 layouts por secção com `PermissionGuard` impedem acesso por URL directa. |
| 3 | **Sem RLS no Supabase** | 🟡 Média | Pendente | Sem isolamento de dados ao nível da base de dados |
| 4 | **Permissões em cache no cliente** | 🟡 Média | Pendente | Alterações de role requerem refresh do browser |
| 5 | **Type cast `as any` no sidebar** | 🟢 Baixa | Pendente | Perde type-safety na verificação de permissões |

### O que Já Foi Feito (Centralização de Permissões)

| # | Melhoria | Estado |
|---|----------|--------|
| C1 | Constantes de roles centralizadas em `lib/auth/roles.ts` | ✅ Concluído |
| C2 | Helper `requireAuth()`/`requireRoles()`/`requirePermission()` em `lib/auth/permissions.ts` | ✅ Concluído |
| C3 | 6 API routes de processos usam `requireRoles(PROCESS_MANAGER_ROLES)` | ✅ Concluído |
| C4 | 4 API routes de tarefas ad-hoc usam `ADHOC_TASK_ROLES` centralizado | ✅ Concluído |
| C5 | 4 callers de notificação usam `APPROVER_NOTIFICATION_ROLES` | ✅ Concluído |
| C6 | Hooks usam `ADMIN_ROLES` e `ALL_PERMISSION_MODULES` centralizados | ✅ Concluído |
| C7 | Bug fix: nome da role corrigido de `Gestora Processual` para `Gestor Processual` (conforme BD) | ✅ Concluído |
| C8 | Debug console.logs removidos de `hooks/use-user.ts` | ✅ Concluído |
| C9 | `requirePermission(module)` adicionado a ~47 API routes (properties, leads, negocios, consultants, owners, documents, processes, acquisitions, templates, libraries, emails, form-templates) | ✅ Concluído |
| C10 | `PermissionGuard` componente criado em `components/shared/permission-guard.tsx` | ✅ Concluído |
| C11 | 17 layouts por secção criados com `PermissionGuard` (imoveis, leads, processos, documentos, consultores, proprietarios, equipas, comissoes, definicoes, marketing, recrutamento, automacao, templates-email, templates-documentos, templates-variaveis, meta-ads, instagram) | ✅ Concluído |
| C12 | Routes de tarefas ad-hoc agora têm dupla verificação: `requirePermission('processes')` + `ADHOC_TASK_ROLES` | ✅ Concluído |

### Recomendações para Implementação Futura

#### R1 — RLS Policies no Supabase

```sql
-- Exemplo: consultores só vêem as suas propriedades
ALTER TABLE dev_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultors_view_own_properties"
  ON dev_properties FOR SELECT
  USING (
    consultant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'Broker/CEO' OR (r.permissions->>'properties')::boolean = true)
    )
  );
```

---

## Ficheiros Relevantes

| Ficheiro | Descrição |
|----------|-----------|
| `middleware.ts` | Middleware de autenticação Next.js |
| `lib/auth/roles.ts` | **Constantes centralizadas de roles** (ADMIN_ROLES, PROCESS_MANAGER_ROLES, ADHOC_TASK_ROLES, etc.) |
| `lib/auth/permissions.ts` | **Helper server-side** (requireAuth, requireRoles, requirePermission) — usado em ~47 API routes |
| `components/shared/permission-guard.tsx` | **Guard de página** — componente client que verifica permissão e redireciona |
| `app/dashboard/*/layout.tsx` | **17 layouts por secção** — envolvem páginas com PermissionGuard |
| `hooks/use-user.ts` | Hook para obter dados do utilizador + roles + permissões (usa ADMIN_ROLES, ALL_PERMISSION_MODULES) |
| `hooks/use-permissions.ts` | Hook para verificar permissões por módulo (usa ADMIN_ROLES, PermissionModule type) |
| `components/layout/app-sidebar.tsx` | Sidebar com filtragem de menu por permissões |
| `app/dashboard/layout.tsx` | Layout raiz do dashboard (autenticação via middleware, permissões delegadas a layouts de secção) |
| `lib/constants.ts` | Re-export de ADHOC_TASK_ROLES + constantes de status/labels |
| `lib/supabase/client.ts` | Cliente Supabase (browser) |
| `lib/supabase/server.ts` | Cliente Supabase (server components) |
| `lib/supabase/admin.ts` | Cliente Supabase (service role, bypass RLS) |
