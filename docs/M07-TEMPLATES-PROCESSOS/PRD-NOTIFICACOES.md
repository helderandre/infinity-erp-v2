# PRD — Sistema de Notificacoes In-App (Processos & Comentarios)

**Data:** 2026-02-24
**Modulo:** Notificacoes
**Escopo Actual:** Processos, Tarefas, Comentarios de Tarefa, Chat de Processo
**Escopo Futuro:** Todos os modulos (Leads, Imoveis, Documentos, etc.)

---

## 1. Resumo Executivo

Implementar um sistema de notificacoes in-app em tempo real, focado inicialmente nos modulos de **Processos** e **Comentarios/Chat**. O sistema deve notificar utilizadores sobre eventos relevantes (novas angariagoes, aprovagoes, atribuigao de tarefas, comentarios, mengoes, alteragoes de tarefas e tarefas vencidas), com navegagao directa para o contexto e rastreamento de leitura.

---

## 2. Regras de Negocio (Eventos de Notificagao)

| # | Evento | Destinatarios | Conteudo |
|---|--------|---------------|----------|
| 1 | Nova angariagao criada | Gestora Processual + Admin (Broker/CEO) | "Novo processo criado por {consultor} — aguarda aprovagao" |
| 2 | Processo aprovado | Consultor que criou (requested_by) | "O seu processo {ref} foi aprovado" |
| 3 | Tarefa atribuida | Utilizador atribuido (assigned_to) | "Tarefa '{titulo}' foi-lhe atribuida no processo {ref}" |
| 4 | Tarefa concluida | Gestora Processual | "Tarefa '{titulo}' foi concluida no processo {ref}" |
| 5 | Comentario na tarefa | Responsavel da tarefa (assigned_to) | "Novo comentario na tarefa '{titulo}'" |
| 6 | Mensagem no chat do processo | Responsavel da tarefa (se aplicavel) | "Nova mensagem no chat do processo {ref}" |
| 7 | Mengao em comentario de tarefa | Utilizador mencionado | "{autor} mencionou-o na tarefa '{titulo}'" |
| 8 | Mengao no chat do processo | Utilizador mencionado | "{autor} mencionou-o no chat do processo {ref}" |
| 9 | Alteragao de tarefa (data, prioridade, conclusao) | Atribuido da tarefa (se != quem alterou) | "Tarefa '{titulo}' foi actualizada: {detalhe}" |
| 10 | Tarefa vencida (SLA expirado) | Atribuido + Gestora Processual | "Tarefa '{titulo}' ultrapassou o prazo limite" |

**Regra importante:** O utilizador que executa a agao **NUNCA** recebe notificagao dessa mesma agao.

---

## 3. Arquivos da Base de Codigo Afectados

### 3.1 Arquivos Existentes a Modificar

#### API Routes (Backend)

| Arquivo | Motivo |
|---------|--------|
| `app/api/processes/route.ts` | Disparar notif. #1 ao criar processo (POST) |
| `app/api/processes/[id]/approve/route.ts` | Disparar notif. #2 ao aprovar |
| `app/api/processes/[id]/tasks/[taskId]/route.ts` | Disparar notif. #3 (assign), #4 (complete), #9 (update) |
| `app/api/processes/[id]/tasks/[taskId]/comments/route.ts` | Disparar notif. #5 (comment) e #7 (mention) |
| `app/api/processes/[id]/chat/route.ts` | Disparar notif. #6 (message) e #8 (mention) |

#### Frontend Components

| Arquivo | Motivo |
|---------|--------|
| `components/layout/app-sidebar.tsx` | Adicionar icone de sino com badge de contagem |
| `app/dashboard/processos/[id]/page.tsx` | Link de navegagao para tarefa/chat via notificagao |

#### Types & Constants

| Arquivo | Motivo |
|---------|--------|
| `types/process.ts` | Adicionar tipos de Notification |
| `lib/constants.ts` | Adicionar NOTIFICATION_TYPES, NOTIFICATION_LABELS |

### 3.2 Arquivos Novos a Criar

