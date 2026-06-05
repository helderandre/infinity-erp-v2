import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createActivitySchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contact_id } = await params
    const { searchParams } = new URL(request.url)

    const negocio_id = searchParams.get('negocio_id')
    const activity_type = searchParams.get('activity_type')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const per_page = Math.max(1, parseInt(searchParams.get('per_page') ?? '50', 10))
    const from = (page - 1) * per_page

    const supabase = createCrmAdminClient()

    // leads_activities.contact_id FK now points to leads(id)
    let query = supabase
      .from('leads_activities')
      .select('*, dev_users!created_by(id, commercial_name)', { count: 'exact' })
      .eq('contact_id', contact_id)
      .order('created_at', { ascending: false })
      .range(from, from + per_page - 1)

    if (negocio_id) query = query.eq('negocio_id', negocio_id)
    if (activity_type) query = query.eq('activity_type', activity_type)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data, total: count ?? 0, page, per_page })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contact_id } = await params
    const body = await request.json()

    const parsed = createActivitySchema.safeParse({ ...body, contact_id })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = createCrmAdminClient()

    const { data, error } = await supabase
      .from('leads_activities')
      .insert(parsed.data)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
