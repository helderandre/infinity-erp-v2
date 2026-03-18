# SPEC — Integração Calendário ↔ Processos (Tarefas & Subtarefas)

**Data:** 2026-03-16
**Estado:** Draft
**Prioridade:** Alta

---

## 1. Objectivo

Mostrar no calendário as **tarefas (`proc_tasks`)** e **subtarefas (`proc_subtasks`)** que tenham `due_date` definido, para que os utilizadores atribuídos possam visualizar os seus prazos e aceder rapidamente ao processo correspondente.

**Regra fundamental:** Processos com `current_status = 'deleted'` ou `deleted_at IS NOT NULL` **não geram eventos** no calendário. Processos com `current_status = 'cancelled'` ou `'rejected'` também são excluídos.

---

## 2. Arquitectura Actual (Resumo)

### 2.1 Calendário

- **Tabela:** `temp_calendar_events` (eventos manuais)
- **Fontes automáticas existentes:** `contract_expiry` (de `dev_property_internal`), `lead_expiry` (de `leads`)
- **API:** `GET /api/calendar/events` — agrega 3 fontes, suporta filtros por `categories`, `user_id`, intervalo de datas
- **Types:** `CalendarEvent` com campos `category`, `source`, `process_id`, `user_id`, etc.
- **Componentes:** 9 componentes (month grid, week view, event card, detail sheet, form, filters, sidebar, toolbar)

### 2.2 Processos

- **Tabelas:** `proc_instances` (processo), `proc_tasks` (tarefas), `proc_subtasks` (subtarefas)
- **Campos relevantes nas tarefas:**
  - `due_date` (timestamptz) — data de vencimento
  - `assigned_to` (uuid) — utilizador atribuído
  - `assigned_role` (text) — role atribuído (fallback)
  - `status` ('pending' | 'in_progress' | 'completed' | 'skipped')
  - `priority` ('urgent' | 'normal' | 'low')
  - `stage_name`, `stage_order_index` — fase do processo
  - `title` — nome da tarefa
- **Campos relevantes nas subtarefas:**
  - `due_date`, `assigned_to`, `assigned_role`, `priority`
  - `is_completed`, `is_mandatory`, `is_blocked`
  - `title`, `config.type` ('upload' | 'email' | 'checklist' | 'form' | 'field' | 'generate_doc')
  - `owner_id` — proprietário associado

---

## 3. Solução Proposta

### 3.1 Nova Fonte no GET `/api/calendar/events`

Adicionar uma **4ª fonte** à API de calendário que busca tarefas e subtarefas com `due_date` de processos activos.

```
Fontes actuais:
  1. temp_calendar_events (manuais)
  2. dev_property_internal.contract_expiry (auto)
  3. leads.expires_at (auto)

Nova fonte:
  4. proc_tasks + proc_subtasks com due_date (auto)
```

### 3.2 Novas Categorias

| Categoria | Label PT-PT | Cor (Tailwind) | Descrição |
|-----------|-------------|----------------|-----------|
| `process_task` | Tarefa de Processo | `violet` | Tarefa com due_date |
| `process_subtask` | Subtarefa de Processo | `fuchsia` | Subtarefa com due_date |

### 3.3 Filtros de Status

**Processos elegíveis** (JOIN com `proc_instances`):
```sql
proc_instances.current_status IN ('active', 'on_hold')
AND proc_instances.deleted_at IS NULL
```

**Tarefas/Subtarefas elegíveis:**
```sql
-- Tarefas:
proc_tasks.due_date IS NOT NULL
AND proc_tasks.status NOT IN ('completed', 'skipped')

-- Subtarefas:
proc_subtasks.due_date IS NOT NULL
AND proc_subtasks.is_completed = false
```

> **Nota:** Tarefas/subtarefas já concluídas ou dispensadas NÃO aparecem no calendário (não faz sentido mostrar prazos cumpridos).

---

## 4. Alterações Backend

### 4.1 API — `GET /api/calendar/events/route.ts`

Adicionar query paralela às existentes:

