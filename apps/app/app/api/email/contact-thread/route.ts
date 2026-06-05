import { NextResponse } from 'next/server'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { searchMessages } from '@/lib/email/imap-client'

/**
 * GET /api/email/contact-thread?email=person@example.com&limit=40
 *
 * Searches INBOX + Sent for all emails involving a specific email address.
 * Returns them merged and sorted chronologically (oldest first, like a chat).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const contactEmail = searchParams.get('email')
    const accountId = searchParams.get('account_id') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 100)

    if (!contactEmail) {
      return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })
    }

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

    // Search INBOX and Sent in parallel
    const [inboxResult, sentResult] = await Promise.all([
      searchMessages(imapConfig, 'INBOX', contactEmail, limit).catch(() => ({ messages: [], total: 0 })),
      searchMessages(imapConfig, 'Sent', contactEmail, limit).catch(async () => {
        // Some servers use different sent folder names
        try {
          return await searchMessages(imapConfig, 'INBOX.Sent', contactEmail, limit)
        } catch {
          try {
            return await searchMessages(imapConfig, 'Sent Messages', contactEmail, limit)
          } catch {
            return { messages: [], total: 0 }
          }
        }
      }),
    ])

    // Tag each message with its source folder
    const inboxMessages = inboxResult.messages.map((m) => ({ ...m, _folder: 'INBOX' as const }))
    const sentMessages = sentResult.messages.map((m) => ({ ...m, _folder: 'Sent' as const }))

    // Merge and deduplicate by messageId
    const seen = new Set<string>()
    const all = [...inboxMessages, ...sentMessages].filter((m) => {
      if (m.messageId && seen.has(m.messageId)) return false
      if (m.messageId) seen.add(m.messageId)
      return true
    })

    // Sort chronologically (oldest first = chat order)
    all.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return da - db
    })

    // Take the last N messages
    const messages = all.slice(-limit)

    return NextResponse.json({
      messages,
      total: all.length,
      account_email: account.email_address,
      account_name: account.display_name,
    })
  } catch (error) {
    console.error('[email/contact-thread] Erro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