| Arquivo | Propoisito |
|---------|-----------|
| **Database** | |
| `supabase/migrations/XXXXXX_create_notifications_table.sql` | Tabela + indices + RLS + trigger de limpeza |
| **API** | |
| `app/api/notifications/route.ts` | GET (listar) + PUT (marcar todas como lidas) |
| `app/api/notifications/[id]/route.ts` | PUT (marcar como lida) + DELETE (eliminar) |
| `app/api/notifications/unread-count/route.ts` | GET contagem de nao lidas (lightweight) |
| **Service** | |
| `lib/notifications/service.ts` | Servigo centralizado para criar notificagoes |
| `lib/notifications/types.ts` | Enum NotificationType + interfaces |
| **Hooks** | |
| `hooks/use-notifications.ts` | Fetch + Supabase Realtime subscription |
| **Components** | |
| `components/notifications/notification-popover.tsx` | Popover com lista de notificagoes |
| `components/notifications/notification-item.tsx` | Item individual de notificagao |
| `components/notifications/notification-empty.tsx` | Estado vazio |
| **Validagao** | |
| `lib/validations/notification.ts` | Schemas Zod |
| **Cron/Background** | |
| (Supabase pg_cron ou Edge Function) | Verificar tarefas vencidas (notif. #10) |

---

## 4. Schema da Base de Dados

### 4.1 Tabela `notifications`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Destinatario e remetente
  recipient_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES dev_users(id) ON DELETE SET NULL,

  -- Tipo e entidade relacionada
  notification_type TEXT NOT NULL,
  -- Valores: 'process_created' | 'process_approved' | 'task_assigned' |
  --          'task_completed' | 'task_comment' | 'chat_message' |
  --          'comment_mention' | 'chat_mention' | 'task_updated' | 'task_overdue'

  entity_type TEXT NOT NULL,
  -- Valores: 'proc_instance' | 'proc_task' | 'proc_task_comment' | 'proc_chat_message'

  entity_id UUID NOT NULL,

  -- Conteudo (PT-PT)
  title TEXT NOT NULL,
  body TEXT,

  -- URL de navegagao directa
  action_url TEXT NOT NULL,
  -- Exemplos:
  -- /dashboard/processos/{proc_id}
  -- /dashboard/processos/{proc_id}?task={task_id}
  -- /dashboard/processos/{proc_id}?tab=chat&message={msg_id}

  -- Estado de leitura
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Metadados adicionais
  metadata JSONB DEFAULT '{}',
  -- Exemplos:
  -- { "process_ref": "PROC-2026-0042", "task_title": "Upload Caderneta" }
  -- { "process_ref": "PROC-2026-0042", "old_priority": "normal", "new_priority": "urgent" }

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices para performance
CREATE INDEX idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC);

CREATE INDEX idx_notifications_entity
  ON notifications(entity_type, entity_id);

-- Publicar para Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- RLS: utilizador so ve as suas notificagoes
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());

-- Service role pode inserir (sem RLS bypass ja e implicito)
CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);
```

### 4.2 Limpeza Automatica (Opcional — pg_cron)

```sql
-- Limpar notificagoes lidas com mais de 90 dias
-- Limpar notificagoes nao lidas com mais de 180 dias
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * 0', -- Domingos as 03:00
  $$
  DELETE FROM notifications
  WHERE (is_read = true AND created_at < now() - interval '90 days')
     OR (is_read = false AND created_at < now() - interval '180 days');
  $$
);
```

### 4.3 Fungao para Verificar Tarefas Vencidas (pg_cron)

```sql
CREATE OR REPLACE FUNCTION check_overdue_tasks()
RETURNS void AS $$
DECLARE
  task RECORD;
  gestora_ids UUID[];
