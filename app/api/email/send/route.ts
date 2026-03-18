import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appendToSentFolder } from '@/lib/email/imap-client'
import { injectOpenTrackingPixel } from '@/lib/email-renderer'
import { z } from 'zod'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const EDGE_SMTP_SECRET = process.env.EDGE_SMTP_SECRET || ''

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
 * Build a minimal RFC822 raw message for IMAP APPEND to Sent folder
 */
function buildRawMessage(opts: {
  from: string
  to: string
  cc?: string
  subject: string
  html: string
  messageId: string
  inReplyTo?: string
}): string {
  const lines: string[] = []
  lines.push(`From: ${opts.from}`)
  lines.push(`To: ${opts.to}`)
  if (opts.cc) lines.push(`Cc: ${opts.cc}`)
  lines.push(`Subject: ${opts.subject}`)
  lines.push(`Date: ${new Date().toUTCString()}`)
  lines.push(`Message-ID: ${opts.messageId}`)
  lines.push(`MIME-Version: 1.0`)
  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`)
    lines.push(`References: ${opts.inReplyTo}`)
  }
  lines.push(`Content-Type: text/html; charset=utf-8`)
  lines.push(`Content-Transfer-Encoding: base64`)
  lines.push(``)
  // Base64 encode the HTML body in 76-char lines
  const b64 = Buffer.from(opts.html, 'utf-8').toString('base64')
  const b64Lines = b64.match(/.{1,76}/g) || []
  lines.push(...b64Lines)
  return lines.join('\r\n') + '\r\n'
}

/**
 * POST /api/email/send — Send email via consultant's SMTP account
 */
export async function POST(req: Request) {
  try {
    console.log('[email/send] === INÍCIO ===')
    console.log('[email/send] ENCRYPTION_KEY presente:', !!ENCRYPTION_KEY)
    console.log('[email/send] SUPABASE_URL:', SUPABASE_URL)
    console.log('[email/send] EDGE_SMTP_SECRET presente:', !!EDGE_SMTP_SECRET)

    if (!ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'ENCRYPTION_KEY não configurada' }, { status: 500 })
    }

    console.log('[email/send] [1/8] A autenticar utilizador...')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    console.log('[email/send] [1/8] Utilizador:', user.id)

    console.log('[email/send] [2/8] A validar body...')
    const body = await req.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      console.error('[email/send] [2/8] Validação falhou:', JSON.stringify(parsed.error.flatten()))
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    console.log('[email/send] [2/8] Body válido. To:', body.to, '| Subject:', body.subject)

    const { to, cc, bcc, subject, body_html, body_text, in_reply_to, process_id, process_type, attachments } =
      parsed.data

    // 1. Fetch consultant's email account
    console.log('[email/send] [3/8] A buscar conta email do consultor...')
    const adminDb = createAdminClient()
    const { data: account, error: accError } = await adminDb
      .from('consultant_email_accounts')
      .select('*')
      .eq('consultant_id', user.id)
      .eq('is_verified', true)
      .eq('is_active', true)
      .single()

    if (accError || !account) {
      console.error('[email/send] [3/8] Conta não encontrada:', accError?.message)
      return NextResponse.json(
        { error: 'Conta de email não configurada ou não verificada' },
        { status: 404 }
      )
    }
    console.log('[email/send] [3/8] Conta encontrada:', account.email_address, '| SMTP:', account.smtp_host, ':', account.smtp_port, '| IMAP:', account.imap_host, ':', account.imap_port)

    // 2. Decrypt password
    console.log('[email/send] [4/8] A desencriptar password...')
    const { data: password, error: decError } = await adminDb.rpc('decrypt_email_password', {
      p_encrypted: account.encrypted_password,
      p_key: ENCRYPTION_KEY,
    })

    if (decError || !password) {
      console.error('[email/send] [4/8] Decrypt falhou:', decError?.message)
      return NextResponse.json({ error: 'Erro ao desencriptar credenciais' }, { status: 500 })
    }
    console.log('[email/send] [4/8] Password desencriptada (length:', password.length, ')')

    // 3. Create message record first (status: sending)
    console.log('[email/send] [5/8] A criar registo na DB...')
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
      console.error('[email/send] [5/8] Insert falhou:', msgError?.message)
      return NextResponse.json({ error: 'Erro ao registar mensagem' }, { status: 500 })
    }
    console.log('[email/send] [5/8] Mensagem criada:', message.id)

    // 4. Resolve attachments to base64 for the edge function
    console.log('[email/send] [6/8] A resolver', attachments.length, 'anexos...')
    const edgeAttachments = await Promise.all(
      attachments.map(async (a) => {
        let base64: string
        if (a.data_base64) {
          base64 = a.data_base64
        } else if (a.path) {
          const res = await fetch(a.path)
          if (!res.ok) throw new Error(`Falha ao descarregar anexo: ${a.filename}`)
          const buf = Buffer.from(await res.arrayBuffer())
          base64 = buf.toString('base64')
        } else {
          throw new Error(`Anexo sem conteúdo: ${a.filename}`)
        }
        return {
          filename: a.filename,
          content_type: a.content_type,
          data_base64: base64,
        }
      })
    )
    console.log('[email/send] [6/8] Anexos resolvidos:', edgeAttachments.length)

    // 4b. Inject open-tracking pixel into the HTML
    const requestOrigin = new URL(req.url).origin
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin
    const trackedHtml = injectOpenTrackingPixel(body_html, message.id, baseUrl)

    // 5. Call Supabase Edge Function (smtp-send) to bypass serverless SMTP port restrictions
    const edgePayload = {
      smtp: {
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_secure,
        user: account.email_address,
        pass: password,
      },
      imap: {
        host: account.imap_host,
        port: account.imap_port,
        secure: account.imap_secure,
        user: account.email_address,
        pass: password,
      },
      from: { name: account.display_name, address: account.email_address },
      to,
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      subject,
      html: trackedHtml,
      text: body_text,
      in_reply_to,
      references: in_reply_to,
      attachments: edgeAttachments.length > 0 ? edgeAttachments : undefined,
    }

    const edgeUrl = `${SUPABASE_URL}/functions/v1/smtp-send`
    console.log('[email/send] [7/8] A chamar Edge Function:', edgeUrl)
    console.log('[email/send] [7/8] SMTP config:', { host: account.smtp_host, port: account.smtp_port, secure: account.smtp_secure, user: account.email_address })
    console.log('[email/send] [7/8] IMAP config:', { host: account.imap_host, port: account.imap_port, secure: account.imap_secure })
    console.log('[email/send] [7/8] Headers x-edge-secret presente:', !!EDGE_SMTP_SECRET)

    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EDGE_SMTP_SECRET ? { 'x-edge-secret': EDGE_SMTP_SECRET } : {}),
      },
      body: JSON.stringify(edgePayload),
    })

    console.log('[email/send] [7/8] Edge Response status:', edgeRes.status, edgeRes.statusText)
    const resultText = await edgeRes.text()
    console.log('[email/send] [7/8] Edge Response body:', resultText)

    let result: Record<string, unknown>
    try {
      result = JSON.parse(resultText)
    } catch {
      console.error('[email/send] [7/8] Edge retornou resposta não-JSON:', resultText.substring(0, 500))
      await adminDb
        .from('email_messages')
        .update({ status: 'failed', error_message: `Edge non-JSON: ${resultText.substring(0, 200)}` })
        .eq('id', message.id)
      return NextResponse.json(
        { error: 'Edge function retornou resposta inválida', detail: resultText.substring(0, 500) },
        { status: 502 }
      )
    }

    // 6. Update message status based on edge function response
    console.log('[email/send] [8/8] Resultado:', JSON.stringify(result))
    if (result.ok) {
      await adminDb
        .from('email_messages')
        .update({
          status: 'sent',
          message_id: result.messageId as string,
          sent_at: new Date().toISOString(),
        })
        .eq('id', message.id)

      // Store attachments metadata
      if (edgeAttachments.length > 0) {
        const attachmentRecords = edgeAttachments.map((a) => ({
          message_id: message.id,
          filename: a.filename,
          content_type: a.content_type,
          size_bytes: Math.ceil((a.data_base64.length * 3) / 4),
          storage_path: `email-inline/${message.id}/${a.filename}`,
        }))

        await adminDb.from('email_attachments').insert(attachmentRecords)
      }

      // 7. Append to IMAP Sent folder (port 993 is not blocked by serverless platforms)
      console.log('[email/send] [8b/8] A fazer IMAP append à pasta Enviados...')
      try {
        // Build a minimal RFC822 message for the Sent folder
        const rawMessage = buildRawMessage({
          from: `${account.display_name} <${account.email_address}>`,
          to: to.join(', '),
          cc: cc.length > 0 ? cc.join(', ') : undefined,
          subject,
          html: trackedHtml,
          messageId: result.messageId as string,
          inReplyTo: in_reply_to,
        })

        await appendToSentFolder(
          {
            host: account.imap_host,
            port: account.imap_port,
            secure: account.imap_secure,
            user: account.email_address,
            pass: password,
          },
          rawMessage
        )
        console.log('[email/send] [8b/8] IMAP append concluído')
      } catch (imapErr) {
        console.warn('[email/send] [8b/8] IMAP append falhou (não-fatal):', imapErr)
      }

      console.log('[email/send] === SUCESSO === messageId:', result.messageId)
      return NextResponse.json({
        success: true,
        message_id: message.id,
        smtp_message_id: result.messageId,
      })
    } else {
      console.error('[email/send] === FALHA === erro:', result.error)
      await adminDb
        .from('email_messages')
        .update({
          status: 'failed',
          error_message: result.error as string,
        })
        .eq('id', message.id)

      return NextResponse.json(
        { error: 'Falha ao enviar email', detail: result.error },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error('[email/send] === EXCEPTION ===', err)
    return NextResponse.json({ error: 'Erro interno', detail: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
