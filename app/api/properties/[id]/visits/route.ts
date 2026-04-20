import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    // Use admin client to avoid RLS filtering out proposals / cross-agent visits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('visits')
      .select(`
        *,
        consultant:dev_users!visits_consultant_id_fkey(id, commercial_name),
        lead:leads(id, nome, email, telemovel)
      `)
      .eq('property_id', id)
      .order('visit_date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar visitas:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('visits')
      .insert({
        property_id: id,
        consultant_id: body.consultant_id || user.id,
        seller_consultant_id: body.seller_consultant_id || body.consultant_id || user.id,
        lead_id: body.lead_id || null,
        visit_date: body.visit_date,
        visit_time: body.visit_time || null,
        duration_minutes: body.duration_minutes || 30,
        status: body.status || 'scheduled',
        client_name: body.client_name || null,
        client_phone: body.client_phone || null,
        client_email: body.client_email || null,
        notes: body.notes || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao criar visita:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
