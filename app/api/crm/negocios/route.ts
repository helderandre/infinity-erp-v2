import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createNegocioSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createCrmAdminClient()
    const { searchParams } = new URL(request.url)

    const pipeline_type = searchParams.get('pipeline_type')
    const assigned_consultant_id = searchParams.get('assigned_consultant_id')
    const contact_id = searchParams.get('contact_id') || searchParams.get('lead_id')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const per_page = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') ?? '50', 10)))
    const from = (page - 1) * per_page
    const to = from + per_page - 1

    let query = supabase
      .from('negocios')
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), leads!lead_id(id, nome, email, telemovel, tags), dev_users!assigned_consultant_id(id, commercial_name), dev_properties!property_id(id, title, external_ref, city, listing_price)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    if (pipeline_type) {
      // Map pipeline_type to the `tipo` column values in the negocios table
      if (pipeline_type === 'comprador') {
        query = query.in('tipo', ['Compra', 'Compra e Venda'])
      } else if (pipeline_type === 'vendedor') {
        query = query.in('tipo', ['Venda', 'Compra e Venda'])
      } else if (pipeline_type === 'arrendatario') {
        query = query.eq('tipo', 'Arrendatário')
      } else if (pipeline_type === 'arrendador') {
        query = query.eq('tipo', 'Arrendador')
      }
    }
    if (assigned_consultant_id) query = query.eq('assigned_consultant_id', assigned_consultant_id)
    if (contact_id) query = query.eq('lead_id', contact_id)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data, total: count ?? 0, page, per_page })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createCrmAdminClient()
    const body = await request.json()

    const parsed = createNegocioSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const input = parsed.data

    const { data: stage, error: stageError } = await supabase
      .from('leads_pipeline_stages')
      .select('id, pipeline_type')
      .eq('id', input.pipeline_stage_id)
      .single()

    if (stageError || !stage) {
      return NextResponse.json({ error: 'Fase de pipeline não encontrada' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('negocios')
      .insert({ ...input, stage_entered_at: new Date().toISOString() })
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), leads!lead_id(id, nome, email, telemovel, tags), dev_users!assigned_consultant_id(id, commercial_name)`
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
