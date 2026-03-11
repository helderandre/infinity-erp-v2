# SPEC — Redesign de Subtarefas: De Collapsible para Cards Independentes

**Data:** 2026-03-05
**PRD:** [PRD-SUBTASK-CARDS-REDESIGN.md](PRD-SUBTASK-CARDS-REDESIGN.md)

---

## Resumo

Substituir o componente `TaskFormAction` (collapsible com linhas simples) por um sistema de cards independentes por tipo de subtarefa. Os cards ficam sempre visíveis na tab "Tarefa" do `TaskDetailSheet`, com layout e acções específicas por tipo (`checklist`, `upload`, `email`, `generate_doc`).

---

## Fase 1 — Backend: Novos Activity Types + Melhoria na Rota de Subtarefas

### 1.1 Ficheiro: `types/process.ts`

**O que fazer:** Adicionar 3 novos activity types ao union type `TaskActivityType` (linha 160-179).

```typescript
// Adicionar ao final do union type TaskActivityType:
| 'subtask_reverted'
| 'document_replaced'
| 'upload_completed'
```

### 1.2 Ficheiro: `lib/processes/activity-logger.ts`

**O que fazer:** Adicionar os mesmos 3 tipos ao union type local `TaskActivityType` (linha 1-22).

```typescript
// Adicionar ao final do union type:
| 'subtask_reverted'
| 'document_replaced'
| 'upload_completed'
```

### 1.3 Ficheiro: `lib/validations/activity.ts`

**O que fazer:** Adicionar os 3 novos valores ao `z.enum()` do `activitySchema` (linha 4-10).

```typescript
// Adicionar ao array do z.enum:
'subtask_reverted', 'document_replaced', 'upload_completed',
```

### 1.4 Ficheiro: `lib/constants.ts`

**O que fazer:** Adicionar 3 entradas ao objecto `TASK_ACTIVITY_TYPE_CONFIG` (após linha 466).

```typescript
subtask_reverted:   { icon: 'RotateCcw',  label: 'Subtarefa revertida',     color: 'text-orange-500' },
document_replaced:  { icon: 'RefreshCw',   label: 'Documento substituído',   color: 'text-blue-500' },
upload_completed:   { icon: 'Upload',      label: 'Upload concluído',        color: 'text-emerald-500' },
```

### 1.5 Ficheiro: `components/processes/task-activity-timeline.tsx`

**O que fazer:** Adicionar `RotateCcw` ao import do lucide-react (linha 18) e ao objecto `ICON_MAP` (linha 28-33).

```typescript
// Import (já existe RefreshCw, adicionar RotateCcw):
import { ..., RotateCcw } from 'lucide-react'

// ICON_MAP — adicionar:
RotateCcw,
```

### 1.6 Ficheiro: `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

**O que fazer:** Modificar a lógica de update para suportar reversão (is_completed = false) com logging e cleanup. Alterações na função `PUT`:

**1.6.1** Adicionar `'upload'` à lista de `isAllowedType` (linha 94-98), para que subtarefas upload possam ser actualizadas manualmente:

```typescript
const isAllowedType =
  subtaskType === 'checklist' ||
  subtaskType === 'email' ||
  subtaskType === 'generate_doc' ||
  subtaskType === 'upload' ||       // ← NOVO
  checkType === 'manual'
```

**1.6.2** No bloco de activity logging (linhas 153-222), adicionar caso de reversão. Quando `is_completed === false`, logar `subtask_reverted`:

```typescript
// Após o bloco existente de is_completed === undefined (rascunho):
} else if (is_completed === false) {
  // Subtarefa revertida
  await logTaskActivity(
    supabase, taskId, user.id,
    'subtask_reverted',
    `${userName} reverteu "${subtaskTitle}"${suffix}`,
    { ...metadata, previous_completed_at: subtask.completed_at }
  )
} else if (is_completed) {
  // ... código existente de conclusão ...
```

**1.6.3** Adicionar suporte para `task_result` no schema e no update, para subtarefas upload guardarem `doc_registry_id`:

No `subtaskUpdateSchema` (linhas 8-30), adicionar:

