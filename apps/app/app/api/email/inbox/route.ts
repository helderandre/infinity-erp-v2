import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import {
  fetchMessageEnvelopes,
  listFolders,
  markAsRead,
  toggleFlagged,
  searchMessages,
  moveMessage,
  deleteMessage,
  archiveMessage,
} from '@/lib/email/imap-client'

/**
 * GET /api/email/inbox — List messages or folders
 *
 * Query params:
 *   account_id=<uuid> (optional — admin can access any account)
 *   action=list (default) | folders | search
 *   folder=INBOX (default)
 *   page=1
 *   limit=50
 *   query=<string> (for search)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('account_id')
    const action = searchParams.get('action') || 'list'

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

    // ─── Action: list folders ───────────────────────────────────────
    if (action === 'folders') {
      const folders = await listFolders(imapConfig)

      const mapped = folders.map((f) => {
        let special: string | undefined
        const su = (f as Record<string, unknown>).specialUse as string | null
        if (su) {
          if (su.includes('Inbox')) special = 'inbox'
          else if (su.includes('Sent')) special = 'sent'
          else if (su.includes('Drafts')) special = 'drafts'
          else if (su.includes('Trash')) special = 'trash'
          else if (su.includes('Junk')) special = 'junk'
          else if (su.includes('Archive')) special = 'archive'
        }
        return {
          name: f.name,
          path: f.path,
          flags: f.flags,
          delimiter: f.delimiter,
          special,
        }
      })

      return NextResponse.json({ folders: mapped })
    }

    // ─── Action: search messages ─────────────────────────────────────
    if (action === 'search') {
      const folder = searchParams.get('folder') || 'INBOX'
      const query = searchParams.get('query') || ''
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

      if (!query.trim()) {
        return NextResponse.json({ messages: [], total: 0, query: '', folder })
      }

      const result = await searchMessages(imapConfig, folder, query.trim(), limit)

      return NextResponse.json({
        messages: result.messages,
        total: result.total,
        query,
        folder,
      })
    }

    // ─── Action: list messages ──────────────────────────────────────
    if (action === 'list') {
      const folder = searchParams.get('folder') || 'INBOX'
      const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

      const result = await fetchMessageEnvelopes(imapConfig, { folder, page, limit })

      // Update last_sync_at
      const adminDb = createAdminClient()
      await adminDb
        .from('consultant_email_accounts')
        .update({ last_sync_at: new Date().toISOString(), last_error: null })
        .eq('id', account.id)

      return NextResponse.json({
        messages: result.messages,
        total: result.total,
        page,
        limit,
        folder,
      })
    }

    return NextResponse.json({ error: 'Acção inválida' }, { status: 400 })
  } catch (err) {
    console.error('[email/inbox] GET exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/email/inbox — Actions on messages (mark_read, toggle_flagged, move, delete, archive)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, folder = 'INBOX', uid, flagged, destination, account_id } = body as {
      action: string
      folder?: string
      uid: number
      flagged?: boolean
      destination?: string
      account_id?: string
    }

    if (!uid || !action) {
      return NextResponse.json({ error: 'uid e action são obrigatórios' }, { status: 400 })
    }

    const resolved = await resolveEmailAccount(account_id)
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

    if (action === 'mark_read') {
      await markAsRead(imapConfig, folder, uid)
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_flagged') {
      await toggleFlagged(imapConfig, folder, uid, flagged ?? true)
      return NextResponse.json({ success: true })
    }

    if (action === 'move') {
      if (!destination) {
        return NextResponse.json({ error: 'destination é obrigatório' }, { status: 400 })
      }
      await moveMessage(imapConfig, folder, uid, destination)
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      await deleteMessage(imapConfig, folder, uid)
      return NextResponse.json({ success: true })
    }

    if (action === 'archive') {
      await archiveMessage(imapConfig, folder, uid)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acção inválida' }, { status: 400 })
  } catch (err) {
    console.error('[email/inbox] POST exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
