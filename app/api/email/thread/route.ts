import { NextResponse } from 'next/server'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { listFolders } from '@/lib/email/imap-client'
import { ImapFlow } from 'imapflow'
import type { ImapMessageEnvelope } from '@/types/email'

/**
 * GET /api/email/thread?subject=<subject>&account_id=<uuid>
 *
 * Searches the Sent folder for messages matching the thread subject.
 * Uses direct IMAP SUBJECT search on the most distinctive word.
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
        f.path.toLowerCase() === 'enviadas' ||
        f.path.toLowerCase() === 'enviados' ||
        f.path.toLowerCase() === 'sent' ||
        f.path.toLowerCase() === 'sent items' ||
        f.path.toLowerCase() === 'sent mail' ||
        f.path.toLowerCase().includes('enviad') ||
        f.path.toLowerCase().includes('sent')
    )

    if (!sentFolder) {
      return NextResponse.json({
        messages: [],
        folder: null,
        _debug: { error: 'No Sent folder', available: folders.map((f: { path: string }) => f.path) },
      })
    }

    // Strip Re:/Fwd: and special chars, extract the base subject
    const baseSubject = subject
      .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
      .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
      .trim()

    // Extract the longest distinctive word (>4 chars) for IMAP search
    // IMAP SUBJECT search does substring matching, so one good keyword is enough
    const words = baseSubject
      .split(/[\s_\-–—\/\\|,;:.!?()[\]{}]+/)
      .filter(w => w.length > 4)
      .sort((a, b) => b.length - a.length)

    const searchWord = words[0] || baseSubject.slice(0, 20)

    // Direct IMAP connection for precise SUBJECT-only search
    const client = new ImapFlow({
      host: imapConfig.host,
      port: imapConfig.port,
      secure: imapConfig.secure,
      auth: { user: imapConfig.user, pass: imapConfig.pass },
      logger: false,
      emitLogs: false,
    })

    let messages: ImapMessageEnvelope[] = []

    try {
      await client.connect()
      const lock = await client.getMailboxLock(sentFolder.path)

      try {
        // IMAP SUBJECT search — searches ALL messages, does substring match
        const uids = await client.search({ subject: searchWord }, { uid: true })

        if (uids && uids.length > 0) {
          // Take most recent 30
          const sorted = [...uids].sort((a, b) => b - a).slice(0, 30)
          const uidRange = sorted.join(',')

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasAttachmentParts = (bs: any): boolean => {
            if (!bs) return false
            if (bs.disposition === 'attachment') return true
            if (Array.isArray(bs.childNodes)) return bs.childNodes.some(hasAttachmentParts)
            return false
          }

          for await (const msg of client.fetch(uidRange, {
            envelope: true,
            flags: true,
            bodyStructure: true,
            uid: true,
            size: true,
          }, { uid: true })) {
            const env = msg.envelope
            messages.push({
              uid: msg.uid,
              messageId: env?.messageId || null,
              inReplyTo: env?.inReplyTo || null,
              from: (env?.from || []).map((a: { name?: string; address?: string }) => ({
                name: a.name, address: a.address,
              })),
              to: (env?.to || []).map((a: { name?: string; address?: string }) => ({
                name: a.name, address: a.address,
              })),
              cc: (env?.cc || []).map((a: { name?: string; address?: string }) => ({
                name: a.name, address: a.address,
              })),
              subject: env?.subject || '(sem assunto)',
              date: env?.date ? new Date(env.date).toISOString() : null,
              flags: Array.from(msg.flags || []),
              size: msg.size || 0,
              hasAttachments: hasAttachmentParts(msg.bodyStructure),
            })
          }
        }

        // Post-filter: normalize subjects and compare
        const normalize = (s: string) =>
          s.replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
            .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
            .replace(/[\s_\-–—\/\\|]+/g, ' ')
            .trim()
            .toLowerCase()

        const targetNorm = normalize(baseSubject)

        messages = messages.filter(m => {
          const norm = normalize(m.subject || '')
          return norm === targetNorm ||
            norm.includes(targetNorm) ||
            targetNorm.includes(norm)
        })

        messages.sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          return db - da
        })
      } finally {
        lock.release()
      }
    } finally {
      await client.logout()
    }

    return NextResponse.json({
      messages,
      folder: sentFolder.path,
      _debug: {
        sentFolderPath: sentFolder.path,
        searchWord,
        baseSubject,
        matchingCount: messages.length,
      },
    })
  } catch (error) {
    console.error('[email/thread] Error:', error)
    return NextResponse.json({ error: 'Erro ao pesquisar conversa' }, { status: 500 })
  }
}