BEGIN
  -- Buscar IDs dos gestores processuais e admins
  SELECT ARRAY_AGG(ur.user_id) INTO gestora_ids
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name IN ('Gestora Processual', 'Broker/CEO');

  -- Tarefas vencidas (due_date < now(), status != completed/skipped)
  FOR task IN
    SELECT pt.id, pt.title, pt.assigned_to, pt.due_date,
           pi.id as proc_id, pi.external_ref
    FROM proc_tasks pt
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE pt.due_date < now()
      AND pt.status NOT IN ('completed', 'skipped')
      AND pi.current_status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.entity_id = pt.id
          AND n.notification_type = 'task_overdue'
          AND n.created_at > now() - interval '24 hours'
      )
  LOOP
    -- Notificar atribuido
    IF task.assigned_to IS NOT NULL THEN
      INSERT INTO notifications (recipient_id, sender_id, notification_type, entity_type, entity_id, title, body, action_url, metadata)
      VALUES (
        task.assigned_to, NULL, 'task_overdue', 'proc_task', task.id,
        'Tarefa vencida',
        format('A tarefa ''%s'' ultrapassou o prazo limite no processo %s', task.title, task.external_ref),
        format('/dashboard/processos/%s?task=%s', task.proc_id, task.id),
        jsonb_build_object('process_ref', task.external_ref, 'task_title', task.title, 'due_date', task.due_date)
      );
    END IF;

    -- Notificar gestores
    IF gestora_ids IS NOT NULL THEN
      INSERT INTO notifications (recipient_id, sender_id, notification_type, entity_type, entity_id, title, body, action_url, metadata)
      SELECT
        gid, NULL, 'task_overdue', 'proc_task', task.id,
        'Tarefa vencida',
        format('A tarefa ''%s'' ultrapassou o prazo limite no processo %s', task.title, task.external_ref),
        format('/dashboard/processos/%s?task=%s', task.proc_id, task.id),
        jsonb_build_object('process_ref', task.external_ref, 'task_title', task.title, 'due_date', task.due_date, 'assigned_to', task.assigned_to)
      FROM unnest(gestora_ids) AS gid
      WHERE gid != task.assigned_to OR task.assigned_to IS NULL;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agendar verificagao a cada hora
SELECT cron.schedule(
  'check-overdue-tasks',
  '0 * * * *', -- A cada hora
  $$ SELECT check_overdue_tasks(); $$
);
```

---

## 5. Servigo de Notificagoes (Backend)

### 5.1 Tipos de Notificagao

```typescript
// lib/notifications/types.ts

export type NotificationType =
  | 'process_created'     // Nova angariagao
  | 'process_approved'    // Processo aprovado
  | 'task_assigned'       // Tarefa atribuida
  | 'task_completed'      // Tarefa concluida
  | 'task_comment'        // Novo comentario na tarefa
  | 'chat_message'        // Nova mensagem no chat
  | 'comment_mention'     // Mengao em comentario
  | 'chat_mention'        // Mengao no chat
  | 'task_updated'        // Alteragao de tarefa (data, prioridade)
  | 'task_overdue'        // Tarefa vencida

export type NotificationEntityType =
  | 'proc_instance'
  | 'proc_task'
  | 'proc_task_comment'
  | 'proc_chat_message'

export interface CreateNotificationParams {
  recipientId: string
  senderId?: string | null
  notificationType: NotificationType
  entityType: NotificationEntityType
  entityId: string
  title: string
  body?: string
  actionUrl: string
  metadata?: Record<string, unknown>
}

export interface Notification {
  id: string
  recipient_id: string
  sender_id: string | null
  notification_type: NotificationType
  entity_type: NotificationEntityType
  entity_id: string
  title: string
  body: string | null
  action_url: string
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  // Populated via join
  sender?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null }
  }
}
```

### 5.2 Servigo Centralizado

```typescript
// lib/notifications/service.ts
import { createAdminClient } from '@/lib/supabase/admin'
import type { CreateNotificationParams } from './types'

/**
 * Servigo para criar notificagoes — usa service role (bypass RLS)
 * Chamado a partir de Route Handlers apos agoes relevantes
 */
export class NotificationService {
  private supabase = createAdminClient()

  /**
   * Criar uma notificagao para um destinatario
   */
  async create(params: CreateNotificationParams): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .insert({
        recipient_id: params.recipientId,
        sender_id: params.senderId ?? null,
        notification_type: params.notificationType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        title: params.title,
        body: params.body ?? null,
        action_url: params.actionUrl,
        metadata: params.metadata ?? {},
      })

