# SPEC — Sistema de Notificações In-App

**Data:** 2026-02-24
**PRD de origem:** PRD-NOTIFICACOES.md
**Escopo:** Processos, Tarefas, Comentários de Tarefa, Chat de Processo

---

## Índice

1. [Migração SQL](#1-migração-sql)
2. [Ficheiros Novos a Criar](#2-ficheiros-novos-a-criar)
3. [Ficheiros Existentes a Modificar](#3-ficheiros-existentes-a-modificar)
4. [Ordem de Implementação](#4-ordem-de-implementação)

---

## 1. Migração SQL

### Ficheiro: Executar via Supabase MCP (`execute_sql`)

Executar o SQL directamente via MCP server `SupabaseInfinity` (não criar ficheiro de migração local).

**O que fazer:**

```sql
-- 1. Tabela notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC);

CREATE INDEX idx_notifications_entity
  ON notifications(entity_type, entity_id);

-- 3. Publicar para Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 4. RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT TO service_role
  WITH CHECK (true);
```

**pg_cron (tarefas vencidas + limpeza):** Implementar numa fase posterior — não incluir neste scope inicial. O evento #10 (task_overdue) fica fora desta implementação.

---

## 2. Ficheiros Novos a Criar

### 2.1 `lib/notifications/types.ts`

**O que fazer:** Definir tipos TypeScript para o sistema de notificações.

```typescript
export type NotificationType =
  | 'process_created'
  | 'process_approved'
  | 'process_rejected'
  | 'process_returned'
  | 'task_assigned'
  | 'task_completed'
  | 'task_comment'
  | 'chat_message'
  | 'comment_mention'
  | 'chat_mention'
  | 'task_updated'
  | 'task_overdue'

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
  // Via join
  sender?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  }
}
```

---

### 2.2 `lib/notifications/service.ts`

**O que fazer:** Serviço centralizado que cria notificações usando o admin client (bypass RLS). Importar `createAdminClient` de `@/lib/supabase/admin` — seguir o padrão exacto desse ficheiro.

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import type { CreateNotificationParams } from './types'

export class NotificationService {
  private supabase = createAdminClient()

  /** Criar uma notificação para um destinatário */
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
      console.error('[NotificationService] Erro ao criar notificação:', error)
      // NÃO lançar erro — notificações não devem bloquear a acção principal
    }
  }

  /**
   * Criar notificações para múltiplos destinatários (batch).
   * Exclui automaticamente o senderId da lista de destinatários.
   */
  async createBatch(
    recipientIds: string[],
    params: Omit<CreateNotificationParams, 'recipientId'>
  ): Promise<void> {
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
      console.error('[NotificationService] Erro batch:', error)
    }
  }

  /** Buscar IDs de utilizadores com roles específicas */
  async getUserIdsByRoles(roleNames: string[]): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('dev_users')
      .select(`
        id,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles!inner(name)
        )
      `)

    if (error || !data) return []

    // Filtrar no JS porque o Supabase não permite .in() num campo nested com !inner
    const filtered = data.filter((u: any) =>
      u.user_roles?.some((ur: any) => roleNames.includes(ur.role?.name))
    )

    return [...new Set(filtered.map((u: any) => u.id as string))]
  }
}

export const notificationService = new NotificationService()
```

**Nota sobre `getUserIdsByRoles`:** O padrão de join `user_roles!user_roles_user_id_fkey!inner(role:roles(name))` já é usado em `approve/route.ts:40-42`, `reject/route.ts:32-34`, `return/route.ts:32-34`, `hold/route.ts:32-34`. Replicar exactamente esse padrão. Como o filtro `.in()` numa coluna nested não funciona no Supabase PostgREST, buscar todos e filtrar no JS.

---

### 2.3 `lib/validations/notification.ts`

**O que fazer:** Schemas Zod para as API routes de notificações. Seguir o padrão de `lib/validations/comment.ts` (mesma regex UUID).

```typescript
import { z } from 'zod'

export const notificationUpdateSchema = z.object({
  is_read: z.boolean(),
})

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread_only: z.coerce.boolean().default(false),
  type: z.string().optional(),
})

