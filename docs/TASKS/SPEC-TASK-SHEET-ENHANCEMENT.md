# SPEC — Enhanced Task Detail Sheet

**Data:** 2026-03-05
**PRD de referência:** [PRD-TASK-SHEET-ENHANCEMENT.md](PRD-TASK-SHEET-ENHANCEMENT.md)

---

## Resumo

Redesign do `TaskDetailSheet` com sidebar lateral, feed de actividades enriquecido via nova tabela `proc_task_activities`, e sistema de comentários integrado na timeline.

---

## FASE A — Base de Dados + Backend

---

### A1. Migração SQL: `proc_task_activities`

**Path:** `supabase/migrations/20260305_create_proc_task_activities.sql`
**Acção:** CRIAR ficheiro

```sql
CREATE TABLE proc_task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proc_task_id UUID NOT NULL REFERENCES proc_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES dev_users(id),
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proc_task_activities_task ON proc_task_activities(proc_task_id);
CREATE INDEX idx_proc_task_activities_created ON proc_task_activities(created_at DESC);

-- RLS
ALTER TABLE proc_task_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activities"
  ON proc_task_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activities"
  ON proc_task_activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

**Output:** Tabela `proc_task_activities` criada com índices e RLS.

---

### A2. Helper: `logTaskActivity()`

**Path:** `lib/processes/activity-logger.ts`
**Acção:** CRIAR ficheiro

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskActivityType =
  | 'status_change'
  | 'assignment'
  | 'priority_change'
  | 'due_date_change'
  | 'bypass'
  | 'upload'
  | 'email_sent'
  | 'doc_generated'
  | 'started'
  | 'completed'
  | 'viewed'
  | 'draft_generated'
  | 'comment'

export async function logTaskActivity(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  activityType: TaskActivityType,
  description: string,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase.from('proc_task_activities').insert({
    proc_task_id: taskId,
    user_id: userId,
    activity_type: activityType,
    description,
    metadata: metadata || {},
  })
  if (error) {
    console.error('[ActivityLogger] Erro ao registar actividade:', error.message)
  }
}
```

**Output:** Função `logTaskActivity()` disponível para import em qualquer API route.

---

### A3. Integrar logging em `PUT /api/processes/[id]/tasks/[taskId]`

**Path:** `app/api/processes/[id]/tasks/[taskId]/route.ts`
**Acção:** MODIFICAR — adicionar chamadas `logTaskActivity()` após cada acção bem-sucedida

Alterações concretas:

1. Adicionar import no topo:
```typescript
import { logTaskActivity } from '@/lib/processes/activity-logger'
```

2. Após cada `switch/case` e antes do `return`, obter o `commercial_name` do utilizador para descrições:
```typescript
// Após a linha 165 (update com sucesso), antes do bloco de notificações:
// Obter nome do utilizador para descrição
const { data: currentUser } = await supabase
  .from('dev_users')
  .select('commercial_name')
  .eq('id', user.id)
  .single()
const userName = currentUser?.commercial_name || 'Utilizador'
```

3. Registar actividade por acção (após update bem-sucedido, antes das notificações):

```typescript
// Registar actividade
switch (action) {
  case 'start':
    await logTaskActivity(supabase, taskId, user.id, 'started', `${userName} iniciou a tarefa`)
    break
  case 'complete':
    await logTaskActivity(supabase, taskId, user.id, 'completed', `${userName} concluiu a tarefa`)
    break
  case 'bypass':
    await logTaskActivity(supabase, taskId, user.id, 'bypass', `${userName} dispensou a tarefa: ${bypass_reason}`, { reason: bypass_reason })
    break
  case 'assign':
    // Obter nome do atribuído
    const { data: assignedUser } = await supabase
      .from('dev_users')
      .select('commercial_name')
      .eq('id', assigned_to)
      .single()
    await logTaskActivity(supabase, taskId, user.id, 'assignment', `${userName} atribuiu a tarefa a ${assignedUser?.commercial_name || 'utilizador'}`, {
      old_user_id: task.assigned_to,
      new_user_id: assigned_to,
      new_user_name: assignedUser?.commercial_name,
    })
    break
  case 'update_priority':
    await logTaskActivity(supabase, taskId, user.id, 'priority_change', `${userName} alterou a prioridade de ${task.priority || 'normal'} para ${priority}`, {
      old_priority: task.priority || 'normal',
      new_priority: priority,
    })
    break
  case 'update_due_date':
    await logTaskActivity(supabase, taskId, user.id, 'due_date_change', `${userName} alterou a data limite`, {
      old_due_date: task.due_date,
      new_due_date: due_date,
    })
    break
  case 'reset':
    await logTaskActivity(supabase, taskId, user.id, 'status_change', `${userName} reactivou a tarefa`, {
      old_status: 'skipped',
      new_status: 'pending',
    })
    break
}
```

