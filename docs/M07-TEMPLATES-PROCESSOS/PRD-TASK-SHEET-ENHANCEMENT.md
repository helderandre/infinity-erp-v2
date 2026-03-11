# PRD — Enhanced Task Detail Sheet com Navegação Lateral, Actividades e Comentários

**Data:** 2026-03-05
**Projecto:** ERP Infinity v2 — Módulo de Processos
**Scope:** Redesign do `TaskDetailSheet` com split-panel lateral, feed de actividades enriquecido e sistema de comentários aprimorado

---

## 1. Visão Geral

Redesign do sheet de detalhe de tarefa de processo para incluir:
1. **Navegação lateral (sidebar)** dentro do sheet — menus que alternam o conteúdo principal
2. **Feed de actividades enriquecido** — mapear acções (visto por, alterado por, rascunho gerado por, email/documento enviado por, etc.)
3. **Sistema de comentários** aprimorado com avatares e timestamps
4. **Split-view** — possibilidade de ver tarefa + documento lado a lado, ou só tarefa, ou só documento
5. **Badges de prioridade** melhoradas com design mais expressivo

### Referência Visual
- **IMG 01 (Estado actual):** Sheet vertical com 3 secções empilhadas (metadata → acções → comentários)
- **IMG 02 (Alvo):** Sheet com metadata à esquerda, tabs Activity/My Work/Assigned/Comments no centro
- **IMG 03 (Split-view):** Painel lateral com sidebar de navegação + conteúdo principal redimensionável

---

## 2. Arquitectura Actual (Estado As-Is)

### 2.1 Componente Principal

**Ficheiro:** [task-detail-sheet.tsx](components/processes/task-detail-sheet.tsx)

```
Sheet (side="right", sm:max-w-2xl, min-w-[600px])
├── SheetHeader (fixo, border-b)
│   ├── Status icon + título
│   └── Badges: action_type, obrigatória, fase
├── Corpo scrollável (flex-1 overflow-y-auto)
│   ├── TaskDetailMetadata (grid 2-col: estado, prioridade, atribuído, data, fase, owner, criada)
│   ├── Separator
│   ├── TaskDetailActions (acções por tipo: UPLOAD/EMAIL/FORM/COMPOSITE/GENERATE_DOC/MANUAL)
│   ├── Separator
│   └── TaskActivityFeed (lista de comentários com avatares)
└── Footer fixo (border-t)
    └── CommentInput (react-mentions com @user)
```

### 2.2 Componentes Existentes

| Componente | Ficheiro | Linhas | Responsabilidade |
|------------|----------|--------|------------------|
| `TaskDetailSheet` | [task-detail-sheet.tsx](components/processes/task-detail-sheet.tsx) | 208 | Container principal do sheet |
| `TaskDetailMetadata` | [task-detail-metadata.tsx](components/processes/task-detail-metadata.tsx) | 256 | Grid de metadados editáveis (estado, prioridade, atribuído, data, fase) |
| `TaskDetailActions` | [task-detail-actions.tsx](components/processes/task-detail-actions.tsx) | 601 | Acções por tipo + transições de estado + email dialog |
| `TaskActivityFeed` | [task-activity-feed.tsx](components/processes/task-activity-feed.tsx) | 101 | Lista de comentários com avatar + menções |
| `CommentInput` | [comment-input.tsx](components/processes/comment-input.tsx) | 100 | Input com @mentions via react-mentions |
| `ProcessTaskCard` | [process-task-card.tsx](components/processes/process-task-card.tsx) | 323 | Cards kanban/lista |
| `StatusBadge` | [status-badge.tsx](components/shared/status-badge.tsx) | 59 | Badge genérica com cores por status |

### 2.3 Hooks Existentes

| Hook | Ficheiro | Responsabilidade |
|------|----------|------------------|
| `useTaskComments` | [use-task-comments.ts](hooks/use-task-comments.ts) | Fetch + realtime subscription + addComment |

### 2.4 Página de Processo

**Ficheiro:** [page.tsx](app/dashboard/processos/[id]/page.tsx)

- Estado: `selectedTask` (useState) controla abertura do sheet
- Deep-linking: `?task=<taskId>` no URL
- Sincronização: useEffect actualiza selectedTask quando process.stages muda
- Callbacks: `handleTaskClick`, `onTaskUpdate` (refetch process)

