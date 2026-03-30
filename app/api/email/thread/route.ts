import { NextResponse } from 'next/server'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { searchThreadMessages, listFolders } from '@/lib/email/imap-client'

/**
 * GET /api/email/thread?message_ids=<id1>,<id2>&account_id=<uuid>
 *
 * Searches the Sent folder for messages that belong to a thread
 * (matching In-Reply-To or Message-ID headers).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const messageIdsParam = searchParams.get('message_ids')
    const accountId = searchParams.get('account_id')
    const subject = searchParams.get('subject')

    if (!messageIdsParam && !subject) {
      return NextResponse.json({ error: 'message_ids ou subject é obrigatório' }, { status: 400 })
    }

    const messageIds = messageIdsParam ? messageIdsParam.split(',').filter(Boolean) : []

    const resolved = await resolveEmailAccount(accountId || undefined)
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

    // Find the Sent folder name
    const folders = await listFolders(imapConfig)
    const sentFolder = folders.find(
      (f: { path: string; specialUse?: string }) =>
        f.specialUse === '\\Sent' ||
        f.path.toLowerCase() === 'sent' ||
        f.path.toLowerCase() === 'sent items' ||
        f.path.toLowerCase() === 'enviados'
    )

    if (!sentFolder) {
      return NextResponse.json({ messages: [] })
    }

    const messages = await searchThreadMessages(imapConfig, sentFolder.path, messageIds, subject || undefined)

    return NextResponse.json({ messages, folder: sentFolder.path })
  } catch (error) {
    console.error('[email/thread] Error:', error)
    return NextResponse.json({ error: 'Erro ao pesquisar conversa' }, { status: 500 })
  }
}
