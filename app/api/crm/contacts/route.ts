import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { createContactSchema } from '@/lib/validations/leads-crm'

export async function GET(request: Request) {
  try {
    const supabase = createCrmAdminClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search') || ''
    const lifecycleStageId = searchParams.get('lifecycle_stage_id')
    const assignedConsultantId = searchParams.get('assigned_consultant_id')
    const tagsParam = searchParams.get('tags')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('per_page')) || 25))
    const offset = (page - 1) * perPage

    let query = supabase
      .from('leads')
      .select(
        '*, leads_contact_stages(*), dev_users!agent_id(id, commercial_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (search) {
      query = query.or(
        `nome.ilike.%${search}%,email.ilike.%${search}%,telemovel.ilike.%${search}%`
      )
    }

    if (lifecycleStageId) {
      query = query.eq('lifecycle_stage_id', lifecycleStageId)
    }

    if (assignedConsultantId) {
      query = query.eq('agent_id', assignedConsultantId)
    }

    if (tagsParam) {
      const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean)
      if (tags.length > 0) {
        query = query.overlaps('tags', tags)
      }
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      per_page: perPage,
    })
  } catch (error) {
    console.error('Erro ao listar contactos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createCrmAdminClient()

    const body = await request.json()
    const validation = createContactSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const input = validation.data

    // Deduplication: check existing contact by telemovel or email
    const orConditions: string[] = []
    if ((input as Record<string, unknown>).telemovel) orConditions.push(`telemovel.eq.${(input as Record<string, unknown>).telemovel}`)
    if (input.email) orConditions.push(`email.eq.${input.email}`)

    if (orConditions.length > 0) {
      const { data: existing } = await supabase
        .from('leads')
        .select('*')
        .or(orConditions.join(','))
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ data: existing, deduplicated: true })
      }
    }

    const { data, error } = await supabase
      .from('leads')
      .insert(input)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar contacto', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data, deduplicated: false }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar contacto:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