---

## 3. Schema de Base de Dados Relevante

### 3.1 proc_tasks (Tarefas)

```sql
id (UUID, PK)
proc_instance_id (UUID, FK → proc_instances)
tpl_task_id (UUID, FK → tpl_tasks)
title (text)
status (text) -- pending | in_progress | completed | skipped
action_type (text) -- UPLOAD | EMAIL | GENERATE_DOC | MANUAL | FORM | COMPOSITE
priority (text) -- urgent | normal | low
is_mandatory (boolean)
is_bypassed (boolean)
bypass_reason (text)
bypassed_by (UUID, FK → dev_users)
assigned_to (UUID, FK → dev_users)
assigned_role (text)
owner_id (UUID, FK → owners)
due_date (timestamptz)
started_at (timestamptz)
completed_at (timestamptz)
config (jsonb)
task_result (jsonb)
stage_name (text)
stage_order_index (int)
order_index (int)
created_at (timestamptz)
```

### 3.2 proc_task_comments (Comentários — JÁ EXISTE)

```sql
id (UUID, PK)
proc_task_id (UUID, FK → proc_tasks)
user_id (UUID, FK → dev_users)
content (text, max 5000)
mentions (jsonb) -- [{user_id, display_name}]
created_at (timestamptz)
updated_at (timestamptz)
```

**API:** `GET/POST /api/processes/[id]/tasks/[taskId]/comments`
**Validação:** [comment.ts](lib/validations/comment.ts)
**Hook:** [use-task-comments.ts](hooks/use-task-comments.ts) com Supabase realtime

### 3.3 log_audit (Auditoria — EXISTE MAS NÃO POPULADA)

```sql
id (UUID, PK)
user_id (UUID, FK → dev_users)
entity_type (text)
entity_id (text)
action (text)
old_data (jsonb)
new_data (jsonb)
ip_address (text)
created_at (timestamptz)
```

### 3.4 log_emails (Emails — JÁ EXISTE)

```sql
id (UUID, PK)
proc_task_id (UUID, FK → proc_tasks)
recipient_email (text)
subject (text)
sent_at (timestamptz)
delivery_status (text)
provider_id (text)
metadata (jsonb)
```

### 3.5 notifications (Notificações — JÁ EXISTE)

Types relevantes: `task_assigned`, `task_comment`, `comment_mention`, `process_approved`, `process_created`

### 3.6 TABELA NOVA NECESSÁRIA: proc_task_activities

```sql
-- Histórico de actividades da tarefa (status changes, assignments, etc.)
CREATE TABLE proc_task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proc_task_id UUID NOT NULL REFERENCES proc_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES dev_users(id),
  activity_type TEXT NOT NULL,
    -- status_change | assignment | priority_change | due_date_change
    -- bypass | upload | email_sent | doc_generated | comment | started | completed
    -- viewed | draft_generated
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
    -- Para status_change: {old_status, new_status}
    -- Para assignment: {old_user_id, new_user_id, new_user_name}
    -- Para priority_change: {old_priority, new_priority}
    -- Para upload: {file_name, file_url, doc_type}
    -- Para email_sent: {recipient, subject}
    -- Para bypass: {reason}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proc_task_activities_task ON proc_task_activities(proc_task_id);
CREATE INDEX idx_proc_task_activities_created ON proc_task_activities(created_at DESC);
```

---

## 4. Types Existentes Relevantes

**Ficheiro:** [process.ts](types/process.ts)

```typescript
// Já existe — usar como base
export interface TaskActivityEntry {
  id: string
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'due_date_change' | 'bypass'
  user_id: string
  user_name: string
  content: string
  metadata?: Record<string, unknown>
  created_at: string
}

export type TaskPriority = 'urgent' | 'normal' | 'low'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM' | 'COMPOSITE'
```

**Extensão necessária:**

