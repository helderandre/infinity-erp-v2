import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

// DELETE /api/task-lists/[id]/shares/[userId] — owner removes member OR member leaves
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id, userId } = await params
    const supabase = createAdminClient()

    const { data: list } = await supabase
      .from('task_lists')
      .select('owner_id')
      .eq('id', id)
      .single()
    if (!list) return NextResponse.json({ error: 'Lista não encontrada' }, { status: 404 })

    const isOwner = list.owner_id === auth.user.id
    const isSelfLeave = userId === auth.user.id
    if (!isOwner && !isSelfLeave) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { error } = await supabase
      .from('task_list_shares')
      .delete()
      .eq('task_list_id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Erro ao remover membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Erro ao remover membro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
