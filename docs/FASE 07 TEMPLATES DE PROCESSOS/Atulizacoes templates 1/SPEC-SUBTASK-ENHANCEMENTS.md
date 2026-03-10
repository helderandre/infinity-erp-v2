# SPEC — Aprimoramentos de Subtarefas (Prazo, Responsável, Prioridade)

**Data:** 2026-03-10
**Módulo:** M07 (Templates) + M06 (Processos)
**Dependências:** Tabelas `tpl_subtasks` e `proc_subtasks` existentes

---

## 1. Resumo

Adicionar às subtarefas (template e instância) três capacidades que actualmente só existem ao nível da tarefa:

1. **Prazo (SLA)** — `sla_days` no template, `due_date` na instância
2. **Responsável** — `assigned_role` no template, `assigned_to` na instância
3. **Prioridade** — `priority` (urgent / normal / low) em ambos

---

## 2. Migração de Base de Dados

### 2.1 Alterações em `tpl_subtasks`

```sql
ALTER TABLE tpl_subtasks
  ADD COLUMN IF NOT EXISTS sla_days integer,
  ADD COLUMN IF NOT EXISTS assigned_role text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

COMMENT ON COLUMN tpl_subtasks.sla_days IS 'Prazo em dias para completar a subtarefa. Usado para calcular due_date na instanciação.';
COMMENT ON COLUMN tpl_subtasks.assigned_role IS 'Role responsável pela subtarefa (Processual, Consultor, Broker/CEO).';
COMMENT ON COLUMN tpl_subtasks.priority IS 'Prioridade: urgent, normal, low.';
```

### 2.2 Alterações em `proc_subtasks`

```sql
ALTER TABLE proc_subtasks
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES dev_users(id),
  ADD COLUMN IF NOT EXISTS assigned_role text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_proc_subtasks_due_date 
  ON proc_subtasks(due_date) 
  WHERE is_completed = false AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proc_subtasks_assigned_to 
  ON proc_subtasks(assigned_to) 
  WHERE is_completed = false;

COMMENT ON COLUMN proc_subtasks.due_date IS 'Data limite calculada a partir de sla_days do template na instanciação.';
COMMENT ON COLUMN proc_subtasks.assigned_to IS 'Utilizador atribuído a esta subtarefa.';
COMMENT ON COLUMN proc_subtasks.assigned_role IS 'Role copiado do template.';
COMMENT ON COLUMN proc_subtasks.priority IS 'Prioridade: urgent, normal, low.';
```

---

## 3. Impacto na Instanciação (Trigger `populate_process_tasks`)

A função `populate_process_tasks` já copia subtarefas de `tpl_subtasks` para `proc_subtasks`. Precisa ser actualizada para copiar os novos campos:

```sql
-- Na secção onde se copiam subtarefas, adicionar:
-- sla_days → due_date: NOW() + (tpl_st.sla_days * interval '1 day')
-- assigned_role: copiar directamente
-- priority: copiar directamente
```

**NOTA:** O `assigned_to` não é preenchido na instanciação (fica NULL). O `assigned_role` é copiado do template e serve de guia para atribuição posterior.

---

## 4. Impacto nos Types TypeScript

### 4.1 `types/subtask.ts` — Actualizar interfaces

```typescript
// SubtaskData (usado no template builder)
export interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  type: SubtaskType
  sla_days?: number          // ← NOVO
  assigned_role?: string     // ← NOVO
  priority?: 'urgent' | 'normal' | 'low'  // ← NOVO
  config: { ... }
}

// TplSubtask (do banco)
export interface TplSubtask {
  // ... campos existentes ...
  sla_days: number | null        // ← NOVO
  assigned_role: string | null   // ← NOVO
  priority: string               // ← NOVO (default 'normal')
}

// ProcSubtask (instância)
export interface ProcSubtask {
  // ... campos existentes ...
  due_date: string | null        // ← NOVO
  assigned_to: string | null     // ← NOVO
  assigned_role: string | null   // ← NOVO
  priority: string               // ← NOVO
  started_at: string | null      // ← NOVO
}
```

---

## 5. Impacto no Template Builder (Frontend)

### 5.1 `components/templates/subtask-editor.tsx`

Cada `SortableSubtaskRow` passa a mostrar campos adicionais (colapsáveis para não sobrecarregar a UI):

```
┌ ⋮⋮ [Upload] Certidão Permanente          [Obrig.] [✕] ┐
│   Tipo documento: [Certidão Permanente ▾]               │
│   ▸ Opções avançadas                                     │
│     Prazo (dias): [5]                                    │
│     Responsável:  [Gestora Processual ▾]                 │
│     Prioridade:   [Normal ▾]                             │
└─────────────────────────────────────────────────────────┘
```

