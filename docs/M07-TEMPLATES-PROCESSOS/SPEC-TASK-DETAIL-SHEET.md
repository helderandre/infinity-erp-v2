# SPEC — Task Detail Sheet (Painel Lateral de Detalhes da Tarefa)

**Data:** 2026-02-24
**PRD de referência:** `PRD-TASK-DETAIL-SHEET.md`

---

## Resumo

Sheet lateral que abre ao clicar numa tarefa na página de detalhe do processo. Apresenta metadados editáveis, acções por tipo de tarefa, e sistema de comentários com @menções e realtime.

---

## 1. Dependências a instalar

```bash
npm install react-mentions @types/react-mentions
npx shadcn@latest add calendar
```

> `react-day-picker` é instalado automaticamente pelo shadcn calendar. `date-fns` já existe no projecto.

---

## 2. Migration — Tabela `proc_task_comments`

**Ferramenta:** Supabase MCP `apply_migration`

```sql
CREATE TABLE proc_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proc_task_id UUID NOT NULL REFERENCES proc_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id),
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_proc_task_comments_task_id ON proc_task_comments(proc_task_id);
CREATE INDEX idx_proc_task_comments_created ON proc_task_comments(created_at);

ALTER TABLE proc_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read comments"
  ON proc_task_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON proc_task_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON proc_task_comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE proc_task_comments;
```

---

## 3. Ficheiros a MODIFICAR

---

### 3.1 `types/process.ts`

**O que fazer:** Adicionar 3 interfaces novas no final do ficheiro.

```typescript
// ── Comentários de tarefa ──

export interface TaskComment {
  id: string
  proc_task_id: string
  user_id: string
  content: string // Texto com marcadores: @[Nome](user-id)
  mentions: TaskCommentMention[]
  created_at: string
  updated_at: string
  user?: {
    id: string
    commercial_name: string
  }
}

export interface TaskCommentMention {
  user_id: string
  display_name: string
}

export interface TaskActivityEntry {
  id: string
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'due_date_change' | 'bypass'
  user_id: string
  user_name: string
  content: string
  metadata?: Record<string, unknown>
  created_at: string
}
```

---

### 3.2 `lib/constants.ts`

**O que fazer:** Adicionar o mapa `ACTIVITY_TYPE_LABELS` junto das outras constantes de processo (depois de `TASK_PRIORITY_LABELS`).

```typescript
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  comment: 'Comentário',
  status_change: 'Alteração de estado',
  assignment: 'Atribuição',
  priority_change: 'Alteração de prioridade',
  due_date_change: 'Alteração de data limite',
  bypass: 'Dispensa de tarefa',
}
```

---

### 3.3 `components/processes/process-kanban-view.tsx`

**O que fazer:**

1. Adicionar prop `onTaskClick` à interface `ProcessKanbanViewProps`:

```typescript
interface ProcessKanbanViewProps {
  // ... props existentes ...
  onTaskClick?: (task: ProcessTask) => void  // ← ADICIONAR
}
```

2. Desestruturar a nova prop no componente:

```typescript
export function ProcessKanbanView({
  stages,
  processId,
  propertyId,
  processDocuments,
  owners,
  isProcessing,
  onTaskAction,
  onTaskBypass,
  onTaskAssign,
  onTaskUpdate,
  onTaskClick,      // ← ADICIONAR
}: ProcessKanbanViewProps) {
```

3. Passar `onClick` para cada `<ProcessTaskCard>`:

Localizar o render de `<ProcessTaskCard>` dentro do `.map()` de tasks e adicionar:

```tsx
<ProcessTaskCard
  key={task.id}
  task={task}
  variant="kanban"
  isProcessing={isProcessing}
  onAction={onTaskAction}
  onBypass={onTaskBypass}
  onAssign={onTaskAssign}
  onClick={onTaskClick}    // ← ADICIONAR
/>
```

---

### 3.4 `components/processes/process-list-view.tsx`

**O que fazer:** Exactamente o mesmo que o kanban (mesma interface de props):

1. Adicionar prop `onTaskClick?: (task: ProcessTask) => void` à interface.
2. Desestruturar no componente.
3. Passar `onClick={onTaskClick}` a cada `<ProcessTaskCard>`.