```typescript
// --- FONTE 4: Tarefas e subtarefas de processos ---
const fetchProcessTasks = async () => {
  // 4a. Tarefas com due_date
  const { data: tasks } = await supabase
    .from('proc_tasks')
    .select(`
      id,
      title,
      due_date,
      status,
      priority,
      assigned_to,
      stage_name,
      proc_instance_id,
      proc_instances!inner (
        id,
        external_ref,
        current_status,
        deleted_at,
        property_id,
        dev_properties ( id, title, slug )
      ),
      dev_users!proc_tasks_assigned_to_fkey ( id, commercial_name )
    `)
    .not('due_date', 'is', null)
    .not('status', 'in', '("completed","skipped")')
    .is('proc_instances.deleted_at', null)
    .in('proc_instances.current_status', ['active', 'on_hold'])
    .gte('due_date', start)
    .lte('due_date', end)

  // 4b. Subtarefas com due_date
  const { data: subtasks } = await supabase
    .from('proc_subtasks')
    .select(`
      id,
      title,
      due_date,
      is_completed,
      priority,
      assigned_to,
      owner_id,
      config,
      proc_task_id,
      proc_tasks!inner (
        id,
        title,
        stage_name,
        proc_instance_id,
        proc_instances!inner (
          id,
          external_ref,
          current_status,
          deleted_at,
          property_id,
          dev_properties ( id, title, slug )
        )
      ),
      dev_users!proc_subtasks_assigned_to_fkey ( id, commercial_name ),
      owners ( id, name )
    `)
    .not('due_date', 'is', null)
    .eq('is_completed', false)
    .is('proc_tasks.proc_instances.deleted_at', null)
    .in('proc_tasks.proc_instances.current_status', ['active', 'on_hold'])
    .gte('due_date', start)
    .lte('due_date', end)

  return { tasks: tasks || [], subtasks: subtasks || [] }
}
```

**Mapeamento para `CalendarEvent`:**

```typescript
// Tarefa → CalendarEvent
function mapTaskToCalendarEvent(task: ProcTaskRow): CalendarEvent {
  const proc = task.proc_instances
  const property = proc.dev_properties
  const assignee = task.dev_users
  const now = new Date().toISOString()

  return {
    id: `proc_task:${task.id}`,
    title: task.title,
    description: `${proc.external_ref} · ${task.stage_name}${property ? ` · ${property.title}` : ''}`,
    category: 'process_task',
    start_date: task.due_date,
    end_date: null,
    all_day: true,           // Prazos são por dia
    color: 'violet-500',
    source: 'auto',
    is_recurring: false,
    is_overdue: task.due_date < now,
    status: task.status,
    user_id: assignee?.id || null,
    user_name: assignee?.commercial_name || null,
    property_id: property?.id || null,
    property_title: property?.title || null,
    // Campos extra para navegação
    process_id: proc.id,
    process_ref: proc.external_ref,
    task_id: task.id,
    priority: task.priority,
  }
}

// Subtarefa → CalendarEvent
function mapSubtaskToCalendarEvent(subtask: ProcSubtaskRow): CalendarEvent {
  const task = subtask.proc_tasks
  const proc = task.proc_instances
  const property = proc.dev_properties
  const assignee = subtask.dev_users
  const owner = subtask.owners
  const now = new Date().toISOString()

  return {
    id: `proc_subtask:${subtask.id}`,
    title: `${subtask.title}${owner ? ` (${owner.name})` : ''}`,
    description: `${proc.external_ref} · ${task.stage_name} · ${task.title}${property ? ` · ${property.title}` : ''}`,
    category: 'process_subtask',
    start_date: subtask.due_date,
    end_date: null,
    all_day: true,
    color: 'fuchsia-500',
    source: 'auto',
    is_recurring: false,
    is_overdue: subtask.due_date < now,
    user_id: assignee?.id || null,
    user_name: assignee?.commercial_name || null,
    property_id: property?.id || null,
    property_title: property?.title || null,
    process_id: proc.id,
    process_ref: proc.external_ref,
    task_id: task.id,
    subtask_id: subtask.id,
    priority: subtask.priority,
  }
}
```

### 4.2 Filtro por `user_id`

O filtro existente `user_id` já é aplicado após a agregação. Para tarefas/subtarefas, comparar contra `assigned_to`:

```typescript
if (userId) {
  processEvents = processEvents.filter(e => e.user_id === userId)
}
```

### 4.3 Filtro por `categories`

Adicionar `process_task` e `process_subtask` ao array de categorias filtráveis. Se o utilizador não seleccionou estas categorias, os eventos de processo são excluídos do resultado.

---

## 5. Alterações Frontend

### 5.1 Types — `types/calendar.ts`

