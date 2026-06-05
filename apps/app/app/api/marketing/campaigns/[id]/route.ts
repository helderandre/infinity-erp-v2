import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient() as any
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { status, rejection_reason } = body

    if (!status || !['pending', 'approved', 'active', 'completed', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'rejected' && rejection_reason) {
      updateData.rejection_reason = rejection_reason
    }

    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        agent:dev_users!marketing_campaigns_agent_id_fkey(id, commercial_name),
        property:dev_properties!marketing_campaigns_property_id_fkey(id, title, slug)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar campanha:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
