import { ImapFlow } from 'imapflow'
import type { ImapMessageEnvelope } from '@/types/email'

// Re-export for backward compat
export type { ImapMessageEnvelope }

interface ImapConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

/**
 * Verify IMAP connection is valid
 */
export async function verifyImap(config: ImapConfig): Promise<{ ok: boolean; error?: string }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    await client.logout()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * List available IMAP folders/mailboxes
 */
export async function listFolders(config: ImapConfig) {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    const mailboxes = await client.list()
    await client.logout()

    return mailboxes.map((mb) => ({
      name: mb.name,
      path: mb.path,
      flags: Array.from(mb.flags || []),
      delimiter: mb.delimiter,
      specialUse: mb.specialUse || null,
      listed: mb.listed,
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Erro ao listar pastas IMAP: ${message}`)
  }
}

export interface FetchMessagesOptions {
  folder?: string
  limit?: number
  page?: number
  /** Fetch only messages newer than this UID */
  sinceUid?: number
}

/**
 * Fetch message envelopes (headers only) from a folder
 */
export async function fetchMessageEnvelopes(
  config: ImapConfig,
  options: FetchMessagesOptions = {}
): Promise<{ messages: ImapMessageEnvelope[]; total: number }> {
  const { folder = 'INBOX', limit = 50, page = 1 } = options

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)

    try {
      const total = client.mailbox ? (client.mailbox as { exists: number }).exists : 0
      if (total === 0) return { messages: [], total: 0 }

      // Calculate range: most recent first
      const end = total
      const start = Math.max(1, end - (page * limit) + 1)
      const rangeEnd = Math.max(1, end - ((page - 1) * limit))

      const messages: ImapMessageEnvelope[] = []

      for await (const msg of client.fetch(`${start}:${rangeEnd}`, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        uid: true,
        size: true,
      })) {
        const env = msg.envelope
        messages.push({
          uid: msg.uid,
          messageId: env?.messageId || null,
          inReplyTo: env?.inReplyTo || null,
          from: (env?.from || []).map((a: { name?: string; address?: string }) => ({
            name: a.name,
            address: a.address,
          })),
          to: (env?.to || []).map((a: { name?: string; address?: string }) => ({
            name: a.name,
            address: a.address,
          })),
          cc: (env?.cc || []).map((a: { name?: string; address?: string }) => ({
            name: a.name,
            address: a.address,
          })),
          subject: env?.subject || '(sem assunto)',
          date: env?.date ? new Date(env.date).toISOString() : null,
          flags: Array.from(msg.flags || []),
          size: msg.size || 0,
          hasAttachments: hasAttachmentParts(msg.bodyStructure),
        })
      }

      // Sort by date descending (most recent first)
      messages.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0
        const db = b.date ? new Date(b.date).getTime() : 0
        return db - da
      })

      return { messages, total }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

/**
 * Fetch full message content by UID
 */
export async function fetchMessageByUid(
  config: ImapConfig,
  folder: string,
  uid: number
): Promise<{ source: Buffer; flags: string[] } | null> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)

    try {
      const msg = await client.fetchOne(String(uid), {
        source: true,
        flags: true,
        uid: true,
      }, { uid: true })

      if (!msg) return null

      return {
        source: msg.source as unknown as Buffer,
        flags: Array.from(msg.flags || []),
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

/**
 * Mark a message as read (add \Seen flag)
 */
export async function markAsRead(
  config: ImapConfig,
  folder: string,
  uid: number
): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)

    try {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

/**
 * Toggle flagged status
 */
export async function toggleFlagged(
  config: ImapConfig,
  folder: string,
  uid: number,
  flagged: boolean
): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)

    try {
      if (flagged) {
        await client.messageFlagsAdd(String(uid), ['\\Flagged'], { uid: true })
      } else {
        await client.messageFlagsRemove(String(uid), ['\\Flagged'], { uid: true })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

/**
 * Search messages in a folder using IMAP SEARCH
 * Searches in FROM, SUBJECT, and BODY
 */
export async function searchMessages(
  config: ImapConfig,
  folder: string,
  query: string,
  limit = 50
): Promise<{ messages: ImapMessageEnvelope[]; total: number }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)

    try {
      // IMAP OR search: match FROM, SUBJECT, or TO
      const uids = await client.search(
        {
          or: [
            { from: query },
            { subject: query },
            { to: query },
          ],
        },
        { uid: true }
      )

      if (!uids || uids.length === 0) return { messages: [], total: 0 }

      const total = uids.length
      // Take only the most recent `limit` UIDs (highest UIDs = most recent)
      const sortedUids = [...uids].sort((a, b) => b - a).slice(0, limit)
      const uidRange = sortedUids.join(',')

      const messages: ImapMessageEnvelope[] = []

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
            name: a.name,
            address: a.address,
          })),
          to: (env?.to || []).map((a: { name?: string; address?: string }) => ({
            name: a.name,
            address: a.address,
          })),
          cc: (env?.cc || []).map((a: { name?: string; address?: string }) => ({
            name: a.name,
            address: a.address,
          })),
          subject: env?.subject || '(sem assunto)',
          date: env?.date ? new Date(env.date).toISOString() : null,
          flags: Array.from(msg.flags || []),
          size: msg.size || 0,
          hasAttachments: hasAttachmentParts(msg.bodyStructure),
        })
      }

      messages.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0
        const db = b.date ? new Date(b.date).getTime() : 0
        return db - da
      })

      return { messages, total }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

/**
 * Append a sent message (raw RFC822) to the Sent/IMAP folder
 * so it appears in Outlook, webmail, etc.
 */
export async function appendToSentFolder(
  config: ImapConfig,
  rawMessage: Buffer | string
): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()

    // Find the Sent folder via LIST special-use
    const mailboxes = await client.list()
    const sentFolder = mailboxes.find(
      (mb) =>
        mb.specialUse === '\\Sent' ||
        mb.path.toLowerCase() === 'sent' ||
        mb.path.toLowerCase() === 'sent items' ||
        mb.path.toLowerCase() === 'enviados'
    )

    const sentPath = sentFolder?.path || 'Sent'

    await client.append(sentPath, rawMessage, ['\\Seen'])
  } finally {
    await client.logout()
  }
}

/**
 * Move a message to another folder (IMAP MOVE or COPY+DELETE fallback)
 */
export async function moveMessage(
  config: ImapConfig,
  sourceFolder: string,
  uid: number,
  destinationFolder: string
): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(sourceFolder)

    try {
      await client.messageMove(String(uid), destinationFolder, { uid: true })
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

/**
 * Delete a message — moves to Trash folder
 */
export async function deleteMessage(
  config: ImapConfig,
  folder: string,
  uid: number
): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()

    // Find Trash folder
    const mailboxes = await client.list()
    const trashFolder = mailboxes.find(
      (mb) =>
        mb.specialUse === '\\Trash' ||
        mb.path.toLowerCase() === 'trash' ||
        mb.path.toLowerCase() === 'lixo'
    )
    const trashPath = trashFolder?.path || 'Trash'

    // If already in trash, permanently delete
    if (folder.toLowerCase() === trashPath.toLowerCase()) {
      const lock = await client.getMailboxLock(folder)
      try {
        await client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true })
        await client.messageDelete(String(uid), { uid: true })
      } finally {
        lock.release()
      }
    } else {
      const lock = await client.getMailboxLock(folder)
      try {
        await client.messageMove(String(uid), trashPath, { uid: true })
      } finally {
        lock.release()
      }
    }
  } finally {
    await client.logout()
  }
}

/**
 * Archive a message — moves to Archive folder
 */
export async function archiveMessage(
  config: ImapConfig,
  folder: string,
  uid: number
): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()

    // Find Archive folder
    const mailboxes = await client.list()
    const archiveFolder = mailboxes.find(
      (mb) =>
        mb.specialUse === '\\Archive' ||
        mb.path.toLowerCase() === 'archive' ||
        mb.path.toLowerCase() === 'arquivo'
    )

    // If no archive folder exists, try to create it
    let archivePath = archiveFolder?.path
    if (!archivePath) {
      try {
        await client.mailboxCreate('Archive')
        archivePath = 'Archive'
      } catch {
        archivePath = 'INBOX.Archive'
        await client.mailboxCreate(archivePath)
      }
    }

    const lock = await client.getMailboxLock(folder)
    try {
      await client.messageMove(String(uid), archivePath, { uid: true })
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

/**
 * Save a draft message to the Drafts folder
 * Returns the UID of the saved draft
 */
export async function saveDraft(
  config: ImapConfig,
  rawMessage: Buffer | string,
  existingDraftUid?: number
): Promise<{ uid: number | null }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()

    // Find Drafts folder
    const mailboxes = await client.list()
    const draftsFolder = mailboxes.find(
      (mb) =>
        mb.specialUse === '\\Drafts' ||
        mb.path.toLowerCase() === 'drafts' ||
        mb.path.toLowerCase() === 'rascunhos'
    )
    const draftsPath = draftsFolder?.path || 'Drafts'

    // Delete previous draft version if exists
    if (existingDraftUid) {
      try {
        const lock = await client.getMailboxLock(draftsPath)
        try {
          await client.messageFlagsAdd(String(existingDraftUid), ['\\Deleted'], { uid: true })
          await client.messageDelete(String(existingDraftUid), { uid: true })
        } finally {
          lock.release()
        }
      } catch {
        // Ignore — old draft may have been removed already
      }
    }

    // Append new draft with \Draft and \Seen flags
    const result = await client.append(draftsPath, rawMessage, ['\\Draft', '\\Seen'])
    return { uid: (result as { uid?: number })?.uid ?? null }
  } finally {
    await client.logout()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasAttachmentParts(bodyStructure: any): boolean {
  if (!bodyStructure) return false
  if (bodyStructure.disposition === 'attachment') return true
  if (bodyStructure.childNodes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return bodyStructure.childNodes.some((child: any) => hasAttachmentParts(child))
  }
  return false
}