```typescript
task_result: z.object({
  doc_registry_id: z.string().optional(),
}).optional(),
```

No bloco de construção do `updateData` (após linha 118), adicionar:

```typescript
if (validation.data.task_result) {
  // Guardar resultado no campo config ou num campo dedicado
  updateData.config = {
    ...config,
    task_result: is_completed ? validation.data.task_result : null,
  }
}
```

---

## Fase 2 — Componentes Base (Novos Ficheiros)

### 2.1 Ficheiro: `components/processes/subtask-card-base.tsx` (CRIAR)

**O que fazer:** Componente wrapper que encapsula o layout comum a todos os cards de subtarefa.

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Circle, CheckCircle2, FileEdit } from 'lucide-react'
import type { ProcSubtask } from '@/types/subtask'

// Estado visual do card
const CARD_STATES = {
  pending: {
    border: 'border-l-slate-300',
    bg: 'bg-card',
    icon: Circle,
  },
  draft: {
    border: 'border-l-amber-400',
    bg: 'bg-amber-50/30 dark:bg-amber-950/10',
    icon: FileEdit,
  },
  completed: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50/30 dark:bg-emerald-950/10',
    icon: CheckCircle2,
  },
} as const

type CardState = keyof typeof CARD_STATES

interface SubtaskCardBaseProps {
  subtask: ProcSubtask
  state: CardState
  icon: React.ReactNode
  typeLabel: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function SubtaskCardBase({
  subtask, state, icon, typeLabel, children, footer, className,
}: SubtaskCardBaseProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-l-4 p-3 space-y-2 transition-colors',
        CARD_STATES[state].border,
        CARD_STATES[state].bg,
        state === 'completed' && 'opacity-80',
        className,
      )}
    >
      {/* Header: ícone + título + status badge */}
      <div className="flex items-center gap-2">
        <div className="shrink-0">{icon}</div>
        <span className={cn(
          'flex-1 text-sm font-medium',
          state === 'completed' && 'line-through text-muted-foreground'
        )}>
          {subtask.title}
        </span>
        {!subtask.is_mandatory && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Opcional</Badge>
        )}
      </div>

      {/* Conteúdo específico do tipo */}
      {children}

      {/* Footer: owner badge + type label */}
      {(subtask.owner || footer) && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          {subtask.owner && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0',
                subtask.owner.person_type === 'singular'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              )}
            >
              {subtask.owner.person_type === 'singular' ? '👤' : '🏢'} {subtask.owner.name}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">
            {typeLabel}
          </Badge>
          {footer}
        </div>
      )}
    </div>
  )
}

export { CARD_STATES, type CardState }
```

### 2.2 Ficheiro: `components/processes/subtask-card-checklist.tsx` (CRIAR)

**O que fazer:** Card simples com checkbox toggle inline.

```typescript
'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckSquare } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { SubtaskCardBase } from './subtask-card-base'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskCardChecklistProps {
  subtask: ProcSubtask
  onToggle: (subtaskId: string, completed: boolean) => Promise<void>
}

