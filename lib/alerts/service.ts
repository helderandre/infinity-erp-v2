import { createAdminClient } from '@/lib/supabase/admin'
import { notificationService } from '@/lib/notifications/service'
import type { AlertEventConfig, AlertContext } from '@/types/alert'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

function getDb() {
  const supabase = createAdminClient()
  return supabase as unknown as {
    from: (table: string) => ReturnType<typeof supabase.from>
  }
}

class AlertService {
  /**
   * Ponto de entrada principal — processa um alerta configurado no template.
   * Erros nunca bloqueiam a acção principal.
   */
  async processAlert(alertConfig: AlertEventConfig, context: AlertContext): Promise<void> {
    if (!alertConfig.enabled) return

    try {
      const recipientIds = await this.resolveRecipients(alertConfig.recipients, context)
      if (recipientIds.length === 0) return

      const message = this.renderMessage(alertConfig.message_template, context)

      // Processar cada canal em paralelo
      const promises: Promise<void>[] = []

      if (alertConfig.channels.notification) {
        promises.push(this.sendNotifications(recipientIds, context, message))
      }

      if (alertConfig.channels.email?.enabled) {
        promises.push(this.sendEmails(recipientIds, context, message, alertConfig.channels.email.sender_id))
      }

      if (alertConfig.channels.whatsapp?.enabled && alertConfig.channels.whatsapp.wpp_instance_id) {
        promises.push(this.sendWhatsApp(recipientIds, context, message, alertConfig.channels.whatsapp.wpp_instance_id))
      }

      await Promise.allSettled(promises)
    } catch (error) {
      console.error('[AlertService] Erro ao processar alerta:', error)
    }
  }

  /**
   * Resolve destinatários com base na configuração.
   */
  private async resolveRecipients(
    recipientConfig: AlertEventConfig['recipients'],
    context: AlertContext
  ): Promise<string[]> {
    const supabase = createAdminClient()

    switch (recipientConfig.type) {
      case 'assigned':
        return context.assignedTo ? [context.assignedTo] : []

      case 'consultant': {
        // Buscar consultor (requested_by) do processo
        const { data: proc } = await supabase
          .from('proc_instances')
          .select('requested_by')
          .eq('id', context.procInstanceId)
          .single()
        return proc?.requested_by ? [proc.requested_by] : []
      }

      case 'role': {
        if (!recipientConfig.roles || recipientConfig.roles.length === 0) return []
        return notificationService.getUserIdsByRoles(recipientConfig.roles)
      }

      case 'specific_users':
        return recipientConfig.user_ids || []

      default:
        return []
    }
  }

  /**
   * Envia notificações in-app para os destinatários.
   */
  private async sendNotifications(
    recipientIds: string[],
    context: AlertContext,
    message: string
  ): Promise<void> {
    try {
      const notificationType = `alert_${context.eventType}` as SA

      await notificationService.createBatch(recipientIds, {
        senderId: context.triggeredBy,
        notificationType,
        entityType: context.entityType === 'proc_task' ? 'proc_task' : 'proc_task',
        entityId: context.entityId,
        title: message,
        body: `Processo ${context.processRef} — ${context.title}`,
        actionUrl: `/dashboard/processos/${context.procInstanceId}`,
        metadata: {
          alert_event: context.eventType,
          process_ref: context.processRef,
        },
      })

      await this.logAlert(context, 'notification', recipientIds, 'sent')
    } catch (error) {
      console.error('[AlertService] Erro notificação:', error)
      await this.logAlert(context, 'notification', recipientIds, 'failed', String(error))
    }
  }

