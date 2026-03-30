import { NextResponse } from 'next/server'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { fetchMessageEnvelopes, listFolders } from '@/lib/email/imap-client'

/**
 * GET /api/email/thread?subject=<subject>&account_id=<uuid>
 *
 * Fetches messages from the Sent folder that match the thread subject.
 * Uses the same envelope fetch that works for INBOX — no IMAP SEARCH needed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject')
    const accountId = searchParams.get('account_id')

    if (!subject) {
      return NextResponse.json({ messages: [], folder: null })
    }

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

    // Find the Sent folder
    const folders = await listFolders(imapConfig)
    const sentFolder = folders.find(
      (f: { path: string; specialUse?: string }) =>
        f.specialUse === '\\Sent' ||
        f.path.toLowerCase() === 'sent' ||
        f.path.toLowerCase() === 'sent items' ||
        f.path.toLowerCase() === 'enviados' ||
        f.path.toLowerCase() === 'sent mail' ||
        f.path.toLowerCase().includes('sent')
    )

    if (!sentFolder) {
      // Return folder list for debugging
      console.warn('[email/thread] No Sent folder found. Available:', folders.map((f: { path: string }) => f.path))
      return NextResponse.json({ messages: [], folder: null })
    }

    // Fetch ALL envelopes from Sent folder (recent pages)
    // Then filter client-side by subject match
    const normalizeSubject = (s: string) =>
      s.replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
        .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
        .trim()
        .toLowerCase()

    const targetSubject = normalizeSubject(subject)

    // Fetch up to 200 recent sent messages and filter by subject
    const { messages: sentMessages } = await fetchMessageEnvelopes(imapConfig, {
      folder: sentFolder.path,
      limit: 200,
      page: 1,
    })

    const matching = sentMessages.filter(m => {
      const msgSubject = normalizeSubject(m.subject || '')
      return msgSubject === targetSubject || msgSubject.includes(targetSubject) || targetSubject.includes(msgSubject)
    })

    return NextResponse.json({
      messages: matching,
      folder: sentFolder.path,
    })
  } catch (error) {
    console.error('[email/thread] Error:', error)
    return NextResponse.json({ error: 'Erro ao pesquisar conversa' }, { status: 500 })
  }
}
