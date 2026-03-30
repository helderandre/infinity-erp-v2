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
      console.error('[email/thread] NO SENT FOLDER FOUND. Available folders:', folders.map((f: { path: string; specialUse?: string }) => `${f.path} (${f.specialUse || 'no special-use'})`))
      return NextResponse.json({ messages: [], folder: null })
    }

    console.log('[email/thread] Using Sent folder:', sentFolder.path)
    console.log('[email/thread] Searching for subject:', subject)

    const normalizeSubject = (s: string) =>
      s.replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
        .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
        .trim()
        .toLowerCase()

    const targetSubject = normalizeSubject(subject)
    console.log('[email/thread] Normalized target:', targetSubject)

    // Fetch up to 200 recent sent messages and filter by subject
    const { messages: sentMessages, total } = await fetchMessageEnvelopes(imapConfig, {
      folder: sentFolder.path,
      limit: 200,
      page: 1,
    })

    console.log(`[email/thread] Fetched ${sentMessages.length} of ${total} sent messages`)

    const matching = sentMessages.filter(m => {
      const msgSubject = normalizeSubject(m.subject || '')
      return msgSubject === targetSubject || msgSubject.includes(targetSubject) || targetSubject.includes(msgSubject)
    })

    console.log(`[email/thread] Found ${matching.length} matching messages`)
    if (matching.length > 0) {
      matching.forEach(m => console.log(`  - UID ${m.uid}: "${m.subject}" from ${m.from[0]?.address}`))
    } else if (sentMessages.length > 0) {
      // Log first 5 sent subjects for debugging
      console.log('[email/thread] Sample sent subjects:')
      sentMessages.slice(0, 5).forEach(m => console.log(`  - "${m.subject}"`))
    }

    return NextResponse.json({
      messages: matching,
      folder: sentFolder.path,
      _debug: {
        sentFolderPath: sentFolder.path,
        totalInSent: total,
        fetchedFromSent: sentMessages.length,
        targetSubject,
        matchingCount: matching.length,
        sampleSubjects: sentMessages.slice(0, 5).map(m => m.subject),
        allFolders: folders.map((f: { path: string; specialUse?: string }) => `${f.path} (${f.specialUse || '-'})`),
      },
    })
  } catch (error) {
    console.error('[email/thread] Error:', error)
    return NextResponse.json({ error: 'Erro ao pesquisar conversa' }, { status: 500 })
  }
}
