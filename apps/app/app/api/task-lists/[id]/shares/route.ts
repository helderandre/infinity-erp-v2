import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'
import { addMemberSchema } from '@/lib/validations/task-list'

// POST /api/task-lists/[id]/shares — owner adds a member
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const validation = addMemberSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: list } = await supabase
      .from('task_lists')
      .select('owner_id')
      .eq('id', id)
      .single()
    if (!list) return NextResponse.json({ error: 'Lista não encontrada' }, { status: 404 })
    if (list.owner_id !== auth.user.id) {
      return NextResponse.json({ error: 'Apenas o criador pode adicionar membros' }, { status: 403 })
    }

    if (validation.data.user_id === list.owner_id) {
      return NextResponse.json(
        { error: 'O criador já tem acesso' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('task_list_shares')
      .insert({
        task_list_id: id,
        user_id: validation.data.user_id,
        added_by: auth.user.id,
      })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já é membro desta lista' }, { status: 409 })
      }
      console.error('Erro ao adicionar membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Erro ao adicionar membro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
