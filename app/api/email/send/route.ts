import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendViaSMTP } from '@/lib/email/smtp-client'
import { appendToSentFolder } from '@/lib/email/imap-client'
import { injectOpenTrackingPixel } from '@/lib/email-renderer'
import { z } from 'zod'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

const attachmentSchema = z.object({
  filename: z.string(),
  content_type: z.string(),
  // Either base64 data or a URL to fetch the file from
  data_base64: z.string().optional(),
  path: z.string().url().optional(),
}).refine((a) => a.data_base64 || a.path, {
  message: 'Anexo deve ter data_base64 ou path (URL)',
})

const sendSchema = z.object({
  to: z.array(z.string().email()).min(1, 'Pelo menos um destinatário'),
  cc: z.array(z.string().email()).optional().default([]),
  bcc: z.array(z.string().email()).optional().default([]),
  subject: z.string().min(1, 'Assunto é obrigatório'),
  body_html: z.string().min(1, 'Corpo do email é obrigatório'),
  body_text: z.string().optional(),
  in_reply_to: z.string().optional(),
  process_id: z.string().uuid().optional(),
  process_type: z.string().optional(),
  attachments: z.array(attachmentSchema).optional().default([]),
})

/**
 * POST /api/email/send — Send email via consultant's SMTP account
 */
export async function POST(req: Request) {
  try {
    if (!ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'ENCRYPTION_KEY não configurada' }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { to, cc, bcc, subject, body_html, body_text, in_reply_to, process_id, process_type, attachments } =
      parsed.data

    // 1. Fetch consultant's email account
    const adminDb = createAdminClient()
    const { data: account, error: accError } = await adminDb
      .from('consultant_email_accounts')
      .select('*')
      .eq('consultant_id', user.id)
      .eq('is_verified', true)
      .eq('is_active', true)
      .single()

    if (accError || !account) {
      return NextResponse.json(
        { error: 'Conta de email não configurada ou não verificada' },
        { status: 404 }
      )
    }

    // 2. Decrypt password
    const { data: password, error: decError } = await adminDb.rpc('decrypt_email_password', {
      p_encrypted: account.encrypted_password,
      p_key: ENCRYPTION_KEY,
    })

    if (decError || !password) {
      console.error('[email/send] Decrypt error:', decError)
      return NextResponse.json({ error: 'Erro ao desencriptar credenciais' }, { status: 500 })
    }

    // 3. Create message record first (status: sending)
    const { data: message, error: msgError } = await adminDb
      .from('email_messages')
      .insert({
        account_id: account.id,
        process_id: process_id || null,
        process_type: process_type || null,
        direction: 'outbound',
        status: 'sending',
        from_address: account.email_address,
        from_name: account.display_name,
        to_addresses: to,
        cc_addresses: cc,
        bcc_addresses: bcc,
        subject,
        body_html,
        body_text: body_text || null,
        in_reply_to: in_reply_to || null,
        has_attachments: attachments.length > 0,
      })
      .select('id')
      .single()

    if (msgError || !message) {
      console.error('[email/send] Insert message error:', msgError)
      return NextResponse.json({ error: 'Erro ao registar mensagem' }, { status: 500 })
    }

    // 4. Resolve attachments (base64 or fetch from URL)
    const smtpAttachments = await Promise.all(
      attachments.map(async (a) => {
        let content: Buffer
        if (a.data_base64) {
          content = Buffer.from(a.data_base64, 'base64')
        } else if (a.path) {
          const res = await fetch(a.path)
          if (!res.ok) throw new Error(`Falha ao descarregar anexo: ${a.filename}`)
          content = Buffer.from(await res.arrayBuffer())
        } else {
          throw new Error(`Anexo sem conteúdo: ${a.filename}`)
        }
        return {
          filename: a.filename,
          contentType: a.content_type,
          content,
        }
      })
    )

    // 4b. Inject open-tracking pixel into the HTML
    const requestOrigin = new URL(req.url).origin
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin
    const trackedHtml = injectOpenTrackingPixel(body_html, message.id, baseUrl)

    const result = await sendViaSMTP(
      {
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_secure,
        user: account.email_address,
        pass: password,
      },
      {
        from: { name: account.display_name, address: account.email_address },
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        html: trackedHtml,
        text: body_text,
        inReplyTo: in_reply_to,
        references: in_reply_to,
        attachments: smtpAttachments.length > 0 ? smtpAttachments : undefined,
      }
    )

    // 5. Update message status
    if (result.ok) {
      await adminDb
        .from('email_messages')
        .update({
          status: 'sent',
          message_id: result.messageId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', message.id)

      // Store attachments metadata
      if (smtpAttachments.length > 0) {
        const attachmentRecords = smtpAttachments.map((a) => ({
          message_id: message.id,
          filename: a.filename,
          content_type: a.contentType,
          size_bytes: a.content.length,
          storage_path: `email-inline/${message.id}/${a.filename}`,
        }))

        await adminDb.from('email_attachments').insert(attachmentRecords)
      }

      // 6. Append to IMAP Sent folder so it appears in Outlook/webmail
      if (result.rawMessage) {
        try {
          await appendToSentFolder(
            {
              host: account.imap_host,
              port: account.imap_port,
              secure: account.imap_secure,
              user: account.email_address,
              pass: password,
            },
            result.rawMessage
          )
        } catch (imapErr) {
          console.warn('[email/send] Failed to append to Sent folder:', imapErr)
          // Non-fatal — the email was still sent successfully
        }
      }

      return NextResponse.json({
        success: true,
        message_id: message.id,
        smtp_message_id: result.messageId,
      })
    } else {
      await adminDb
        .from('email_messages')
        .update({
          status: 'failed',
          error_message: result.error,
        })
        .eq('id', message.id)

      return NextResponse.json(
        { error: 'Falha ao enviar email', detail: result.error },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error('[email/send] Exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