---

### 3.5 `app/dashboard/processos/[id]/page.tsx`

**O que fazer:** Integrar o `TaskDetailSheet` na página e gerir o estado de tarefa seleccionada.

**3.5.1 — Novos imports (adicionar ao topo):**

```typescript
import { TaskDetailSheet } from '@/components/processes/task-detail-sheet'
```

**3.5.2 — Novo estado (adicionar junto do bloco de estados existente, ~linha 67):**

```typescript
// Task detail sheet
const [selectedTask, setSelectedTask] = useState<ProcessTask | null>(null)
```

**3.5.3 — Novo handler (adicionar depois do `handleAssignOpen`):**

```typescript
const handleTaskClick = useCallback((task: ProcessTask) => {
  setSelectedTask(task)
}, [])
```

**3.5.4 — Passar `onTaskClick` às views Kanban e List:**

No `<ProcessKanbanView>` (~linha 418), adicionar:

```tsx
onTaskClick={handleTaskClick}
```

No `<ProcessListView>` (~linha 431), adicionar:

```tsx
onTaskClick={handleTaskClick}
```

**3.5.5 — Render do Sheet (antes do Bypass Dialog, ~linha 535):**

```tsx
{/* Task Detail Sheet */}
<TaskDetailSheet
  task={selectedTask}
  processId={instance.id}
  propertyId={instance.property_id}
  processDocuments={documents}
  owners={owners}
  open={selectedTask !== null}
  onOpenChange={(open) => {
    if (!open) setSelectedTask(null)
  }}
  onTaskUpdate={loadProcess}
/>
```

**3.5.6 — Actualizar `selectedTask` quando `process` recarrega:**

Adicionar um `useEffect` para manter a tarefa seleccionada sincronizada:

```typescript
// Sincronizar selectedTask com dados actualizados do processo
useEffect(() => {
  if (selectedTask && process?.stages) {
    const allTasks: ProcessTask[] = process.stages.flatMap(
      (s: ProcessStageWithTasks) => s.tasks
    )
    const updated = allTasks.find((t) => t.id === selectedTask.id)
    if (updated) {
      setSelectedTask(updated)
    } else {
      setSelectedTask(null) // Tarefa removida
    }
  }
}, [process?.stages])
```

---

## 4. Ficheiros a CRIAR

---

### 4.1 `lib/validations/comment.ts`

**O que fazer:** Schema Zod para validação de comentários.

```typescript
import { z } from 'zod'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const commentSchema = z.object({
  content: z.string().min(1, 'Comentário não pode estar vazio').max(5000),
  mentions: z
    .array(
      z.object({
        user_id: z.string().regex(uuidRegex, 'UUID inválido'),
        display_name: z.string(),
      })
    )
    .default([]),
})

export type CommentFormData = z.infer<typeof commentSchema>
```

> **Nota:** Usar `z.string().regex()` para UUID (mesmo padrão do `tasks/[taskId]/route.ts`).

---

### 4.2 `app/api/processes/[id]/tasks/[taskId]/comments/route.ts`

**O que fazer:** API Route Handler com GET (listar) + POST (criar) para comentários de uma tarefa.

