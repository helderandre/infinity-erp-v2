# PRD — M06: Gestao de Processos (Instancias)

**Data:** 2026-02-20
**Modulo:** M06 — Processos (Instancias)
**Dependencias:** M07 (Templates) ja implementado, Angariacao (formulario) ja implementado

---

## 1. Resumo Executivo

O M06 e o modulo de **execucao de processos** — onde templates do M07 ganham vida como instancias associadas a imoveis reais. O ciclo completo: consultor submete angariacao -> processo criado automaticamente -> responsavel revisa/aprova/rejeita -> tarefas executadas progressivamente -> processo concluido -> imovel publicado.

**Estado actual:** O M06 ja tem implementacao parcial funcional. A listagem, detalhe, stepper, review, task management e APIs ja existem. Esta PRD documenta o que existe, o que precisa ser melhorado e os padroes a seguir.

---

## 2. Ficheiros Existentes na Base de Codigo

### 2.1 Paginas (Frontend)

| Ficheiro | Linhas | Estado | Funcao |
|----------|--------|--------|--------|
| `app/dashboard/processos/page.tsx` | 181 | Funcional | Listagem de processos com search, cards, progress bar |
| `app/dashboard/processos/[id]/page.tsx` | 251 | Funcional | Detalhe do processo com stepper, review, tarefas |

### 2.2 Componentes

| Ficheiro | Linhas | Estado | Funcao |
|----------|--------|--------|--------|
| `components/processes/process-stepper.tsx` | 77 | Funcional | Stepper horizontal com fases, cores por status, contagem de tarefas |
| `components/processes/process-review-section.tsx` | 226 | Funcional | Secao de revisao com aprovar/devolver/rejeitar + dialogs |
| `components/processes/process-tasks-section.tsx` | 281 | Funcional | Listagem de tarefas por fase com acoes (iniciar/concluir/dispensar/reactivar) |

### 2.3 API Route Handlers

| Ficheiro | Metodo | Estado | Funcao |
|----------|--------|--------|--------|
| `app/api/processes/route.ts` | GET | Funcional | Lista processos com search e filtro por status |
| `app/api/processes/[id]/route.ts` | GET | Funcional | Detalhe completo: instance + stages + owners + documents |
| `app/api/processes/[id]/approve/route.ts` | PUT | Funcional | Aprovar processo (pending_approval/returned -> active) |
| `app/api/processes/[id]/return/route.ts` | PUT | Funcional | Devolver processo com motivo (pending_approval -> returned) |
| `app/api/processes/[id]/reject/route.ts` | PUT | Funcional | Rejeitar processo com motivo (pending_approval -> rejected) |
| `app/api/processes/[id]/tasks/[taskId]/route.ts` | PUT | Funcional | Accoes sobre tarefas: start/complete/bypass/assign/reset |

### 2.4 Engine e Tipos

| Ficheiro | Estado | Funcao |
|----------|--------|--------|
| `lib/process-engine.ts` | Funcional | autoCompleteTasks() + recalculateProgress() |
| `types/process.ts` | Funcional | ProcessInstance, ProcessTask, ProcessStageWithTasks, ProcessDetail |
| `lib/constants.ts` | Funcional | PROCESS_STATUS, TASK_STATUS, ACTION_TYPES |
| `components/shared/status-badge.tsx` | Funcional | Badge reutilizavel com cores por tipo (process/task/property) |

### 2.5 Ficheiros Relacionados (M07 Templates)

| Ficheiro | Estado | Funcao |
|----------|--------|--------|
| `app/api/templates/route.ts` | Funcional | GET (listar) + POST (criar) templates |
| `app/api/templates/[id]/route.ts` | Funcional | GET + PUT + DELETE (soft) templates |
| `app/api/templates/active/route.ts` | Funcional | GET template activo (para instanciacao) |
| `components/templates/template-builder.tsx` | Funcional | Builder visual com DnD Kit |
| `lib/validations/template.ts` | Funcional | Zod schemas para template/stage/task |

### 2.6 Ficheiros Relacionados (Angariacao)

