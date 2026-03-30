import { NextResponse } from 'next/server'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { listFolders, searchMessages } from '@/lib/email/imap-client'

/**
 * GET /api/email/thread?subject=<subject>&account_id=<uuid>
 *
 * Searches the Sent folder for messages matching the thread subject.
 * Uses IMAP SUBJECT search which scans all messages in the folder.
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
        f.path.toLowerCase() === 'enviadas' ||
        f.path.toLowerCase() === 'sent mail' ||
        f.path.toLowerCase().includes('sent') ||
        f.path.toLowerCase().includes('enviad')
    )

    if (!sentFolder) {
      return NextResponse.json({
        messages: [],
        folder: null,
        _debug: { error: 'No Sent folder', available: folders.map((f: { path: string }) => f.path) },
      })
    }

    // Strip Re:/Fwd: to get the base subject for search
    const baseSubject = subject
      .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
      .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
      .trim()

    // Use IMAP SUBJECT search — this searches ALL messages in the folder
    const { messages, total } = await searchMessages(
      imapConfig,
      sentFolder.path,
      baseSubject,
      50
    )

    return NextResponse.json({
      messages,
      folder: sentFolder.path,
      _debug: {
        sentFolderPath: sentFolder.path,
        searchQuery: baseSubject,
        matchingCount: messages.length,
        totalResults: total,
      },
    })
  } catch (error) {
    console.error('[email/thread] Error:', error)
    return NextResponse.json({ error: 'Erro ao pesquisar conversa' }, { status: 500 })
  }
}
