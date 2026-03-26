import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateLeadEntryStatusSchema } from '@/lib/validations/lead-entry'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data, error } = await supabase
      .from('leads_entries')
      .select(`
        *,
        contact:leads!leads_entries_contact_id_fkey(
          id, nome, email, telemovel, agent_id,
          agent:dev_users!leads_agent_id_fkey(id, commercial_name)
        ),
        campaign:leads_campaigns(id, name, platform),
        assigned_consultant:dev_users!leads_entries_assigned_consultant_id_fkey(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter lead entry:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateLeadEntryStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { status: parsed.data.status }

    if (['converted', 'discarded'].includes(parsed.data.status)) {
      updateData.processed_at = new Date().toISOString()
      updateData.processed_by = user.id
    }

    const { data, error } = await supabase
      .from('leads_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar lead entry:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