| Ficheiro | Estado | Funcao |
|----------|--------|--------|
| `app/api/acquisitions/route.ts` | Funcional | POST: cria property + owners + proc_instance |
| `components/acquisitions/acquisition-form.tsx` | Funcional | Formulario multi-step 5 passos |
| `lib/validations/acquisition.ts` | Funcional | Zod schema completo |

---

## 3. Schema da Base de Dados (Estado Real)

### 3.1 proc_instances — Colunas Reais

```sql
id                  uuid        NOT NULL  DEFAULT gen_random_uuid()
property_id         uuid        NOT NULL
tpl_process_id      uuid        YES
external_ref        text        YES       -- Gerado por trigger: PROC-YYYY-XXXX
current_status      text        YES       DEFAULT 'draft'
current_stage_id    uuid        YES       -- FK -> tpl_stages
percent_complete    integer     YES       DEFAULT 0
started_at          timestamptz YES       DEFAULT now()
completed_at        timestamptz YES
updated_at          timestamptz YES       DEFAULT now()
requested_by        uuid        YES       -- FK -> dev_users
approved_by         uuid        YES       -- FK -> dev_users
approved_at         timestamptz YES
returned_at         timestamptz YES
returned_reason     text        YES
rejected_at         timestamptz YES
rejected_reason     text        YES
notes               text        YES
```

**Foreign Keys:**
- `property_id` -> `dev_properties.id`
- `tpl_process_id` -> `tpl_processes.id`
- `current_stage_id` -> `tpl_stages.id`
- `requested_by` -> `dev_users.id`
- `approved_by` -> `dev_users.id`

### 3.2 proc_tasks — Colunas Reais

```sql
id                  uuid        NOT NULL  DEFAULT gen_random_uuid()
proc_instance_id    uuid        NOT NULL  -- FK -> proc_instances
tpl_task_id         uuid        YES       -- FK -> tpl_tasks
title               text        NOT NULL
status              text        YES       DEFAULT 'pending'
is_mandatory        boolean     YES       DEFAULT true
is_bypassed         boolean     YES       DEFAULT false
bypass_reason       text        YES
bypassed_by         uuid        YES       -- FK -> dev_users
assigned_to         uuid        YES       -- FK -> dev_users
due_date            timestamptz YES
completed_at        timestamptz YES
task_result         jsonb       YES       DEFAULT '{}'
stage_name          text        YES
stage_order_index   integer     YES
action_type         text        YES       -- UPLOAD | EMAIL | GENERATE_DOC | MANUAL
config              jsonb       YES       DEFAULT '{}'
assigned_role       text        YES       -- Processual | Consultor | Broker/CEO
```

### 3.3 Triggers Activos

**trg_generate_proc_ref** (INSERT em proc_instances):
```sql
-- Gera referencia PROC-YYYY-XXXX usando sequencia proc_ref_seq_global
-- Apenas se external_ref IS NULL
NEW.external_ref := 'PROC-' || year_text || '-' || LPAD(seq_val::text, 4, '0');
```

**populate_process_tasks** (funcao callable, NAO trigger):
```sql
-- Deve ser chamada explicitamente: SELECT populate_process_tasks(proc_instance_id)
-- Copia tarefas do template, incluindo: title, action_type, config,
-- is_mandatory, assigned_role, due_date (calculado via sla_days),
-- stage_name, stage_order_index
```

**IMPORTANTE:** O trigger `trg_populate_tasks` NAO esta instalado. A funcao `populate_process_tasks(p_instance_id)` deve ser chamada via RPC apos criar a instancia.

### 3.4 RLS Policies

**Nenhuma policy RLS** existe em `proc_instances` ou `proc_tasks`. Se RLS estiver habilitado, isto bloqueia todo o acesso. A API usa `createClient()` (com cookies, respeita RLS) para queries normais e `createAdminClient()` (service role) no process-engine.

### 3.5 Dados Existentes

