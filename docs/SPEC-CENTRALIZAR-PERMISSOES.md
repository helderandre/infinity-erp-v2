# SPEC — Centralizar Verificações de Permissões

**Data:** 2026-03-12
**Objectivo:** Eliminar verificações de permissões hardcoded espalhadas pelo código e centralizar tudo num helper server-side reutilizável + constantes unificadas.

---

## Problema Actual

Existem **15+ locais** com verificações de role/permissão feitas de forma ad-hoc:
- 6 API routes de processos repetem o mesmo bloco de ~20 linhas (query `user_roles` + comparar contra array de strings)
- 4 API routes usam `ADHOC_TASK_ROLES` com query separada
- 3 locais usam `getUserIdsByRoles` com strings hardcoded
- 2 locais duplicam `CONSULTANT_ROLES`
- 2 componentes frontend fazem `user?.role?.name && ADHOC_TASK_ROLES.includes(...)`
- Nome inconsistente: `"Gestor Processual"` (constants.ts) vs `"Gestora Processual"` (API routes)

---

## Ficheiros a CRIAR

### 1. `lib/auth/permissions.ts` — Helper server-side centralizado

Cria um módulo com funções reutilizáveis para verificar autenticação + autorização em API routes.

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ROLE_GROUPS } from '@/lib/auth/roles'

// ─── Tipos ────────────────────────────────────────────────

export type PermissionModule =
  | 'dashboard' | 'properties' | 'leads' | 'processes'
  | 'documents' | 'consultants' | 'owners' | 'teams'
  | 'commissions' | 'marketing' | 'templates' | 'settings'
  | 'goals' | 'store' | 'users' | 'buyers'
  | 'credit' | 'calendar' | 'pipeline' | 'financial'
  | 'integration' | 'recruitment'

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

// ─── Funções Principais ───────────────────────────────────

/**
 * Verificar apenas autenticação (sem permissão granular).
 * Substitui o bloco repetido: supabase.auth.getUser() + if (!user) return 401
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    }
  }

  // Carregar roles + permissões numa única query
  const { data: devUser } = await supabase
    .from('dev_users')
    .select(`
      id,
      user_roles!user_roles_user_id_fkey!inner(
        role:roles(name, permissions)
      )
    `)
    .eq('id', user.id)
    .single()

  const userRoles = ((devUser as any)?.user_roles || [])
    .map((ur: any) => ur.role?.name)
    .filter(Boolean) as string[]

  // Merge de permissões (OR lógico)
  const isAdmin = userRoles.some((r) =>
    ['admin', 'Broker/CEO'].includes(r)
  )

  const mergedPermissions: Record<string, boolean> = {}
  if (isAdmin) {
    const allModules: PermissionModule[] = [
      'dashboard', 'properties', 'leads', 'processes', 'documents',
      'consultants', 'owners', 'teams', 'commissions', 'marketing',
      'templates', 'settings', 'goals', 'store', 'users', 'buyers',
      'credit', 'calendar', 'pipeline', 'financial', 'integration', 'recruitment',
    ]
    allModules.forEach((m) => { mergedPermissions[m] = true })
  } else {
    ;((devUser as any)?.user_roles || []).forEach((ur: any) => {
      const perms = ur.role?.permissions as Record<string, boolean> | undefined
      if (perms) {
        Object.entries(perms).forEach(([k, v]) => {
          if (v === true) mergedPermissions[k] = true
        })
      }
    })
  }

  return {
    authorized: true,
    user: { id: user.id, email: user.email },
    roles: userRoles,
    permissions: mergedPermissions,
  }
}

/**
 * Verificar autenticação + permissão por módulo.
 * Retorna 401 se não autenticado, 403 se sem permissão.
 */
export async function requirePermission(
  module: PermissionModule
): Promise<AuthResult | AuthError> {
  const auth = await requireAuth()
  if (!auth.authorized) return auth

  if (!auth.permissions[module]) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `Sem permissão para o módulo: ${module}` },
        { status: 403 }
      ),
    }
  }

  return auth
}

/**
 * Verificar autenticação + se o utilizador tem uma das roles indicadas.
 * Para acções específicas que dependem de role (approve, reject, adhoc tasks, etc.).
 */
