import type { ImapMessageEnvelope } from '@/types/email'

export interface EmailThread {
  /** The thread ID (messageId of the root message, or first message's messageId) */
  id: string
  /** All messages in this thread, sorted oldest → newest */
  messages: ImapMessageEnvelope[]
  /** The most recent message (for display in list) */
  latest: ImapMessageEnvelope
  /** Subject line (cleaned of Re:/Fwd: prefixes) */
  subject: string
  /** Number of messages in the thread */
  count: number
  /** Whether any message in the thread is unread */
  hasUnread: boolean
  /** Whether any message in the thread is flagged */
  hasFlagged: boolean
  /** Whether any message in the thread has attachments */
  hasAttachments: boolean
}

/**
 * Normalize a subject line by stripping Re:/Fwd:/Fw: prefixes and trimming.
 */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '')
    .replace(/^(re|fwd|fw|enc|rsp)\s*:\s*/gi, '') // strip double prefixes
    .trim()
    .toLowerCase()
}

/**
 * Group a flat list of message envelopes into conversation threads.
 *
 * Strategy:
 * 1. Build a map of messageId → message
 * 2. For each message with inReplyTo, link it to its parent
 * 3. Group by root messageId (following inReplyTo chains up)
 * 4. Fallback: group by normalized subject for messages without inReplyTo links
 */
export function groupMessagesIntoThreads(messages: ImapMessageEnvelope[]): EmailThread[] {
  if (messages.length === 0) return []

  // Map messageId → message for quick lookup
  const byMessageId = new Map<string, ImapMessageEnvelope>()
  for (const msg of messages) {
    if (msg.messageId) {
      byMessageId.set(msg.messageId, msg)
    }
  }

  // Find root messageId for a message by following inReplyTo chain
  function findRootId(msg: ImapMessageEnvelope): string {
    const visited = new Set<string>()
    let current = msg
    while (current.inReplyTo && byMessageId.has(current.inReplyTo)) {
      if (visited.has(current.inReplyTo)) break // prevent cycles
      visited.add(current.inReplyTo)
      current = byMessageId.get(current.inReplyTo)!
    }
    return current.messageId || `uid-${current.uid}`
  }

  // Group messages by root ID
  const threadMap = new Map<string, ImapMessageEnvelope[]>()
  const assigned = new Set<number>() // track assigned UIDs

  // First pass: group by inReplyTo chains
  for (const msg of messages) {
    if (msg.inReplyTo || msg.messageId) {
      const rootId = findRootId(msg)
      if (!threadMap.has(rootId)) threadMap.set(rootId, [])
      threadMap.get(rootId)!.push(msg)
      assigned.add(msg.uid)
    }
  }

  // Second pass: for unassigned messages, try to match by normalized subject
  const subjectToThreadId = new Map<string, string>()
  for (const [threadId, msgs] of threadMap) {
    const subj = normalizeSubject(msgs[0].subject || '')
    if (subj) subjectToThreadId.set(subj, threadId)
  }

  for (const msg of messages) {
    if (assigned.has(msg.uid)) continue
    const subj = normalizeSubject(msg.subject || '')
    if (subj && subjectToThreadId.has(subj)) {
      const threadId = subjectToThreadId.get(subj)!
      threadMap.get(threadId)!.push(msg)
      assigned.add(msg.uid)
    } else {
      // Standalone message — its own thread
      const id = msg.messageId || `uid-${msg.uid}`
      threadMap.set(id, [msg])
      if (subj) subjectToThreadId.set(subj, id)
      assigned.add(msg.uid)
    }
  }

  // Build thread objects
  const threads: EmailThread[] = []
  for (const [id, msgs] of threadMap) {
    // Sort oldest → newest
    msgs.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return da - db
    })

    const latest = msgs[msgs.length - 1]

    threads.push({
      id,
      messages: msgs,
      latest,
      subject: normalizeSubject(latest.subject || ''),
      count: msgs.length,
      hasUnread: msgs.some(m => !m.flags.includes('\\Seen')),
      hasFlagged: msgs.some(m => m.flags.includes('\\Flagged')),
      hasAttachments: msgs.some(m => m.hasAttachments),
    })
  }

  // Sort threads by latest message date (newest first)
  threads.sort((a, b) => {
    const da = a.latest.date ? new Date(a.latest.date).getTime() : 0
    const db = b.latest.date ? new Date(b.latest.date).getTime() : 0
    return db - da
  })

  return threads
}