| Tabela | Registos |
|--------|----------|
| proc_instances | 1 (status: pending_approval) |
| proc_tasks | 2 |
| tpl_processes | 3 (2 activos, 1 inactivo) |
| tpl_stages | 10 |
| tpl_tasks | 31 |

**Template Principal:** "Captacao da Angariacao" — 6 fases, ~28 tarefas (UPLOAD + MANUAL).

---

## 4. Fluxo de Status do Processo

```
                              ┌──────────────────┐
                              │ pending_approval  │ <── Criado pela angariacao
                              └───────┬──────────┘
                                      │
                         ┌────────────┼────────────┐
                         │            │            │
                    ┌────▼────┐  ┌────▼────┐  ┌───▼────┐
                    │ active  │  │returned │  │rejected│
                    └────┬────┘  └────┬────┘  └────────┘
                         │            │
                    ┌────▼────┐       │ (corrigir e re-submeter)
                    │on_hold  │       └───► pending_approval
                    └────┬────┘
                         │
                    ┌────▼─────┐
                    │completed │ <── percent_complete = 100%
                    └──────────┘
```

### Transicoes de Status de Tarefas

```
pending ──► in_progress ──► completed
   │
   ├──► completed (directo)
   │
   └──► skipped (bypass com motivo, apenas nao-obrigatorias)
           │
           └──► pending (reset/reactivar)
```

---

## 5. Codigo Existente — Snippets Chave

### 5.1 Padrao de API Route Handler (GET com auth + filtros)

```typescript
// app/api/processes/route.ts — padrao a seguir
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    let query = supabase
      .from('proc_instances')
      .select(`
        id, external_ref, current_status, percent_complete,
        started_at, updated_at, requested_by, approved_at, notes,
        dev_properties ( id, title, city, zone, business_type, listing_price, property_type, status ),
        tpl_processes ( id, name )
      `)
      .order('updated_at', { ascending: false, nullsFirst: false })

    if (status) query = query.eq('current_status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filtro server-side para search
    let results = data || []
    if (search) {
      const term = search.toLowerCase()
      results = results.filter((p: any) =>
        p.external_ref?.toLowerCase().includes(term) ||
        p.dev_properties?.title?.toLowerCase().includes(term) ||
        p.dev_properties?.city?.toLowerCase().includes(term)
      )
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

### 5.2 Padrao de Detalhe com Relacoes Agrupadas

```typescript
// app/api/processes/[id]/route.ts — padrao de agrupamento
// 1. Fetch instancia com joins
const { data } = await supabase
  .from('proc_instances')
  .select(`
    *,
    property:dev_properties(id, title, slug, city, listing_price, status, property_type),
    requested_by_user:dev_users!proc_instances_requested_by_fkey(id, commercial_name),
    approved_by_user:dev_users!proc_instances_approved_by_fkey(id, commercial_name)
  `)
  .eq('id', id)
  .single()

// 2. Fetch tarefas separadamente
const { data: tasks } = await supabase
  .from('proc_tasks')
  .select(`*, assigned_to_user:dev_users(id, commercial_name)`)
  .eq('proc_instance_id', id)
  .order('stage_order_index', { ascending: true })
  .order('order_index', { ascending: true })

// 3. Agrupar por fase em JavaScript
const stagesMap = new Map<string, any>()
tasks?.forEach((task) => {
  const stageName = task.stage_name || 'Sem Fase'
  if (!stagesMap.has(stageName)) {
    stagesMap.set(stageName, {
      name: stageName,
      order_index: task.stage_order_index || 0,
      tasks: [], tasks_completed: 0, tasks_total: 0,
    })
  }
  const stage = stagesMap.get(stageName)!
  stage.tasks.push(task)
  stage.tasks_total += 1
  if (task.status === 'completed' || task.status === 'skipped') {
    stage.tasks_completed += 1
  }
})

// 4. Calcular status de cada fase
const stages = Array.from(stagesMap.values()).map((stage) => ({
  ...stage,
  status: stage.tasks_completed === stage.tasks_total ? 'completed'
    : stage.tasks_completed > 0 ? 'in_progress' : 'pending'
}))