export async function requireRoles(
  allowedRoles: readonly string[]
): Promise<AuthResult | AuthError> {
  const auth = await requireAuth()
  if (!auth.authorized) return auth

  // Admin/Broker tem sempre acesso
  const isAdmin = auth.roles.some((r) =>
    ['admin', 'Broker/CEO'].includes(r)
  )

  if (!isAdmin && !auth.roles.some((r) => allowedRoles.includes(r))) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Sem permissão para esta acção' },
        { status: 403 }
      ),
    }
  }

  return auth
}
```

---

### 2. `lib/auth/roles.ts` — Constantes centralizadas de roles

Centraliza todos os arrays de roles que hoje estão espalhados pelo código.

```typescript
/**
 * Fonte única de verdade para agrupamentos de roles.
 * Qualquer ficheiro que precise verificar roles por nome deve importar daqui.
 */

/** Roles com acesso total (superadmin) */
export const ADMIN_ROLES = ['admin', 'Broker/CEO'] as const

/** Roles que podem aprovar/rejeitar/pausar/cancelar/devolver processos */
export const PROCESS_MANAGER_ROLES = ['Broker/CEO', 'Gestora Processual', 'admin'] as const

/** Roles que podem criar/remover tarefas ad-hoc e reverter tarefas concluídas */
export const ADHOC_TASK_ROLES = ['admin', 'Broker/CEO', 'Gestora Processual'] as const

/** Roles consideradas "consultores" (não back-office/admin) */
export const CONSULTANT_ROLES = ['Consultor', 'Consultora Executiva', 'Team Leader'] as const

/** Roles que recebem notificações de aprovação/gestão */
export const APPROVER_NOTIFICATION_ROLES = ['Broker/CEO', 'Gestora Processual'] as const

/** Todos os agrupamentos disponíveis (para referência) */
export const ROLE_GROUPS = {
  admin: ADMIN_ROLES,
  processManager: PROCESS_MANAGER_ROLES,
  adhocTask: ADHOC_TASK_ROLES,
  consultant: CONSULTANT_ROLES,
  approverNotification: APPROVER_NOTIFICATION_ROLES,
} as const
```

**Nota:** O valor actual em `lib/constants.ts` é `'Gestor Processual'` (masculino), mas todas as API routes usam `'Gestora Processual'` (feminino). Confirmar com o banco de dados qual é o correcto e usar esse. A spec assume `'Gestora Processual'` pois é o que está na BD (usado em 6 API routes).

---

## Ficheiros a MODIFICAR

### 3. `lib/constants.ts`

**O que fazer:** Remover `ADHOC_TASK_ROLES` deste ficheiro (passa para `lib/auth/roles.ts`). Adicionar re-export para manter retrocompatibilidade temporária.

**Linha 444 — substituir:**
```typescript
// ANTES:
export const ADHOC_TASK_ROLES = ['admin', 'Broker/CEO', 'Gestor Processual'] as const

// DEPOIS:
// Re-export de lib/auth/roles.ts (fonte única de verdade)
export { ADHOC_TASK_ROLES } from '@/lib/auth/roles'
```

---

### 4. `app/api/processes/[id]/approve/route.ts`

**O que fazer:** Substituir o bloco de autenticação + query de roles (linhas 22-66) por uma chamada a `requireRoles(PROCESS_MANAGER_ROLES)`.

**Substituir linhas 22-66 por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

// Dentro do POST handler, substituir todo o bloco auth+roles por:
const auth = await requireRoles(PROCESS_MANAGER_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

**Remover:** Os imports e variáveis que ficam sem uso (`devUser`, `userRoles`, `canApprove`). Remover os `console.log` de debug de auth (linhas 33, 49, 54, 61).

---

### 5. `app/api/processes/[id]/reject/route.ts`

**O que fazer:** Substituir bloco de auth + roles (linhas 19-53) por `requireRoles(PROCESS_MANAGER_ROLES)`.

**Substituir linhas 19-53 por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const auth = await requireRoles(PROCESS_MANAGER_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

---

### 6. `app/api/processes/[id]/return/route.ts`

**O que fazer:** Substituir bloco de auth + roles (linhas 19-53) por `requireRoles(PROCESS_MANAGER_ROLES)`.

**Substituir linhas 19-53 por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const auth = await requireRoles(PROCESS_MANAGER_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

---

### 7. `app/api/processes/[id]/hold/route.ts`

**O que fazer:** Substituir bloco de auth + roles (linhas 19-51) por `requireRoles(PROCESS_MANAGER_ROLES)`.

**Substituir linhas 19-51 por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const auth = await requireRoles(PROCESS_MANAGER_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

---

### 8. `app/api/processes/[id]/cancel/route.ts`

**O que fazer:** Substituir bloco de auth + roles (linhas 18-50) por `requireRoles(PROCESS_MANAGER_ROLES)`.

**Substituir linhas 18-50 por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const auth = await requireRoles(PROCESS_MANAGER_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

---

### 9. `app/api/processes/[id]/re-template/route.ts`

**O que fazer:** Substituir bloco de auth + roles (linhas 22-58) por `requireRoles(PROCESS_MANAGER_ROLES)`.

**Substituir linhas 22-58 por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const auth = await requireRoles(PROCESS_MANAGER_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

---

### 10. `app/api/processes/[id]/tasks/route.ts`

**O que fazer:** Substituir bloco de auth + query de role (linhas 58-83) por `requireRoles(ADHOC_TASK_ROLES)`.

**Substituir linhas 57-83 por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'

// 1. Autenticar + verificar role
const auth = await requireRoles(ADHOC_TASK_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

**Nota:** Este handler também faz `.select('id, commercial_name')` do `dev_users` (linha 64-68) para usar o nome noutro ponto. Manter essa query separada apenas para buscar `commercial_name`, mas remover a parte de verificação de role que agora é feita pelo helper.

```typescript
// Buscar nome comercial (necessário para logging)
const supabase = await createClient()
const { data: devUser } = await supabase
  .from('dev_users')
  .select('id, commercial_name')
  .eq('id', auth.user.id)
  .single()