```typescript
// Adicionar às categorias existentes
export type CalendarCategory =
  | 'contract_expiry'
  | 'lead_expiry'
  | 'lead_followup'
  | 'birthday'
  | 'vacation'
  | 'company_event'
  | 'marketing_event'
  | 'meeting'
  | 'reminder'
  | 'custom'
  | 'process_task'       // ← NOVO
  | 'process_subtask'    // ← NOVO

// Adicionar ao mapa de cores
export const CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, {...}> = {
  // ... existentes ...
  process_task: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-600',
    dot: 'bg-violet-500',
  },
  process_subtask: {
    bg: 'bg-fuchsia-500/15',
    text: 'text-fuchsia-600',
    dot: 'bg-fuchsia-500',
  },
}

// Adicionar labels
export const CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string> = {
  // ... existentes ...
  process_task: 'Tarefa de Processo',
  process_subtask: 'Subtarefa de Processo',
}

// Campos adicionais no CalendarEvent
export interface CalendarEvent {
  // ... existentes ...
  process_id?: string
  process_ref?: string        // ex: "ANG-2026-0042"
  task_id?: string
  subtask_id?: string
  priority?: 'urgent' | 'normal' | 'low'
}
```

### 5.2 Constantes — `lib/constants.ts`

Adicionar ao `CALENDAR_CATEGORY_OPTIONS`:

```typescript
export const CALENDAR_CATEGORY_OPTIONS = [
  // ... existentes ...
  { value: 'process_task', label: 'Tarefa de Processo' },
  { value: 'process_subtask', label: 'Subtarefa de Processo' },
]
```

### 5.3 Filtros — `components/calendar/calendar-filters.tsx`

Adicionar um novo grupo "Processos" no painel de filtros:

```tsx
{/* Grupo: Processos */}
<div>
  <p className="text-xs font-medium text-muted-foreground mb-2">Processos</p>
  {(['process_task', 'process_subtask'] as const).map(cat => (
    <FilterCheckbox key={cat} category={cat} ... />
  ))}
</div>
```

### 5.4 Role Presets — `types/calendar.ts`

Adicionar `process_task` e `process_subtask` aos presets relevantes:

```typescript
export const CALENDAR_ROLE_PRESETS = {
  broker_ceo: [...existing, 'process_task', 'process_subtask'],
  gestora_processual: [...existing, 'process_task', 'process_subtask'],
  consultor: [...existing, 'process_task', 'process_subtask'],
  consultora_executiva: [...existing, 'process_task', 'process_subtask'],
  team_leader: [...existing, 'process_task', 'process_subtask'],
  // recrutador e marketing: NÃO incluir (não interagem com processos)
}
```

### 5.5 Event Card — `components/calendar/calendar-event-card.tsx`

Adicionar indicador de prioridade para eventos de processo:

```tsx
{/* Indicador de prioridade */}
{event.priority === 'urgent' && (
  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />
)}
```

### 5.6 Event Detail Sheet — `components/calendar/calendar-event-detail.tsx`

Este é o componente principal a alterar. Quando o evento é de processo (`process_task` ou `process_subtask`), o sheet deve mostrar:

```
┌─────────────────────────────────────────┐
│  [Violet/Fuchsia Banner]                │
│  Título da Tarefa/Subtarefa             │
│  Badge: "Tarefa de Processo"            │
│  Badge: Prioridade (Urgente/Normal/Baixa│
├─────────────────────────────────────────┤
│  ⏰ Data de Vencimento                  │
│     15 de Março de 2026                 │
│     ⚠️ "Atrasado" (se is_overdue)      │
├─────────────────────────────────────────┤
│  📋 Processo                            │
│     ANG-2026-0042                       │
│     Fase: Colecta de Documentos         │
│     [Botão: Abrir Processo →]           │
├─────────────────────────────────────────┤
│  🏠 Imóvel (se property_id)            │
│     T3 em Cascais - Rua da Paz          │
│     [Botão: Abrir Imóvel →]             │
├─────────────────────────────────────────┤
│  👤 Atribuído a                         │
│     João Silva                          │
├─────────────────────────────────────────┤
│  📝 Descrição                           │
│     ANG-2026-0042 · Colecta Docs · T3.. │
├─────────────────────────────────────────┤
│  [Botão: Abrir Processo] [Fechar]       │
└─────────────────────────────────────────┘
```

**Implementação:**

```tsx
// Dentro do CalendarEventDetail, adicionar secção para processos:
const isProcessEvent = event.category === 'process_task' || event.category === 'process_subtask'

{isProcessEvent && (
  <>
    {/* Prioridade */}
    {event.priority && (
      <Badge variant={
        event.priority === 'urgent' ? 'destructive' :
        event.priority === 'low' ? 'secondary' : 'outline'
      }>
        {event.priority === 'urgent' ? 'Urgente' :
         event.priority === 'low' ? 'Baixa' : 'Normal'}
      </Badge>
    )}

    {/* Secção Processo */}
    <div className="space-y-1">
      <p className="text-sm font-medium">Processo</p>
      <p className="text-sm text-muted-foreground">{event.process_ref}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(`/dashboard/processos/${event.process_id}`)}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Abrir Processo
      </Button>
    </div>

    {/* Subtarefa: mostrar tarefa pai */}
    {event.category === 'process_subtask' && event.task_id && (
      <div className="space-y-1">
        <p className="text-sm font-medium">Tarefa</p>
        <p className="text-sm text-muted-foreground">
          {/* Extraído da description */}
        </p>
      </div>
    )}
  </>
)}
```

