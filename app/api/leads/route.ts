import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { createLeadSchema } from '@/lib/validations/lead'
import { requirePermission } from '@/lib/auth/permissions'
import type { Database } from '@/types/database'

type LeadInsert = Database['public']['Tables']['leads']['Insert']

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const nome = searchParams.get('nome')
    const estado = searchParams.get('estado')
    const temperatura = searchParams.get('temperatura')
    const origem = searchParams.get('origem')
    const agent_id = searchParams.get('agent_id')
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)
    const offset = Number(searchParams.get('offset')) || 0

    let query = supabase
      .from('leads')
      .select('*, agent:dev_users(id, commercial_name), negocios(id, tipo)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (nome) {
      query = query.ilike('nome', `%${nome}%`)
    }
    if (estado) {
      query = query.eq('estado', estado)
    }
    if (temperatura) {
      query = query.eq('temperatura', temperatura)
    }
    if (origem) {
      query = query.eq('origem', origem)
    }
    if (agent_id) {
      query = query.eq('agent_id', agent_id)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar leads:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const body = await request.json()
    const validation = createLeadSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Construir objecto de insert com tipos correctos
    const insertData: LeadInsert = {
      nome: data.nome.trim(),
    }

    if (data.email) insertData.email = data.email.trim()
    if (data.telefone) insertData.telefone = data.telefone.trim()
    if (data.telemovel) insertData.telemovel = data.telemovel.trim()
    if (data.origem) insertData.origem = data.origem
    if (data.agent_id) insertData.agent_id = data.agent_id
    if (data.estado) insertData.estado = data.estado
    if (data.lead_type) (insertData as any).lead_type = data.lead_type
    if (data.observacoes) insertData.observacoes = data.observacoes

    const { data: lead, error } = await supabase
      .from('leads')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar lead', details: error.message },
        { status: 500 }
      )
    }

    // Notify assigned agent if it's a different person
    if (data.agent_id && data.agent_id !== auth.user.id) {
      const db = createCrmAdminClient()
      db.from('leads_notifications').insert({
        recipient_id: data.agent_id,
        type: 'new_lead',
        title: 'Nova lead atribuída',
        body: `${data.nome} foi-lhe atribuída.`,
        link: `/dashboard/leads/${lead.id}`,
        contact_id: lead.id,
      }).then(() => {}).catch(() => {})
    }

    return NextResponse.json({ id: lead.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar lead:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