```typescript
// Adicionar novos tipos de actividade
export type TaskActivityType =
  | 'status_change'      // Estado alterado
  | 'assignment'          // Atribuído a / removido de
  | 'priority_change'     // Prioridade alterada
  | 'due_date_change'     // Data limite alterada
  | 'bypass'              // Tarefa dispensada
  | 'upload'              // Documento carregado
  | 'email_sent'          // Email enviado
  | 'doc_generated'       // Documento gerado
  | 'started'             // Tarefa iniciada
  | 'completed'           // Tarefa concluída
  | 'viewed'              // Visto por
  | 'draft_generated'     // Rascunho gerado por
  | 'comment'             // Comentário adicionado

export interface TaskActivity {
  id: string
  proc_task_id: string
  user_id: string
  activity_type: TaskActivityType
  description: string
  metadata?: Record<string, unknown>
  created_at: string
  user?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  }
}
```

---

## 5. Componentes UI Disponíveis

### 5.1 Instalados (shadcn/ui)

| Componente | Ficheiro | Uso Previsto |
|------------|----------|-------------|
| `Sheet` | [sheet.tsx](components/ui/sheet.tsx) | Container principal — alargar para `sm:max-w-5xl` |
| `Tabs` | [tabs.tsx](components/ui/tabs.tsx) | Suporta `orientation="vertical"` + `variant="line"` |
| `ScrollArea` | [scroll-area.tsx](components/ui/scroll-area.tsx) | Scroll independente em cada painel |
| `Timeline` | [timeline.tsx](components/ui/timeline.tsx) | Feed de actividades (vertical, com dots e connectors) |
| `Avatar` | [avatar.tsx](components/ui/avatar.tsx) | Avatares nos comentários e actividades |
| `Badge` | [badge.tsx](components/ui/badge.tsx) | 6 variantes (default, secondary, destructive, outline, ghost, link) |
| `Separator` | [separator.tsx](components/ui/separator.tsx) | Divisores entre secções |
| `Tooltip` | [tooltip.tsx](components/ui/tooltip.tsx) | Tooltips em ícones da sidebar |

### 5.2 NÃO Instalado (pode ser necessário)

| Componente | Pacote | Uso |
|------------|--------|-----|
| `Resizable` | `react-resizable-panels` | Split-view ajustável (tarefa + documento) |

### 5.3 Tabs Vertical — Capacidade Existente

O componente `Tabs` em [tabs.tsx](components/ui/tabs.tsx) já suporta `orientation="vertical"`:

```typescript
// Já suportado nativamente:
<Tabs orientation="vertical" ...>
  // Data attributes: data-orientation="vertical"
  // CSS: group-data-vertical/tabs:flex-col → layout vertical
  // TabsTrigger: group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start
  // Indicator: group-data-vertical/tabs:after:inset-y-0 after:-right-1 after:w-0.5
```

---

## 6. Design Proposto — Nova Arquitectura

### 6.1 Layout Principal do Sheet

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER (fixo)                                                           │
│ [Status Icon] Título da Tarefa                              [X Fechar]  │
│ [Badge: Tipo] [Badge: Obrigatória] [Badge: Fase]                       │
├─────────┬───────────────────────────────────────────────────────────────┤
│ SIDEBAR │ CONTEÚDO PRINCIPAL                                            │
│  (56px) │                                                               │
│         │ Conteúdo muda conforme selecção do sidebar:                   │
│ [📋]   │                                                               │
│ Tarefa  │ • Tarefa: Metadata + Acções (estado actual)                   │
│         │ • Actividade: Timeline enriquecida                            │
│ [📊]   │ • Comentários: Feed + input                                   │
│ Activ.  │ • Documento: Preview de doc/email (se aplicável)              │
│         │                                                               │
│ [💬]   │ SPLIT MODE:                                                    │
│ Coment. │ Pode mostrar 2 painéis lado a lado:                          │
│         │ [Tarefa | Documento] ou [Actividade | Comentários]            │
│ [📄]   │                                                               │
│ Docs    │                                                               │
│         │                                                               │
├─────────┴───────────────────────────────────────────────────────────────┤
│ FOOTER (fixo) — Input de comentário (sempre visível)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Sidebar Icons (navegação lateral)

```typescript
const SIDEBAR_ITEMS = [
  { id: 'task',      icon: ClipboardList, label: 'Tarefa',      shortcut: '1' },
  { id: 'activity',  icon: Activity,      label: 'Actividade',  shortcut: '2' },
  { id: 'comments',  icon: MessageSquare, label: 'Comentários', shortcut: '3' },
  { id: 'documents', icon: FileText,      label: 'Documentos',  shortcut: '4' },
] as const
```

