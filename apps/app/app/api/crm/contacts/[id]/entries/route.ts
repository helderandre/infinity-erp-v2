import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { createEntrySchema } from '@/lib/validations/leads-crm'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { id } = await params

    // leads_entries.contact_id FK now points to leads(id)
    const { data, error } = await supabase
      .from('leads_entries')
      .select('*, leads_campaigns(*), leads_partners(*)')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar entradas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { id } = await params

    const body = await request.json()
    const validation = createEntrySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('leads_entries')
      .insert({ ...validation.data, contact_id: id })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar entrada', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar entrada:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
