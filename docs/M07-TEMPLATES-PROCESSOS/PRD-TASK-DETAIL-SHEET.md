# PRD — Task Detail Sheet (Painel Lateral de Detalhes da Tarefa)

**Data:** 2026-02-24
**Projecto:** ERP Infinity v2
**Módulo:** Processos (M06) — `app/dashboard/processos/[id]`

---

## 1. Resumo Executivo

Implementar um **Sheet lateral (side panel)** que abre ao clicar numa tarefa na página de detalhe do processo (`processos/[id]`). Este painel apresenta todos os detalhes da tarefa, permite editar metadados (prioridade, data limite, atribuição), executar acções por tipo (UPLOAD, EMAIL, FORM, MANUAL), e inclui um sistema de **comentários com @menções** vinculados à tarefa.

---

## 2. Arquivos da Base de Código Afectados

### 2.1 Arquivos que serão MODIFICADOS

| Arquivo | Motivo | Linhas-chave |
|---------|--------|--------------|
| [app/dashboard/processos/[id]/page.tsx](app/dashboard/processos/[id]/page.tsx) | Adicionar estado do Sheet + handler `onClick` nas task cards | Estado: `selectedTask`, render do `<TaskDetailSheet>` |
| [components/processes/process-task-card.tsx](components/processes/process-task-card.tsx) | Propagar evento `onClick` para abrir o Sheet | Já tem prop `onClick?: (task) => void` |
| [components/processes/process-kanban-view.tsx](components/processes/process-kanban-view.tsx) | Passar `onTaskClick` para os cards | Já renderiza `<ProcessTaskCard>` |
| [components/processes/process-list-view.tsx](components/processes/process-list-view.tsx) | Passar `onTaskClick` para os cards | Já renderiza `<ProcessTaskCard>` |
| [types/process.ts](types/process.ts) | Adicionar tipos de Comment e ActivityEntry | Novas interfaces |
| [lib/constants.ts](lib/constants.ts) | Adicionar labels de comentários/actividades em PT-PT | Novas constantes |

### 2.2 Arquivos que serão CRIADOS

| Arquivo | Propósito |
|---------|-----------|
| `components/processes/task-detail-sheet.tsx` | Componente principal do Sheet lateral |
| `components/processes/task-detail-metadata.tsx` | Grid de metadados editáveis (status, prioridade, data, atribuição) |
| `components/processes/task-detail-actions.tsx` | Secção de acções por tipo (UPLOAD, EMAIL, FORM, MANUAL) |
| `components/processes/task-comments.tsx` | Sistema de comentários com @menções |
| `components/processes/task-activity-feed.tsx` | Feed de actividade (comentários + eventos do sistema) |
| `components/processes/comment-input.tsx` | Input de comentário com @menções (usa react-mentions) |
| `app/api/processes/[id]/tasks/[taskId]/comments/route.ts` | API GET + POST de comentários |
| `hooks/use-task-comments.ts` | Hook para fetch + realtime dos comentários |
| `lib/validations/comment.ts` | Schema Zod para validação de comentários |

### 2.3 Arquivos de REFERÊNCIA (não modificar, apenas padrões a seguir)

| Arquivo | Padrão que fornece |
|---------|-------------------|
| [components/ui/sheet.tsx](components/ui/sheet.tsx) | Base do Sheet component (já instalado) |
| [components/processes/process-review-section.tsx](components/processes/process-review-section.tsx) | Padrão de Dialog com formulário + loading + toast |
| [components/processes/process-task-assign-dialog.tsx](components/processes/process-task-assign-dialog.tsx) | Padrão de atribuição de utilizadores (fetch consultores) |
| [components/processes/task-upload-action.tsx](components/processes/task-upload-action.tsx) | Padrão de acção UPLOAD (reutilizar docs existentes) |
| [components/processes/task-form-action.tsx](components/processes/task-form-action.tsx) | Padrão de acção FORM (subtasks/checklist) |
| [components/templates/template-task-dialog.tsx](components/templates/template-task-dialog.tsx) | Padrão de Dialog scrollável com formulário complexo |
| [components/negocios/negocio-chat.tsx](components/negocios/negocio-chat.tsx) | Padrão de interface de mensagens (scroll-to-bottom) |
| [app/api/processes/[id]/tasks/[taskId]/route.ts](app/api/processes/[id]/tasks/[taskId]/route.ts) | API de acções na tarefa (start, complete, bypass, assign, etc.) |

---

## 3. Schema da Base de Dados