- Sidebar com **56px de largura** (apenas ícones + tooltip no hover)
- Item activo com **indicador vertical** (barra esquerda ou background accent)
- Badge numérica para contagem de comentários não lidos

### 6.3 Split View

Ao clicar em "Documentos" enquanto "Tarefa" está aberta:
- O conteúdo divide-se em **2 painéis lado a lado**
- Painel esquerdo: Tarefa (metadata + acções)
- Painel direito: Documento (preview PDF/email)
- Cada painel tem scroll independente
- Botão para fechar o split (volta a single-panel)

**Implementação:** CSS Grid com `grid-template-columns: 1fr 1fr` ou Resizable Panels.

### 6.4 Prioridade Badges — Novo Design

```typescript
// Actual (apenas ícone + texto simples):
<AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Urgente

// Proposto (badge colorida com fundo):
const PRIORITY_BADGES = {
  urgent: {
    icon: AlertTriangle,
    label: 'Urgente',
    className: 'bg-red-500/15 text-red-600 border-red-500/20',
    dotColor: 'bg-red-500',
  },
  normal: {
    icon: ArrowRight,
    label: 'Normal',
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
    dotColor: 'bg-amber-500',
  },
  low: {
    icon: ArrowDown,
    label: 'Baixa',
    className: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
    dotColor: 'bg-slate-400',
  },
}
```

---

## 7. Mapeamento de Actividades

### 7.1 Tipos de Actividade e Descrições PT-PT

```typescript
export const ACTIVITY_TYPE_CONFIG: Record<TaskActivityType, {
  icon: LucideIcon
  label: string
  color: string
  descriptionTemplate: string
}> = {
  status_change: {
    icon: RefreshCw,
    label: 'Estado alterado',
    color: 'text-blue-500',
    descriptionTemplate: '{user} alterou o estado de {old} para {new}',
  },
  assignment: {
    icon: UserPlus,
    label: 'Atribuição',
    color: 'text-violet-500',
    descriptionTemplate: '{user} atribuiu a tarefa a {assignee}',
  },
  priority_change: {
    icon: Flag,
    label: 'Prioridade alterada',
    color: 'text-amber-500',
    descriptionTemplate: '{user} alterou a prioridade de {old} para {new}',
  },
  due_date_change: {
    icon: CalendarClock,
    label: 'Data limite alterada',
    color: 'text-orange-500',
    descriptionTemplate: '{user} alterou a data limite para {date}',
  },
  bypass: {
    icon: Ban,
    label: 'Dispensada',
    color: 'text-orange-500',
    descriptionTemplate: '{user} dispensou a tarefa: {reason}',
  },
  upload: {
    icon: Upload,
    label: 'Documento carregado',
    color: 'text-emerald-500',
    descriptionTemplate: '{user} carregou {file_name}',
  },
  email_sent: {
    icon: Mail,
    label: 'Email enviado',
    color: 'text-sky-500',
    descriptionTemplate: '{user} enviou email para {recipient}',
  },
  doc_generated: {
    icon: FileText,
    label: 'Documento gerado',
    color: 'text-indigo-500',
    descriptionTemplate: '{user} gerou o documento {doc_name}',
  },
  started: {
    icon: PlayCircle,
    label: 'Iniciada',
    color: 'text-blue-500',
    descriptionTemplate: '{user} iniciou a tarefa',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Concluída',
    color: 'text-emerald-500',
    descriptionTemplate: '{user} concluiu a tarefa',
  },
  viewed: {
    icon: Eye,
    label: 'Visto por',
    color: 'text-muted-foreground',
    descriptionTemplate: '{user} visualizou a tarefa',
  },
  draft_generated: {
    icon: PenLine,
    label: 'Rascunho gerado',
    color: 'text-violet-500',
    descriptionTemplate: '{user} gerou um rascunho',
  },
  comment: {
    icon: MessageSquare,
    label: 'Comentário',
    color: 'text-foreground',
    descriptionTemplate: '{user} adicionou um comentário',
  },
}
```

### 7.2 Rendering de Actividade (Timeline)

Usar o componente `Timeline` existente em [timeline.tsx](components/ui/timeline.tsx):

