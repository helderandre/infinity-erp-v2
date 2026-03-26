import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createReferralSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const contact_id = searchParams.get('contact_id')
    const from_consultant_id = searchParams.get('from_consultant_id')
    const to_consultant_id = searchParams.get('to_consultant_id')
    const partner_id = searchParams.get('partner_id')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const per_page = Math.max(1, parseInt(searchParams.get('per_page') ?? '25', 10))
    const from = (page - 1) * per_page

    const supabase = createCrmAdminClient()

    // leads_referrals.contact_id FK points to leads(id)
    // leads_referrals.negocio_id FK points to negocios(id)
    let query = supabase
      .from('leads_referrals')
      .select(
        `*,
        leads!contact_id(id, nome, email, telemovel),
        dev_users!from_consultant_id(id, commercial_name),
        dev_users!to_consultant_id(id, commercial_name),
        leads_partners!partner_id(id, name, company),
        negocios!negocio_id(id, tipo, pipeline_stage_id, expected_value)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, from + per_page - 1)

    if (contact_id) query = query.eq('contact_id', contact_id)
    if (from_consultant_id) query = query.eq('from_consultant_id', from_consultant_id)
    if (to_consultant_id) query = query.eq('to_consultant_id', to_consultant_id)
    if (partner_id) query = query.eq('partner_id', partner_id)
    if (status) query = query.eq('status', status)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data, total: count ?? 0, page, per_page })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = createReferralSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = createCrmAdminClient()

    const { data, error } = await supabase
      .from('leads_referrals')
      .insert(parsed.data)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