### 3.1 Tabela `proc_tasks` (EXISTENTE — não modificar)

```sql
proc_tasks
├── id (UUID, PK)
├── proc_instance_id (UUID, FK → proc_instances)
├── tpl_task_id (UUID, FK → tpl_tasks, nullable)
├── title (text, NOT NULL)
├── status (text, default 'pending') -- pending | in_progress | completed | skipped
├── action_type (text) -- UPLOAD | EMAIL | GENERATE_DOC | MANUAL | FORM
├── is_mandatory (boolean, default true)
├── is_bypassed (boolean, default false)
├── bypass_reason (text)
├── bypassed_by (UUID, FK → dev_users)
├── assigned_to (UUID, FK → dev_users)
├── assigned_role (text)
├── due_date (timestamptz)
├── started_at (timestamptz)
├── completed_at (timestamptz)
├── task_result (jsonb, default '{}')
├── priority (text, NOT NULL, default 'normal') -- urgent | normal | low
├── owner_id (UUID, FK → owners)
├── config (jsonb, default '{}')
├── stage_name (text)
├── stage_order_index (int)
├── order_index (int, default 0)
├── created_at (timestamptz, default now())
```

### 3.2 Tabela `proc_subtasks` (EXISTENTE — não modificar)

```sql
proc_subtasks
├── id (UUID, PK)
├── proc_task_id (UUID, FK → proc_tasks)
├── tpl_subtask_id (UUID, nullable)
├── title (text, NOT NULL)
├── is_mandatory (boolean, default true)
├── is_completed (boolean, default false)
├── completed_at (timestamptz)
├── completed_by (UUID, FK → dev_users)
├── order_index (int, NOT NULL, default 0)
├── config (jsonb, default '{}')
├── created_at (timestamptz, default now())
```

### 3.3 Tabela `proc_task_comments` (NOVA — criar via migration)

```sql
CREATE TABLE proc_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proc_task_id UUID NOT NULL REFERENCES proc_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id),
  content TEXT NOT NULL,
  -- mentions armazenadas como JSON array: [{ "user_id": "uuid", "display_name": "Nome" }]
  mentions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_proc_task_comments_task_id ON proc_task_comments(proc_task_id);
CREATE INDEX idx_proc_task_comments_created ON proc_task_comments(created_at);

-- RLS
ALTER TABLE proc_task_comments ENABLE ROW LEVEL SECURITY;

-- Políticas: utilizadores autenticados podem ler e criar comentários
CREATE POLICY "Authenticated users can read comments"
  ON proc_task_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON proc_task_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON proc_task_comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

-- Adicionar à publicação realtime (para Postgres Changes)
ALTER PUBLICATION supabase_realtime ADD TABLE proc_task_comments;
```

### 3.4 Tabela `dev_users` (EXISTENTE — apenas consultar para menções)

```sql
dev_users
├── id (UUID, PK, FK → auth.users)
├── commercial_name (text, NOT NULL) -- nome para exibir
├── professional_email (text)
├── is_active (boolean)
├── display_website (boolean)
├── created_at (timestamptz)
```

---

## 4. Tipos TypeScript Necessários

### 4.1 Novos tipos (adicionar em `types/process.ts`)

```typescript
// Comentário de tarefa
export interface TaskComment {
  id: string
  proc_task_id: string
  user_id: string
  content: string // Texto com marcadores de menção: @[Nome](user-id)
  mentions: TaskCommentMention[]
  created_at: string
  updated_at: string
  // Dados do utilizador (via join)
  user?: {
    id: string
    commercial_name: string
  }
}

export interface TaskCommentMention {
  user_id: string
  display_name: string
}

// Entrada do feed de actividade (mistura comentários + eventos do sistema)
export interface TaskActivityEntry {
  id: string
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'due_date_change' | 'bypass'
  user_id: string
  user_name: string
  content: string
  metadata?: Record<string, any>
  created_at: string
}
```

### 4.2 Constantes PT-PT (adicionar em `lib/constants.ts`)

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

## 5. Padrões de Implementação da Base de Código

### 5.1 Padrão de Sheet existente no projecto

O componente Sheet já está instalado em `components/ui/sheet.tsx`. Usa Radix UI Dialog como base.

```tsx
// Padrão de uso controlado (do codebase)
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet"

<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col">
    <SheetHeader className="border-b px-6 py-4">
      <SheetTitle>Título</SheetTitle>
    </SheetHeader>
    {/* Conteúdo scrollável */}
    <div className="flex-1 overflow-y-auto">
      {/* ... */}
    </div>
    {/* Footer fixo */}
    <div className="border-t p-4">
      {/* Input de comentário */}
    </div>
  </SheetContent>
</Sheet>
```