    if (error) {
      console.error('[NotificationService] Erro ao criar notificagao:', error)
      // Nao langar erro — notificagoes nao devem bloquear a agao principal
    }
  }

  /**
   * Criar notificagoes para multiplos destinatarios (batch)
   * Exclui automaticamente o senderId da lista de destinatarios
   */
  async createBatch(
    recipientIds: string[],
    params: Omit<CreateNotificationParams, 'recipientId'>
  ): Promise<void> {
    // Filtrar: quem fez a agao NAO recebe notificagao
    const filteredIds = recipientIds.filter(id => id !== params.senderId)

    if (filteredIds.length === 0) return

    const notifications = filteredIds.map(recipientId => ({
      recipient_id: recipientId,
      sender_id: params.senderId ?? null,
      notification_type: params.notificationType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      title: params.title,
      body: params.body ?? null,
      action_url: params.actionUrl,
      metadata: params.metadata ?? {},
    }))

    const { error } = await this.supabase
      .from('notifications')
      .insert(notifications)

    if (error) {
      console.error('[NotificationService] Erro ao criar notificagoes em batch:', error)
    }
  }

  /**
   * Buscar IDs de utilizadores com roles especificas
   * Util para notificar Gestora Processual + Broker/CEO
   */
  async getUserIdsByRoles(roleNames: string[]): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .in('roles.name', roleNames)

    if (error || !data) return []

    return [...new Set(data.map(d => d.user_id))]
  }
}

// Singleton para reutilizagao
export const notificationService = new NotificationService()
```

### 5.3 Padrao de Integragao nos Route Handlers

```typescript
// Exemplo: app/api/processes/[id]/approve/route.ts
// APOS a logica de aprovagao existente:

import { notificationService } from '@/lib/notifications/service'

// ... (logica de aprovagao existente) ...

// Notificar consultor que criou o processo
if (process.requested_by && process.requested_by !== user.id) {
  await notificationService.create({
    recipientId: process.requested_by,
    senderId: user.id,
    notificationType: 'process_approved',
    entityType: 'proc_instance',
    entityId: process.id,
    title: 'Processo aprovado',
    body: `O processo ${process.external_ref} foi aprovado`,
    actionUrl: `/dashboard/processos/${process.id}`,
    metadata: {
      process_ref: process.external_ref,
      template_name: template.name,
    },
  })
}
```

---

## 6. API Routes de Notificagoes

### 6.1 GET /api/notifications

```typescript
// app/api/notifications/route.ts

// Query params:
// ?page=1&limit=20 — paginagao
// ?unread_only=true — apenas nao lidas
// ?type=task_assigned,comment_mention — filtro por tipo

// Response:
{
  notifications: Notification[],  // Com sender populado
  total: number,
  unread_count: number,
  page: number,
  limit: number,
}
```

### 6.2 PUT /api/notifications (Marcar Todas como Lidas)

```typescript
// Body: {} (sem body)
// Agao: UPDATE notifications SET is_read = true, read_at = now()
//        WHERE recipient_id = auth.uid() AND is_read = false
// Response: { success: true, count: number }
```

### 6.3 PUT /api/notifications/[id] (Marcar Uma como Lida)

```typescript
// Body: { is_read: true } ou { is_read: false }
// Response: { success: true }
```

### 6.4 DELETE /api/notifications/[id]

```typescript
// Response: { success: true }
```

### 6.5 GET /api/notifications/unread-count

```typescript
// Response: { count: number }
// Lightweight — usado pelo badge do sino
```

---

## 7. Hook de Notificagoes (Frontend)

### 7.1 Padrao Existente (Referencia: `use-chat-messages.ts`)

O codebase ja usa Supabase Realtime com o seguinte padrao:

```typescript
// hooks/use-chat-messages.ts (EXISTENTE — padrao a seguir)
const channel = supabase
  .channel(`process-chat-${processId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'proc_chat_messages',
    filter: `proc_instance_id=eq.${processId}`,
  }, () => fetchMessages())
  .subscribe()

return () => supabase.removeChannel(channel)
```

### 7.2 Hook de Notificagoes (Novo)

```typescript
// hooks/use-notifications.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/notifications/types'

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  // 1. Fetch inicial
  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=50')
      if (!res.ok) throw new Error('Erro ao carregar notificagoes')
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // 2. Fetch contagem (lightweight)
  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return
    const res = await fetch('/api/notifications/unread-count')
    if (res.ok) {
      const { count } = await res.json()
      setUnreadCount(count)
    }
  }, [userId])

  // 3. Subscrigao Realtime
  useEffect(() => {
    if (!userId) return

    fetchNotifications()

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        // Optimistic: adicionar nova notificagao ao topo
        const newNotif = payload.new as Notification
        setNotifications(prev => {
          if (prev.find(n => n.id === newNotif.id)) return prev
          return [newNotif, ...prev]
        })
        setUnreadCount(prev => prev + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        // Re-fetch ao actualizar (marcar como lida, etc.)
        fetchUnreadCount()
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, fetchNotifications, fetchUnreadCount])

  // 4. Agoes
  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    await fetch(`/api/notifications/${notificationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
    setUnreadCount(0)

    await fetch('/api/notifications', { method: 'PUT' })
  }, [])

  const deleteNotification = useCallback(async (notificationId: string) => {
    const notif = notifications.find(n => n.id === notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    if (notif && !notif.is_read) setUnreadCount(prev => Math.max(0, prev - 1))

    await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' })
  }, [notifications])

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  }
}
```

---

## 8. Componentes Frontend

### 8.1 Notification Popover (Sino no Sidebar/Topbar)

**Referencia:** O codebase usa `Popover` + `PopoverContent` do shadcn/ui extensivamente (ex: `PropertyAddressMapPicker`, `ChatInput`).

```typescript
// components/notifications/notification-popover.tsx
'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationItem } from './notification-item'
import { useUser } from '@/hooks/use-user'