```

**Remover:** O import de `ADHOC_TASK_ROLES` de `@/lib/constants` (linha 6). Usar o de `@/lib/auth/roles`.

---

### 11. `app/api/processes/[id]/tasks/[taskId]/route.ts`

**O que fazer:** Este ficheiro tem **dois blocos** de verificação de role:
- Linhas 150-162 (reverter tarefa completada — check inline com `ADHOC_TASK_ROLES`)
- Linhas 447-466 (DELETE — remover tarefa ad-hoc)

**Para o DELETE (linhas 443-466):** Substituir pela chamada ao helper no início do handler DELETE:
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'

// No handler DELETE:
const auth = await requireRoles(ADHOC_TASK_ROLES)
if (!auth.authorized) return auth.response
```

**Para o check inline (linhas 148-162):** Este está dentro de um `switch case` no PUT handler. Extrair para uma função auxiliar local ou usar `requireRoles` com a instância de supabase já criada. Abordagem recomendada — criar helper local:

```typescript
// No topo do PUT handler, após o requireAuth:
const auth = await requireAuth()
if (!auth.authorized) return auth.response

// Dentro do case 'reset', linhas 148-162 — substituir por:
if (task.status === 'completed') {
  const isAdhocRole = auth.roles.some((r) => ADHOC_TASK_ROLES.includes(r))
  if (!isAdhocRole) {
    return NextResponse.json(
      { error: 'Sem permissão para reverter tarefas concluídas' },
      { status: 403 }
    )
  }
}
```

**Remover:** O import de `ADHOC_TASK_ROLES` de `@/lib/constants` (linha 8). Usar o de `@/lib/auth/roles`.

---

### 12. `app/api/processes/[id]/tasks/[taskId]/subtasks/route.ts`

**O que fazer:** Substituir bloco de auth + role check (linhas 44-69) por `requireRoles(ADHOC_TASK_ROLES)`.

**Substituir linhas 43-69 por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'

const auth = await requireRoles(ADHOC_TASK_ROLES)
if (!auth.authorized) return auth.response
const user = auth.user
```

**Nota:** Manter query de `dev_users` para `commercial_name` se usado abaixo. Remover import de `ADHOC_TASK_ROLES` de `@/lib/constants`.

---

### 13. `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

**O que fazer:** Substituir bloco de auth + role check (linhas ~498-514) no DELETE handler por `requireRoles(ADHOC_TASK_ROLES)`.

**Substituir por:**
```typescript
import { requireRoles } from '@/lib/auth/permissions'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'

const auth = await requireRoles(ADHOC_TASK_ROLES)
if (!auth.authorized) return auth.response
```

**Remover:** Import de `ADHOC_TASK_ROLES` de `@/lib/constants`.

---

### 14. `app/api/consultants/route.ts`

**O que fazer:** Substituir `CONSULTANT_ROLES` local (linha 51) por import centralizado.

**Linha 51 — substituir:**
```typescript
// ANTES:
const CONSULTANT_ROLES = ['Consultor', 'Consultora Executiva', 'Team Leader']

// DEPOIS:
import { CONSULTANT_ROLES } from '@/lib/auth/roles'
// (remover a declaração local, manter a lógica de filtro igual)
```

---

### 15. `app/dashboard/consultores/page.tsx`

**O que fazer:** Substituir `CONSULTANT_ROLES` local (linha 112) por import centralizado.

