// ─── Email the fatura PDF to the client ──────────────────────────────────────
// Reuses the ERP's existing SMTP path: the current user's own connected
// account (consultant_email_accounts) via resolveEmailAccount() — no shared
// fallback (agency policy). The PDF is attached as Buffer bytes.

import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { sendViaSMTP } from '@/lib/email/smtp-client'
import { wrapEmailHtml } from '@/lib/email-renderer'

export interface SendInvoiceEmailInput {
  to: string
  subject: string
  bodyHtml: string
  pdfBuffer: Buffer
  filename: string
}

export interface SendInvoiceEmailResult {
  ok: boolean
  error?: string
  from?: string
  messageId?: string
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<SendInvoiceEmailResult> {
  const resolved = await resolveEmailAccount()
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error || 'Não tem uma conta de email configurada. Configure em Definições → Email.',
    }
  }
  const { account, password } = resolved.data

  const res = await sendViaSMTP(
    {
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_secure,
      user: account.email_address,
      pass: password,
      requireTLS: !account.smtp_secure && account.smtp_port === 587,
    },
    {
      from: { name: account.display_name || 'Infinity Group', address: account.email_address },
      to: [input.to],
      subject: input.subject,
      html: wrapEmailHtml(input.bodyHtml),
      attachments: [{ filename: input.filename, contentType: 'application/pdf', content: input.pdfBuffer }],
    },
  )

  if (!res.ok) return { ok: false, error: res.error, from: account.email_address }
  return { ok: true, from: account.email_address, messageId: res.messageId }
}