export function NotificationPopover() {
  const { user } = useUser()
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(user?.id ?? null)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center',
              'rounded-full bg-red-500 text-[0.6rem] font-medium text-white'
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        {/* Cabegalho */}
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-sm font-semibold">Notificagoes</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={markAllAsRead}>
              Marcar tudo como lido
            </Button>
          )}
        </div>
        <Separator />

        {/* Lista */}
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Sem notificagoes</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(notif => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
```

### 8.2 Notification Item

**Referencia:** Segue o padrao de `task-activity-feed.tsx` (avatar + conteudo + timestamp).

```typescript
// components/notifications/notification-item.tsx
'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { NOTIFICATION_TYPE_CONFIG } from '@/lib/constants' // a criar
import type { Notification } from '@/lib/notifications/types'

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationItem({ notification, onRead, onDelete }: NotificationItemProps) {
  const router = useRouter()
  const config = NOTIFICATION_TYPE_CONFIG[notification.notification_type]

  const handleClick = () => {
    if (!notification.is_read) onRead(notification.id)
    router.push(notification.action_url)
  }

  const initials = notification.sender?.commercial_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        !notification.is_read && 'bg-primary/5'
      )}
    >
      {/* Icone ou Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {notification.sender?.profile?.profile_photo_url ? (
          <AvatarImage src={notification.sender.profile.profile_photo_url} />
        ) : null}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      {/* Conteudo */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !notification.is_read && 'font-medium')}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: pt,
          })}
        </p>
      </div>

      {/* Indicador de nao lido */}
      {!notification.is_read && (
        <div className="shrink-0 mt-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </button>
  )
}
```

### 8.3 Integragao no Sidebar

**Referencia:** `components/layout/app-sidebar.tsx` — adicionar no `SidebarHeader` ou perto do menu do utilizador.

```typescript
// No SidebarHeader ou SidebarFooter:
import { NotificationPopover } from '@/components/notifications/notification-popover'

// Dentro do JSX:
<SidebarHeader>
  <div className="flex items-center justify-between px-2">
    <Logo />
    <NotificationPopover />
  </div>
</SidebarHeader>
```

---

## 9. Constantes e Labels (PT-PT)

### Adicionar a `lib/constants.ts`

```typescript
// NOTIFICATION_TYPE_CONFIG — configuragao visual por tipo
export const NOTIFICATION_TYPE_CONFIG: Record<string, {
  icon: string       // Nome do icone Lucide
  label: string      // Label em PT-PT
  color: string      // Cor do badge/icone
}> = {
  process_created:  { icon: 'FilePlus2',      label: 'Novo Processo',           color: 'amber' },
  process_approved: { icon: 'CheckCircle2',    label: 'Processo Aprovado',       color: 'emerald' },
  task_assigned:    { icon: 'UserCheck',       label: 'Tarefa Atribuida',        color: 'blue' },
  task_completed:   { icon: 'CircleCheckBig',  label: 'Tarefa Concluida',        color: 'emerald' },
  task_comment:     { icon: 'MessageSquare',   label: 'Comentario',              color: 'slate' },
  chat_message:     { icon: 'MessageCircle',   label: 'Mensagem no Chat',        color: 'indigo' },
  comment_mention:  { icon: 'AtSign',          label: 'Mengao em Comentario',    color: 'amber' },
  chat_mention:     { icon: 'AtSign',          label: 'Mengao no Chat',          color: 'amber' },
  task_updated:     { icon: 'RefreshCw',       label: 'Tarefa Actualizada',      color: 'orange' },
  task_overdue:     { icon: 'AlertTriangle',   label: 'Tarefa Vencida',          color: 'red' },
}