**Padrão a seguir:** `app/api/processes/[id]/tasks/[taskId]/route.ts` (mesmo padrão de autenticação + params).

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { commentSchema } from '@/lib/validations/comment'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar comentários com dados do utilizador
    const { data, error } = await (db.from('proc_task_comments') as ReturnType<typeof supabase.from>)
      .select('*, user:dev_users(id, commercial_name)')
      .eq('proc_task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validar body
    const body = await request.json()
    const validation = commentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Verificar que a tarefa pertence ao processo
    const { data: task, error: taskError } = await supabase
      .from('proc_tasks')
      .select('id')
      .eq('id', taskId)
      .eq('proc_instance_id', id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Inserir comentário
    const { data: comment, error: insertError } = await (db.from('proc_task_comments') as ReturnType<typeof supabase.from>)
      .insert({
        proc_task_id: taskId,
        user_id: user.id,
        content: validation.data.content,
        mentions: validation.data.mentions,
      })
      .select('*, user:dev_users(id, commercial_name)')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

> **Padrão seguido:** Mesmo cast `db = supabase as unknown as ...` usado em `subtasks/[subtaskId]/route.ts` para tabelas não presentes no `database.ts` gerado.

---

### 4.3 `hooks/use-task-comments.ts`

**O que fazer:** Hook client-side para fetch + realtime de comentários via Supabase client directo.

**Funcionalidades:**
- `comments` — array de `TaskComment[]` ordenado por `created_at` ascendente
- `isLoading` — boolean durante fetch inicial
- `addComment(content, mentions)` — inserir comentário via API route (`POST /api/processes/{processId}/tasks/{taskId}/comments`)
- Subscripção realtime via `supabase.channel()` com `postgres_changes` filtrado por `proc_task_id`
- Cleanup do channel no unmount

**Assinatura:**

```typescript
export function useTaskComments(processId: string, taskId: string | null) {
  // ...
  return { comments, isLoading, addComment, refetch }
}
```

**Detalhes de implementação:**

- Fetch inicial: `GET /api/processes/${processId}/tasks/${taskId}/comments`
- Realtime: Canal `task-comments-${taskId}`, evento `INSERT` na tabela `proc_task_comments` com filtro `proc_task_id=eq.${taskId}`
- Quando recebe INSERT via realtime: fetch o comentário completo com join do user via `GET` endpoint (para ter o `commercial_name`)
- `addComment`: `POST /api/processes/${processId}/tasks/${taskId}/comments` com `{ content, mentions }`
- Reset `comments` para `[]` e cancelar channel quando `taskId` muda

> **Padrão seguido:** `useEffect` + `useCallback` com cleanup, igual ao padrão de hooks do projecto.

---

### 4.4 `components/processes/task-detail-sheet.tsx`

**O que fazer:** Componente principal — Sheet lateral que orquestra todas as secções.

**Props:**

```typescript
interface TaskDetailSheetProps {
  task: ProcessTask | null
  processId: string
  propertyId: string
  processDocuments?: ProcessDocument[]
  owners?: ProcessOwner[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdate: () => void
}
```

**Estrutura do layout:**

```tsx
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="right" className="sm:max-w-2xl w-full p-0 flex flex-col h-full">
    {/* HEADER FIXO */}
    <SheetHeader className="border-b px-6 py-4 space-y-2">
      <div className="flex items-center gap-2">
        {/* Status icon (mesmos STATUS_ICONS do process-task-card.tsx) */}
        <SheetTitle className="text-lg">{task.title}</SheetTitle>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Badge action_type (UPLOAD/EMAIL/FORM/MANUAL) */}
        {/* Badge mandatory (se obrigatória) */}
        {/* Badge stage_name */}
      </div>
    </SheetHeader>

    {/* CORPO SCROLLÁVEL */}
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
      {/* Secção: Metadados editáveis */}
      <TaskDetailMetadata
        task={task}
        processId={processId}
        onTaskUpdate={onTaskUpdate}
      />

      {/* Secção: Descrição (se existir no config ou template) */}
      {task.description && (
        <div>
          <h4 className="text-sm font-medium mb-2">Descrição</h4>
          <p className="text-sm text-muted-foreground">{task.description}</p>
        </div>
      )}

      {/* Separador */}
      <Separator />

      {/* Secção: Acções por tipo */}
      <TaskDetailActions
        task={task}
        processId={processId}
        propertyId={propertyId}
        processDocuments={processDocuments}
        owners={owners}
        onTaskUpdate={onTaskUpdate}
      />

      {/* Separador */}
      <Separator />

      {/* Secção: Feed de actividade e comentários */}
      <TaskActivityFeed
        comments={comments}
        isLoading={isCommentsLoading}
      />
    </div>

    {/* FOOTER FIXO — Input de comentário */}
    <div className="border-t px-6 py-3">
      <CommentInput
        value={commentValue}
        onChange={setCommentValue}
        users={mentionUsers}
        onSubmit={handleSubmitComment}
        isSubmitting={isSubmittingComment}
      />
    </div>
  </SheetContent>
</Sheet>
```

**Lógica interna:**

1. Usa `useTaskComments(processId, task?.id ?? null)` para comentários + realtime
2. Fetch de utilizadores activos para menções: `GET /api/users/consultants` no `useEffect` quando `open === true` (mesmo padrão do `process-task-assign-dialog.tsx`)
3. Transforma users para formato `{ id: string, display: string }` exigido pelo `react-mentions`
4. Estado local: `commentValue` (string), `isSubmittingComment` (boolean)
5. `handleSubmitComment`: parsear menções do `commentValue` com regex `/@\[([^\]]+)\]\(([^)]+)\)/g`, chamar `addComment(content, mentions)`, limpar input
6. Auto-scroll para o fim do feed quando recebe novo comentário

---

### 4.5 `components/processes/task-detail-metadata.tsx`

**O que fazer:** Grid de metadados editáveis (2 colunas) com inline editing.

**Props:**

```typescript
interface TaskDetailMetadataProps {
  task: ProcessTask
  processId: string
  onTaskUpdate: () => void
}
```

**Campos (cada um como row label/value):**

| Label | Componente | Editável | API action |
|-------|-----------|----------|------------|
| Estado | `<StatusBadge>` | Não directamente (usa botões de acção) | — |
| Prioridade | `<Select>` com `urgent/normal/low` | Sim | `update_priority` |
| Atribuído a | `<Select>` com lista de consultores | Sim | `assign` |
| Data Limite | `<DatePicker>` (Calendar + Popover) | Sim | `update_due_date` |
| Fase | Label read-only | Não | — |
| Proprietário | Label + link (se existir) | Não | — |
| Criada | Data formatada read-only | Não | — |

**Lógica de update inline:**

Para prioridade, atribuição e data limite — ao alterar o valor, fazer imediatamente:

```typescript
const handleMetadataUpdate = async (action: string, payload: Record<string, unknown>) => {
  try {
    const res = await fetch(`/api/processes/${processId}/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    })
    if (!res.ok) throw new Error()
    toast.success('Tarefa actualizada')
    onTaskUpdate()
  } catch {
    toast.error('Erro ao actualizar tarefa')
  }
}
```

**Exemplos de chamada:**

- Prioridade: `handleMetadataUpdate('update_priority', { priority: 'urgent' })`
- Atribuição: `handleMetadataUpdate('assign', { assigned_to: userId })`
- Data limite: `handleMetadataUpdate('update_due_date', { due_date: date.toISOString() })`

**Fetch de consultores:** Mesmo padrão do `process-task-assign-dialog.tsx` — `GET /api/users/consultants` no `useEffect`, guardar em estado local.

**DatePicker:** Usar pattern do PRD com shadcn Calendar + Popover + `date-fns/locale/pt`. Incluir botão de limpar (X) quando há data.

**PrioritySelector:** Usar pattern do PRD com `Select` + ícones + cores por prioridade (AlertTriangle/ArrowRight/ArrowDown).

---

### 4.6 `components/processes/task-detail-actions.tsx`

**O que fazer:** Secção de acções condicionais por `action_type` + botões de transição de estado.

**Props:**

```typescript
interface TaskDetailActionsProps {
  task: ProcessTask
  processId: string
  propertyId: string
  processDocuments?: ProcessDocument[]
  owners?: ProcessOwner[]
  onTaskUpdate: () => void
}
```

**Renderização condicional por `task.action_type`:**

| action_type | O que renderizar |
|-------------|-----------------|
| `UPLOAD` | `<TaskUploadAction>` (componente existente) com props extraídas de `task.config` |
| `FORM` | `<TaskFormAction>` (componente existente) com subtasks |
| `EMAIL` | Preview do template de email (subject + body_html de `task.config`) + botão "Enviar Email" |
| `MANUAL` | Nada (apenas botões de estado abaixo) |
| `GENERATE_DOC` | Preview do template de documento + botão "Gerar Documento" |

**Botões de transição de estado (abaixo da secção de acção):**

Renderizar condicionalmente segundo a máquina de estados:

| Estado actual | Botões |
|---------------|--------|
| `pending` | "Iniciar" (→ `start`), "Concluir" (→ `complete`), "Dispensar" (→ abre dialog bypass, se não obrigatória) |
| `in_progress` | "Concluir" (→ `complete`), "Dispensar" (→ abre dialog bypass, se não obrigatória) |
| `completed` | Nenhum (estado final, mostrar mensagem "Tarefa concluída em {data}") |
| `skipped` | "Reactivar" (→ `reset`) |

**Bypass:** Ao clicar "Dispensar", mostrar inline um `<Textarea>` para motivo (mín. 10 chars) + botão "Confirmar Dispensa". Não abrir dialog separado — manter tudo dentro do Sheet.

**Padrão de chamada API:**

```typescript
const handleAction = async (action: string, extra?: Record<string, unknown>) => {
  setIsProcessing(true)
  try {
    const res = await fetch(`/api/processes/${processId}/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao executar acção')
    }
    toast.success('Tarefa actualizada com sucesso!')
    onTaskUpdate()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Erro ao executar acção')
  } finally {
    setIsProcessing(false)
  }
}
```

**Para UPLOAD:** Extrair config da tarefa:
```typescript
const docTypeId = task.config?.doc_type_id
const docTypeName = task.config?.doc_type_name || 'Documento'
const allowedExtensions = task.config?.allowed_extensions || ['pdf', 'jpg', 'png', 'jpeg']
const mainOwnerId = owners?.find((o) => o.is_main_contact)?.id || owners?.[0]?.id
```

Renderizar `<TaskUploadAction>` com essas props (componente já existe).

**Para FORM:** Renderizar `<TaskFormAction>` com as subtasks da tarefa (componente já existe). Passar `onSubtaskToggle` que chama `PUT /api/processes/${processId}/tasks/${task.id}/subtasks/${subtaskId}`.

---

### 4.7 `components/processes/task-activity-feed.tsx`

**O que fazer:** Lista de comentários renderizados com avatars e timestamps relativos.

**Props:**

```typescript
interface TaskActivityFeedProps {
  comments: TaskComment[]
  isLoading: boolean
}
```

**Estrutura de cada comentário:**

```tsx
<div className="flex gap-3">
  {/* Avatar circular com inicial do nome */}
  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0">
    {comment.user?.commercial_name?.[0]?.toUpperCase() || '?'}
  </div>

  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{comment.user?.commercial_name}</span>
      <span className="text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: pt })}
      </span>
    </div>
    <p className="text-sm mt-0.5">
      {renderCommentContent(comment.content)}
    </p>
  </div>
</div>
```

**Função `renderCommentContent`:** Parsear o formato `@[Nome](user-id)` e substituir por `<span>` estilizado:

```typescript
function renderCommentContent(content: string): React.ReactNode {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/)
    if (match) {
      return (
        <span key={i} className="text-primary font-medium bg-primary/10 rounded px-1">
          @{match[1]}
        </span>
      )
    }
    return part
  })
}
```

**Estado loading:** Mostrar 3 `<Skeleton>` items.

**Estado vazio:** Mensagem "Sem comentários. Seja o primeiro a comentar."

**Auto-scroll:** O componente pai (`task-detail-sheet`) faz scroll automático para o fim da área scrollável quando `comments.length` muda.

---

### 4.8 `components/processes/comment-input.tsx`

**O que fazer:** Input de comentário com `react-mentions` para @menções.

**Props:**

```typescript
interface CommentInputProps {
  value: string
  onChange: (value: string) => void
  users: { id: string; display: string }[]
  onSubmit: () => void
  isSubmitting: boolean
}
```

**Estrutura:**

```tsx
<div className="flex items-end gap-2">
  <div className="flex-1 relative">
    <MentionsInput
      value={value}
      onChange={(e, newValue) => onChange(newValue)}
      placeholder="Escrever comentário... Use @ para mencionar"
      className="mentions-input"
      style={mentionsInputStyle}
      a11ySuggestionsListLabel="Utilizadores sugeridos"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onSubmit()
        }
      }}
    >
      <Mention
        trigger="@"
        data={users}
        markup="@[__display__](__id__)"
        displayTransform={(id, display) => `@${display}`}
        style={mentionStyle}
        renderSuggestion={(suggestion, search, highlightedDisplay) => (
          <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
              {suggestion.display?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm">{highlightedDisplay}</span>
          </div>
        )}
      />
    </MentionsInput>
  </div>
  <Button
    size="sm"
    onClick={onSubmit}
    disabled={!value.trim() || isSubmitting}
  >
    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
  </Button>
</div>
```

**Estilos inline obrigatórios** (react-mentions usa estilos inline):

```typescript
const mentionsInputStyle = {
  control: { fontSize: 14, fontWeight: 'normal' },
  '&multiLine': {
    control: { minHeight: 60 },
    highlighter: { padding: 9, border: '1px solid transparent' },
    input: {
      padding: 9,
      border: '1px solid hsl(var(--border))',
      borderRadius: 6,
      outline: 'none',
      '&focused': { borderColor: 'hsl(var(--ring))' },
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      overflow: 'hidden',
      maxHeight: 200,
      overflowY: 'auto',
    },
    item: {
      '&focused': { backgroundColor: 'hsl(var(--muted))' },
    },
  },
}

const mentionStyle = {
  backgroundColor: 'hsl(var(--primary) / 0.1)',
  borderRadius: 4,
  padding: '1px 2px',
}
```

**Submissão com Enter:** Enter envia, Shift+Enter nova linha.

---

## 5. Resumo de todos os ficheiros

### Ficheiros MODIFICADOS (6)

| # | Path | Alteração |
|---|------|-----------|
| 1 | `types/process.ts` | +3 interfaces: `TaskComment`, `TaskCommentMention`, `TaskActivityEntry` |
| 2 | `lib/constants.ts` | +1 constante: `ACTIVITY_TYPE_LABELS` |
| 3 | `components/processes/process-kanban-view.tsx` | +prop `onTaskClick`, passá-la ao `<ProcessTaskCard>` |
| 4 | `components/processes/process-list-view.tsx` | +prop `onTaskClick`, passá-la ao `<ProcessTaskCard>` |
| 5 | `app/dashboard/processos/[id]/page.tsx` | +estado `selectedTask`, +handler `handleTaskClick`, +render `<TaskDetailSheet>`, +`useEffect` sync |

### Ficheiros CRIADOS (7)

| # | Path | Propósito |
|---|------|-----------|
| 1 | `lib/validations/comment.ts` | Schema Zod para comentários |
| 2 | `app/api/processes/[id]/tasks/[taskId]/comments/route.ts` | API GET+POST comentários |
| 3 | `hooks/use-task-comments.ts` | Hook fetch + realtime comentários |
| 4 | `components/processes/task-detail-sheet.tsx` | Componente principal do Sheet |
| 5 | `components/processes/task-detail-metadata.tsx` | Grid de metadados editáveis |
| 6 | `components/processes/task-detail-actions.tsx` | Acções por tipo + botões de estado |
| 7 | `components/processes/task-activity-feed.tsx` | Feed de comentários renderizados |
| 8 | `components/processes/comment-input.tsx` | Input com react-mentions |

### Migration (1)

| # | Nome | Tabela |
|---|------|--------|
| 1 | `create_proc_task_comments` | `proc_task_comments` + índices + RLS + realtime |

### Dependências (2 npm + 1 shadcn)

| Pacote | Tipo |
|--------|------|
| `react-mentions` | runtime |
| `@types/react-mentions` | dev |
| shadcn `calendar` | componente UI |

---

## 6. Ordem de implementação

1. **Instalar dependências** (`react-mentions`, `@types/react-mentions`, `calendar`)
2. **Migration** — criar tabela `proc_task_comments` via Supabase MCP
3. **Types + Constants** — `types/process.ts` + `lib/constants.ts`
4. **Validação** — `lib/validations/comment.ts`
5. **API** — `comments/route.ts`
6. **Hook** — `hooks/use-task-comments.ts`
7. **Componentes folha** — `comment-input.tsx`, `task-activity-feed.tsx`, `task-detail-metadata.tsx`, `task-detail-actions.tsx`
8. **Componente principal** — `task-detail-sheet.tsx`
9. **Integração views** — modificar `process-kanban-view.tsx` + `process-list-view.tsx` (adicionar `onTaskClick`)
10. **Integração página** — modificar `processos/[id]/page.tsx` (estado + render + sync)
