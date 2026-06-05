import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'
import { updateTaskListSchema } from '@/lib/validations/task-list'

// GET /api/task-lists/[id] — details (list + owner + members)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()
    const userId = auth.user.id

    const { data: list, error } = await supabase
      .from('task_lists')
      .select(`
        id, name, color, owner_id, created_at, updated_at,
        owner:dev_users!task_lists_owner_id_fkey(id, commercial_name,
          profile:dev_consultant_profiles(profile_photo_url)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !list) {
      return NextResponse.json({ error: 'Lista não encontrada' }, { status: 404 })
    }

    // Authorization: owner or member
    const isOwner = list.owner_id === userId
    if (!isOwner) {
      const { data: share } = await supabase
        .from('task_list_shares')
        .select('user_id')
        .eq('task_list_id', id)
        .eq('user_id', userId)
        .maybeSingle()
      if (!share) return NextResponse.json({ error: 'Sem acesso' }, { status: 403 })
    }

    // Members (shared users) + owner's joined data
    const { data: shares } = await supabase
      .from('task_list_shares')
      .select(`
        user_id, created_at,
        user:dev_users!task_list_shares_user_id_fkey(id, commercial_name,
          profile:dev_consultant_profiles(profile_photo_url)
        )
      `)
      .eq('task_list_id', id)

    const members = (shares || []).map((s: any) => ({
      user_id: s.user_id,
      commercial_name: s.user?.commercial_name ?? 'Utilizador',
      profile_photo_url: s.user?.profile?.profile_photo_url ?? null,
      added_at: s.created_at,
    }))

    const ownerRel: any = (list as any).owner
    const owner = ownerRel
      ? {
          id: ownerRel.id,
          commercial_name: ownerRel.commercial_name,
          profile_photo_url: ownerRel.profile?.profile_photo_url ?? null,
        }
      : null

    return NextResponse.json({
      id: list.id,
      name: list.name,
      color: list.color,
      owner_id: list.owner_id,
      created_at: list.created_at,
      updated_at: list.updated_at,
      is_owner: isOwner,
      member_count: members.length,
      owner,
      members,
    })
  } catch (err) {
    console.error('Erro ao obter task_list:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PATCH /api/task-lists/[id] — rename / change color (owner only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const validation = updateTaskListSchema.safeParse(body)
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
      return NextResponse.json({ error: 'Apenas o criador pode editar' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('task_lists')
      .update(validation.data)
      .eq('id', id)
      .select('id, name, color, owner_id, updated_at')
      .single()

    if (error) {
      console.error('Erro ao actualizar lista:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error('Erro ao actualizar task_list:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/task-lists/[id] — owner only. Cascades shares; tasks get task_list_id=null.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()

    const { data: list } = await supabase
      .from('task_lists')
      .select('owner_id')
      .eq('id', id)
      .single()
    if (!list) return NextResponse.json({ error: 'Lista não encontrada' }, { status: 404 })
    if (list.owner_id !== auth.user.id) {
      return NextResponse.json({ error: 'Apenas o criador pode eliminar' }, { status: 403 })
    }

    const { error } = await supabase.from('task_lists').delete().eq('id', id)
    if (error) {
      console.error('Erro ao eliminar lista:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Erro ao eliminar task_list:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