**Output:** Todas as acções de tarefa passam a registar actividade na tabela `proc_task_activities`.

---

### A4. Integrar logging no POST de comentários

**Path:** `app/api/processes/[id]/tasks/[taskId]/comments/route.ts`
**Acção:** MODIFICAR — adicionar `logTaskActivity` após inserção bem-sucedida do comentário

1. Adicionar import:
```typescript
import { logTaskActivity } from '@/lib/processes/activity-logger'
```

2. Após a inserção do comentário (linha ~93), antes das notificações:
```typescript
// Registar actividade de comentário
const commentUserName = (comment as any).user?.commercial_name || 'Utilizador'
await logTaskActivity(supabase, taskId, user.id, 'comment', `${commentUserName} adicionou um comentário`, {
  comment_id: comment.id,
  content_preview: validation.data.content.substring(0, 100),
})
```

**Output:** Comentários também aparecem na timeline de actividades.

---

### A5. API Route: GET actividades

**Path:** `app/api/processes/[id]/tasks/[taskId]/activities/route.ts`
**Acção:** CRIAR ficheiro

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('proc_task_activities')
      .select('*, user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))')
      .eq('proc_task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

**Output:** Endpoint `GET /api/processes/[id]/tasks/[taskId]/activities` funcional, retorna até 50 actividades mais recentes com dados do utilizador.

---

## FASE B — Types, Constantes e Hook

---

### B1. Actualizar types

**Path:** `types/process.ts`
**Acção:** MODIFICAR — adicionar os novos tipos

Adicionar após a interface `TaskActivityEntry` existente (linha ~156):

```typescript
// ── Actividades de Tarefa (nova tabela proc_task_activities) ──

export type TaskActivityType =
  | 'status_change'
  | 'assignment'
  | 'priority_change'
  | 'due_date_change'
  | 'bypass'
  | 'upload'
  | 'email_sent'
  | 'doc_generated'
  | 'started'
  | 'completed'
  | 'viewed'
  | 'draft_generated'
  | 'comment'

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

**Output:** Tipos `TaskActivityType` e `TaskActivity` disponíveis para uso em componentes e hooks.

---

### B2. Adicionar constantes de actividade e prioridade

**Path:** `lib/constants.ts`
**Acção:** MODIFICAR — adicionar 2 novos exports

Adicionar após `ACTIVITY_TYPE_LABELS` (linha ~440):

```typescript
// Configuração de tipos de actividade para timeline (ícones e cores)
export const TASK_ACTIVITY_TYPE_CONFIG: Record<string, {
  icon: string
  label: string
  color: string
}> = {
  status_change:   { icon: 'RefreshCw',      label: 'Estado alterado',      color: 'text-blue-500' },
  assignment:      { icon: 'UserPlus',       label: 'Atribuição',           color: 'text-violet-500' },
  priority_change: { icon: 'Flag',           label: 'Prioridade alterada',  color: 'text-amber-500' },
  due_date_change: { icon: 'CalendarClock',  label: 'Data limite alterada', color: 'text-orange-500' },
  bypass:          { icon: 'Ban',            label: 'Dispensada',           color: 'text-orange-500' },
  upload:          { icon: 'Upload',         label: 'Documento carregado',  color: 'text-emerald-500' },
  email_sent:      { icon: 'Mail',           label: 'Email enviado',        color: 'text-sky-500' },
  doc_generated:   { icon: 'FileText',       label: 'Documento gerado',     color: 'text-indigo-500' },
  started:         { icon: 'PlayCircle',     label: 'Iniciada',             color: 'text-blue-500' },
  completed:       { icon: 'CheckCircle2',   label: 'Concluída',            color: 'text-emerald-500' },
  viewed:          { icon: 'Eye',            label: 'Visto por',            color: 'text-muted-foreground' },
  draft_generated: { icon: 'PenLine',        label: 'Rascunho gerado',      color: 'text-violet-500' },
  comment:         { icon: 'MessageSquare',  label: 'Comentário',           color: 'text-foreground' },
}

// Badges de prioridade com design expressivo
export const PRIORITY_BADGE_CONFIG: Record<string, {
  icon: string
  label: string
  className: string
  dotColor: string
}> = {
  urgent: {
    icon: 'AlertTriangle',
    label: 'Urgente',
    className: 'bg-red-500/15 text-red-600 border-red-500/20',
    dotColor: 'bg-red-500',
  },
  normal: {
    icon: 'ArrowRight',
    label: 'Normal',
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
    dotColor: 'bg-amber-500',
  },
  low: {
    icon: 'ArrowDown',
    label: 'Baixa',
    className: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
    dotColor: 'bg-slate-400',
  },
}
```

**Output:** Constantes `TASK_ACTIVITY_TYPE_CONFIG` e `PRIORITY_BADGE_CONFIG` disponíveis.

---

### B3. Criar hook `useTaskActivities`

**Path:** `hooks/use-task-activities.ts`
**Acção:** CRIAR ficheiro

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TaskActivity } from '@/types/process'

export function useTaskActivities(processId: string, taskId: string | null) {
  const [activities, setActivities] = useState<TaskActivity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchActivities = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${taskId}/activities`)
      if (!res.ok) throw new Error('Erro ao carregar actividades')
      const data = await res.json()
      setActivities(data)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [processId, taskId])

  useEffect(() => {
    if (!taskId) {
      setActivities([])
      return
    }

    fetchActivities()

    // Realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel(`task-activities-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proc_task_activities',
          filter: `proc_task_id=eq.${taskId}`,
        },
        () => {
          fetchActivities()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [taskId, fetchActivities])

  return { activities, isLoading, refetch: fetchActivities }
}
```

**Output:** Hook `useTaskActivities` com fetch + realtime, seguindo o mesmo padrão de `useTaskComments`.

---

## FASE C — Componentes UI

---

### C1. Criar `TaskSheetSidebar`

**Path:** `components/processes/task-sheet-sidebar.tsx`
**Acção:** CRIAR ficheiro

Barra lateral com 56px de largura, ícones com tooltips, indicador de tab activa.

```typescript
'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList,
  Activity,
  MessageSquare,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type SheetTab = 'task' | 'activity' | 'comments' | 'documents'

