import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMessageByUid, markAsRead } from '@/lib/email/imap-client'
import { simpleParser } from 'mailparser'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

/**
 * GET /api/email/inbox/[uid] — Fetch full message content
 *
 * Query params:
 *   folder=INBOX (default)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    if (!ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'ENCRYPTION_KEY não configurada' }, { status: 500 })
    }

    const { uid: uidStr } = await params
    const uid = parseInt(uidStr)
    if (isNaN(uid)) {
      return NextResponse.json({ error: 'UID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const folder = searchParams.get('folder') || 'INBOX'

    // Fetch account + decrypt
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

    // Fetch raw message
    const raw = await fetchMessageByUid(imapConfig, folder, uid)
    if (!raw) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    // Parse with mailparser
    const parsed = await simpleParser(raw.source)

    // Mark as read automatically
    if (!raw.flags.includes('\\Seen')) {
      markAsRead(imapConfig, folder, uid).catch((err) =>
        console.error('[email/inbox] markAsRead error:', err)
      )
    }

    // Extract attachments metadata (no content — download separately if needed)
    const attachments = (parsed.attachments || []).map((att) => ({
      filename: att.filename || 'sem-nome',
      content_type: att.contentType || 'application/octet-stream',
      size_bytes: att.size || 0,
      cid: att.cid || null,
      is_inline: att.contentDisposition === 'inline',
      // base64 content for download
      data_base64: att.content.toString('base64'),
    }))

    return NextResponse.json({
      uid,
      folder,
      messageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo || null,
      references: parsed.references
        ? Array.isArray(parsed.references)
          ? parsed.references
          : [parsed.references]
        : [],
      from: parsed.from?.value?.map((a) => ({ name: a.name, address: a.address })) || [],
      to: parsed.to
        ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((t) =>
            t.value.map((a) => ({ name: a.name, address: a.address }))
          )
        : [],
      cc: parsed.cc
        ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap((t) =>
            t.value.map((a) => ({ name: a.name, address: a.address }))
          )
        : [],
      subject: parsed.subject || '(sem assunto)',
      date: parsed.date?.toISOString() || null,
      html: parsed.html || null,
      text: parsed.text || null,
      flags: raw.flags,
      isRead: raw.flags.includes('\\Seen'),
      isFlagged: raw.flags.includes('\\Flagged'),
      attachments,
    })
  } catch (err) {
    console.error('[email/inbox/[uid]] GET exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