  /**
   * Envia emails para os destinatários via Edge Function send-email.
   */
  private async sendEmails(
    recipientIds: string[],
    context: AlertContext,
    message: string,
    senderId: string | null
  ): Promise<void> {
    try {
      const db = getDb()
      const supabase = createAdminClient()

      // Resolver remetente
      let senderName = 'Infinity Group'
      let senderEmail = 'noreply@infinitygroup.pt'

      if (senderId) {
        const { data: sender } = await (db.from('email_senders') as SA)
          .select('name, email, display_name')
          .eq('id', senderId)
          .single()
        if (sender) {
          senderName = sender.display_name || sender.name
          senderEmail = sender.email
        }
      } else {
        // Usar default
        const { data: defaultSender } = await (db.from('email_senders') as SA)
          .select('name, email, display_name')
          .eq('is_default', true)
          .single()
        if (defaultSender) {
          senderName = defaultSender.display_name || defaultSender.name
          senderEmail = defaultSender.email
        }
      }

      // Buscar emails dos destinatários
      const { data: users } = await supabase
        .from('dev_users')
        .select('id, professional_email')
        .in('id', recipientIds)

      if (!users || users.length === 0) return

      // Enviar email para cada destinatário via Edge Function
      for (const u of users) {
        if (!u.professional_email) continue
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              senderName,
              senderEmail,
              recipientEmail: u.professional_email,
              subject: `[Processo ${context.processRef}] ${message}`,
              body: `<p>${message}</p><p><strong>Tarefa:</strong> ${context.title}</p><p><strong>Processo:</strong> ${context.processRef}</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/processos/${context.procInstanceId}">Ver processo</a></p>`,
            },
          })
        } catch (emailError) {
          console.error(`[AlertService] Erro email para ${u.professional_email}:`, emailError)
        }
      }

      await this.logAlert(context, 'email', recipientIds, 'sent')
    } catch (error) {
      console.error('[AlertService] Erro email:', error)
      await this.logAlert(context, 'email', recipientIds, 'failed', String(error))
    }
  }

  /**
   * Envia WhatsApp para os destinatários via Uazapi.
   */
  private async sendWhatsApp(
    recipientIds: string[],
    context: AlertContext,
    message: string,
    wppInstanceId: string
  ): Promise<void> {
    try {
      const db = getDb()
      const supabase = createAdminClient()

      // Buscar instância WhatsApp
      const { data: instance } = await (db.from('auto_wpp_instances') as SA)
        .select('name, uazapi_token, connection_status')
        .eq('id', wppInstanceId)
        .single()

      if (!instance?.uazapi_token) {
        console.error('[AlertService] Token da instância WhatsApp não encontrado')
        await this.logAlert(context, 'whatsapp', recipientIds, 'failed', 'Token não encontrado')
        return
      }

      if (instance.connection_status !== 'connected') {
        console.error(`[AlertService] Instância "${instance.name}" não está conectada (${instance.connection_status})`)
        await this.logAlert(context, 'whatsapp', recipientIds, 'failed', `Instância não conectada: ${instance.connection_status}`)
        return
      }

      // Buscar telefones dos destinatários
      const { data: profiles } = await (db.from('dev_consultant_profiles') as SA)
        .select('user_id, phone_commercial')
        .in('user_id', recipientIds)

      if (!profiles || profiles.length === 0) return

      const baseUrl = process.env.UAZAPI_URL
      if (!baseUrl) {
        console.error('[AlertService] UAZAPI_URL não configurado')
        await this.logAlert(context, 'whatsapp', recipientIds, 'failed', 'UAZAPI_URL não configurado')
        return
      }

      const fullMessage = `*[Processo ${context.processRef}]*\n${message}\n\nTarefa: ${context.title}`

      for (const profile of profiles) {
        if (!profile.phone_commercial) continue
        const phone = profile.phone_commercial.replace(/\D/g, '')
        if (!phone) continue

        try {
          await fetch(`${baseUrl}/sendText/${instance.uazapi_token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone,
              message: fullMessage,
            }),
          })
        } catch (wppError) {
          console.error(`[AlertService] Erro WhatsApp para ${phone}:`, wppError)
        }
      }

      await this.logAlert(context, 'whatsapp', recipientIds, 'sent')
    } catch (error) {
      console.error('[AlertService] Erro WhatsApp:', error)
      await this.logAlert(context, 'whatsapp', recipientIds, 'failed', String(error))
    }
  }

  /**
   * Regista alerta no proc_alert_log.
   */
  private async logAlert(
    context: AlertContext,
    channel: string,
    recipientIds: string[],
    status: 'sent' | 'failed' | 'pending',
    errorMessage?: string
  ): Promise<void> {
    try {
      const db = getDb()
      await (db.from('proc_alert_log') as SA).insert({
        proc_instance_id: context.procInstanceId,
        entity_type: context.entityType,
        entity_id: context.entityId,
        event_type: context.eventType,
        channel,
        status,
        metadata: {
          recipient_ids: recipientIds,
          title: context.title,
          process_ref: context.processRef,
          triggered_by: context.triggeredBy,
          ...(errorMessage && { error: errorMessage }),
        },
      })
    } catch (logError) {
      console.error('[AlertService] Erro ao registar log:', logError)
    }
  }

  /**
   * Substitui variáveis no template de mensagem.
   */
  private renderMessage(template: string | undefined, context: AlertContext): string {
    const defaultMessages: Record<string, string> = {
      on_complete: `A tarefa "${context.title}" foi concluída no processo ${context.processRef}`,
      on_overdue: `A tarefa "${context.title}" venceu o prazo no processo ${context.processRef}`,
      on_unblock: `A tarefa "${context.title}" foi desbloqueada no processo ${context.processRef}`,
      on_assign: `A tarefa "${context.title}" foi-lhe atribuída no processo ${context.processRef}`,
    }

    if (!template) return defaultMessages[context.eventType] || defaultMessages.on_complete

    return template
      .replace(/\{title\}/g, context.title)
      .replace(/\{process_ref\}/g, context.processRef)
      .replace(/\{triggered_by\}/g, context.triggeredBy)
  }
}

export const alertService = new AlertService()