// 5. Retornar resposta estruturada
return NextResponse.json({
  instance: data,
  stages: stages.sort((a, b) => a.order_index - b.order_index),
  owners: [...],
  documents: [...],
})
```

### 5.3 Padrao de Verificacao de Permissoes (Approve)

```typescript
// app/api/processes/[id]/approve/route.ts
// Verifica roles especificas para accoes criticas
const { data: devUser } = await supabase
  .from('dev_users')
  .select(`
    *,
    user_roles!user_roles_user_id_fkey!inner(
      role:roles(name, permissions)
    )
  `)
  .eq('id', user.id)
  .single()

const roleName = (devUser as any)?.user_roles?.[0]?.role?.name
const canApprove = ['Broker/CEO', 'Gestora Processual'].includes(roleName)
if (!canApprove) {
  return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
}
```

### 5.4 Padrao de Task Action (Switch/Case)

```typescript
// app/api/processes/[id]/tasks/[taskId]/route.ts
const taskUpdateSchema = z.object({
  action: z.enum(['complete', 'bypass', 'assign', 'start', 'reset']),
  bypass_reason: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  task_result: z.record(z.string(), z.any()).optional(),
})

switch (action) {
  case 'start':
    // pending -> in_progress, assign to current user
    updateData.status = 'in_progress'
    updateData.assigned_to = user.id
    break
  case 'complete':
    // pending/in_progress -> completed
    updateData.status = 'completed'
    updateData.completed_at = new Date().toISOString()
    break
  case 'bypass':
    // -> skipped, requer motivo min. 10 chars
    updateData.status = 'skipped'
    updateData.is_bypassed = true
    updateData.bypass_reason = bypass_reason
    updateData.bypassed_by = user.id
    break
  case 'reset':
    // skipped -> pending, limpa bypass fields
    updateData.status = 'pending'
    updateData.is_bypassed = false
    updateData.bypass_reason = null
    break
}

// Apos complete/bypass/reset, recalcular progresso
if (['complete', 'bypass', 'reset'].includes(action)) {
  await recalculateProgress(id)
}
```

### 5.5 Process Engine — Auto-Complete

```typescript
// lib/process-engine.ts
export async function autoCompleteTasks(procInstanceId: string, propertyId: string) {
  // 1. Buscar tarefas UPLOAD pendentes
  // 2. Buscar documentos do imovel (doc_registry where property_id = X)
  // 3. Buscar documentos dos owners (doc_registry where owner_id IN (...) AND property_id IS NULL)
  // 4. Para cada tarefa: se doc_type_id da config bate com um documento valido -> completar
  // task_result = { doc_registry_id, auto_completed: true, source: 'acquisition_form' | 'owner_existing_document' }
}

