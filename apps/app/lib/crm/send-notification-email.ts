/**
 * Send CRM notification emails via the existing email infrastructure.
 * Used by the SLA engine and ingestion pipeline.
 */

import { sendEmail } from '@/lib/email/send'

interface NotificationEmailParams {
  recipientEmail: string
  recipientName: string
  type: 'new_lead' | 'sla_warning' | 'sla_breach' | 'sla_escalation' | 'assignment'
  title: string
  body: string
  link?: string
  contactName?: string
  contactPhone?: string
}

const TYPE_SUBJECTS: Record<string, string> = {
  new_lead: '🔔 Nova lead recebida',
  sla_warning: '⚠️ SLA a expirar — lead por contactar',
  sla_breach: '🔴 SLA ultrapassado — acção necessária',
  sla_escalation: '🚨 Escalonamento — lead reatribuída',
  assignment: '📋 Lead reatribuída',
}

export async function sendNotificationEmail(params: NotificationEmailParams) {
  const { recipientEmail, recipientName, type, title, body, link, contactName, contactPhone } = params

  const subject = TYPE_SUBJECTS[type] || title
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://erp.infinitygroup.pt'
  const fullLink = link ? `${appUrl}${link}` : appUrl

  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px;">
      <p style="margin: 0 0 16px; color: #333;">Olá ${recipientName?.split(' ')[0] || ''},</p>
      <p style="margin: 0 0 16px; color: #333;">${body}</p>
      ${contactName ? `
        <div style="background: #f8f9fa; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
          <p style="margin: 0; font-weight: 600; color: #111;">${contactName}</p>
          ${contactPhone ? `<p style="margin: 4px 0 0; color: #666; font-size: 14px;">${contactPhone}</p>` : ''}
        </div>
      ` : ''}
      <a href="${fullLink}" style="display: inline-block; background: #0a0a0a; color: #fff; padding: 10px 24px; border-radius: 999px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">
        Ver no ERP
      </a>
      <p style="margin: 24px 0 0; color: #999; font-size: 12px;">
        Esta notificação foi enviada automaticamente pelo sistema de gestão de leads.
      </p>
    </div>
  `

  try {
    const result = await sendEmail({
      to: recipientEmail,
      subject,
      bodyHtml,
    })

    if (!result.success) {
      console.warn(`[CRM Email] Failed to send ${type} to ${recipientEmail}:`, result.error)
    }

    return result
  } catch (err) {
    console.error(`[CRM Email] Error sending ${type} to ${recipientEmail}:`, err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