**Linha 112 — substituir:**
```typescript
// ANTES:
const CONSULTANT_ROLES = ['Consultor', 'Consultora Executiva', 'Team Leader']

// DEPOIS (no topo do ficheiro):
import { CONSULTANT_ROLES } from '@/lib/auth/roles'
// (remover a declaração local dentro do useCallback)
```

---

### 16. `app/dashboard/processos/[id]/page.tsx`

**O que fazer:** Substituir import de `ADHOC_TASK_ROLES` de `@/lib/constants` por `@/lib/auth/roles`.

**Linha 86 — substituir:**
```typescript
// ANTES:
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, ADHOC_TASK_ROLES } from '@/lib/constants'

// DEPOIS:
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/constants'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'
```

A lógica nas linhas 320 e 969 (`ADHOC_TASK_ROLES.includes(user.role.name as any)`) **mantém-se igual** — o componente continua a usar o array, apenas muda a origem do import.

---

### 17. `components/processes/task-detail-actions.tsx`

**O que fazer:** Substituir import de `ADHOC_TASK_ROLES` de `@/lib/constants` por `@/lib/auth/roles`.

**Linha 65 — substituir:**
```typescript
// ANTES:
import { EMAIL_STATUS_CONFIG, ADHOC_TASK_ROLES } from '@/lib/constants'

// DEPOIS:
import { EMAIL_STATUS_CONFIG } from '@/lib/constants'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'
```

A lógica na linha 103 mantém-se igual.

---

### 18. `lib/notifications/service.ts`

**O que fazer:** O método `getUserIdsByRoles` (linhas 68-85) mantém-se no serviço de notificações — é uma query de lookup, não uma verificação de permissão. **Não alterar.** Mas os chamadores devem usar as constantes centralizadas.

---

### 19. `app/api/acquisitions/route.ts`

**O que fazer:** Substituir string hardcoded por constante centralizada.

**Linha 276 — substituir:**
```typescript
// ANTES:
const approverIds = await notificationService.getUserIdsByRoles(['Broker/CEO', 'Gestora Processual'])

// DEPOIS:
import { APPROVER_NOTIFICATION_ROLES } from '@/lib/auth/roles'
const approverIds = await notificationService.getUserIdsByRoles([...APPROVER_NOTIFICATION_ROLES])
```

---

### 20. `app/api/acquisitions/[id]/finalize/route.ts`

**O que fazer:** Substituir string hardcoded por constante centralizada.

**Linha 101 — substituir:**
```typescript
// ANTES:
const approverIds = await notificationService.getUserIdsByRoles(['Broker/CEO', 'Gestora Processual'])

// DEPOIS:
import { APPROVER_NOTIFICATION_ROLES } from '@/lib/auth/roles'
const approverIds = await notificationService.getUserIdsByRoles([...APPROVER_NOTIFICATION_ROLES])
```

---

### 21. `app/api/processes/[id]/tasks/[taskId]/route.ts` (notificações)

**O que fazer:** Substituir string hardcoded na chamada de notificação.

**Linha 308 — substituir:**
```typescript
// ANTES:
const gestoraIds = await notificationService.getUserIdsByRoles(['Gestora Processual'])

// DEPOIS:
import { APPROVER_NOTIFICATION_ROLES } from '@/lib/auth/roles'
const gestoraIds = await notificationService.getUserIdsByRoles([...APPROVER_NOTIFICATION_ROLES])
```

**Nota:** Se a intenção é notificar apenas a Gestora (e não o Broker), criar uma constante separada `GESTORA_NOTIFICATION_ROLES = ['Gestora Processual'] as const` em `lib/auth/roles.ts`.

---

### 22. `app/api/processes/[id]/route.ts` (notificações)

**O que fazer:** Substituir string hardcoded na chamada de notificação.

**Linha 103-106 — substituir:**
```typescript
// ANTES:
const managerIds = await notificationService.getUserIdsByRoles([
  'Broker/CEO',
  'Gestora Processual',
])

// DEPOIS:
import { APPROVER_NOTIFICATION_ROLES } from '@/lib/auth/roles'
const managerIds = await notificationService.getUserIdsByRoles([...APPROVER_NOTIFICATION_ROLES])
```

---

### 23. `hooks/use-user.ts`

**O que fazer:** Substituir arrays hardcoded de admin roles e módulos por imports centralizados.

**Linhas 80-84 — substituir:**
```typescript
// ANTES:
const hasAdminRole = userData.user_roles?.some(
  (ur) =>
    ur.role.name?.toLowerCase() === 'admin' ||
    ur.role.name?.toLowerCase() === 'broker/ceo'
)

// DEPOIS:
import { ADMIN_ROLES } from '@/lib/auth/roles'

const hasAdminRole = userData.user_roles?.some(
  (ur) => ADMIN_ROLES.some((ar) => ar.toLowerCase() === ur.role.name?.toLowerCase())
)
```