export async function recalculateProgress(procInstanceId: string) {
  // completed = tasks where status='completed' OR is_bypassed=true
  // percent = (completed / total) * 100
  // Se 100% -> marcar processo como 'completed'
}
```

### 5.6 Padrao de Componente de Listagem (Client Component)

```tsx
// app/dashboard/processos/page.tsx — padrao existente
'use client'
export default function ProcessosPage() {
  const [processes, setProcesses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const loadProcesses = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/processes?${params.toString()}`)
      const data = await res.json()
      setProcesses(data)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { loadProcesses() }, [loadProcesses])

  // Render: header + search + skeleton/empty/cards
}
```

### 5.7 Padrao ProcessStepper (Server Component puro)

```tsx
// components/processes/process-stepper.tsx
// - Nav com aria-label="Progresso"
// - ol flex horizontal
// - Cada fase: circulo (verde check / azul numero / cinza numero) + nome + contagem
// - Linha de conexao entre fases (verde se completa, cinza se nao)
// - Props: { stages: ProcessStageWithTasks[], className?: string }
```

### 5.8 Padrao ProcessTasksSection (Client Component com Dialog)

```tsx
// components/processes/process-tasks-section.tsx
// - Tarefas agrupadas por fase (Card por fase)
// - Cada tarefa: icone status + icone action_type + titulo + badge obrigatoria + status badge
// - DropdownMenu com accoes contextuais
// - Dialog de bypass com textarea e validacao min. 10 chars
// - Toast notifications para todas as accoes
// - Callback onTaskUpdate para refetch do processo
```

---

## 6. Tipos TypeScript Existentes

```typescript
// types/process.ts
export interface ProcessInstance extends ProcInstance {
  property?: Pick<DevProperty, 'id' | 'title' | 'slug' | 'city' | 'listing_price' | 'status' | 'property_type'>
  requested_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  approved_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
}

export interface ProcessTask extends ProcTask {
  assigned_to_user?: Pick<DevUser, 'id' | 'commercial_name'>
}

export interface ProcessStageWithTasks {
  name: string
  order_index: number
  status: 'completed' | 'in_progress' | 'pending'
  tasks_completed: number
  tasks_total: number
  tasks: ProcessTask[]
}

export interface ProcessDetail {
  instance: ProcessInstance
  stages: ProcessStageWithTasks[] | null
  owners: Array<{ id: string; name: string; nif: string | null; person_type: string; existing_documents: any[] }>
  documents: Array<{ id: string; doc_type: { name: string; category: string }; file_name: string; file_url: string; status: string }>
}

export type ProcessStatus = 'pending_approval' | 'returned' | 'active' | 'on_hold' | 'completed' | 'rejected' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type TaskAction = 'complete' | 'bypass' | 'assign' | 'start' | 'reset'
```

---

## 7. Constantes PT-PT Existentes

```typescript
// lib/constants.ts (relevante para M06)
export const PROCESS_STATUS = {
  pending_approval: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Pendente Aprovacao' },
  returned:         { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Devolvido' },
  active:           { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Em Andamento' },
  on_hold:          { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-500', label: 'Pausado' },
  completed:        { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Concluido' },
  rejected:         { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Rejeitado' },
  cancelled:        { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Cancelado' },
}

export const TASK_STATUS = {
  pending:     { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-400', label: 'Pendente' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Em Progresso' },
  completed:   { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Concluida' },
  skipped:     { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Dispensada' },
}

export const ACTION_TYPES = {
  UPLOAD:       'Upload de Documento',
  EMAIL:        'Envio de Email',
  GENERATE_DOC: 'Gerar Documento',
  MANUAL:       'Tarefa Manual',
}
```

---

## 8. Gaps Identificados e Melhorias Necessarias

### 8.1 Funcionalidades em Falta

| # | Funcionalidade | Prioridade | Descricao |
|---|---------------|------------|-----------|
| 1 | **Filtros por status na listagem** | Alta | Dropdown ou tabs para filtrar por status (pending_approval, active, completed, etc.) |
| 2 | **Pausa/Reactivacao de processo** | Alta | Botoes on_hold <-> active na pagina de detalhe |
| 3 | **Atribuicao de tarefas a utilizadores** | Alta | Select de utilizador no dropdown de tarefa (accao 'assign') |
| 4 | **Consultor que submeteu** | Media | Mostrar nome do consultor na listagem e no detalhe |
| 5 | **Barra de progresso geral no detalhe** | Media | Progress bar visivel no topo do detalhe (ja existe no listing mas nao no detalhe) |
| 6 | **Visualizacao de documentos anexados** | Media | Na secao de tarefas UPLOAD, mostrar link para documento se task_result tem doc_registry_id |
| 7 | **Historico/timeline de accoes** | Baixa | Log de quem fez o que e quando (log_audit) |
| 8 | **Notificacoes em tempo real** | Baixa | Supabase Realtime para actualizacoes live |

### 8.2 Problemas Tecnicos

| # | Problema | Impacto | Solucao |
|---|---------|---------|---------|
| 1 | **Sem RLS policies** em proc_instances/proc_tasks | Seguranca | Criar policies ou confirmar que RLS esta desactivado |
| 2 | **Tipos `any`** extensivos nos componentes | Manutenibilidade | Usar ProcessDetail, ProcessInstance, ProcessTask dos types |
| 3 | **Falta coluna `order_index`** em proc_tasks | Ordenacao dentro de fase | Verificar se existe — se nao, adicionar migration |
| 4 | **`returned_by` nao existe** como coluna | Rastreabilidade | Existe `returned_at` e `returned_reason` mas nao `returned_by` |
| 5 | **`rejected_by` nao existe** como coluna | Rastreabilidade | Existe `rejected_at` e `rejected_reason` mas nao `rejected_by` |

---

## 9. Padroes Externos Relevantes

### 9.1 Stepper Horizontal (shadcn/ui custom)

Nao existe componente stepper oficial no shadcn/ui. O padrao actual no projecto (process-stepper.tsx) e o correcto: custom com CVA + Tailwind. Manter o padrao existente.

**Referencia externa (se necessario expandir):**
```tsx
// Padrao com CVA para variantes
const stepVariants = cva(
  'flex items-center justify-center rounded-full border-2 transition-all duration-300',
  {
    variants: {
      status: {
        completed: 'border-emerald-500 bg-emerald-500 text-white',
        active: 'border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-500/20',
        inactive: 'border-slate-300 bg-white text-slate-400',
      },
      size: { sm: 'h-6 w-6 text-xs', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' },
    },
    defaultVariants: { status: 'inactive', size: 'md' },
  }
)
```

### 9.2 Supabase Realtime (para futuro)

Se quisermos actualizacoes em tempo real na pagina de detalhe:

```typescript
// hooks/use-process-realtime.ts
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useProcessRealtime(
  processId: string,
  onUpdate: () => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`process-${processId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'proc_tasks',
        filter: `proc_instance_id=eq.${processId}`,
      }, () => onUpdate())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'proc_instances',
        filter: `id=eq.${processId}`,
      }, () => onUpdate())
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [processId])
}
```

**Pre-requisito SQL (para receber old values):**
```sql
ALTER TABLE proc_tasks REPLICA IDENTITY FULL;
ALTER TABLE proc_instances REPLICA IDENTITY FULL;
```

### 9.3 Server Actions vs Route Handlers

O projecto usa Route Handlers para tudo. Manter consistencia:
- **Route Handlers (GET):** Listagens e detalhes (cacheavel, reutilizavel)
- **Route Handlers (PUT/POST):** Mutacoes (approve, reject, task update)
- **Server Actions:** NAO usar por agora — manter consistencia com o resto do projecto

### 9.4 DnD Kit (ja instalado no projecto via M07)

```bash
# Ja instalados para o template-builder:
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Se futuramente quisermos reordenar tarefas ou drag-and-drop na vista Kanban, as dependencias ja existem.