export const NOTIFICATION_LABELS = {
  title: 'Notificagoes',
  no_notifications: 'Sem notificagoes',
  mark_all_read: 'Marcar tudo como lido',
  mark_as_read: 'Marcar como lido',
  mark_as_unread: 'Marcar como nao lido',
  delete: 'Eliminar',
  time_just_now: 'Agora mesmo',
}
```

---

## 10. Validagao Zod

```typescript
// lib/validations/notification.ts
import { z } from 'zod'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const notificationUpdateSchema = z.object({
  is_read: z.boolean(),
})

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread_only: z.coerce.boolean().default(false),
  type: z.string().optional(), // Comma-separated types
})

export type NotificationUpdateFormData = z.infer<typeof notificationUpdateSchema>
```

---

## 11. Padroes de Implementagao da Base de Codigo

### 11.1 Padrao de Real-time Subscription (Existente)

O codebase ja implementa 3 hooks com Supabase Realtime:

| Hook | Tabela | Eventos | Ficheiro |
|------|--------|---------|----------|
| `useChatMessages` | `proc_chat_messages` | INSERT, UPDATE | `hooks/use-chat-messages.ts` |
| `useChatPresence` | (presence API) | sync | `hooks/use-chat-presence.ts` |
| `useTaskComments` | `proc_task_comments` | INSERT | `hooks/use-task-comments.ts` |

**Padrao consistente:**
1. `useState` para dados + loading
2. `useCallback` para fetch functions
3. `useEffect` para setup subscription + cleanup
4. `useRef` para channel reference
5. Cleanup: `supabase.removeChannel(channel)`

### 11.2 Padrao de Route Handler (Existente)

```typescript
// Padrao consistente em todos os handlers:
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    // Validar input com Zod
    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Dados invalidos', details: validation.error.flatten() }, { status: 400 })
    }

    // Operagao no Supabase
    const { data, error } = await supabase.from('table').insert({...}).select()
    if (error) throw error

    // Sucesso
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Context:', error)
    return NextResponse.json({ error: 'Mensagem PT-PT' }, { status: 500 })
  }
}
```

### 11.3 Padrao de Mengoes (Existente)

```typescript
// Formato: @[Display Name](user-id)
// Regex: /@\[([^\]]+)\]\(([^)]+)\)/g

// Validagao Zod:
mentions: z.array(z.object({
  user_id: z.string().regex(uuidRegex),
  display_name: z.string(),
})).default([])
```

### 11.4 Padrao de Permissoes (Existente)

```typescript
// No approve/reject/return/hold:
const { data: userData } = await adminClient
  .from('user_roles')
  .select('roles(name)')
  .eq('user_id', user.id)

const roleNames = userData?.map(ur => ur.roles?.name).filter(Boolean) || []
const hasPermission = roleNames.some(name =>
  ['Broker/CEO', 'Gestora Processual'].includes(name as string)
)
```

### 11.5 Padrao de Skeleton Loading (Existente)

```typescript
// Referencia: task-activity-feed.tsx
{isLoading ? (
  [1, 2, 3].map(i => (
    <div key={i} className="flex gap-3">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  ))
) : /* ... */}
```

### 11.6 Padrao de Timestamp (Existente)

```typescript
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

formatDistanceToNow(new Date(comment.created_at), {
  addSuffix: true,
  locale: pt,
})
// Resultado: "ha 5 minutos", "ha 2 horas", etc.
```

---

## 12. Documentagao Externa Relevante

### 12.1 Supabase Realtime — Postgres Changes

**Fonte:** [Supabase Docs](https://supabase.com/docs/guides/realtime/postgres-changes)

```typescript
// Filtrar por recipient_id (crucial para notificagoes)
const channel = supabase
  .channel('user-notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `recipient_id=eq.${userId}`,
  }, (payload) => {
    // payload.new contem a notificagao completa
  })
  .subscribe()
