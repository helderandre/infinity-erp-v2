import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

/**
 * GET /api/deletion-requests
 *
 * Modes (query param `scope`):
 *   - scope=partner  → pending requests awaiting THIS parceiro's approval
 *                      (partner_id = me). Portal queue.
 *   - scope=mine     → requests I filed (requested_by = me). ERP requester view.
 *   - entity_type & entity_id → the pending request for a specific entity, only
 *                      if I'm the requester or the target partner (badge lookup).
 *
 * Optional `status` filter (comma-separated) for scope=mine/partner.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const db = createCrmAdminClient()
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')
    const statusParam = searchParams.get('status')

    // Single-entity lookup (for the ERP "pending deletion" badge).
    if (entityType && entityId) {
      const { data, error } = await db
        .from('deletion_requests')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('status', 'pending')
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data) return NextResponse.json({ request: null })
      // Only the requester or the target partner may see it.
      if (data.requested_by !== auth.user.id && data.partner_id !== auth.user.id) {
        return NextResponse.json({ request: null })
      }
      return NextResponse.json({ request: data })
    }

    let query = db
      .from('deletion_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (scope === 'partner') {
      query = query.eq('partner_id', auth.user.id)
    } else {
      // default: requests I filed
      query = query.eq('requested_by', auth.user.id)
    }

    const statuses = (statusParam || (scope === 'partner' ? 'pending' : ''))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (statuses.length === 1) query = query.eq('status', statuses[0])
    else if (statuses.length > 1) query = query.in('status', statuses)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ requests: data ?? [] })
  } catch (err) {
    console.error('[deletion-requests GET]', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