export type NotificationUpdateFormData = z.infer<typeof notificationUpdateSchema>
```

---

### 2.4 `app/api/notifications/route.ts`

**O que fazer:** GET (listar notificações do user autenticado) + PUT (marcar todas como lidas).

Seguir o padrão exacto dos outros route handlers (e.g. `app/api/processes/route.ts`):
- `createClient` de `@/lib/supabase/server`
- `supabase.auth.getUser()` para auth check
- Validação com Zod dos query params
- try/catch com mensagens PT-PT

**GET handler:**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { notificationQuerySchema } from '@/lib/validations/notification'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = notificationQuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      unread_only: searchParams.get('unread_only') || 'false',
      type: searchParams.get('type') || undefined,
    })

    // Query notificações com sender join
    let query = supabase
      .from('notifications')
      .select(
        '*, sender:dev_users!notifications_sender_id_fkey(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))',
        { count: 'exact' }
      )
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .range((params.page - 1) * params.limit, params.page * params.limit - 1)

    if (params.unread_only) {
      query = query.eq('is_read', false)
    }

    if (params.type) {
      const types = params.type.split(',')
      query = query.in('notification_type', types)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Contagem de não lidas (query separada, lightweight)
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)

    return NextResponse.json({
      notifications: data,
      total: count ?? 0,
      unread_count: unreadCount ?? 0,
      page: params.page,
      limit: params.limit,
    })
  } catch (error) {
    console.error('Erro ao carregar notificações:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

**PUT handler (marcar todas como lidas):**

```typescript
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .eq('is_read', false)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: data?.length ?? 0 })
  } catch (error) {
    console.error('Erro ao marcar notificações como lidas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

**Nota sobre o join do sender:** A foreign key `notifications_sender_id_fkey` pode não ser o nome exacto que o Supabase gera. Se o Supabase reclamar, usar a sintaxe sem hint: `sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))` — ou verificar o nome da FK com `\d notifications` via MCP.

---

### 2.5 `app/api/notifications/[id]/route.ts`

**O que fazer:** PUT (marcar uma como lida/não lida) + DELETE (eliminar).

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { notificationUpdateSchema } from '@/lib/validations/notification'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = notificationUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { is_read: validation.data.is_read }
    if (validation.data.is_read) {
      updateData.read_at = new Date().toISOString()
    } else {
      updateData.read_at = null
    }

    const { error } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .eq('recipient_id', user.id) // RLS garante, mas double-check

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao actualizar notificação:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('recipient_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar notificação:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

**Nota sobre `params`:** Usar `{ params }: { params: Promise<{ id: string }> }` e `const { id } = await params` — este é o padrão exacto de Next.js 16 usado em todos os route handlers do projecto (ver `approve/route.ts:15`, `comments/route.ts:41`).

---

### 2.6 `app/api/notifications/unread-count/route.ts`

**O que fazer:** GET com contagem lightweight (apenas count, sem dados).

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    console.error('Erro ao contar notificações:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

---

### 2.7 `hooks/use-notifications.ts`

**O que fazer:** Hook client-side com fetch inicial + Supabase Realtime subscription. Seguir o padrão exacto de `hooks/use-chat-messages.ts`:
- `useState` para dados + loading
- `useCallback` para fetch functions
- `useEffect` para setup subscription + cleanup
- `useRef` para channel reference
- Cleanup: `supabase.removeChannel(channel)`
- Importar `createClient` de `@/lib/supabase/client` (NOT server)

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/notifications/types'

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=50')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return
    const res = await fetch('/api/notifications/unread-count')
    if (res.ok) {
      const { count } = await res.json()
      setUnreadCount(count)
    }
  }, [userId])

  // Subscrição Realtime — seguir padrão de use-chat-messages.ts
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
        fetchUnreadCount()
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, fetchNotifications, fetchUnreadCount])

  const markAsRead = useCallback(async (notificationId: string) => {
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

### 2.8 `components/notifications/notification-popover.tsx`

**O que fazer:** Popover com sino + badge + lista de notificações. Usar componentes shadcn existentes: `Popover`, `PopoverContent`, `PopoverTrigger`, `ScrollArea`, `Separator`, `Skeleton`, `Button`. Seguir padrão de avatar de `components/processes/task-activity-feed.tsx`.

```typescript
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
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-sm font-semibold">Notificações</h4>
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
              <p className="text-sm text-muted-foreground">Sem notificações</p>
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

---

### 2.9 `components/notifications/notification-item.tsx`

**O que fazer:** Item individual com avatar do sender, título, body, timestamp relativo, indicador de não lido. Ao clicar: marca como lido + navega para `action_url`.

Seguir padrão de timestamp de `task-activity-feed.tsx`: `formatDistanceToNow` com `{ addSuffix: true, locale: pt }`.

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { NOTIFICATION_TYPE_CONFIG } from '@/lib/constants'
import type { Notification } from '@/lib/notifications/types'

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter()

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
      <Avatar className="h-8 w-8 shrink-0">
        {notification.sender?.profile?.profile_photo_url ? (
          <AvatarImage src={notification.sender.profile.profile_photo_url} />
        ) : null}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

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

      {!notification.is_read && (
        <div className="shrink-0 mt-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </button>
  )
}
```

---

## 3. Ficheiros Existentes a Modificar

### 3.1 `lib/constants.ts`

**Localização:** Após a linha 661 (`export const CHAT_EMOJI_QUICK = [...]`) e antes da linha 663 (`// --- LEADS ---`).

**O que fazer:** Adicionar bloco de constantes de notificações.

```typescript
// --- NOTIFICAÇÕES ---

export const NOTIFICATION_TYPE_CONFIG: Record<string, {
  icon: string
  label: string
  color: string
}> = {
  process_created:  { icon: 'FilePlus2',     label: 'Novo Processo',        color: 'amber' },
  process_approved: { icon: 'CheckCircle2',   label: 'Processo Aprovado',    color: 'emerald' },
  process_rejected: { icon: 'XCircle',        label: 'Processo Rejeitado',   color: 'red' },
  process_returned: { icon: 'Undo2',          label: 'Processo Devolvido',   color: 'orange' },
  task_assigned:    { icon: 'UserCheck',      label: 'Tarefa Atribuída',     color: 'blue' },
  task_completed:   { icon: 'CircleCheckBig', label: 'Tarefa Concluída',     color: 'emerald' },
  task_comment:     { icon: 'MessageSquare',  label: 'Comentário',           color: 'slate' },
  chat_message:     { icon: 'MessageCircle',  label: 'Mensagem no Chat',     color: 'indigo' },
  comment_mention:  { icon: 'AtSign',         label: 'Menção em Comentário', color: 'amber' },
  chat_mention:     { icon: 'AtSign',         label: 'Menção no Chat',       color: 'amber' },
  task_updated:     { icon: 'RefreshCw',      label: 'Tarefa Actualizada',   color: 'orange' },
  task_overdue:     { icon: 'AlertTriangle',  label: 'Tarefa Vencida',       color: 'red' },
}

export const NOTIFICATION_LABELS = {
  title: 'Notificações',
  no_notifications: 'Sem notificações',
  mark_all_read: 'Marcar tudo como lido',
  mark_as_read: 'Marcar como lido',
  mark_as_unread: 'Marcar como não lido',
  delete: 'Eliminar',
} as const
```

---

### 3.2 `types/process.ts`

**Localização:** Ao final do ficheiro, após a linha 197 (final de `ChatReadReceipt`).

**O que fazer:** Apenas re-exportar os tipos de notificação para manter backward compatibility com imports existentes.

```typescript
// ── Notificações ──

export type { Notification, NotificationType, NotificationEntityType } from '@/lib/notifications/types'
```

---

### 3.3 `components/layout/app-sidebar.tsx`

**O que fazer:** Adicionar o `NotificationPopover` no `SidebarHeader`, ao lado do logo. O header actual (`linhas 167-185`) tem apenas o logo — adicionar o sino à direita.

**Modificação exacta — substituir o bloco `SidebarHeader` (linhas 167-185):**

```typescript
// ANTES (linhas 167-185):
<SidebarHeader>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton size="lg" asChild>
        <Link href="/dashboard">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold">ERP Infinity</span>
            <span className="text-xs text-muted-foreground">Imobiliária</span>
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarHeader>

// DEPOIS:
<SidebarHeader>
  <SidebarMenu>
    <SidebarMenuItem>
      <div className="flex items-center justify-between w-full">
        <SidebarMenuButton size="lg" asChild>
          <Link href="/dashboard">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-semibold">ERP Infinity</span>
              <span className="text-xs text-muted-foreground">Imobiliária</span>
            </div>
          </Link>
        </SidebarMenuButton>
        <NotificationPopover />
      </div>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarHeader>
```

**Adicionar import no topo do ficheiro (após linha 53 `import { toast } from 'sonner'`):**

```typescript
import { NotificationPopover } from '@/components/notifications/notification-popover'
```

---

### 3.4 `app/api/acquisitions/route.ts` — Notificação #1 (Nova angariação)

**O que fazer:** Após criar `procInstance` (linha 258), disparar notificação para Gestora Processual + Broker/CEO.

**Adicionar import no topo (após linha 3):**

```typescript
import { notificationService } from '@/lib/notifications/service'
```

**Adicionar após a linha 258 (`const procInstance = ... .single()`) e antes do check de erro na linha 260:**

Na verdade, adicionar **após** o check de erro (linha 265, antes do `return` na linha 267):

```typescript
    // Notificar Gestora Processual + Broker/CEO (evento #1)
    try {
      const approverIds = await notificationService.getUserIdsByRoles(['Broker/CEO', 'Gestora Processual'])
      if (approverIds.length > 0) {
        await notificationService.createBatch(approverIds, {
          senderId: user.id,
          notificationType: 'process_created',
          entityType: 'proc_instance',
          entityId: procInstance.id,
          title: 'Nova angariação submetida',
          body: `${data.title} — aguarda aprovação`,
          actionUrl: `/dashboard/processos/${procInstance.id}`,
          metadata: { property_title: data.title },
        })
      }
    } catch (notifError) {
      console.error('[Acquisitions] Erro ao enviar notificações:', notifError)
    }
```

**Dados disponíveis neste ponto:** `user.id` (requester), `procInstance.id`, `data.title` (título do imóvel do body validado). NÃO temos `external_ref` porque é gerado por trigger — usamos o título do imóvel no body.

---

### 3.5 `app/api/processes/[id]/approve/route.ts` — Notificação #2 (Processo aprovado)

**O que fazer:** Após aprovação, notificar o consultor que criou o processo (`requested_by`).

**1. Adicionar import no topo (após linha 3):**

```typescript
import { notificationService } from '@/lib/notifications/service'
```

**2. Expandir o select do processo na linha 126 para incluir `requested_by` e `external_ref`:**

```typescript
// ANTES (linha 126):
.select('*, property:dev_properties(id)')

// DEPOIS:
.select('*, property:dev_properties(id), requested_by, external_ref')
```

**Nota:** `requested_by` e `external_ref` são colunas directas de `proc_instances`, logo o `*` já as inclui. Mas como o código no approve usa `proc.property.id` com cast `(proc as any)`, é importante confirmar que `proc.requested_by` e `proc.external_ref` estão acessíveis. O `*` já devolve tudo — basta usar.

**3. Adicionar após a linha 231 (`console.log('[APPROVE] Aprovação concluída com sucesso!')`) e antes da linha 232 (`return`):**

```typescript
    // Notificar consultor que criou o processo (evento #2)
    try {
      if (proc.requested_by && proc.requested_by !== user.id) {
        await notificationService.create({
          recipientId: proc.requested_by,
          senderId: user.id,
          notificationType: 'process_approved',
          entityType: 'proc_instance',
          entityId: id,
          title: 'Processo aprovado',
          body: `O processo ${proc.external_ref || ''} foi aprovado com o template "${template.name}"`,
          actionUrl: `/dashboard/processos/${id}`,
          metadata: {
            process_ref: proc.external_ref,
            template_name: template.name,
          },
        })
      }
    } catch (notifError) {
      console.error('[APPROVE] Erro ao enviar notificação:', notifError)
    }
```

**Dados disponíveis:** `proc.requested_by` (UUID), `proc.external_ref` (string, e.g. "PROC-2026-0042"), `template.name`, `id` (proc UUID), `user.id` (approver).

---

### 3.6 `app/api/processes/[id]/reject/route.ts` — Notificação (Processo rejeitado)

**O que fazer:** Após rejeição, notificar o consultor que criou o processo.

**1. Adicionar import no topo (após linha 3):**

```typescript
import { notificationService } from '@/lib/notifications/service'
```

**2. Expandir o select do processo na linha 69 para incluir `requested_by` e `external_ref`:**

```typescript
// ANTES (linha 69):
.select('current_status, property:dev_properties(id)')

// DEPOIS:
.select('current_status, requested_by, external_ref, property:dev_properties(id)')
```

**3. Adicionar após a linha 114 (`console.error(...)`) e antes da linha 116 (`return`):**

```typescript
    // Notificar consultor que criou o processo
    try {
      if ((proc as any).requested_by && (proc as any).requested_by !== user.id) {
        await notificationService.create({
          recipientId: (proc as any).requested_by,
          senderId: user.id,
          notificationType: 'process_rejected',
          entityType: 'proc_instance',
          entityId: id,
          title: 'Processo rejeitado',
          body: `O processo ${(proc as any).external_ref || ''} foi rejeitado: ${reason}`,
          actionUrl: `/dashboard/processos/${id}`,
          metadata: {
            process_ref: (proc as any).external_ref,
            reason,
          },
        })
      }
    } catch (notifError) {
      console.error('[REJECT] Erro ao enviar notificação:', notifError)
    }
```

---

### 3.7 `app/api/processes/[id]/return/route.ts` — Notificação (Processo devolvido)

**O que fazer:** Após devolução, notificar o consultor que criou o processo.

**1. Adicionar import no topo (após linha 3):**

```typescript
import { notificationService } from '@/lib/notifications/service'
```

**2. Expandir o select do processo na linha 69:**

```typescript
// ANTES (linha 69):
.select('current_status')

// DEPOIS:
.select('current_status, requested_by, external_ref')
```

**3. Adicionar após a linha 104 (fim do check de `updateError`) e antes da linha 106 (`return`):**

```typescript
    // Notificar consultor que criou o processo
    try {
      if ((proc as any).requested_by && (proc as any).requested_by !== user.id) {
        await notificationService.create({
          recipientId: (proc as any).requested_by,
          senderId: user.id,
          notificationType: 'process_returned',
          entityType: 'proc_instance',
          entityId: id,
          title: 'Processo devolvido',
          body: `O processo ${(proc as any).external_ref || ''} foi devolvido: ${reason}`,
          actionUrl: `/dashboard/processos/${id}`,
          metadata: {
            process_ref: (proc as any).external_ref,
            reason,
          },
        })
      }
    } catch (notifError) {
      console.error('[RETURN] Erro ao enviar notificação:', notifError)
    }
```

---

### 3.8 `app/api/processes/[id]/hold/route.ts` — Notificação (Processo pausado/reactivado)

**O que fazer:** Notificação opcional — **não implementar neste scope**. Pausar/reactivar é uma acção administrativa com baixo valor de notificação. Pode ser adicionado numa iteração futura.

---

### 3.9 `app/api/processes/[id]/tasks/[taskId]/route.ts` — Notificações #3, #4, #9

**O que fazer:** Disparar notificações após acções sobre tarefas:
- `assign` → notificar o utilizador atribuído (#3)
- `complete` → notificar Gestora Processual (#4)
- `update_priority`, `update_due_date` → notificar o atribuído se != quem alterou (#9)

**1. Adicionar import no topo (após linha 4):**

```typescript
import { notificationService } from '@/lib/notifications/service'
```

**2. Expandir o select da tarefa na linha 47 para incluir `assigned_to` e dados do processo:**

```typescript
// ANTES (linha 47):
.select('*, proc_instance:proc_instances(current_status)')

// DEPOIS:
.select('*, proc_instance:proc_instances(current_status, external_ref, requested_by)')
```

**3. Adicionar após a linha 181 (`console.log('Progress recalculated:', progressResult)`) — ou mais precisamente, após todo o bloco de recalculate (antes do `return` na linha 183):**

Inserir entre a linha 181 e a linha 183:

```typescript
    // --- Notificações ---
    try {
      const procRef = (task as any).proc_instance?.external_ref || ''

      if (action === 'assign' && assigned_to && assigned_to !== user.id) {
        // #3: Tarefa atribuída
        await notificationService.create({
          recipientId: assigned_to,
          senderId: user.id,
          notificationType: 'task_assigned',
          entityType: 'proc_task',
          entityId: taskId,
          title: 'Tarefa atribuída',
          body: `A tarefa "${task.title}" foi-lhe atribuída no processo ${procRef}`,
          actionUrl: `/dashboard/processos/${id}?task=${taskId}`,
          metadata: { process_ref: procRef, task_title: task.title },
        })
      }

      if (action === 'complete') {
        // #4: Tarefa concluída — notificar Gestora Processual
        const gestoraIds = await notificationService.getUserIdsByRoles(['Gestora Processual'])
        if (gestoraIds.length > 0) {
          await notificationService.createBatch(gestoraIds, {
            senderId: user.id,
            notificationType: 'task_completed',
            entityType: 'proc_task',
            entityId: taskId,
            title: 'Tarefa concluída',
            body: `A tarefa "${task.title}" foi concluída no processo ${procRef}`,
            actionUrl: `/dashboard/processos/${id}?task=${taskId}`,
            metadata: { process_ref: procRef, task_title: task.title },
          })
        }
      }

      if ((action === 'update_priority' || action === 'update_due_date') && task.assigned_to && task.assigned_to !== user.id) {
        // #9: Tarefa actualizada
        const detail = action === 'update_priority'
          ? `prioridade alterada para ${priority}`
          : `data limite alterada`
        await notificationService.create({
          recipientId: task.assigned_to,
          senderId: user.id,
          notificationType: 'task_updated',
          entityType: 'proc_task',
          entityId: taskId,
          title: 'Tarefa actualizada',
          body: `A tarefa "${task.title}" foi actualizada: ${detail}`,
          actionUrl: `/dashboard/processos/${id}?task=${taskId}`,
          metadata: { process_ref: procRef, task_title: task.title, change: action },
        })
      }
    } catch (notifError) {
      console.error('[TaskUpdate] Erro ao enviar notificações:', notifError)
    }
```

**Dados disponíveis:** `task.title`, `task.assigned_to` (agora incluído no select original porque `*` já devolve todas as colunas de `proc_tasks`), `(task as any).proc_instance.external_ref`, `(task as any).proc_instance.requested_by`, `assigned_to` (do body, para acção `assign`), `user.id`, `id` (proc UUID), `taskId`, `action`, `priority`, `due_date`.

---

### 3.10 `app/api/processes/[id]/tasks/[taskId]/comments/route.ts` — Notificações #5, #7

**O que fazer:** Após inserir comentário, disparar:
- #5: Notificar o responsável da tarefa (`assigned_to`) que há novo comentário
- #7: Notificar cada utilizador mencionado

**1. Adicionar imports no topo (após linha 3):**

```typescript
import { notificationService } from '@/lib/notifications/service'
```

**2. Expandir o select da tarefa na linha 70 para incluir `assigned_to` e dados do processo:**

```typescript
// ANTES (linha 70):
.select('id')

// DEPOIS:
.select('id, title, assigned_to, proc_instance:proc_instances(external_ref)')
```

**3. Adicionar após a linha 88 (`.single()`) e o check de erro (linha 90-92), antes do `return` na linha 94:**

```typescript
    // --- Notificações ---
    try {
      const procRef = (task as any).proc_instance?.external_ref || ''
      const taskTitle = (task as any).title || ''
      const notifiedUserIds = new Set<string>()

      // #7: Menções em comentário — notificar cada mencionado
      if (validation.data.mentions && validation.data.mentions.length > 0) {
        for (const mention of validation.data.mentions) {
          if (mention.user_id !== user.id) {
            notifiedUserIds.add(mention.user_id)
            await notificationService.create({
              recipientId: mention.user_id,
              senderId: user.id,
              notificationType: 'comment_mention',
              entityType: 'proc_task_comment',
              entityId: comment.id,
              title: 'Mencionado num comentário',
              body: `${comment.user?.commercial_name || 'Alguém'} mencionou-o na tarefa "${taskTitle}"`,
              actionUrl: `/dashboard/processos/${id}?task=${taskId}&tab=comments`,
              metadata: { process_ref: procRef, task_title: taskTitle },
            })
          }
        }
      }

      // #5: Novo comentário — notificar responsável da tarefa (se não é o autor do comentário e não foi já notificado por menção)
      const taskAssignedTo = (task as any).assigned_to
      if (taskAssignedTo && taskAssignedTo !== user.id && !notifiedUserIds.has(taskAssignedTo)) {
        await notificationService.create({
          recipientId: taskAssignedTo,
          senderId: user.id,
          notificationType: 'task_comment',
          entityType: 'proc_task_comment',
          entityId: comment.id,
          title: 'Novo comentário na tarefa',
          body: `Novo comentário na tarefa "${taskTitle}" do processo ${procRef}`,
          actionUrl: `/dashboard/processos/${id}?task=${taskId}&tab=comments`,
          metadata: { process_ref: procRef, task_title: taskTitle },
        })
      }
    } catch (notifError) {
      console.error('[Comments] Erro ao enviar notificações:', notifError)
    }
```

**Dados disponíveis:** `comment.id`, `comment.user.commercial_name` (do join na insert), `validation.data.mentions` (array de `{ user_id, display_name }`), `task.assigned_to` (agora no select expandido), `task.title`, `task.proc_instance.external_ref`, `user.id`, `id` (proc UUID), `taskId`.

---

### 3.11 `app/api/processes/[id]/chat/route.ts` — Notificações #6, #8

**O que fazer:** Após inserir mensagem no chat, disparar:
- #8: Notificar cada utilizador mencionado
- #6: (Opcional) Notificar responsáveis de tarefas — **não implementar neste scope** porque o chat é broadcast e criaria demasiado ruído. Apenas menções.

**1. Adicionar import no topo (após linha 3):**

```typescript
import { notificationService } from '@/lib/notifications/service'
```

**2. Expandir o select do processo na linha 84 para incluir `external_ref`:**

```typescript
// ANTES (linha 84):
.select('id')

// DEPOIS:
.select('id, external_ref')
```

**3. Adicionar após o check de erro do insert (linha 107-109), antes do `return` na linha 111:**

```typescript
    // --- Notificações ---
    try {
      const procRef = (proc as any).external_ref || ''

      // #8: Menções no chat
      if (validation.data.mentions && validation.data.mentions.length > 0) {
        for (const mention of validation.data.mentions) {
          if (mention.user_id !== user.id) {
            await notificationService.create({
              recipientId: mention.user_id,
              senderId: user.id,
              notificationType: 'chat_mention',
              entityType: 'proc_chat_message',
              entityId: message.id,
              title: 'Mencionado no chat',
              body: `${message.sender?.commercial_name || 'Alguém'} mencionou-o no chat do processo ${procRef}`,
              actionUrl: `/dashboard/processos/${processId}?tab=chat&message=${message.id}`,
              metadata: { process_ref: procRef },
            })
          }
        }
      }
    } catch (notifError) {
      console.error('[Chat] Erro ao enviar notificações:', notifError)
    }
```

**Dados disponíveis:** `message.id`, `message.sender.commercial_name` (do join), `validation.data.mentions`, `proc.external_ref` (agora no select expandido), `processId`, `user.id`.

---

### 3.12 `app/dashboard/processos/[id]/page.tsx` — Deep-linking via query params

**O que fazer:** Adicionar suporte para abrir uma tarefa automaticamente quando a URL contém `?task=<taskId>`. Isto permite que as notificações naveguem directamente para a tarefa relevante.

**1. Adicionar `useSearchParams` ao import (linha 4):**

```typescript
// ANTES (linha 4):
import { useParams, useRouter } from 'next/navigation'

// DEPOIS:
import { useParams, useRouter, useSearchParams } from 'next/navigation'
```

**2. Adicionar `searchParams` dentro do componente (após linha 56):**

```typescript
const searchParams = useSearchParams()
```

**3. Adicionar um `useEffect` para deep-link (após o `useEffect` que sincroniza `selectedTask` — após a linha 265):**

```typescript
  // Deep-link: abrir tarefa via ?task=<taskId>
  useEffect(() => {
    const taskParam = searchParams.get('task')
    if (taskParam && process?.stages && !selectedTask) {
      const allTasks: ProcessTask[] = process.stages.flatMap(
        (s: ProcessStageWithTasks) => s.tasks
      )
      const target = allTasks.find((t: ProcessTask) => t.id === taskParam)
      if (target) {
        setSelectedTask(target)
      }
    }
  }, [searchParams, process?.stages, selectedTask])
```

**Nota:** Este `useEffect` corre depois do processo carregar. Se o `task` param existe na URL, procura a tarefa nos stages e abre o `TaskDetailSheet`. O `!selectedTask` evita reabrir se o user já fechou manualmente.

---

## 4. Ordem de Implementação

| Passo | O que | Ficheiro(s) |
|-------|-------|-------------|
| 1 | Executar migração SQL via Supabase MCP | SQL directo |
| 2 | Criar tipos TypeScript | `lib/notifications/types.ts` |
| 3 | Criar serviço de notificações | `lib/notifications/service.ts` |
| 4 | Criar validação Zod | `lib/validations/notification.ts` |
| 5 | Criar API routes de notificações | `app/api/notifications/route.ts`, `[id]/route.ts`, `unread-count/route.ts` |
| 6 | Adicionar constantes PT-PT | `lib/constants.ts` (editar) |
| 7 | Criar hook `useNotifications` | `hooks/use-notifications.ts` |
| 8 | Criar componentes UI | `components/notifications/notification-popover.tsx`, `notification-item.tsx` |
| 9 | Integrar no sidebar | `components/layout/app-sidebar.tsx` (editar) |
| 10 | Adicionar tipos ao process.ts | `types/process.ts` (editar) |
| 11 | Integrar notif. #1 (nova angariação) | `app/api/acquisitions/route.ts` (editar) |
| 12 | Integrar notif. #2 (aprovação) | `app/api/processes/[id]/approve/route.ts` (editar) |
| 13 | Integrar notif. reject/return | `reject/route.ts` e `return/route.ts` (editar) |
| 14 | Integrar notif. #3, #4, #9 (tarefas) | `tasks/[taskId]/route.ts` (editar) |
| 15 | Integrar notif. #5, #7 (comentários) | `tasks/[taskId]/comments/route.ts` (editar) |
| 16 | Integrar notif. #8 (chat menções) | `chat/route.ts` (editar) |
| 17 | Deep-linking na página de processo | `app/dashboard/processos/[id]/page.tsx` (editar) |

---

## Resumo de Ficheiros

### Novos (9 ficheiros)

| Ficheiro | Propósito |
|----------|-----------|
| `lib/notifications/types.ts` | Tipos TypeScript (NotificationType, Notification, CreateNotificationParams) |
| `lib/notifications/service.ts` | Serviço singleton: create(), createBatch(), getUserIdsByRoles() |
| `lib/validations/notification.ts` | Schemas Zod: notificationUpdateSchema, notificationQuerySchema |
| `app/api/notifications/route.ts` | GET (listar) + PUT (marcar todas como lidas) |
| `app/api/notifications/[id]/route.ts` | PUT (marcar uma) + DELETE (eliminar) |
| `app/api/notifications/unread-count/route.ts` | GET contagem lightweight |
| `hooks/use-notifications.ts` | Hook: fetch + Realtime + acções (markAsRead, etc.) |
| `components/notifications/notification-popover.tsx` | Popover com sino + badge + lista |
| `components/notifications/notification-item.tsx` | Item individual com avatar + timestamp |

### Modificados (10 ficheiros)

| Ficheiro | Modificação |
|----------|-------------|
| `lib/constants.ts` | Adicionar `NOTIFICATION_TYPE_CONFIG` e `NOTIFICATION_LABELS` após linha 661 |
| `types/process.ts` | Re-exportar tipos de notificação ao final |
| `components/layout/app-sidebar.tsx` | Adicionar `NotificationPopover` no `SidebarHeader` + import |
| `app/api/acquisitions/route.ts` | Adicionar notificação #1 após criar proc_instance |
| `app/api/processes/[id]/approve/route.ts` | Adicionar notificação #2 após aprovar + confirmar `proc.*` acessível |
| `app/api/processes/[id]/reject/route.ts` | Expandir select + adicionar notificação rejeitado |
| `app/api/processes/[id]/return/route.ts` | Expandir select + adicionar notificação devolvido |
| `app/api/processes/[id]/tasks/[taskId]/route.ts` | Expandir select + adicionar notificações #3, #4, #9 |
| `app/api/processes/[id]/tasks/[taskId]/comments/route.ts` | Expandir select da tarefa + adicionar notificações #5, #7 |
| `app/api/processes/[id]/chat/route.ts` | Expandir select do processo + adicionar notificação #8 |
| `app/dashboard/processos/[id]/page.tsx` | Adicionar deep-linking via `?task=<taskId>` com useSearchParams |

### Fora do scope (implementar depois)

| Item | Motivo |
|------|--------|
| pg_cron para tarefas vencidas (#10) | Requer configuração de pg_cron no Supabase — fase posterior |
| pg_cron para limpeza de notificações antigas | Optimização — não urgente |
| Notificação #6 (mensagem no chat para responsáveis) | Gera muito ruído — só menções por agora |
| Notificação no hold (pausar/reactivar) | Baixo valor — pode ser adicionado depois |
