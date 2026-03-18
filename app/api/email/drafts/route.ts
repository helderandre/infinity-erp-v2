import { NextResponse } from 'next/server'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { saveDraft } from '@/lib/email/imap-client'
import MailComposer from 'nodemailer/lib/mail-composer'
import { z } from 'zod'

const draftSchema = z.object({
  to: z.string().optional().default(''),
  cc: z.string().optional().default(''),
  bcc: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  body_html: z.string().optional().default(''),
  in_reply_to: z.string().optional(),
  existing_draft_uid: z.number().optional(),
  account_id: z.string().uuid().optional(),
})

/**
 * POST /api/email/drafts — Save draft to IMAP Drafts folder
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = draftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const resolved = await resolveEmailAccount(data.account_id)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const { account, password } = resolved.data

    const imapConfig = {
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_secure,
      user: account.email_address,
      pass: password,
    }

    // Parse recipients
    const toAddrs = data.to
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
    const ccAddrs = data.cc
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
    const bccAddrs = data.bcc
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)

    // Build RFC822 message
    const composer = new MailComposer({
      from: `${account.display_name || ''} <${account.email_address}>`,
      to: toAddrs.length > 0 ? toAddrs.join(', ') : undefined,
      cc: ccAddrs.length > 0 ? ccAddrs.join(', ') : undefined,
      bcc: bccAddrs.length > 0 ? bccAddrs.join(', ') : undefined,
      subject: data.subject || '(sem assunto)',
      html: data.body_html || '',
      inReplyTo: data.in_reply_to,
      date: new Date(),
    })

    const rawMessage = await new Promise<Buffer>((resolve, reject) => {
      composer.compile().build((err, message) => {
        if (err) reject(err)
        else resolve(message)
      })
    })

    const result = await saveDraft(imapConfig, rawMessage, data.existing_draft_uid)

    return NextResponse.json({ success: true, uid: result.uid })
  } catch (err) {
    console.error('[email/drafts] POST exception:', err)
    return NextResponse.json({ error: 'Erro ao guardar rascunho' }, { status: 500 })
  }
}
