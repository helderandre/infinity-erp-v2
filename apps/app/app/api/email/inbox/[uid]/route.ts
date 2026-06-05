import { NextResponse } from 'next/server'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { fetchMessageByUid, markAsRead } from '@/lib/email/imap-client'
import { simpleParser } from 'mailparser'

/**
 * GET /api/email/inbox/[uid] — Fetch full message content
 *
 * Query params:
 *   folder=INBOX (default)
 *   account_id=<uuid> (optional — admin can access any account)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid: uidStr } = await params
    const uid = parseInt(uidStr)
    if (isNaN(uid)) {
      return NextResponse.json({ error: 'UID inválido' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const folder = searchParams.get('folder') || 'INBOX'
    const accountId = searchParams.get('account_id')

    const resolved = await resolveEmailAccount(accountId)
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

    // Extract attachments metadata
    const attachments = (parsed.attachments || []).map((att) => ({
      filename: att.filename || 'sem-nome',
      content_type: att.contentType || 'application/octet-stream',
      size_bytes: att.size || 0,
      cid: att.cid || null,
      is_inline: att.contentDisposition === 'inline',
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