**Linhas 91-114 — substituir o array inline de módulos:**
```typescript
// ANTES:
const allModules = [
  'dashboard', 'properties', 'leads', /* ... 21 itens */ 'recruitment',
]

// DEPOIS:
import { ALL_PERMISSION_MODULES } from '@/lib/auth/roles'
// (adicionar esta constante ao lib/auth/roles.ts — ver abaixo)
ALL_PERMISSION_MODULES.forEach((module) => {
  mergedPermissions[module] = true
})
```

**Adicionar ao `lib/auth/roles.ts`:**
```typescript
/** Lista completa de todos os módulos de permissão */
export const ALL_PERMISSION_MODULES = [
  'dashboard', 'properties', 'leads', 'processes', 'documents',
  'consultants', 'owners', 'teams', 'commissions', 'marketing',
  'templates', 'settings', 'goals', 'store', 'users', 'buyers',
  'credit', 'calendar', 'pipeline', 'financial', 'integration', 'recruitment',
] as const
```

**Remover:** Os `console.log` de debug (linhas 76-77, 154-155).

---

### 24. `hooks/use-permissions.ts`

**O que fazer:** Substituir o type `PermissionModule` local pelo import centralizado + usar `ADMIN_ROLES` para `isBroker()`.

```typescript
// ANTES:
type PermissionModule =
  | 'dashboard' | 'properties' | /* ... */ | 'recruitment'

// DEPOIS:
import type { PermissionModule } from '@/lib/auth/permissions'

// isBroker() — substituir:
// ANTES:
const isBroker = (): boolean => {
  return user?.role?.name?.toLowerCase() === 'broker/ceo'
}

// DEPOIS:
import { ADMIN_ROLES } from '@/lib/auth/roles'

const isBroker = (): boolean => {
  return ADMIN_ROLES.some((r) => r.toLowerCase() === user?.role?.name?.toLowerCase())
}
```

---

## Resumo de Impacto

| Acção | Ficheiros |
|-------|-----------|
| **Criar** | `lib/auth/permissions.ts`, `lib/auth/roles.ts` |
| **Modificar (API routes — auth+roles)** | 6 routes de processos (approve, reject, return, hold, cancel, re-template) |
| **Modificar (API routes — adhoc)** | 4 routes (tasks, tasks/[taskId], subtasks, subtasks/[subtaskId]) |
| **Modificar (API routes — notificações)** | 4 routes (acquisitions, acquisitions/finalize, processes/[id], tasks/[taskId]) |
| **Modificar (API routes — consultants)** | 1 route (consultants) |
| **Modificar (Frontend — imports)** | 4 ficheiros (processos page, consultores page, task-detail-actions, constants.ts) |
| **Modificar (Hooks)** | 2 ficheiros (use-user.ts, use-permissions.ts) |
| **Total** | 2 criados + 21 modificados |

---

## Ordem de Implementação

1. **Criar `lib/auth/roles.ts`** — constantes centralizadas (sem dependências)
2. **Criar `lib/auth/permissions.ts`** — helper server-side (depende de roles.ts)
3. **Modificar `lib/constants.ts`** — re-export de ADHOC_TASK_ROLES
4. **Modificar os 6 API routes de processos** (approve, reject, return, hold, cancel, re-template) — maior redução de código
5. **Modificar os 4 API routes de adhoc tasks** (tasks, taskId, subtasks, subtaskId)
6. **Modificar os 4 chamadores de notificação** — apenas trocar strings por constantes
7. **Modificar `app/api/consultants/route.ts`** — trocar CONSULTANT_ROLES local
8. **Modificar hooks** (use-user.ts, use-permissions.ts) — usar imports centralizados
9. **Modificar componentes frontend** — trocar origens de import
10. **Verificar build** — `npm run build` para confirmar que não há erros

---

## Correcção de Bug: Nome Inconsistente

Verificar na base de dados o nome exacto da role:

```sql
SELECT name FROM roles WHERE name ILIKE '%gestor%';
```

- Se retornar `Gestora Processual` → corrigir `lib/constants.ts` linha 444 (`Gestor` → `Gestora`)
- Se retornar `Gestor Processual` → corrigir as 6 API routes de processos (`Gestora` → `Gestor`)

A constante centralizada `PROCESS_MANAGER_ROLES` em `lib/auth/roles.ts` resolve isto de uma vez — só precisamos acertar num único local.
