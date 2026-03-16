// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { ADMIN_ROLES } from '@/lib/auth/roles'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { error: 'ID do comentário é obrigatório' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return NextResponse.json(
        { error: 'Conteúdo do comentário é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check comment exists and belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('temp_training_comments')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Comentário não encontrado' },
        { status: 404 }
      )
    }

    if (existing.user_id !== auth.user.id) {
      return NextResponse.json(
        { error: 'Apenas o autor pode editar este comentário' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('temp_training_comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        user:dev_users(id, commercial_name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Erro ao editar comentário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { error: 'ID do comentário é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check comment exists
    const { data: existing, error: fetchError } = await supabase
      .from('temp_training_comments')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Comentário não encontrado' },
        { status: 404 }
      )
    }

    // Only author or admin can delete
    const isAdmin = auth.roles.some((r) => ADMIN_ROLES.includes(r as any))
    if (existing.user_id !== auth.user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Sem permissão para eliminar este comentário' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('temp_training_comments')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Comentário eliminado com sucesso' })
  } catch (error) {
    console.error('Erro ao eliminar comentário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