**Propriedades do SheetContent:**
- `side`: `"top" | "right" | "bottom" | "left"` (default: `"right"`)
- `showCloseButton`: boolean (default: `true`)
- Largura padrão: `w-3/4` com `sm:max-w-sm`
- Para o task detail, override com `sm:max-w-xl` (~576px) ou `sm:max-w-2xl` (~672px)

### 5.2 Padrão de Dialog scrollável (do template-task-dialog.tsx)

```tsx
// Padrão para conteúdo scrollável dentro de Dialog/Sheet
<DialogContent className="max-w-[500px] max-h-[85vh] flex flex-col overflow-hidden">
  <DialogHeader>...</DialogHeader>

  {/* -mx-4 px-4 permite scroll full-width */}
  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-4 px-4">
    <div className="space-y-4 py-2">
      {/* Campos do formulário */}
    </div>
  </div>

  <DialogFooter>...</DialogFooter>
</DialogContent>
```

### 5.3 Padrão de acção assíncrona com toast (do process-review-section.tsx)

```tsx
const [isProcessing, setIsProcessing] = useState(false)

const handleAction = async () => {
  setIsProcessing(true)
  try {
    const res = await fetch(`/api/processes/${id}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', task_result: { ... } }),
    })
    if (!res.ok) throw new Error('Erro ao executar acção')
    toast.success('Acção executada com sucesso')
    onOpenChange(false)
    onTaskUpdate() // recarregar dados do processo
  } catch (error) {
    toast.error('Erro ao executar acção. Tente novamente.')
  } finally {
    setIsProcessing(false)
  }
}
```

### 5.4 Padrão de atribuição de utilizador (do process-task-assign-dialog.tsx)

```tsx
// Fetch de consultores activos
useEffect(() => {
  if (open) {
    fetch('/api/users/consultants')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => setUsers([]))
  }
}, [open])