const SIDEBAR_ITEMS: { id: SheetTab; icon: typeof ClipboardList; label: string; shortcut: string }[] = [
  { id: 'task',      icon: ClipboardList, label: 'Tarefa',      shortcut: '1' },
  { id: 'activity',  icon: Activity,      label: 'Actividade',  shortcut: '2' },
  { id: 'comments',  icon: MessageSquare, label: 'Comentários', shortcut: '3' },
  { id: 'documents', icon: FileText,      label: 'Documentos',  shortcut: '4' },
]

interface TaskSheetSidebarProps {
  activeTab: SheetTab
  onTabChange: (tab: SheetTab) => void
  commentsCount?: number
  activitiesCount?: number
}

export function TaskSheetSidebar({
  activeTab,
  onTabChange,
  commentsCount,
  activitiesCount,
}: TaskSheetSidebarProps) {
  return (
    <div className="w-14 shrink-0 border-r flex flex-col items-center py-3 gap-1">
      {SIDEBAR_ITEMS.map((item) => {
        const isActive = activeTab === item.id
        const Icon = item.icon
        const count = item.id === 'comments' ? commentsCount : item.id === 'activity' ? activitiesCount : undefined

        return (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-10 w-10 relative',
                  isActive && 'bg-accent text-accent-foreground'
                )}
                onClick={() => onTabChange(item.id)}
              >
                <Icon className="h-4.5 w-4.5" />
                {/* Indicador activo */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-foreground rounded-r" />
                )}
                {/* Badge de contagem */}
                {count !== undefined && count > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] font-bold"
                  >
                    {count > 99 ? '99+' : count}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label} <kbd className="ml-1 text-[10px] text-muted-foreground">{item.shortcut}</kbd>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
```

**Output:** Componente sidebar com ícones, tooltips, indicador activo e badges de contagem.

---

### C2. Criar `TaskActivityTimeline`

**Path:** `components/processes/task-activity-timeline.tsx`
**Acção:** CRIAR ficheiro

Timeline enriquecida usando o componente `Timeline` existente de `components/ui/timeline.tsx`.

```typescript
'use client'

import React from 'react'
import {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineHeader,
  TimelineDescription,
  TimelineTime,
} from '@/components/ui/timeline'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RefreshCw, UserPlus, Flag, CalendarClock, Ban,
  Upload, Mail, FileText, PlayCircle, CheckCircle2,
  Eye, PenLine, MessageSquare, Activity,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { TASK_ACTIVITY_TYPE_CONFIG } from '@/lib/constants'
import type { TaskActivity } from '@/types/process'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  RefreshCw, UserPlus, Flag, CalendarClock, Ban,
  Upload, Mail, FileText, PlayCircle, CheckCircle2,
  Eye, PenLine, MessageSquare, Activity,
}

interface TaskActivityTimelineProps {
  activities: TaskActivity[]
  isLoading: boolean
}

export function TaskActivityTimeline({ activities, isLoading }: TaskActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Actividade
        </h4>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Sem actividade registada.</p>
        <p className="text-xs text-muted-foreground mt-1">As acções nesta tarefa aparecerão aqui.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <Timeline orientation="vertical">
          {activities.map((activity, index) => {
            const config = TASK_ACTIVITY_TYPE_CONFIG[activity.activity_type] || {
              icon: 'Activity',
              label: activity.activity_type,
              color: 'text-muted-foreground',
            }
            const IconComponent = ICON_MAP[config.icon] || Activity

            return (
              <TimelineItem key={activity.id}>
                <TimelineDot className={config.color}>
                  <IconComponent className="h-3 w-3" />
                </TimelineDot>
                {index < activities.length - 1 && <TimelineConnector />}
                <TimelineContent>
                  <TimelineHeader>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        {activity.user?.profile?.profile_photo_url && (
                          <AvatarImage src={activity.user.profile.profile_photo_url} />
                        )}
                        <AvatarFallback className="text-[9px]">
                          {activity.user?.commercial_name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {activity.user?.commercial_name || 'Sistema'}
                      </span>
                    </div>
                    <TimelineDescription>{activity.description}</TimelineDescription>
                  </TimelineHeader>
                  <TimelineTime>
                    {formatDistanceToNow(new Date(activity.created_at), {
                      addSuffix: true,
                      locale: pt,
                    })}
                  </TimelineTime>
                </TimelineContent>
              </TimelineItem>
            )
          })}
        </Timeline>
      </div>
    </ScrollArea>
  )
}
```

**Output:** Timeline enriquecida com ícones coloridos por tipo, avatar e timestamp relativo.

---

### C3. Criar `TaskDocumentsPanel`

**Path:** `components/processes/task-documents-panel.tsx`
**Acção:** CRIAR ficheiro

Painel que mostra documentos associados à tarefa (resultado de UPLOAD, emails enviados, docs gerados).

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FileText,
  ExternalLink,
  Download,
  FolderOpen,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ProcessDocument } from '@/types/process'

interface TaskDocumentsPanelProps {
  documents: ProcessDocument[]
  taskTitle?: string
}

export function TaskDocumentsPanel({ documents, taskTitle }: TaskDocumentsPanelProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FolderOpen className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Sem documentos associados.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documentos ({documents.length})
        </h4>
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.doc_type?.name}</span>
                    <span>·</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.file_url} download={doc.file_name}>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
```

**Output:** Painel de documentos com lista, preview links e download.

---

### C4. Redesenhar `TaskDetailSheet` (componente principal)

**Path:** `components/processes/task-detail-sheet.tsx`
**Acção:** REESCREVER COMPLETAMENTE

**Mudanças principais:**
1. Alargar o sheet para `sm:max-w-5xl` (de `sm:max-w-2xl`)
2. Adicionar layout flex com sidebar lateral
3. Gerir estado da tab activa
4. Usar `useTaskActivities` além de `useTaskComments`
5. Manter footer de comentário sempre visível
6. Adicionar keyboard shortcuts (1-4)

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Ban,
  Upload,
  Mail,
  FileText,
  CheckSquare,
} from 'lucide-react'
import { ACTION_TYPE_LABELS, SUBTASK_TYPE_LABELS } from '@/lib/constants'
import { useTaskComments } from '@/hooks/use-task-comments'
import { useTaskActivities } from '@/hooks/use-task-activities'
import { TaskDetailMetadata } from './task-detail-metadata'
import { TaskDetailActions } from './task-detail-actions'
import { TaskActivityFeed } from './task-activity-feed'
import { TaskActivityTimeline } from './task-activity-timeline'
import { TaskDocumentsPanel } from './task-documents-panel'
import { TaskSheetSidebar, type SheetTab } from './task-sheet-sidebar'
import { CommentInput } from './comment-input'
import { toast } from 'sonner'
import type { ProcessTask, ProcessDocument, ProcessOwner, TaskCommentMention } from '@/types/process'

