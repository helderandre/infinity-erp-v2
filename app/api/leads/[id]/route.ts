import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateLeadSchema } from '@/lib/validations/lead'
import type { Database } from '@/types/database'

type LeadUpdate = Database['public']['Tables']['leads']['Update']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('leads')
      .select('*, agent:dev_users(id, commercial_name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter lead:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = updateLeadSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Se body vazio, retornar sem update
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id })
    }

    // Trim strings e converter strings vazias em null
    const updateData: LeadUpdate = {}
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue
      if (typeof value === 'string') {
        const trimmed = value.trim()
        ;(updateData as Record<string, unknown>)[key] = trimmed || null
      } else {
        ;(updateData as Record<string, unknown>)[key] = value
      }
    }

    const { error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao actualizar lead', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Erro ao actualizar lead:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar lead', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao eliminar lead:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