export function SubtaskCardChecklist({ subtask, onToggle }: SubtaskCardChecklistProps) {
  const [isToggling, setIsToggling] = useState(false)

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await onToggle(subtask.id, !subtask.is_completed)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <SubtaskCardBase
      subtask={subtask}
      state={subtask.is_completed ? 'completed' : 'pending'}
      icon={
        isToggling ? (
          <Spinner variant="infinite" size={16} className="text-muted-foreground" />
        ) : (
          <Checkbox
            checked={subtask.is_completed}
            onCheckedChange={handleToggle}
            className="h-4 w-4"
          />
        )
      }
      typeLabel="Checklist"
    >
      {/* Sem conteúdo extra — card compacto */}
      <></>
    </SubtaskCardBase>
  )
}
```

### 2.3 Ficheiro: `components/processes/subtask-card-email.tsx` (CRIAR)

**O que fazer:** Card com preview do assunto/destinatário, status Resend realtime, e botões (editar/ver/reenviar/reverter).

**Props:** `subtask`, `processId`, `taskId`, `ownerEmail`, `emails` (do useEmailStatus), `onOpenSheet` (abre SubtaskEmailSheet), `onRevert`, `onResend`, `onTaskUpdate`.

**Lógica:**
- Ler `subtask.config.rendered?.subject` para mostrar assunto
- Usar `ownerEmail` (do owner da subtarefa) para mostrar "Para:"
- `hasRendered = !!subtask.config.rendered` → estado `draft`
- `subtask.is_completed` → estado `completed`, mostrar data/status email
- Buscar email log: `emails.find(e => e.proc_subtask_id === subtask.id)` — usar `EMAIL_STATUS_CONFIG` para badge
- Botão "Editar Email" / "Continuar Edição" → chama `onOpenSheet(subtask)`
- Botão "Ver Email" (quando concluído) → chama `onOpenSheet(subtask)` em modo read-only
- Botão "Reenviar" (quando concluído) → chama `onResend(subtask)`
- Botão "Reverter" (quando concluído) → chama `onRevert(subtask.id)`

**Imports dos ícones:** `Mail, Eye, RotateCcw, Send, Edit`
**Imports de constants:** `EMAIL_STATUS_CONFIG` de `@/lib/constants`, `formatDateTime` de `@/lib/utils`
**Usar `SubtaskCardBase`** com state = `completed` | `draft` | `pending`

### 2.4 Ficheiro: `components/processes/subtask-card-doc.tsx` (CRIAR)

**O que fazer:** Card com preview do nome do documento, e botões (editar/ver/imprimir/reverter).

**Props:** `subtask`, `processId`, `taskId`, `onOpenSheet` (abre SubtaskDocSheet), `onRevert`, `onTaskUpdate`.

**Lógica:**
- Ler `subtask.config.doc_library_id` → resolver nome via config ou título
- `hasRendered = !!subtask.config.rendered` → estado `draft`
- `subtask.is_completed` → estado `completed`, mostrar `completed_at`
- Botão "Editar Documento" / "Continuar Edição" → chama `onOpenSheet(subtask)`
- Botão "Ver" (quando concluído) → chama `onOpenSheet(subtask)` em modo read-only
- Botão "Reverter" → chama `onRevert(subtask.id)`

**Imports dos ícones:** `FileText, Eye, RotateCcw, Printer, Edit`
**Usar `SubtaskCardBase`** com state = `completed` | `draft` | `pending`

### 2.5 Ficheiro: `components/processes/subtask-card-upload.tsx` (CRIAR)

**O que fazer:** Card com zona de upload inline (pendente) ou preview de ficheiro (concluído).

**Props:** `subtask`, `processId`, `taskId`, `propertyId`, `existingDocs`, `ownerId`, `onRevert`, `onTaskUpdate`.

**Lógica:**
- Quando `!subtask.is_completed`: mostrar `DocumentUploader` inline (reutilizar de `components/documents/document-uploader.tsx`)
  - Ler `subtask.config.doc_type_id` para o tipo de documento
  - Ao upload concluído: chamar `PUT /subtasks/[id]` com `is_completed: true` + `task_result: { doc_registry_id }`
- Quando `subtask.is_completed`: mostrar nome do ficheiro + data + quem fez
  - Ler `subtask.config.task_result?.doc_registry_id` → encontrar em `existingDocs`
  - Botões: "Ver" (link externo), "Download", "Substituir" (abre uploader), "Reverter"
- "Substituir" → upload novo doc, depois `PUT /subtasks/[id]` com novo `doc_registry_id`
- "Reverter" → `PUT /subtasks/[id]` com `is_completed: false`

**Imports:** `Upload, Eye, Download, RotateCcw, RefreshCw`
**Usar `SubtaskCardBase`** com state = `completed` | `pending`

### 2.6 Ficheiro: `components/processes/subtask-card-list.tsx` (CRIAR)

**O que fazer:** Container que renderiza a lista de cards + barra de progresso. Substitui directamente o `TaskFormAction`.

**Props:** Idênticas a `TaskFormActionProps` actual (linha 45-52 de task-form-action.tsx):
```typescript
interface SubtaskCardListProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  propertyId: string
  owners?: ProcessOwner[]
  processDocuments?: ProcessDocument[]
  onSubtaskToggle: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>
  onTaskUpdate: () => void
}
```

**Lógica interna:**
1. Calcular `completedCount`, `totalCount`, `progress` (copiar de task-form-action.tsx linhas 69-72)
2. `useEmailStatus(task.id)` — para passar emails aos cards de email
3. State para `openEmailSubtask`, `openDocSubtask` (sheets) — copiar padrão de task-form-action.tsx
4. Função `getSubtaskType(subtask)` — copiar de task-form-action.tsx linhas 82-89
5. Função `getCardState(subtask)`:
   ```typescript
   if (subtask.is_completed) return 'completed'
   if (subtask.config.rendered) return 'draft'
   return 'pending'
   ```
6. Função `handleRevert(subtaskId)`:
   ```typescript
   const res = await fetch(`/api/processes/${processId}/tasks/${task.id}/subtasks/${subtaskId}`, {
     method: 'PUT',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ is_completed: false }),
   })
   if (res.ok) { onTaskUpdate(); toast.success('Subtarefa revertida') }
   ```
7. Função `handleResend(subtask)` — para subtarefas email, chamar:
   ```typescript
   // Buscar o log_email mais recente da subtarefa
   const emailLog = emails.find(e => e.proc_subtask_id === subtask.id)
   if (!emailLog) return
   const res = await fetch(`/api/processes/${processId}/tasks/${task.id}/resend-email`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ log_email_id: emailLog.id }),
   })
   ```
8. Renderizar:
   - Barra de progresso (sempre visível, fora de collapsible)
   - Texto "{completedCount} de {totalCount} items completos — {progress}%"
   - Lista de cards usando switch por tipo:
     ```typescript
     switch (getSubtaskType(subtask)) {
       case 'checklist': return <SubtaskCardChecklist ... />
       case 'upload': return <SubtaskCardUpload ... />
       case 'email': return <SubtaskCardEmail ... />
       case 'generate_doc': return <SubtaskCardDoc ... />
       default: return <SubtaskCardChecklist ... />  // fallback
     }
     ```
   - Link para proprietário (copiar de task-form-action.tsx linhas 284-298)
   - Sheets (`SubtaskEmailSheet`, `SubtaskDocSheet`) — copiar de task-form-action.tsx linhas 303-329

---

## Fase 3 — Integração (Ficheiros a Modificar)

### 3.1 Ficheiro: `components/processes/task-detail-actions.tsx`

**O que fazer:** Substituir o import e uso de `TaskFormAction` por `SubtaskCardList`.

**Linha 18:** Mudar import:
```typescript
// ANTES:
import { TaskFormAction } from './task-form-action'
// DEPOIS:
import { SubtaskCardList } from './subtask-card-list'
```

**Linhas 288-311** (case COMPOSITE/FORM do `renderActionContent`): Substituir:
```typescript
// ANTES:
case 'COMPOSITE':
case 'FORM': {
  if (!task.subtasks || task.subtasks.length === 0) return null
  return (
    <TaskFormAction
      task={task as ProcessTask & { subtasks: ProcSubtask[] }}
      processId={processId}
      propertyId={propertyId}
      owners={owners}
      onSubtaskToggle={async (taskId, subtaskId, completed) => { ... }}
      onTaskUpdate={onTaskUpdate}
    />
  )
}

