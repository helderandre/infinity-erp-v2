import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveDraft } from '@/lib/email/imap-client'
import MailComposer from 'nodemailer/lib/mail-composer'
import { z } from 'zod'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

const draftSchema = z.object({
  to: z.string().optional().default(''),
  cc: z.string().optional().default(''),
  bcc: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  body_html: z.string().optional().default(''),
  in_reply_to: z.string().optional(),
  existing_draft_uid: z.number().optional(),
})

/**
 * POST /api/email/drafts — Save draft to IMAP Drafts folder
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
    const parsed = draftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const adminDb = createAdminClient()
    const { data: account } = await adminDb
      .from('consultant_email_accounts')
      .select('*')
      .eq('consultant_id', user.id)
      .eq('is_verified', true)
      .eq('is_active', true)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Conta não configurada' }, { status: 404 })
    }

    const { data: password } = await adminDb.rpc('decrypt_email_password', {
      p_encrypted: account.encrypted_password,
      p_key: ENCRYPTION_KEY,
    })

    if (!password) {
      return NextResponse.json({ error: 'Erro ao desencriptar' }, { status: 500 })
    }

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