```

**Requisitos:**
- Tabela deve estar publicada: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications;`
- Para receber old records em UPDATE: `ALTER TABLE notifications REPLICA IDENTITY FULL;`
- DELETE events NAO suportam filtros
- RLS NAO se aplica a DELETE events no payload

### 12.2 Padrao MakerKit — Notificagoes com Supabase

**Fonte:** [MakerKit Blog](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs)

Padroes adoptados:
- Tabela com `dismissed` em vez de `is_read` (nos usamos `is_read` + `read_at`)
- `expires_at` para auto-limpeza
- RLS policies para acesso restrito
- Fetch inicial + Realtime subscription combinados

### 12.3 Padrao de Notification Bell — shadcn/ui

**Fonte:** [MakerKit](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs)

```typescript
// Badge com contagem no icone
<Button className="relative h-9 w-9" variant="ghost">
  <Bell className="h-4 w-4" />
  <span className={cn(
    'absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center',
    'rounded-full bg-red-500 text-[0.65rem] text-white',
    { hidden: !count }
  )}>
    {count}
  </span>
</Button>
```

### 12.4 Database Triggers para Notificagoes

**Fonte:** [Supabase Docs — Triggers](https://supabase.com/docs/guides/database/postgres/triggers)

```sql
-- Trigger AFTER INSERT/UPDATE
CREATE TRIGGER trg_notify_on_event
AFTER INSERT OR UPDATE ON proc_tasks
FOR EACH ROW
EXECUTE FUNCTION create_task_notification();
```

**Decisao de design:** Optamos por criar notificagoes no **Route Handler** (applicagao) em vez de triggers SQL, porque:
1. Temos acesso ao contexto completo (user autenticado, dados do request)
2. Logica condicional mais flexivel (ex: "quem alterou NAO recebe")
3. Mais facil de debugar e testar
4. Triggers SQL para notif. #10 (tarefas vencidas) via pg_cron — unico caso de trigger

### 12.5 Best Practices (MagicBell)

**Fonte:** [MagicBell Blog](https://www.magicbell.com/blog/notification-system-design)

Recomendagoes adoptadas:
- **Idempotencia:** Verificar duplicados antes de criar (ex: task_overdue so 1x por 24h)
- **Rate limiting:** `max_notifications_per_hour` por utilizador (futuro)
- **Auto-expire:** Limpeza automatica de notificagoes antigas
- **Nao bloquear:** Erro em notificagao NAO deve bloquear a agao principal

---

## 13. Fluxo de Navegagao (action_url)

| Tipo | action_url | Destino |
|------|-----------|---------|
| process_created | `/dashboard/processos/{proc_id}` | Detalhe do processo |
| process_approved | `/dashboard/processos/{proc_id}` | Detalhe do processo |
| task_assigned | `/dashboard/processos/{proc_id}?task={task_id}` | Processo com task aberta |
| task_completed | `/dashboard/processos/{proc_id}?task={task_id}` | Processo com task aberta |
| task_comment | `/dashboard/processos/{proc_id}?task={task_id}&tab=comments` | Comentarios da task |
| chat_message | `/dashboard/processos/{proc_id}?tab=chat` | Chat do processo |
| comment_mention | `/dashboard/processos/{proc_id}?task={task_id}&tab=comments` | Comentarios da task |
| chat_mention | `/dashboard/processos/{proc_id}?tab=chat&message={msg_id}` | Chat com destaque |
| task_updated | `/dashboard/processos/{proc_id}?task={task_id}` | Processo com task aberta |
| task_overdue | `/dashboard/processos/{proc_id}?task={task_id}` | Processo com task aberta |

---

## 14. Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│                                                         │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ NotificationPop │  │   useNotifications Hook      │  │
│  │ (Bell + Badge)  │◄─┤  - fetch /api/notifications  │  │
│  │                 │  │  - Supabase Realtime sub     │  │
│  │  ┌───────────┐  │  │  - markAsRead/markAllAsRead │  │
│  │  │ Item      │  │  │  - deleteNotification       │  │
│  │  │ Item      │  │  └──────────┬───────────────────┘  │
│  │  │ Item      │  │             │                       │
│  │  └───────────┘  │             │ Supabase Realtime     │
│  └─────────────────┘             │ (INSERT on            │
│                                  │  notifications table) │
└──────────────────────────────────┼───────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE (PostgreSQL)                    │
│                                                         │
│  ┌──────────────────┐    ┌───────────────────────────┐  │
│  │  notifications   │◄───┤  Route Handlers (API)     │  │
│  │  table           │    │                           │  │
│  │  - recipient_id  │    │  approve → notif #2       │  │
│  │  - sender_id     │    │  task update → notif #3-9 │  │
│  │  - type          │    │  comment → notif #5, #7   │  │
│  │  - entity_id     │    │  chat → notif #6, #8      │  │
│  │  - is_read       │    │                           │  │
│  │  - action_url    │    │  NotificationService      │  │
│  └──────────────────┘    │  .create() / .createBatch()│  │
│                          └───────────────────────────┘  │
│  ┌──────────────────┐                                   │
│  │  pg_cron         │                                   │
│  │  check_overdue() │──► INSERT notifications (notif #10)│
│  │  cleanup_old()   │──► DELETE old notifications        │
│  └──────────────────┘                                   │
│                                                         │
│  ┌──────────────────┐                                   │
│  │  RLS Policies    │                                   │
│  │  - SELECT own    │                                   │
│  │  - UPDATE own    │                                   │
│  │  - DELETE own    │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 15. Ordem de Implementagao Recomendada

| Passo | O Que | Ficheiros |
|-------|-------|-----------|
| 1 | Migragao SQL (tabela + indices + RLS + publicagao) | `create_notifications_table.sql` |
| 2 | Tipos TypeScript | `lib/notifications/types.ts` |
| 3 | Servigo de notificagoes (backend) | `lib/notifications/service.ts` |
| 4 | API routes de notificagoes | `app/api/notifications/` |
| 5 | Validagao Zod | `lib/validations/notification.ts` |
| 6 | Constantes e labels PT-PT | `lib/constants.ts` (editar) |
| 7 | Hook `useNotifications` | `hooks/use-notifications.ts` |
| 8 | Componentes UI (popover + item) | `components/notifications/` |
| 9 | Integragao no sidebar | `components/layout/app-sidebar.tsx` (editar) |
| 10 | Integragao nos route handlers existentes | 5 ficheiros existentes (editar) |
| 11 | Tipos no `types/process.ts` | Editar |
| 12 | pg_cron para tarefas vencidas | SQL migration |
| 13 | pg_cron para limpeza | SQL migration |

---

## 16. Fontes e Referancias

| Fonte | URL | Conteudo |
|-------|-----|----------|
| Supabase Realtime Docs | supabase.com/docs/guides/realtime/postgres-changes | Subscrigoes Postgres Changes |
| Supabase Triggers Docs | supabase.com/docs/guides/database/postgres/triggers | Database triggers |
| MakerKit Tutorial | makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs | Notificagoes RT completas |
| MagicBell Design | magicbell.com/blog/notification-system-design | Arquitectura de notificagoes |
| DEV Community | dev.to/lra8dev/building-real-time-magic-supabase-subscriptions-in-nextjs-15 | Next.js 15 + Supabase RT |
| ShipSaaS | shipsaas.com/blog/next-js-supabase-realtime | Server + Client component pattern |
| Supabase Push Notifs | supabase.com/docs/guides/functions/examples/push-notifications | Edge Functions webhooks |
| Novu | novu.co/blog/react-notifications | React notification patterns |

---

## 17. Decisoes de Design

| Decisao | Escolha | Motivo |
|---------|---------|--------|
| Criar notifs no app vs. trigger SQL | App (Route Handlers) | Contexto completo, logica condicional, debug facil |
| Tarefas vencidas | pg_cron + SQL function | Nao depende de request HTTP, executa automaticamente |
| Real-time delivery | Supabase Realtime (postgres_changes) | Ja usado no codebase (chat, comments) |
| Storage | PostgreSQL (mesma DB) | Simplicidade, sem infra adicional |
| State management | React Hook (useState) | Consistente com codebase (nao usa Zustand) |
| Limpeza | pg_cron semanal | Evita crescimento infinito da tabela |
| RLS | Sim, por recipient_id | Seguranga — utilizador so ve as suas |
| Notif. de quem fez a agao | NAO recebe | Regra de negocio explicita |
