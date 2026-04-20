import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appendToSentFolder } from '@/lib/email/imap-client'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { injectOpenTrackingPixel } from '@/lib/email-renderer'
import { z } from 'zod'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const EDGE_SMTP_SECRET = process.env.EDGE_SMTP_SECRET || ''
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || ''

const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB — larger ones stay as external <img> URLs

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Scan outgoing HTML for `<img src="<R2_PUBLIC_DOMAIN>/...">`, fetch each image
 * server-side, attach it as an inline MIME part (Content-ID + inline disposition),
 * and rewrite the `src` to `cid:<id>`. This is what makes Outlook display images
 * inline without the "Download pictures" prompt.
 *
 * Images over MAX_INLINE_IMAGE_BYTES, or failures to fetch, fall back to the original
 * external URL so the send is never blocked by this step.
 */
async function inlineR2Images(html: string): Promise<{
  html: string
  inline: { filename: string; content_type: string; data_base64: string; cid: string; inline: true }[]
}> {
  if (!R2_PUBLIC_DOMAIN) return { html, inline: [] }

  const escapedDomain = escapeRegex(R2_PUBLIC_DOMAIN)
  const pattern = new RegExp(
    `src=(["'])(${escapedDomain}/[^"']+)\\1`,
    'gi'
  )

  const uniqueUrls = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    uniqueUrls.add(match[2])
  }
  if (uniqueUrls.size === 0) return { html, inline: [] }

  const srcToCid = new Map<string, { cid: string; filename: string; content_type: string; data_base64: string }>()

  await Promise.all(
    Array.from(uniqueUrls).map(async (url) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const contentType = res.headers.get('content-type') || 'application/octet-stream'
        if (!contentType.startsWith('image/')) return
        const ab = await res.arrayBuffer()
        if (ab.byteLength > MAX_INLINE_IMAGE_BYTES) return
        const buf = Buffer.from(ab)
        const filename = decodeURIComponent(url.split('/').pop() || 'image').slice(0, 80)
        const cid = `${crypto.randomUUID()}@infinity-erp`
        srcToCid.set(url, {
          cid,
          filename,
          content_type: contentType,
          data_base64: buf.toString('base64'),
        })
      } catch {
        // Skip — external URL stays in place
      }
    })
  )

  let rewritten = html
  for (const [url, data] of srcToCid) {
    const escapedUrl = escapeRegex(url)
    rewritten = rewritten.replace(
      new RegExp(`src=(["'])${escapedUrl}\\1`, 'gi'),
      `src="cid:${data.cid}"`
    )
  }

  const inline = Array.from(srcToCid.values()).map((d) => ({
    filename: d.filename,
    content_type: d.content_type,
    data_base64: d.data_base64,
    cid: d.cid,
    inline: true as const,
  }))

  return { html: rewritten, inline }
}

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
  account_id: z.string().uuid().optional(),
})

/**
 * Encode a header value using RFC 2047 Base64 encoding for non-ASCII chars.
 * Prevents corrupted Subject/From headers that cause Gmail to reject emails.
 */
function rfc2047Encode(value: string): string {
  if (!/[^\x00-\x7F]/.test(value)) return value
  const encoded = Buffer.from(value, 'utf-8').toString('base64')
  // Max encoded word length is 75 chars; prefix =?UTF-8?B? is 10 chars, suffix ?= is 2 chars
  const maxChunk = 63
  if (encoded.length <= maxChunk) {
    return `=?UTF-8?B?${encoded}?=`
  }
  const chunks: string[] = []
  for (let i = 0; i < encoded.length; i += maxChunk) {
    chunks.push(`=?UTF-8?B?${encoded.slice(i, i + maxChunk)}?=`)
  }
  return chunks.join('\r\n ')
}

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
  lines.push(`Subject: ${rfc2047Encode(opts.subject)}`)
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
    const body = await req.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { to, cc, bcc, subject, body_html, body_text, in_reply_to, process_id, process_type, attachments, account_id } =
      parsed.data

    // 1. Resolve email account (supports admin accessing any account)
    const resolved = await resolveEmailAccount(account_id)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const { account, password } = resolved.data
    const adminDb = createAdminClient()

    // 2. Create message record (status: sending)
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

    // 3. Resolve attachments to base64 for the edge function
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

    // 4. Inline R2 images into MIME parts (CID) so Outlook renders them without prompting.
    //    Must happen before the tracking pixel so the pixel URL is preserved as external.
    const { html: inlinedHtml, inline: inlineAttachments } = await inlineR2Images(body_html)

    // 5. Inject open-tracking pixel into the HTML
    const requestOrigin = new URL(req.url).origin
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin
    const trackedHtml = injectOpenTrackingPixel(inlinedHtml, message.id, baseUrl)

    // 6. Call Supabase Edge Function (smtp-send) to bypass serverless SMTP port restrictions
    const combinedAttachments = [...inlineAttachments, ...edgeAttachments]
    const edgePayload = {
      smtp: {
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_secure,
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
      attachments: combinedAttachments.length > 0 ? combinedAttachments : undefined,
    }

    const edgeUrl = `${SUPABASE_URL}/functions/v1/smtp-send`
    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EDGE_SMTP_SECRET ? { 'x-edge-secret': EDGE_SMTP_SECRET } : {}),
      },
      body: JSON.stringify(edgePayload),
    })

    const resultText = await edgeRes.text()
    let result: Record<string, unknown>
    try {
      result = JSON.parse(resultText)
    } catch {
      console.error('[email/send] Edge non-JSON response:', resultText.substring(0, 200))
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
      try {
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
      } catch (imapErr) {
        console.warn('[email/send] IMAP append failed (non-fatal):', imapErr)
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
          error_message: result.error as string,
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