// DEPOIS:
case 'COMPOSITE':
case 'FORM': {
  if (!task.subtasks || task.subtasks.length === 0) return null
  return (
    <SubtaskCardList
      task={task as ProcessTask & { subtasks: ProcSubtask[] }}
      processId={processId}
      propertyId={propertyId}
      owners={owners}
      processDocuments={processDocuments}
      onSubtaskToggle={async (taskId, subtaskId, completed) => {
        const res = await fetch(
          `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_completed: completed }),
          }
        )
        if (!res.ok) throw new Error('Erro ao actualizar subtarefa')
      }}
      onTaskUpdate={onTaskUpdate}
    />
  )
}
```

### 3.2 Ficheiro: `components/processes/task-form-action.tsx`

**O que fazer:** NÃO eliminar. Manter como backup / fallback. O componente deixa de ser usado directamente pelo `TaskDetailActions`, mas pode ser útil se houver casos edge que o novo sistema não cubra.

Se quiser, pode marcar como deprecated com um comentário no topo:
```typescript
// @deprecated — Substituído por SubtaskCardList + cards individuais (subtask-card-*.tsx)
```

---

## Fase 4 — Polimento

### 4.1 Ficheiro: Nos componentes de card criados (todos os `subtask-card-*.tsx`)

**O que fazer:** Adicionar confirmação para acções destrutivas (reverter).

Para o botão "Reverter" em todos os cards que o tenham (`email`, `doc`, `upload`):
- Usar `AlertDialog` do shadcn/ui para confirmação
- Texto: "Tem a certeza de que pretende reverter esta subtarefa? O estado voltará a pendente."
- Botão destrutivo: "Reverter"

### 4.2 Ficheiro: `components/processes/subtask-card-list.tsx`

**O que fazer:** Adicionar empty state quando `subtasks.length === 0`.

```tsx
if (subtasks.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">Sem subtarefas definidas.</p>
    </div>
  )
}
```

---

## Resumo de Ficheiros

### Ficheiros a CRIAR (6):
| Ficheiro | Tipo |
|----------|------|
| `components/processes/subtask-card-base.tsx` | Componente wrapper base |
| `components/processes/subtask-card-checklist.tsx` | Card checklist |
| `components/processes/subtask-card-email.tsx` | Card email |
| `components/processes/subtask-card-doc.tsx` | Card documento |
| `components/processes/subtask-card-upload.tsx` | Card upload |
| `components/processes/subtask-card-list.tsx` | Container com lista + progresso |

### Ficheiros a MODIFICAR (6):
| Ficheiro | Alteração |
|----------|-----------|
| `types/process.ts` | +3 activity types ao union |
| `lib/processes/activity-logger.ts` | +3 activity types ao union |
| `lib/validations/activity.ts` | +3 valores ao z.enum |
| `lib/constants.ts` | +3 entradas no TASK_ACTIVITY_TYPE_CONFIG |
| `components/processes/task-activity-timeline.tsx` | +1 import ícone + ICON_MAP |
| `components/processes/task-detail-actions.tsx` | Substituir TaskFormAction por SubtaskCardList |
| `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | +upload type, +reversão logging, +task_result no schema |

### Ficheiros que NÃO mudam:
- `components/processes/task-detail-sheet.tsx` — sem alterações, já passa tudo via `TaskDetailActions`
- `components/processes/subtask-email-sheet.tsx` — reutilizado tal como está
- `components/processes/subtask-doc-sheet.tsx` — reutilizado tal como está
- `components/processes/task-upload-action.tsx` — reutilizado internamente pelo SubtaskCardUpload
- `hooks/use-email-status.ts` — reutilizado tal como está

---

## Ordem de Implementação

1. **Fase 1** — Backend: types → validations → constants → activity-timeline → route.ts
2. **Fase 2** — Componentes: subtask-card-base → subtask-card-checklist → subtask-card-list (testar com checklist primeiro)
3. **Fase 2 cont.** — Componentes: subtask-card-email → subtask-card-doc → subtask-card-upload
4. **Fase 3** — Integração: task-detail-actions.tsx (trocar import)
5. **Fase 4** — Polimento: AlertDialogs, empty states, animações

---

## Critérios de Verificação

### Automatizados:
- [ ] `npm run build` passa sem erros
- [ ] `npx tsc --noEmit` sem erros de tipo
- [ ] Todos os imports resolvem correctamente

### Manuais:
- [ ] Abrir TaskDetailSheet de uma tarefa COMPOSITE → ver cards em vez de collapsible
- [ ] Toggle checklist → actualiza inline com optimistic update
- [ ] Clicar "Editar Email" → abre SubtaskEmailSheet
- [ ] Email enviado → card mostra status Resend em realtime
- [ ] Clicar "Reverter" em subtarefa concluída → volta a pendente
- [ ] Upload de documento → card muda para estado concluído com preview
- [ ] Barra de progresso actualiza ao completar/reverter subtarefas
- [ ] Activity timeline mostra novos tipos (subtask_reverted, upload_completed)