```tsx
<Timeline orientation="vertical">
  {activities.map((activity, index) => (
    <TimelineItem key={activity.id}>
      <TimelineDot className={ACTIVITY_TYPE_CONFIG[activity.activity_type].color}>
        {React.createElement(ACTIVITY_TYPE_CONFIG[activity.activity_type].icon, {
          className: 'h-3 w-3',
        })}
      </TimelineDot>
      {index < activities.length - 1 && <TimelineConnector />}
      <TimelineContent>
        <TimelineHeader>
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={activity.user?.profile?.profile_photo_url} />
              <AvatarFallback className="text-[9px]">
                {activity.user?.commercial_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{activity.user?.commercial_name}</span>
          </div>
          <TimelineDescription>{activity.description}</TimelineDescription>
        </TimelineHeader>
        <TimelineTime>
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: pt })}
        </TimelineTime>
      </TimelineContent>
    </TimelineItem>
  ))}
</Timeline>
```

---

## 8. Ficheiros Afectados

### 8.1 Ficheiros a MODIFICAR

| Ficheiro | Alteração |
|----------|-----------|
| [task-detail-sheet.tsx](components/processes/task-detail-sheet.tsx) | Redesign completo: sidebar lateral + split-view + alargar sheet |
| [task-detail-metadata.tsx](components/processes/task-detail-metadata.tsx) | Melhorar badges de prioridade, reformatar layout |
| [task-activity-feed.tsx](components/processes/task-activity-feed.tsx) | Converter para Timeline com tipos de actividade enriquecidos |
| [process-task-card.tsx](components/processes/process-task-card.tsx) | Actualizar badges de prioridade para novo design |
| [status-badge.tsx](components/shared/status-badge.tsx) | Sem alterações (já funciona bem) |
| [page.tsx](app/dashboard/processos/[id]/page.tsx) | Passar dados adicionais ao sheet (actividades) |
| [process.ts](types/process.ts) | Adicionar `TaskActivity`, `TaskActivityType` |
| [constants.ts](lib/constants.ts) | Adicionar `ACTIVITY_TYPE_CONFIG`, actualizar `PRIORITY_BADGES` |

### 8.2 Ficheiros NOVOS

| Ficheiro | Responsabilidade |
|----------|------------------|
| `components/processes/task-sheet-sidebar.tsx` | Sidebar de navegação lateral (ícones + tooltips) |
| `components/processes/task-activity-timeline.tsx` | Timeline enriquecida com todos os tipos de actividade |
| `components/processes/task-documents-panel.tsx` | Painel de documentos para split-view |
| `hooks/use-task-activities.ts` | Fetch de actividades + realtime subscription |
| `app/api/processes/[id]/tasks/[taskId]/activities/route.ts` | GET actividades + POST registar actividade |
| `lib/validations/activity.ts` | Schema Zod para actividades |

### 8.3 Migração SQL

| Ficheiro | Responsabilidade |
|----------|------------------|
| `supabase/migrations/xxx_create_proc_task_activities.sql` | Tabela + índices |

---

## 9. Padrões de Implementação da Base de Código

### 9.1 Padrão de Sheet (referência)