const STATUS_ICONS = {
  completed: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  in_progress: <PlayCircle className="h-5 w-5 text-blue-500" />,
  skipped: <Ban className="h-5 w-5 text-orange-500" />,
  pending: <Circle className="h-5 w-5 text-muted-foreground" />,
}

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

export function TaskDetailSheet({
  task,
  processId,
  propertyId,
  processDocuments,
  owners,
  open,
  onOpenChange,
  onTaskUpdate,
}: TaskDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<SheetTab>('task')
  const [commentValue, setCommentValue] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [mentionUsers, setMentionUsers] = useState<{ id: string; display: string }[]>([])

  const { comments, isLoading: isCommentsLoading, addComment } = useTaskComments(
    processId,
    task?.id ?? null
  )

  const { activities, isLoading: isActivitiesLoading } = useTaskActivities(
    processId,
    task?.id ?? null
  )

  // Reset tab when task changes
  useEffect(() => {
    if (task) setActiveTab('task')
  }, [task?.id])

  // Fetch users for mentions
  useEffect(() => {
    if (!open) return
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users/consultants')
        if (!res.ok) throw new Error()
        const data: { id: string; commercial_name: string }[] = await res.json()
        setMentionUsers(data.map((u) => ({ id: u.id, display: u.commercial_name })))
      } catch {
        // silent
      }
    }
    loadUsers()
  }, [open])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const tabs: SheetTab[] = ['task', 'activity', 'comments', 'documents']
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < tabs.length) {
        setActiveTab(tabs[idx])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const handleSubmitComment = useCallback(async () => {
    if (!commentValue.trim() || isSubmittingComment) return
    setIsSubmittingComment(true)
    try {
      const mentions: TaskCommentMention[] = []
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      let match
      while ((match = mentionRegex.exec(commentValue)) !== null) {
        mentions.push({ display_name: match[1], user_id: match[2] })
      }
      await addComment(commentValue, mentions)
      setCommentValue('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar comentário')
    } finally {
      setIsSubmittingComment(false)
    }
  }, [commentValue, isSubmittingComment, addComment])

  if (!task) return null

  const statusIcon = STATUS_ICONS[task.status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending

  // Render main content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'task':
        return (
          <ScrollArea className="h-full">
            <div className="px-6 py-4 space-y-6">
              <TaskDetailMetadata
                task={task}
                processId={processId}
                onTaskUpdate={onTaskUpdate}
              />
              <div className="h-px bg-border" />
              <TaskDetailActions
                task={task}
                processId={processId}
                propertyId={propertyId}
                processDocuments={processDocuments}
                owners={owners}
                onTaskUpdate={onTaskUpdate}
              />
            </div>
          </ScrollArea>
        )

      case 'activity':
        return (
          <TaskActivityTimeline
            activities={activities}
            isLoading={isActivitiesLoading}
          />
        )

      case 'comments':
        return (
          <ScrollArea className="h-full">
            <div className="px-6 py-4">
              <TaskActivityFeed
                comments={comments}
                isLoading={isCommentsLoading}
              />
            </div>
          </ScrollArea>
        )

      case 'documents':
        return (
          <TaskDocumentsPanel
            documents={processDocuments || []}
            taskTitle={task.title}
          />
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-5xl w-full min-w-[600px] p-0 flex flex-col h-full">
        {/* HEADER FIXO */}
        <SheetHeader className="border-b px-6 py-4 space-y-2">
          <div className="flex items-center gap-2">
            {statusIcon}
            <SheetTitle className="text-lg">{task.title}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {task.action_type === 'COMPOSITE' && task.subtasks && task.subtasks.length > 0 ? (
              (() => {
                const types = [...new Set(task.subtasks.map((s) => (s.config as any)?.type || (s.config as any)?.check_type || 'checklist'))]
                const ICON_MAP: Record<string, React.ReactNode> = {
                  upload: <Upload className="h-3 w-3" />,
                  checklist: <CheckSquare className="h-3 w-3" />,
                  manual: <CheckSquare className="h-3 w-3" />,
                  email: <Mail className="h-3 w-3" />,
                  generate_doc: <FileText className="h-3 w-3" />,
                }
                return types.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs gap-1">
                    {ICON_MAP[t] || null}
                    {SUBTASK_TYPE_LABELS[t] || t}
                  </Badge>
                ))
              })()
            ) : (
              <Badge variant="secondary" className="text-xs">
                {ACTION_TYPE_LABELS[task.action_type as keyof typeof ACTION_TYPE_LABELS] ?? task.action_type}
              </Badge>
            )}
            {task.is_mandatory && (
              <Badge variant="outline" className="text-xs">
                Obrigatória
              </Badge>
            )}
            {task.stage_name && (
              <Badge variant="outline" className="text-xs">
                {task.stage_name}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* CORPO: SIDEBAR + CONTEÚDO */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar de navegação */}
          <TaskSheetSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            commentsCount={comments.length}
            activitiesCount={activities.length}
          />

          {/* Conteúdo principal */}
          <div className="flex-1 overflow-hidden">
            {renderContent()}
          </div>
        </div>

        {/* FOOTER FIXO — Input de comentário (sempre visível) */}
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
  )
}
```

**Output:** Sheet redesenhado com sidebar lateral de 56px, conteúdo por tab, e footer fixo.

---

### C5. Melhorar badges de prioridade em `TaskDetailMetadata`

**Path:** `components/processes/task-detail-metadata.tsx`
**Acção:** MODIFICAR

**Mudança:** Substituir o display de prioridade read-only (linhas 136-140) por badges coloridas.

Substituir o bloco:
```tsx
<span className="flex items-center gap-1.5">
  {PRIORITY_ICONS[(task.priority as TaskPriority) || 'normal']}
  {TASK_PRIORITY_LABELS[(task.priority as TaskPriority) || 'normal']}