**Implementação:** Usar `<Collapsible>` do shadcn para "Opções avançadas". Campos:
- `sla_days`: `<Input type="number" min="1" />`
- `assigned_role`: `<Select>` com `ASSIGNABLE_ROLES` (Processual, Consultor, Broker/CEO)
- `priority`: `<Select>` com `TASK_PRIORITY_LABELS` (Urgente, Normal, Baixa)

### 5.2 `components/templates/template-task-sheet.tsx`

No `handleSubmit`, propagar os novos campos nas subtarefas:

```typescript
subtasks: subtasks.map((st, idx) => ({
  ...st,
  order_index: idx,
  sla_days: st.sla_days,
  assigned_role: st.assigned_role,
  priority: st.priority || 'normal',
}))
```

### 5.3 `components/templates/template-builder.tsx`

No `useEffect` de carregamento do `initialData`, popular os novos campos:

```typescript
subtasks: tplSubtasks.map((st) => ({
  // ... campos existentes ...
  sla_days: st.sla_days || undefined,
  assigned_role: st.assigned_role || undefined,
  priority: st.priority || 'normal',
}))
```

---

## 6. Impacto no Template API

### 6.1 `app/api/templates/route.ts` (POST) e `app/api/templates/[id]/route.ts` (PUT)

No mapping de subtarefas para insert, adicionar:

```typescript
const subtasksToInsert = subtasks.map((st, idx) => ({
  tpl_task_id: insertedTasks[i].id,
  title: st.title,
  description: st.description || null,
  is_mandatory: st.is_mandatory,
  order_index: idx,
  sla_days: st.sla_days || null,         // ← NOVO
  assigned_role: st.assigned_role || null, // ← NOVO
  priority: st.priority || 'normal',      // ← NOVO
  config: { type: st.type, ...st.config },
}))
```

### 6.2 `lib/validations/template.ts`

Actualizar `subtaskSchema`:

```typescript
export const subtaskSchema = z.object({
  // ... campos existentes ...
  sla_days: z.number().int().positive().optional(),
  assigned_role: z.string().optional(),
  priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
})
```

---

## 7. Impacto na UI de Processos

### 7.1 `components/processes/task-form-action.tsx`

Cada subtarefa no checklist passa a mostrar badges de prazo e responsável:

```tsx
<div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
  {/* Checkbox ou ícone auto */}
  <span className="text-sm flex-1">{subtask.title}</span>
  
  {/* Badges informativos */}
  {subtask.due_date && (
    <Badge variant={isOverdue(subtask.due_date) ? 'destructive' : 'outline'} className="text-xs">
      {format(new Date(subtask.due_date), 'dd/MM', { locale: pt })}
    </Badge>
  )}
  {subtask.assigned_to && (
    <Avatar className="h-5 w-5">
      <AvatarFallback className="text-[8px]">{getInitials(subtask.assigned_to_user)}</AvatarFallback>
    </Avatar>
  )}
  {subtask.priority === 'urgent' && (
    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
  )}
</div>
```

### 7.2 API de toggle de subtarefa — `PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]`

Expandir para aceitar mais acções além de `is_completed`:

```typescript
// Body expandido:
{
  is_completed?: boolean,
  assigned_to?: string,      // ← NOVO
  priority?: string,         // ← NOVO
  due_date?: string | null,  // ← NOVO
}
```

---

## 8. Impacto na Query do Processo

### `app/api/processes/[id]/route.ts`

No JOIN de subtarefas, incluir os novos campos + join do assigned_to:

```typescript
subtasks:proc_subtasks(
  id, title, is_mandatory, is_completed,
  completed_at, completed_by, order_index, config,
  due_date, assigned_to, assigned_role, priority, started_at,
  assigned_to_user:dev_users!proc_subtasks_assigned_to_fkey(id, commercial_name)
)
```

---

## 9. Ordem de Implementação

| # | Acção | Ficheiro(s) |
|---|-------|-------------|
| 1 | Migração SQL (ALTER TABLE) | Via Supabase MCP |
| 2 | Actualizar types TypeScript | `types/subtask.ts` |
| 3 | Actualizar validação Zod | `lib/validations/template.ts` |
| 4 | Actualizar APIs de templates (POST/PUT) | `app/api/templates/route.ts`, `[id]/route.ts` |
| 5 | Actualizar GET do template (incluir novos campos) | `app/api/templates/[id]/route.ts` |
| 6 | Actualizar subtask-editor UI | `components/templates/subtask-editor.tsx` |
| 7 | Actualizar template-builder (initialData) | `components/templates/template-builder.tsx` |
| 8 | Actualizar API do processo (JOIN expandido) | `app/api/processes/[id]/route.ts` |
| 9 | Actualizar API de toggle subtarefa | `.../subtasks/[subtaskId]/route.ts` |
| 10 | Actualizar UI de processos | `task-form-action.tsx`, `task-detail-sheet.tsx` |
| 11 | Actualizar trigger de instanciação | `populate_process_tasks` |
