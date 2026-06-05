/**
 * POST /api/analise-meta/leads/assign-bulk
 *
 * Bulk version of /api/analise-meta/leads/[id]/assign — assigns several raw
 * Meta leads from the "Por atribuir" tab to one consultor at once. For each
 * lead it runs the unified ingest pipeline (bridgeMetaLeadToCrm with
 * forceAgentId), bypassing the attribution-rule gate. Sequential so dedup
 * stays consistent across leads that share a contacto.
 *
 * Gate: gestão/Marketing (canManageAttribution).
 *
 * Body:  { lead_ids: string[1..200], consultant_id }
 * Returns: { results: [{ id, status }], assigned }
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
  lead_ids: z.array(z.string().regex(UUID_RE, 'UUID inválido')).min(1).max(200),
  consultant_id: z.string().regex(UUID_RE, 'UUID inválido'),
})

interface Result {
  id: string
  status: string
}

export async function POST(req: NextRequest) {
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

  const { lead_ids, consultant_id } = parsed.data

  const { data: rows, error } = await db
    .schema('meta')
    .from('meta_leads_raw')
    .select('id, payload, lead_id')
    .in('id', lead_ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byId = new Map(
    ((rows ?? []) as Array<{ id: string; payload: unknown; lead_id: string | null }>).map((r) => [r.id, r]),
  )

  const results: Result[] = []
  let assigned = 0

  // Sequential: shared-contacto dedup must not race.
  for (const id of lead_ids) {
    const raw = byId.get(id)
    if (!raw) {
      results.push({ id, status: 'not_found' })
      continue
    }
    const lead = (raw.payload as MubeLeadEvent | null)?.lead
    if (!lead?.leadgen_id) {
      results.push({ id, status: 'invalid_payload' })
      continue
    }
    try {
      const result = await bridgeMetaLeadToCrm(lead, db, raw.id, null, {
        forceAgentId: consultant_id,
      })
      results.push({ id, status: result.status })
      if (result.status !== 'error') assigned += 1
    } catch {
      results.push({ id, status: 'error' })
    }
  }

  return NextResponse.json({ results, assigned })
}