</span>
```

Por:
```tsx
(() => {
  const p = (task.priority as TaskPriority) || 'normal'
  const config = PRIORITY_BADGE_CONFIG[p]
  return (
    <Badge variant="outline" className={cn('text-xs gap-1.5', config?.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config?.dotColor)} />
      {TASK_PRIORITY_LABELS[p]}
    </Badge>
  )
})()
```

Adicionar imports:
```typescript
import { PRIORITY_BADGE_CONFIG } from '@/lib/constants'
```

**Output:** Prioridade em modo read-only mostra badge colorida em vez de ícone simples.

---

### C6. Actualizar badges de prioridade em `ProcessTaskCard`

**Path:** `components/processes/process-task-card.tsx`
**Acção:** MODIFICAR

**Mudança:** Substituir o ícone `Flag` simples (linhas 176-179 no kanban e 266-268 na lista) por badges coloridas.

No variant kanban, substituir:
```tsx
{task.priority && task.priority !== 'normal' && (
  <Flag className={cn('h-3.5 w-3.5', priorityColor)} />
)}
```

Por:
```tsx
{task.priority && (
  <Badge variant="outline" className={cn('text-[10px] gap-1 px-1.5 py-0', PRIORITY_BADGE_CONFIG[task.priority]?.className)}>
    <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_BADGE_CONFIG[task.priority]?.dotColor)} />
    {TASK_PRIORITY_LABELS[task.priority]}
  </Badge>
)}
```

Mesmo pattern no variant lista.

Adicionar imports:
```typescript
import { PRIORITY_BADGE_CONFIG } from '@/lib/constants'
```

Remover `PRIORITY_COLORS` e o import de `Flag` (já não necessários).

**Output:** Cards de tarefa mostram prioridade com badge colorida expressiva (todas as prioridades, incluindo "normal").

---

### C7. Validação Zod para actividades (opcional mas recomendado)

**Path:** `lib/validations/activity.ts`
**Acção:** CRIAR ficheiro

```typescript
import { z } from 'zod'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const activitySchema = z.object({
  activity_type: z.enum([
    'status_change', 'assignment', 'priority_change', 'due_date_change',
    'bypass', 'upload', 'email_sent', 'doc_generated', 'started',
    'completed', 'viewed', 'draft_generated', 'comment',
  ]),
  description: z.string().min(1).max(1000),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type ActivityFormData = z.infer<typeof activitySchema>
```

**Output:** Schema Zod para validação de actividades (caso se queira expor POST no futuro).

---

## Resumo de Ficheiros

### Ficheiros a CRIAR (6)

| # | Path | Responsabilidade |
|---|------|------------------|
| 1 | `supabase/migrations/20260305_create_proc_task_activities.sql` | Tabela + índices + RLS |
| 2 | `lib/processes/activity-logger.ts` | Helper `logTaskActivity()` |
| 3 | `app/api/processes/[id]/tasks/[taskId]/activities/route.ts` | GET actividades |
| 4 | `hooks/use-task-activities.ts` | Hook com fetch + realtime |
| 5 | `components/processes/task-sheet-sidebar.tsx` | Sidebar de navegação |
| 6 | `components/processes/task-activity-timeline.tsx` | Timeline enriquecida |
| 7 | `components/processes/task-documents-panel.tsx` | Painel de documentos |
| 8 | `lib/validations/activity.ts` | Schema Zod (opcional) |

### Ficheiros a MODIFICAR (5)

| # | Path | Alteração |
|---|------|-----------|
| 1 | `types/process.ts` | Adicionar `TaskActivityType`, `TaskActivity` |
| 2 | `lib/constants.ts` | Adicionar `TASK_ACTIVITY_TYPE_CONFIG`, `PRIORITY_BADGE_CONFIG` |
| 3 | `components/processes/task-detail-sheet.tsx` | Reescrever: layout sidebar + tabs + usar hooks |
| 4 | `components/processes/task-detail-metadata.tsx` | Badges de prioridade coloridas |
| 5 | `components/processes/process-task-card.tsx` | Badges de prioridade coloridas |
| 6 | `app/api/processes/[id]/tasks/[taskId]/route.ts` | Integrar `logTaskActivity()` |
| 7 | `app/api/processes/[id]/tasks/[taskId]/comments/route.ts` | Integrar `logTaskActivity()` |

### Ficheiros SEM alteração

| Path | Motivo |
|------|--------|
| `components/processes/task-activity-feed.tsx` | Mantém-se como está — usado no tab "Comentários" |
| `components/processes/comment-input.tsx` | Sem alterações necessárias |
| `components/ui/timeline.tsx` | Já suporta tudo o que precisamos |
| `components/ui/tabs.tsx` | Não usado neste redesign (usamos sidebar custom) |
| `components/shared/status-badge.tsx` | Sem alterações |
| `hooks/use-task-comments.ts` | Sem alterações |
| `app/dashboard/processos/[id]/page.tsx` | Sem alterações (props ao sheet mantêm-se iguais) |

---

## Dependências

**Nenhuma dependência nova necessária.** Tudo já está instalado:
- `date-fns` + locale `pt`
- `lucide-react`
- `sonner`
- Todos os componentes shadcn/ui usados (Sheet, ScrollArea, Timeline, Avatar, Badge, Tooltip, Button)

---

## Decisões Tomadas

| Decisão | Escolha | Justificação |
|---------|---------|--------------|
| Split-view | **ADIADO para Fase D** | Começa com single-panel + sidebar. Split-view pode ser adicionado depois sem breaking changes |
| Resizable panels | **NÃO instalar** | CSS Grid é suficiente quando split-view for implementado |
| Deep-linking por tab | **ADIADO para Fase D** | `?task=xxx&tab=activity` pode ser adicionado facilmente depois |
| Sidebar implementation | **Custom (não Tabs vertical)** | Mais controlo sobre layout, badges e keyboard shortcuts |
| Actividades históricas | **Apenas novas** | Migração retroactiva seria complexa e de baixo valor |

---

## Ordem de Implementação Recomendada

1. **A1** — Migração SQL (aplicar via Supabase MCP)
2. **A2** — Helper `logTaskActivity`
3. **B1** — Types
4. **B2** — Constantes
5. **A5** — API GET activities
6. **A3** — Integrar logging na task update API
7. **A4** — Integrar logging nos comentários
8. **B3** — Hook `useTaskActivities`
9. **C1** — Sidebar
10. **C2** — ActivityTimeline
11. **C3** — DocumentsPanel
12. **C4** — Redesenhar TaskDetailSheet
13. **C5** — Priority badges em metadata
14. **C6** — Priority badges em task cards
