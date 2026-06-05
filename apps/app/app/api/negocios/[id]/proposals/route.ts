import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const UUID_REGEX = /^[0-9a-f-]{36}$/

const PROPOSAL_SELECT = `
  *,
  property:dev_properties!property_id(id, title, slug, listing_price, external_ref, city, zone),
  deal:deals!deal_id(id),
  creator:dev_users!created_by(id, commercial_name)
`

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('negocio_proposals')
      .select(PROPOSAL_SELECT)
      .eq('negocio_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[negocios/[id]/proposals GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

const createSchema = z.object({
  negocio_property_id: z.string().regex(UUID_REGEX).optional().nullable(),
  property_id: z.string().regex(UUID_REGEX).optional().nullable(),
  amount: z.number().positive().nullable().optional(),
  currency: z.string().default('EUR').optional(),
  direction: z.enum(['outbound', 'inbound']).default('outbound').optional(),
  notes: z.string().max(2000).optional().nullable(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient() as any

    // Resolve property_id a partir do negocio_property_id (se vier do dossier)
    let propertyId = parsed.data.property_id ?? null
    if (parsed.data.negocio_property_id && !propertyId) {
      const { data: np } = await admin
        .from('negocio_properties')
        .select('property_id')
        .eq('id', parsed.data.negocio_property_id)
        .single()
      if (np?.property_id) propertyId = np.property_id
    }

    const insertData: any = {
      negocio_id: id,
      negocio_property_id: parsed.data.negocio_property_id ?? null,
      property_id: propertyId,
      amount: parsed.data.amount ?? null,
      currency: parsed.data.currency ?? 'EUR',
      direction: parsed.data.direction ?? 'outbound',
      notes: parsed.data.notes ?? null,
      created_by: auth.user.id,
    }

    const { data, error } = await admin
      .from('negocio_proposals')
      .insert(insertData)
      .select(PROPOSAL_SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[negocios/[id]/proposals POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