De [task-detail-sheet.tsx:119-206](components/processes/task-detail-sheet.tsx#L119-L206):
```tsx
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="right" className="sm:max-w-2xl w-full min-w-[600px] p-0 flex flex-col h-full">
    <SheetHeader className="border-b px-6 py-4 space-y-2">...</SheetHeader>
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">...</div>
    <div className="border-t px-6 py-3">...</div>
  </SheetContent>
</Sheet>
```

### 9.2 Padrão de Tabs Vertical (capacidade existente)

De [tabs.tsx](components/ui/tabs.tsx):
```tsx
<Tabs orientation="vertical" className="flex flex-1 overflow-hidden">
  <TabsList variant="line" className="w-14 shrink-0 border-r flex-col">
    <TabsTrigger value="task"><ClipboardList className="h-4 w-4" /></TabsTrigger>
    <TabsTrigger value="activity"><Activity className="h-4 w-4" /></TabsTrigger>
  </TabsList>
  <TabsContent value="task" className="flex-1 overflow-y-auto mt-0">...</TabsContent>
</Tabs>
```

### 9.3 Padrão de API Route (referência)

De [comments/route.ts](app/api/processes/[id]/tasks/[taskId]/comments/route.ts):
```typescript
export async function GET(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('proc_task_comments')
    .select('*, user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))')
    .eq('proc_task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### 9.4 Padrão de Hook com Realtime (referência)

De [use-task-comments.ts](hooks/use-task-comments.ts):
```typescript
const channel = supabase
  .channel(`task-comments-${taskId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'proc_task_comments',
    filter: `proc_task_id=eq.${taskId}`,
  }, () => { fetchComments() })
  .subscribe()
```

### 9.5 Padrão de Comment com Mentions (referência)

De [comment-input.tsx](components/processes/comment-input.tsx):
```tsx
<MentionsInput value={value} onChange={(_e, newValue) => onChange(newValue)} ...>
  <Mention
    trigger="@"
    data={users}
    markup="@[__display__](__id__)"
    displayTransform={(_id, display) => `@${display}`}
  />
</MentionsInput>
```

### 9.6 Padrão de Split Layout CSS

```css
/* Container principal do sheet — NOVO */
.task-sheet-body {
  display: flex;
  flex: 1;
  overflow: hidden; /* CRÍTICO: permite scroll independente nos painéis */
}

/* Sidebar de navegação */
.task-sheet-sidebar {
  width: 56px;
  flex-shrink: 0;
  border-right: 1px solid hsl(var(--border));
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
}

/* Painel de conteúdo */
.task-sheet-content {
  flex: 1;
  overflow-y: auto;
}

/* Split mode: 2 painéis */
.task-sheet-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  flex: 1;
  overflow: hidden;
}

.task-sheet-split > * {
  overflow-y: auto;
  border-right: 1px solid hsl(var(--border));
}
```

Em Tailwind:
```
flex flex-1 overflow-hidden                    → container
w-14 shrink-0 border-r flex flex-col items-center py-2 gap-1  → sidebar
flex-1 overflow-y-auto                         → conteúdo single
grid grid-cols-2 flex-1 overflow-hidden        → split mode
```

---

## 10. Dependências

### 10.1 Já Instaladas (sem novas dependências necessárias)

- `react-mentions` — @mentions nos comentários
- `date-fns` + locale `pt` — formatação de datas
- `lucide-react` — ícones
- `sonner` — toasts
- `class-variance-authority` — variantes CSS
- Todos os componentes shadcn/ui necessários

### 10.2 Opcional (apenas se split resizable for requisito)

```bash
npx shadcn@latest add resizable
# Instala react-resizable-panels
```

**Recomendação:** Começar SEM resizable. Usar CSS Grid `grid-cols-2` fixo. Se o utilizador quiser ajustar largura dos painéis, adicionar depois.

---

## 11. APIs Necessárias

### 11.1 Nova API: Task Activities

**Endpoint:** `GET /api/processes/[id]/tasks/[taskId]/activities`

```typescript
// Response: TaskActivity[]
[
  {
    id: "uuid",
    proc_task_id: "uuid",
    user_id: "uuid",
    activity_type: "status_change",
    description: "Ana Silva alterou o estado de Pendente para Em Progresso",
    metadata: { old_status: "pending", new_status: "in_progress" },
    created_at: "2026-03-05T10:30:00Z",
    user: {
      id: "uuid",
      commercial_name: "Ana Silva",
      profile: { profile_photo_url: "https://..." }
    }
  }
]
```

### 11.2 Registar Actividade (interno — chamado dentro de outras APIs)

Ao actualizar uma tarefa em `PUT /api/processes/[id]/tasks/[taskId]`, registar actividade automaticamente:

```typescript
async function logTaskActivity(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  activityType: TaskActivityType,
  description: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from('proc_task_activities').insert({
    proc_task_id: taskId,
    user_id: userId,
    activity_type: activityType,
    description,
    metadata: metadata || {},
  })
}
```

### 11.3 APIs Existentes que Devem Registar Actividades

| API | Acção | Tipo de Actividade |
|-----|-------|--------------------|
| `PUT /api/processes/[id]/tasks/[taskId]` com `action: 'start'` | Iniciar tarefa | `started` |
| `PUT /api/processes/[id]/tasks/[taskId]` com `action: 'complete'` | Concluir | `completed` |
| `PUT /api/processes/[id]/tasks/[taskId]` com `action: 'bypass'` | Dispensar | `bypass` |
| `PUT /api/processes/[id]/tasks/[taskId]` com `action: 'assign'` | Atribuir | `assignment` |
| `PUT /api/processes/[id]/tasks/[taskId]` com `action: 'update_priority'` | Prioridade | `priority_change` |
| `PUT /api/processes/[id]/tasks/[taskId]` com `action: 'update_due_date'` | Data limite | `due_date_change` |
| `POST /api/processes/[id]/tasks/[taskId]/comments` | Comentário | `comment` |
| Task UPLOAD completion | Upload doc | `upload` |
| Task EMAIL send | Email enviado | `email_sent` |

---

## 12. Plano de Implementação (Fases)

### Fase A — Base de Dados + API (Backend)
1. Criar migração `proc_task_activities`
2. Criar API route `GET /api/processes/[id]/tasks/[taskId]/activities`
3. Criar helper `logTaskActivity()` em `lib/processes/activity-logger.ts`
4. Integrar logging em `PUT /api/processes/[id]/tasks/[taskId]` para todas as acções
5. Integrar logging em `POST /api/processes/[id]/tasks/[taskId]/comments`

### Fase B — Hook + Types (Infra Frontend)
1. Actualizar `types/process.ts` com `TaskActivity`, `TaskActivityType`
2. Actualizar `lib/constants.ts` com `ACTIVITY_TYPE_CONFIG`, `PRIORITY_BADGES`
3. Criar hook `useTaskActivities` com realtime subscription

### Fase C — Componentes UI (Frontend)
1. Criar `TaskSheetSidebar` — barra lateral com ícones + tooltips
2. Criar `TaskActivityTimeline` — timeline enriquecida
3. Criar `TaskDocumentsPanel` — painel de documentos
4. Redesenhar `TaskDetailSheet` — layout com sidebar + split-view
5. Melhorar badges de prioridade em `TaskDetailMetadata`

### Fase D — Polish
1. Animações de transição entre painéis
2. Keyboard shortcuts (1-4 para mudar tab)
3. Deep-linking para tab específica (`?task=xxx&tab=activity`)
4. Badge com contagem de comentários não lidos na sidebar

---

## 13. Documentação Externa Relevante

| Recurso | URL | Uso |
|---------|-----|-----|
| shadcn/ui Sheet | https://ui.shadcn.com/docs/components/sheet | Base container |
| shadcn/ui Tabs (vertical) | https://ui.shadcn.com/docs/components/tabs | Navegação lateral |
| shadcn/ui ScrollArea | https://ui.shadcn.com/docs/components/scroll-area | Scroll independente |
| shadcn/ui Timeline | https://ui.shadcn.com/docs/components/timeline | Feed de actividades |
| shadcn/ui Resizable | https://ui.shadcn.com/docs/components/resizable | Split panels (opcional) |
| react-resizable-panels | https://github.com/bvaughn/react-resizable-panels | Dependency do Resizable |
| react-mentions | https://github.com/signavio/react-mentions | Já instalado — @mentions |

---

## 14. Decisões de Design

| Decisão | Opção Escolhida | Justificação |
|---------|-----------------|--------------|
| Sidebar width | 56px (ícones apenas) | Compacta, não rouba espaço do conteúdo |
| Sheet width | `sm:max-w-5xl` (~1024px) | Espaço para split-view |
| Split-view | CSS Grid `grid-cols-2` | Simples, sem dependência extra |
| Actividades | Timeline component | Já existe, suporta dots coloridos e connectors |
| Comentários footer | Sempre visível | UX actual mantida — comentar é acção frequente |
| Navegação | Tabs vertical com variant="line" | Componente já suporta, zero dependências novas |
| Prioridade | Badge com cor + ícone + dot | Mais expressivo que ícone simples |

---

## 15. Riscos e Considerações

1. **Performance:** Actividades + comentários + realtime = múltiplas subscriptions. Limitar a 50 actividades mais recentes.
2. **Migração de dados:** Actividades históricas não existem — apenas novas acções serão registadas.
3. **Mobile:** Split-view não funciona em mobile. Fallback para single-panel com tabs.
4. **Largura do Sheet:** 1024px pode ser demais em ecrãs pequenos. Usar `min-w-[600px]` como fallback.
5. **Complexidade:** O sheet passará de ~208 linhas para ~350+. Manter componentização rigorosa.