---

## 10. Componentes shadcn/ui Utilizados

Componentes ja instalados e usados no M06:

| Componente | Uso no M06 |
|-----------|------------|
| `Card` | Cards de processo, fases, info do imovel |
| `Button` | Todas as accoes (aprovar, devolver, rejeitar, etc.) |
| `Badge` | Contagem de tarefas, status |
| `Dialog` | Dialogs de bypass, devolucao, rejeicao |
| `DropdownMenu` | Menu de accoes por tarefa |
| `Input` | Campo de pesquisa |
| `Textarea` | Motivo de devolucao/rejeicao/bypass |
| `Skeleton` | Loading states |
| `Alert` | Aviso de processo devolvido |
| `Separator` | Divisores visuais |

**Nao instalados (podem ser necessarios):**
| Componente | Possivel Uso |
|-----------|-------------|
| `Select` | Filtro por status, atribuicao de utilizador |
| `Tabs` | Alternar entre vistas (lista vs kanban) |
| `Progress` | Barra de progresso no detalhe |
| `Tooltip` | Info adicional em icones |
| `Sheet` | Painel lateral para detalhe de tarefa |

---

## 11. Decisoes Arquitecturais

### O que o M06 FAZ:
- Listar processos existentes com search e filtros
- Mostrar detalhe completo de um processo (stepper + info + review + tarefas)
- Aprovar/Devolver/Rejeitar processos pendentes
- Gerir tarefas individuais (iniciar/concluir/dispensar/reactivar/atribuir)
- Recalcular progresso automaticamente
- Auto-completar tarefas UPLOAD com documentos existentes

