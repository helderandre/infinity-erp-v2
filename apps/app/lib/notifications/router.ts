import { createAdminClient } from '@/lib/supabase/admin'
import { notificationService } from './service'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

interface RoutingContext {
  /** Event key — deve corresponder a uma entrada em notification_routing_rules */
  eventKey: string
  /** ID da entidade (lead, negócio, processo, etc.) */
  entityId: string
  /** Tipo da entidade para a tabela notifications */
  entityType: string
  /** ID do agente atribuído (para recipient_type = 'assigned_agent') */
  assignedAgentId?: string | null
  /** ID do "dono" da entidade (para recipient_type = 'entity_owner') */
  entityOwnerId?: string | null
  /** Título da notificação */
  title: string
  /** Corpo/descrição da notificação */
  body?: string
  /** URL de acção (link para a página relevante) */
  actionUrl: string
  /** ID de quem despoletou o evento */
  senderId?: string | null
  /** Metadados adicionais */
  metadata?: Record<string, unknown>
}

interface RoutingRule {
  id: string
  event_key: string
  module: string
  label: string
  recipient_type: 'role' | 'user' | 'assigned_agent' | 'entity_owner'
  recipient_role_id: string | null
  recipient_user_id: string | null
  channel_in_app: boolean
  channel_email: boolean
  channel_whatsapp: boolean
  is_active: boolean
}

function getDb() {
  const supabase = createAdminClient()
  return supabase as unknown as {
    from: (table: string) => ReturnType<typeof supabase.from>
  }
}

class NotificationRouter {
  /**
   * Ponto de entrada principal.
   * Dado um evento, resolve as regras activas e cria notificações.
   * Erros nunca bloqueiam a acção principal.
   */
  async dispatch(context: RoutingContext): Promise<void> {
    try {
      const db = getDb()

      // 1. Buscar regras activas para este evento
      const { data: rules, error } = await (db.from('notification_routing_rules') as SA)
        .select('*')
        .eq('event_key', context.eventKey)
        .eq('is_active', true)
        .order('priority', { ascending: true })

      if (error || !rules || rules.length === 0) return

      // 2. Resolver destinatários de cada regra, agrupados por canal
      const inAppRecipients = new Set<string>()
      const emailRecipients = new Set<string>()
      const whatsappRecipients = new Set<string>()

      for (const rule of rules as RoutingRule[]) {
        const ids = await this.resolveRecipients(rule, context)

        for (const id of ids) {
          if (rule.channel_in_app) inAppRecipients.add(id)
          if (rule.channel_email) emailRecipients.add(id)
          if (rule.channel_whatsapp) whatsappRecipients.add(id)
        }
      }

      // 3. Enviar notificações in-app
      if (inAppRecipients.size > 0) {
        await notificationService.createBatch(
          [...inAppRecipients],
          {
            senderId: context.senderId,
            notificationType: context.eventKey as SA,
            entityType: context.entityType as SA,
            entityId: context.entityId,
            title: context.title,
            body: context.body,
            actionUrl: context.actionUrl,
            metadata: {
              ...context.metadata,
              routed_event: context.eventKey,
            },
          }
        )
      }

      // 4. Email (se houver destinatários com canal email)
      if (emailRecipients.size > 0) {
        await this.sendEmailNotifications([...emailRecipients], context)
      }

      // 5. WhatsApp (se houver destinatários com canal WhatsApp)
      if (whatsappRecipients.size > 0) {
        await this.sendWhatsAppNotifications([...whatsappRecipients], context)
      }
    } catch (error) {
      // Nunca bloquear a acção principal
      console.error('[NotificationRouter] Erro ao despachar:', error)
    }
  }

  /**
   * Resolve os IDs de utilizadores para uma regra.
   */
  private async resolveRecipients(
    rule: RoutingRule,
    context: RoutingContext
  ): Promise<string[]> {
    switch (rule.recipient_type) {
      case 'user':
        return rule.recipient_user_id ? [rule.recipient_user_id] : []

      case 'role':
        if (!rule.recipient_role_id) return []
        return notificationService.getUserIdsByRoleId(rule.recipient_role_id)

      case 'assigned_agent':
        return context.assignedAgentId ? [context.assignedAgentId] : []

      case 'entity_owner':
        return context.entityOwnerId ? [context.entityOwnerId] : []

      default:
        return []
    }
  }

  /**
   * Envia notificações por email.
   * Usa o mesmo padrão do AlertService existente.
   */
  private async sendEmailNotifications(
    recipientIds: string[],
    context: RoutingContext
  ): Promise<void> {
    try {
      const supabase = createAdminClient()
      const db = getDb()

      // Buscar sender email default
      let senderName = 'Infinity Group'
      let senderEmail = 'noreply@infinitygroup.pt'

      const { data: defaultSender } = await (db.from('email_senders') as SA)
        .select('name, email, display_name')
        .eq('is_default', true)
        .single()

      if (defaultSender) {
        senderName = defaultSender.display_name || defaultSender.name
        senderEmail = defaultSender.email
      }

      // Buscar emails dos destinatários
      for (const rid of recipientIds) {
        try {
          const { data: { user: authUser } } = await supabase.auth.admin.getUserById(rid)
          if (!authUser?.email) continue

          await supabase.functions.invoke('send-email', {
            body: {
              senderName,
              senderEmail,
              recipientEmail: authUser.email,
              subject: context.title,
              body: `<p>${context.title}</p>${context.body ? `<p>${context.body}</p>` : ''}<p><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}${context.actionUrl}">Ver detalhes</a></p>`,
            },
          })
        } catch (emailError) {
          console.error(`[NotificationRouter] Erro email para ${rid}:`, emailError)
        }
      }
    } catch (error) {
      console.error('[NotificationRouter] Erro ao enviar emails:', error)
    }
  }

  /**
   * Envia notificações por WhatsApp.
   * Usa a primeira instância WhatsApp conectada.
   */
  private async sendWhatsAppNotifications(
    recipientIds: string[],
    context: RoutingContext
  ): Promise<void> {
    try {
      const db = getDb()

      // Buscar primeira instância conectada
      const { data: instance } = await (db.from('auto_wpp_instances') as SA)
        .select('id, name, uazapi_token, connection_status')
        .eq('connection_status', 'connected')
        .limit(1)
        .single()

      if (!instance?.uazapi_token) return

      const baseUrl = process.env.UAZAPI_URL
      if (!baseUrl) return

      // Buscar telefones dos destinatários
      const { data: profiles } = await (db.from('dev_consultant_profiles') as SA)
        .select('user_id, phone_commercial')
        .in('user_id', recipientIds)

      if (!profiles || profiles.length === 0) return

      const message = `*${context.title}*${context.body ? `\n${context.body}` : ''}`

      for (const profile of profiles) {
        if (!profile.phone_commercial) continue
        const phone = profile.phone_commercial.replace(/\D/g, '')
        if (!phone) continue

        try {
          await fetch(`${baseUrl}/send/text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              token: instance.uazapi_token,
            },
            body: JSON.stringify({
              number: phone,
              text: message,
              delay: 2,
              readchat: true,
              track_source: 'erp_infinity_notifications',
            }),
          })
        } catch (wppError) {
          console.error(`[NotificationRouter] Erro WhatsApp para ${phone}:`, wppError)
        }
      }
    } catch (error) {
      console.error('[NotificationRouter] Erro ao enviar WhatsApp:', error)
    }
  }
}

export const notificationRouter = new NotificationRouter()
export type { RoutingContext }
