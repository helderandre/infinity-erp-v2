/**
 * POST /api/analise-meta/leads/[id]/assign
 *
 * Manual assignment of a single Meta lead from the "Por atribuir" inbox to a
 * chosen consultor — bypasses the attribution-rule gate (forceAgentId). Runs
 * the lead through the unified ingestLead pipeline (dedup → contact → entry →
 * notify) and stamps meta_leads_raw.lead_id/processed.
 *
 * Gate: gestão/Marketing (canManageAttribution).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { canManageAttribution } from '@/lib/analise-meta/can-manage-attribution'
import { bridgeMetaLeadToCrm } from '@/lib/mube/handlers'
import type { MubeLeadEvent } from '@/lib/mube/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  consultant_id: z.string().regex(UUID_RE, 'UUID inválido'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const db = createCrmAdminClient()
  if (!(await canManageAttribution(db, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: raw, error } = await db
    .schema('meta')
    .from('meta_leads_raw')
    .select('id, payload, lead_id')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!raw) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const lead = (raw.payload as MubeLeadEvent | null)?.lead
  if (!lead?.leadgen_id) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 422 })
  }

  const result = await bridgeMetaLeadToCrm(lead, db, raw.id, null, {
    forceAgentId: parsed.data.consultant_id,
  })

  if (result.status === 'error') {
    return NextResponse.json({ error: 'ingest_failed' }, { status: 500 })
  }

  return NextResponse.json({
    status: result.status,
    contact_id: result.contact_id ?? null,
    entry_id: result.entry_id ?? null,
  })
}