### O que o M06 NAO FAZ:
- Formulario de Nova Angariacao (e um bloco independente, ja implementado)
- Criacao/edicao de templates (M07, ja implementado)
- Upload de ficheiros ao R2 (o M06 apenas consome, upload e via API separada)
- Criar instancias manualmente (criadas automaticamente pela angariacao)

### Padrao de Data Fetching:
- Client component com `useState` + `useEffect` + `fetch()`
- Callback `loadProcess()` para refetch apos accoes
- `useDebounce` para search (300ms)
- Skeleton durante loading, EmptyState quando vazio

### Padrao de Error Handling:
- `try/catch` em todos os handlers e fetches
- `toast.error()` para erros no frontend
- `toast.success()` para confirmacao de accoes
- Redirect para listagem se processo nao encontrado

---

## 12. Tabelas Relacionadas (Leitura Apenas)

O M06 lê mas nao escreve nestas tabelas:

| Tabela | Relacao | Dados Lidos |
|--------|---------|-------------|
| `dev_properties` | FK via property_id | title, city, listing_price, status, property_type |
| `dev_users` | FK via requested_by, approved_by, assigned_to | commercial_name |
| `owners` | Via property_owners junction | name, nif, person_type |
| `property_owners` | Junction M:N | ownership_percentage, is_main_contact |
| `doc_registry` | Via property_id | file_name, file_url, status, doc_type |
| `doc_types` | Via doc_type_id | name, category |
| `tpl_processes` | FK via tpl_process_id | name |
| `tpl_stages` | Via template | name, order_index |

O M06 escreve em:
| Tabela | Operacoes |
|--------|-----------|
| `proc_instances` | UPDATE (status, approved_by, returned_reason, etc.) |
| `proc_tasks` | UPDATE (status, completed_at, bypass fields, assigned_to) |

---

## 13. Resumo de Accoes Necessarias

### Fase A — Correcoes e Estabilizacao
1. Verificar/criar RLS policies ou confirmar RLS desactivado
2. Adicionar coluna `returned_by` e `rejected_by` a proc_instances (se necessario)
3. Verificar existencia de `order_index` em proc_tasks para ordenacao correcta
4. Substituir tipos `any` por tipos concretos nos componentes existentes

### Fase B — Funcionalidades Core em Falta
5. Adicionar filtros por status na listagem (Select/Tabs)
6. Implementar pausa/reactivacao de processo (on_hold <-> active)
7. Implementar atribuicao de tarefas a utilizadores especificos
8. Adicionar barra de progresso geral na pagina de detalhe
9. Mostrar nome do consultor (requested_by_user) na listagem

### Fase C — Melhorias de UX
10. Mostrar documentos linkados em tarefas UPLOAD completadas
11. Melhorar responsividade do stepper em mobile
12. Adicionar animacoes de transicao (fade-in nos cards)
13. Adicionar confirmacao (AlertDialog) antes de rejeitar processo

### Fase D — Funcionalidades Avancadas (futuro)
14. Supabase Realtime para actualizacoes live
15. Timeline/historico de accoes
16. Notificacoes push para tarefas atribuidas
17. Vista Kanban alternativa para processos

---

## 14. Fontes e Referencias

### Documentacao Oficial
- [Supabase Postgres Changes (Realtime)](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [DnD Kit Multi-Container](https://docs.dndkit.com/presets/sortable/multiple-containers)

### Padroes e Exemplos
- [Makerkit Stepper Component (Next.js + Supabase)](https://makerkit.dev/docs/next-supabase-turbo/components/stepper)
- [shadcn-next-workflows (React Flow)](https://github.com/nobruf/shadcn-next-workflows)
- [Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers)
- [Flowbite Tailwind CSS Stepper](https://flowbite.com/docs/components/stepper/)
- [react-dnd-kit-tailwind-shadcn-ui](https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui)
