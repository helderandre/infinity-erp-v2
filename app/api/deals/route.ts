import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

// POST /api/deals — Create new deal (draft)
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const body = await request.json()

    const scenario = body.scenario
    if (!['pleno', 'comprador_externo', 'pleno_agencia', 'angariacao_externa'].includes(scenario)) {
      return NextResponse.json({ error: 'Cenario invalido' }, { status: 400 })
    }

    const hasShare = scenario !== 'pleno'
    const shareType = scenario === 'comprador_externo' ? 'external_buyer'
      : scenario === 'pleno_agencia' ? 'internal_agency'
      : scenario === 'angariacao_externa' ? 'external_agency'
      : null

    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        deal_type: scenario,
        consultant_id: auth.user.id,
        created_by: auth.user.id,
        status: 'draft',
        has_share: hasShare,
        share_type: shareType,
        deal_value: 0,
        deal_date: new Date().toISOString().split('T')[0],
        commission_pct: 0,
        commission_total: 0,
        payment_structure: 'split',
        cpcv_pct: 0,
        escritura_pct: 100,
        // Pre-fill from body if provided
        property_id: body.property_id || null,
        negocio_id: body.negocio_id || null,
        share_pct: body.share_pct ?? 50,
        partner_agency_name: body.partner_agency_name || null,
        external_consultant_name: body.external_consultant_name || null,
        external_consultant_phone: body.external_consultant_phone || null,
        external_consultant_email: body.external_consultant_email || null,
        internal_colleague_id: body.internal_colleague_id || null,
        external_property_link: body.external_property_link || null,
        share_notes: body.share_notes || null,
      })
      .select('id')
      .single()

    if (error || !deal) {
      return NextResponse.json({ error: 'Erro ao criar negocio', details: error?.message }, { status: 500 })
    }

    return NextResponse.json(deal, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET /api/deals — List deals (with filters)
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const propertyId = searchParams.get('property_id')
    const negocioId = searchParams.get('negocio_id')

    let query = supabase
      .from('deals')
      .select(`
        *,
        property:dev_properties(id, title, external_ref, city, listing_price),
        consultant:dev_users!deals_consultant_id_fkey(id, commercial_name),
        payments:deal_payments(*)
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (propertyId) query = query.eq('property_id', propertyId)
    if (negocioId) query = query.eq('negocio_id', negocioId)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