**Botão de atalho (footer):**

```tsx
{isProcessEvent && event.process_id && (
  <Button
    onClick={() => router.push(`/dashboard/processos/${event.process_id}`)}
    className="w-full"
  >
    <ClipboardList className="h-4 w-4 mr-2" />
    Abrir Processo
  </Button>
)}
```

---

## 6. Fluxo de Dados Completo

```
GET /api/calendar/events?start=...&end=...&categories=...,process_task,process_subtask&user_id=...
  │
  ├── [1] Buscar temp_calendar_events (manuais)
  ├── [2] Buscar contract_expiry (auto)
  ├── [3] Buscar lead_expiry (auto)
  └── [4] Buscar proc_tasks + proc_subtasks (NOVO)
        │
        ├── proc_tasks com due_date + JOIN proc_instances (status ≠ deleted/cancelled/rejected)
        ├── proc_subtasks com due_date + JOIN proc_tasks → proc_instances (mesmos filtros)
        │
        ├── Mapear para CalendarEvent com category = 'process_task' ou 'process_subtask'
        ├── Marcar is_overdue se due_date < now
        └── Filtrar por user_id (assigned_to) se fornecido
  │
  ▼ Agregar tudo, ordenar por start_date, retornar
  │
  ▼ Frontend recebe eventos
  │
  ├── CalendarMonthGrid / CalendarWeekView renderizam event cards
  │     └── Violet (tarefa) ou Fuchsia (subtarefa) + dot de prioridade
  │
  └── Ao clicar → CalendarEventDetail (Sheet)
        ├── Mostra título, data, prioridade, processo, imóvel, atribuição
        └── Botão "Abrir Processo" → navega para /dashboard/processos/[id]
```

---

## 7. Casos de Uso

### 7.1 Gestora Processual

A Maria (Gestora Processual) abre o calendário e vê:
- 3 tarefas com prazo esta semana (violet)
- 2 subtarefas de upload com prazo amanhã (fuchsia, com dot vermelho = urgente)
- 1 tarefa atrasada (ícone ⚠️)

Clica na tarefa atrasada → Sheet abre com:
- "Recolher Certidão Predial"
- Processo: ANG-2026-0042
- Imóvel: T3 em Cascais
- **Botão "Abrir Processo"** → navega para detalhe

### 7.2 Consultor

O João (Consultor) activa "Apenas os meus" no filtro e vê só as tarefas/subtarefas atribuídas a ele. Desactiva "Subtarefa de Processo" nos filtros para ver apenas tarefas.

### 7.3 Processo Eliminado

O processo ANG-2026-0039 é soft-deleted (`deleted_at = '2026-03-15'`). As suas 8 tarefas e 22 subtarefas **desaparecem imediatamente** do calendário (filtrado via `deleted_at IS NULL` na query).

---

## 8. Checklist de Implementação

### Backend

- [ ] **`app/api/calendar/events/route.ts`** — Adicionar 4ª fonte (proc_tasks + proc_subtasks)
  - [ ] Query proc_tasks com due_date + JOIN proc_instances (filtros de status)
  - [ ] Query proc_subtasks com due_date + JOIN proc_tasks → proc_instances
  - [ ] Funções `mapTaskToCalendarEvent()` e `mapSubtaskToCalendarEvent()`
  - [ ] Integrar nos filtros de `categories` e `user_id`
  - [ ] Garantir que `deleted_at IS NULL` é aplicado

### Frontend — Types & Constants

- [ ] **`types/calendar.ts`** — Adicionar `process_task`, `process_subtask` ao tipo `CalendarCategory`
- [ ] **`types/calendar.ts`** — Adicionar cores violet/fuchsia ao `CALENDAR_CATEGORY_COLORS`
- [ ] **`types/calendar.ts`** — Adicionar labels ao `CALENDAR_CATEGORY_LABELS`
- [ ] **`types/calendar.ts`** — Adicionar campos `process_id`, `process_ref`, `task_id`, `subtask_id`, `priority` ao `CalendarEvent`
- [ ] **`types/calendar.ts`** — Actualizar `CALENDAR_ROLE_PRESETS` para incluir novas categorias
- [ ] **`lib/constants.ts`** — Adicionar ao `CALENDAR_CATEGORY_OPTIONS`

