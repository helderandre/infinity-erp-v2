import { createAdminClient } from '@/lib/supabase/admin'
import type { CreateNotificationParams } from './types'

// Cast helper for tables not yet in generated types
function getDb() {
  const supabase = createAdminClient()
  return supabase as unknown as {
    from: (table: string) => ReturnType<typeof supabase.from>
  }
}

export class NotificationService {
  private db = getDb()
  private supabase = createAdminClient()

  /** Criar uma notificação para um destinatário */
  async create(params: CreateNotificationParams): Promise<void> {
    const { error } = await (this.db.from('notifications') as ReturnType<typeof this.supabase.from>)
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

    const { error } = await (this.db.from('notifications') as ReturnType<typeof this.supabase.from>)
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

    const filtered = data.filter((u: any) =>
      u.user_roles?.some((ur: any) => roleNames.includes(ur.role?.name))
    )

    return [...new Set(filtered.map((u: any) => u.id as string))]
  }
}

export const notificationService = new NotificationService()