// Select de utilizador
<Select value={selectedUserId} onValueChange={setSelectedUserId}>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar consultor..." />
  </SelectTrigger>
  <SelectContent>
    {users.map((user) => (
      <SelectItem key={user.id} value={user.id}>
        {user.commercial_name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 5.5 Padrão de task card com onClick (do process-task-card.tsx)

O componente já tem a prop `onClick`:

```tsx
interface ProcessTaskCardProps {
  task: ProcessTask
  variant: 'kanban' | 'list'
  isProcessing: boolean
  onAction: (taskId: string, action: string) => void
  onBypass: (task: ProcessTask) => void
  onAssign: (task: ProcessTask) => void
  onClick?: (task: ProcessTask) => void  // ← JÁ EXISTE
}
```

### 5.6 Padrão de API Route Handler (do tasks/[taskId]/route.ts)

```tsx
// app/api/processes/[id]/tasks/[taskId]/comments/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id, taskId } = await params
  const supabase = await createClient()

  // Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('proc_task_comments')
    .select('*, user:dev_users(id, commercial_name)')
    .eq('proc_task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### 5.7 Padrão de status icons (do process-task-card.tsx)

```tsx
const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  in_progress: <PlayCircle className="h-4 w-4 text-blue-500" />,
  skipped: <Ban className="h-4 w-4 text-orange-500" />,
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'text-red-500',
  normal: 'text-amber-500',
  low: 'text-slate-400',
}
```

---

## 6. Documentação Externa e Padrões de Referência

### 6.1 shadcn/ui Sheet — Uso Recomendado

**Fonte:** https://ui.shadcn.com/docs/components/sheet

O Sheet já está instalado no projecto. Para o task detail panel, usar:

```tsx
<Sheet open={selectedTaskId !== null} onOpenChange={(open) => !open && setSelectedTask(null)}>
  <SheetContent side="right" className="sm:max-w-2xl w-full p-0 flex flex-col h-full">
    {/* Layout: Header fixo + Corpo scrollável + Footer fixo */}
  </SheetContent>
</Sheet>
```

**Nota:** Override da largura default (`sm:max-w-sm`) para `sm:max-w-2xl` para dar espaço suficiente ao conteúdo.

### 6.2 react-mentions — Sistema de @menções (RECOMENDADO)

**Pacote:** `react-mentions` (npm)
**Instalação:** `npm install react-mentions @types/react-mentions`
**Tamanho:** ~15KB (leve)

**Porque escolher react-mentions em vez de Tiptap:**
- Comentários de tarefa são texto simples com @menções — não precisa de rich text
- 15KB vs 100KB+ do Tiptap
- API simples: `MentionsInput` + `Mention`
- Formato de markup parseável: `@[Nome](user-id)`

**Snippet de implementação:**

```tsx
import { MentionsInput, Mention } from 'react-mentions'

interface User {
  id: string
  display: string
}

function CommentInput({
  value,
  onChange,
  users,
  onSubmit,
  isSubmitting,
}: {
  value: string
  onChange: (value: string) => void
  users: User[]
  onSubmit: () => void
  isSubmitting: boolean
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <MentionsInput
          value={value}
          onChange={(e, newValue) => onChange(newValue)}
          placeholder="Escrever comentário... Use @ para mencionar"
          className="mentions-input"
          style={mentionsInputStyle}
          a11ySuggestionsListLabel="Utilizadores sugeridos"
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
  )
}

// Estilos inline para react-mentions (obrigatório — a lib usa estilos inline)
const mentionsInputStyle = {
  control: {
    fontSize: 14,
    fontWeight: 'normal',
  },
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

**Parsing de menções no servidor:**

```typescript
// Extrair menções do formato @[Nome](user-id)
function parseMentions(content: string): TaskCommentMention[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g
  const mentions: TaskCommentMention[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    mentions.push({ display_name: match[1], user_id: match[2] })
  }
  return mentions
}

// Renderizar menções no frontend (substituir markup por spans estilizados)
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

### 6.3 Supabase Realtime para Comentários

**Fonte:** https://supabase.com/docs/guides/realtime/postgres-changes

**Hook de comentários com realtime:**

```typescript
// hooks/use-task-comments.ts
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import type { TaskComment } from '@/types/process'

export function useTaskComments(taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  // Fetch inicial
  const fetchComments = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from('proc_task_comments')
        .select('*, user:dev_users(id, commercial_name)')
        .eq('proc_task_id', taskId)
        .order('created_at', { ascending: true })
      if (data) setComments(data)
    } finally {
      setIsLoading(false)
    }
  }, [taskId, supabase])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  // Subscrição realtime
  useEffect(() => {
    if (!taskId) return

    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proc_task_comments',
          filter: `proc_task_id=eq.${taskId}`,
        },
        async (payload) => {
          // Fetch comment completo com dados do utilizador
          const { data: newComment } = await supabase
            .from('proc_task_comments')
            .select('*, user:dev_users(id, commercial_name)')
            .eq('id', payload.new.id)
            .single()
          if (newComment) {
            setComments((prev) => [...prev, newComment])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [taskId, supabase])

  // Post comment
  const addComment = useCallback(async (content: string, mentions: TaskCommentMention[]) => {
    if (!taskId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('proc_task_comments')
      .insert({
        proc_task_id: taskId,
        user_id: user.id,
        content,
        mentions,
      })

    if (error) throw error
  }, [taskId, supabase])

  return { comments, isLoading, addComment, refetch: fetchComments }
}
```

**Nota:** Antes de usar realtime, é necessário adicionar a tabela à publicação:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE proc_task_comments;
```

### 6.4 Date Picker com shadcn/ui

**Fonte:** https://ui.shadcn.com/docs/components/date-picker

**Dependência necessária:** O componente `Calendar` precisa ser instalado:
```bash
npx shadcn@latest add calendar
```
Isto instala `react-day-picker` automaticamente. O projecto já tem `date-fns` (`^4.1.0`) e `Popover`.

**Padrão de Date Picker em PT-PT:**

```tsx
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function DueDatePicker({
  value,
  onChange,
}: {
  value?: Date | null
  onChange: (date: Date | null) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {value ? format(value, 'dd MMM yyyy', { locale: pt }) : 'Sem data limite'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(date) => onChange(date ?? null)}
            locale={pt}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon-sm" onClick={() => onChange(null)}>
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
```

### 6.5 Padrão de Priority Selector

**Baseado em Linear/Asana + constantes existentes:**

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Flag, AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react'

const PRIORITIES = [
  { value: 'urgent', label: 'Urgente', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100' },
  { value: 'normal', label: 'Normal', icon: ArrowRight, color: 'text-amber-500', bg: 'bg-amber-100' },
  { value: 'low', label: 'Baixa', icon: ArrowDown, color: 'text-slate-400', bg: 'bg-slate-100' },
] as const

function PrioritySelector({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const selected = PRIORITIES.find(p => p.value === value)

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full h-8">
        <SelectValue>
          {selected && (
            <span className="flex items-center gap-2">
              <selected.icon className={cn('h-3.5 w-3.5', selected.color)} />
              <span className="text-sm">{selected.label}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((priority) => (
          <SelectItem key={priority.value} value={priority.value}>
            <span className="flex items-center gap-2">
              <priority.icon className={cn('h-3.5 w-3.5', priority.color)} />
              <span>{priority.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

---

## 7. Layout do Task Detail Sheet — Padrão UI/UX

Baseado em Linear, Asana, ClickUp e no padrão já usado no projecto.

### 7.1 Estrutura do Layout

```
+----------------------------------------------------------+
| SHEET HEADER (fixo)                                       |
| [StatusIcon] Título da Tarefa              [X] Close      |
| Badge: action_type | Badge: mandatory | Badge: stage      |
+----------------------------------------------------------+
| SCROLLABLE CONTENT                                        |
|                                                           |
| ── Metadados (grid 2 cols) ──────────────────────────── |
| Estado:     [Select: pending/in_progress/completed]       |
| Prioridade: [Select: urgente/normal/baixa]                |
| Atribuído:  [Select: consultor]                           |
| Data Limite:[DatePicker]                                  |
| Fase:       [Label read-only]                             |
| Proprietário: [Label + link, se aplicável]                |
|                                                           |
| ── Descrição ────────────────────────────────────────── |
| Texto da descrição da tarefa (do template)                |
|                                                           |
| ── Acção por Tipo ───────────────────────────────────── |
| [Se UPLOAD: TaskUploadAction inline]                      |
| [Se FORM: TaskFormAction com checklist de subtasks]       |
| [Se EMAIL: Preview do email + botão enviar]               |
| [Se MANUAL: Botões Iniciar / Concluir / Dispensar]        |
|                                                           |
| ── Separador ────────────────────────────────────────── |
|                                                           |
| ── Actividade & Comentários ─────────────────────────── |
| [Avatar] Maria Santos — há 2 horas                        |
|   Alterou estado de Pendente para Em Progresso            |
|                                                           |
| [Avatar] João Silva — há 1 hora                           |
|   @Maria Santos pode verificar o doc do NIF?              |
|                                                           |
| [Avatar] Maria Santos — há 30 min                         |
|   Documento verificado e aprovado.                        |
+----------------------------------------------------------+
| FOOTER (fixo)                                             |
| [MentionsInput: Escrever comentário... @ ] [Enviar]       |
+----------------------------------------------------------+
```

### 7.2 Responsive

- Desktop: Sheet com `sm:max-w-2xl` (~672px) ou `sm:max-w-xl` (~576px)
- Mobile: Full width (`w-full`)
- Conteúdo scrollável com footer fixo para input de comentário

---

## 8. API Routes Necessárias

### 8.1 GET `/api/processes/[id]/tasks/[taskId]/comments`

**Request:** Query params opcionais (paginação futura)
**Response:**
```json
[
  {
    "id": "uuid",
    "proc_task_id": "uuid",
    "user_id": "uuid",
    "content": "Texto do comentário com @[Maria Santos](uuid-maria)",
    "mentions": [{ "user_id": "uuid-maria", "display_name": "Maria Santos" }],
    "created_at": "2026-02-24T10:30:00Z",
    "user": {
      "id": "uuid",
      "commercial_name": "João Silva"
    }
  }
]
```

### 8.2 POST `/api/processes/[id]/tasks/[taskId]/comments`

**Request Body:**
```json
{
  "content": "Texto do comentário com @[Maria Santos](uuid)",
  "mentions": [{ "user_id": "uuid", "display_name": "Maria Santos" }]
}
```

**Validação Zod:**
```typescript
const commentSchema = z.object({
  content: z.string().min(1, 'Comentário não pode estar vazio').max(5000),
  mentions: z.array(z.object({
    user_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
    display_name: z.string(),
  })).default([]),
})
```

**Response:**
```json
{
  "id": "uuid",
  "proc_task_id": "uuid",
  "content": "...",
  "mentions": [...],
  "created_at": "...",
  "user": { "id": "uuid", "commercial_name": "Nome" }
}
```

### 8.3 PUT existente — `/api/processes/[id]/tasks/[taskId]` (sem alterações)

As acções existentes já cobrem:
- `start` — iniciar tarefa
- `complete` — concluir tarefa
- `bypass` — dispensar tarefa (com motivo)
- `assign` — atribuir a utilizador
- `reset` — reactivar tarefa dispensada
- `update_priority` — alterar prioridade
- `update_due_date` — alterar data limite

---

## 9. Dependências a Instalar

| Pacote | Versão | Motivo | Tamanho |
|--------|--------|--------|---------|
| `react-mentions` | `^4.4.10` | @menções nos comentários | ~15KB |
| `@types/react-mentions` | `^4.1.13` | Types TypeScript | dev |
| `calendar` (shadcn) | — | Date picker para data limite | via `npx shadcn@latest add calendar` |

**Nota:** `react-day-picker` será instalado automaticamente pelo shadcn calendar.

---

## 10. Máquina de Estados da Tarefa (Referência)

```
            ┌──────────┐
            │ PENDING  │
            └────┬─────┘
                 │
        ┌────────┼────────┐
        │        │        │
    [start]  [bypass]  [complete]
        │        │        │
        ▼        ▼        ▼
    IN_PROGRESS SKIPPED COMPLETED
        │               ▲
        │          [reset]
        └───[complete]──┘
```

**Acções disponíveis por estado:**
| Estado | Acções |
|--------|--------|
| `pending` | start, complete, bypass (se não obrigatória), assign |
| `in_progress` | complete, bypass (se não obrigatória), assign |
| `completed` | (nenhuma — estado final) |
| `skipped` | reset |

**Metadados editáveis em qualquer estado:**
- `priority` (urgent, normal, low)
- `due_date` (date ou null)
- `assigned_to` (user UUID)

---

## 11. Checklist de Implementação

### Fase 1: Infraestrutura (DB + API + Types)
- [ ] Instalar dependências (`react-mentions`, `@types/react-mentions`, shadcn `calendar`)
- [ ] Criar tabela `proc_task_comments` via migration no Supabase
- [ ] Adicionar tabela ao `supabase_realtime` publication
- [ ] Criar API route `GET/POST /api/processes/[id]/tasks/[taskId]/comments`
- [ ] Adicionar tipos `TaskComment`, `TaskCommentMention`, `TaskActivityEntry` em `types/process.ts`
- [ ] Adicionar constantes `ACTIVITY_TYPE_LABELS` em `lib/constants.ts`
- [ ] Criar schema de validação `commentSchema` em `lib/validations/comment.ts`

### Fase 2: Componentes Base
- [ ] Criar `hooks/use-task-comments.ts` com fetch + realtime
- [ ] Criar `components/processes/comment-input.tsx` (react-mentions)
- [ ] Criar `components/processes/task-activity-feed.tsx` (lista de comentários)
- [ ] Criar `components/processes/task-detail-metadata.tsx` (grid de metadados editáveis)

### Fase 3: Sheet Principal
- [ ] Criar `components/processes/task-detail-sheet.tsx` (componente principal)
- [ ] Criar `components/processes/task-detail-actions.tsx` (acções por tipo)
- [ ] Integrar com `app/dashboard/processos/[id]/page.tsx`

### Fase 4: Integração & Testes
- [ ] Passar `onTaskClick` dos views (Kanban + List) → abrir Sheet
- [ ] Testar todos os tipos de tarefa (UPLOAD, EMAIL, FORM, MANUAL)
- [ ] Testar comentários com @menções
- [ ] Testar realtime (dois browsers)
- [ ] Testar alteração de metadados (prioridade, data, atribuição)
- [ ] Verificar responsividade mobile

---

## 12. Decisões de Arquitectura

| Decisão | Escolha | Justificação |
|---------|---------|-------------|
| Painel lateral vs página dedicada | **Sheet (side panel)** | Mantém contexto do processo visível; padrão Linear/Asana |
| Rich text vs plain text | **Plain text + @menções** | Comentários de tarefa não precisam de formatação rica |
| Lib de menções | **react-mentions** | 15KB vs 100KB+ (Tiptap); API simples; formato parseável |
| Realtime | **Supabase Postgres Changes** | Já integrado no stack; suficiente para ERP interno |
| Formato de menções | **@[Nome](user-id)** | Formato padrão do react-mentions; fácil de parsear no backend |
| Tabela de comentários | **Dedicada (`proc_task_comments`)** | Separada de `log_audit`; queries eficientes por tarefa |
| Date picker | **shadcn Calendar + Popover** | Consistente com o design system; suporte a `pt` locale |
| Largura do Sheet | **sm:max-w-2xl (672px)** | Espaço para metadados, acções e comentários |