### Frontend — Componentes

- [ ] **`calendar-filters.tsx`** — Novo grupo "Processos" com checkboxes para as 2 categorias
- [ ] **`calendar-event-card.tsx`** — Indicador visual de prioridade (dot) para eventos de processo
- [ ] **`calendar-event-detail.tsx`** — Secção de processo no sheet (ref, fase, botão "Abrir Processo")
  - [ ] Badge de prioridade (Urgente/Normal/Baixa)
  - [ ] Link para o processo (`/dashboard/processos/[process_id]`)
  - [ ] Link para o imóvel (se existir)
  - [ ] Info da tarefa pai (para subtarefas)
- [ ] **`calendar-event-detail.tsx`** — Botão principal "Abrir Processo" no footer

### Testes Manuais

- [ ] Verificar que processos `deleted` não aparecem no calendário
- [ ] Verificar que processos `cancelled` e `rejected` não aparecem
- [ ] Verificar que tarefas `completed` e `skipped` não aparecem
- [ ] Verificar que subtarefas `is_completed = true` não aparecem
- [ ] Verificar filtro "Apenas os meus" filtra por `assigned_to`
- [ ] Verificar toggle de categorias (ligar/desligar process_task e process_subtask)
- [ ] Verificar `is_overdue` com cor/ícone correcto
- [ ] Verificar navegação "Abrir Processo" funciona
- [ ] Verificar que processos `on_hold` continuam visíveis (prazos mantêm-se)

---

## 9. Notas de Implementação

### 9.1 Performance

As queries de proc_tasks e proc_subtasks usam `!inner` JOIN para filtrar na base de dados (não no cliente). Com índices existentes em `due_date` e `proc_instance_id`, a performance deve ser aceitável para volumes actuais (~159 tarefas, ~104 subtarefas).

Se o volume crescer significativamente, considerar:
- Índice composto: `CREATE INDEX idx_proc_tasks_due_status ON proc_tasks(due_date, status) WHERE status NOT IN ('completed', 'skipped')`
- Índice composto: `CREATE INDEX idx_proc_subtasks_due ON proc_subtasks(due_date) WHERE is_completed = false`

### 9.2 IDs Compostos

Os IDs dos eventos de processo usam prefixo para evitar colisão com outros eventos:
- `proc_task:{uuid}` — tarefa
- `proc_subtask:{uuid}` — subtarefa

Isto é consistente com o padrão já usado para recurring events (`{eventId}_{occurrence}`).

### 9.3 Eventos Não Editáveis

Eventos de processo são `source: 'auto'` — não podem ser editados ou eliminados no calendário. A gestão de datas é feita no detalhe do processo. O sheet mostra apenas o botão "Abrir Processo" (sem "Editar" ou "Eliminar").

### 9.4 Processos On Hold

Processos pausados (`on_hold`) **continuam visíveis** no calendário. A lógica é que os prazos não desaparecem — o utilizador precisa de saber que tem tarefas com data, mesmo que o processo esteja temporariamente pausado. O badge de status pode indicar "(Pausado)" no sheet.

### 9.5 Subtarefas com Owner

Subtarefas multiplicadas por proprietário mostram o nome do owner no título: `"Recolher CC (Maria Santos)"`. Isto ajuda a distinguir subtarefas idênticas para proprietários diferentes.

---

## 10. Ficheiros a Alterar

| Ficheiro | Alteração |
|----------|-----------|
| `app/api/calendar/events/route.ts` | Adicionar fonte 4 (proc_tasks + proc_subtasks) |
| `types/calendar.ts` | Categorias, cores, labels, campos extra, role presets |
| `lib/constants.ts` | CALENDAR_CATEGORY_OPTIONS |
| `lib/validations/calendar.ts` | Sem alteração (só afecta criação manual) |
| `components/calendar/calendar-filters.tsx` | Grupo "Processos" |
| `components/calendar/calendar-event-card.tsx` | Dot de prioridade |
| `components/calendar/calendar-event-detail.tsx` | Secção processo + botão atalho |
| `hooks/use-calendar-filters.ts` | Sem alteração (usa CALENDAR_ROLE_PRESETS dinâmicamente) |
| `hooks/use-calendar-events.ts` | Sem alteração (genérico, suporta novas categorias) |

**Total: 6 ficheiros a modificar, 0 ficheiros novos.**
