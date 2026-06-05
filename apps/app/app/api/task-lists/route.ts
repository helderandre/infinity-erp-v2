import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'
import { createTaskListSchema } from '@/lib/validations/task-list'

// GET /api/task-lists — lists owned by user + lists shared with user
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient()
    const userId = auth.user.id

    // 1. Lists where I'm the owner
    const { data: owned, error: ownedErr } = await supabase
      .from('task_lists')
      .select('id, name, color, owner_id, created_at, updated_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })

    if (ownedErr) {
      console.error('Erro ao listar listas:', ownedErr)
      return NextResponse.json({ error: ownedErr.message }, { status: 500 })
    }

    // 2. Lists shared with me (via task_list_shares join)
    const { data: shares, error: sharesErr } = await supabase
      .from('task_list_shares')
      .select(`
        task_list_id,
        task_lists!inner(id, name, color, owner_id, created_at, updated_at,
          owner:dev_users!task_lists_owner_id_fkey(id, commercial_name,
            profile:dev_consultant_profiles(profile_photo_url)
          )
        )
      `)
      .eq('user_id', userId)

    if (sharesErr) {
      console.error('Erro ao listar listas partilhadas:', sharesErr)
      return NextResponse.json({ error: sharesErr.message }, { status: 500 })
    }

    const ownedIds = (owned || []).map((l) => l.id)
    const sharedLists = (shares || [])
      .map((s: any) => s.task_lists)
      .filter((l: any) => l && !ownedIds.includes(l.id))

    // 3. Member counts + pending counts per list
    const allIds = [...(owned || []).map((l) => l.id), ...sharedLists.map((l: any) => l.id)]

    let memberCounts: Record<string, number> = {}
    let pendingCounts: Record<string, number> = {}

    if (allIds.length > 0) {
      const [{ data: memberRows }, { data: pendingRows }] = await Promise.all([
        supabase
          .from('task_list_shares')
          .select('task_list_id')
          .in('task_list_id', allIds),
        supabase
          .from('tasks')
          .select('task_list_id')
          .in('task_list_id', allIds)
          .eq('is_completed', false)
          .is('parent_task_id', null),
      ])

      for (const r of memberRows || []) {
        memberCounts[r.task_list_id] = (memberCounts[r.task_list_id] || 0) + 1
      }
      for (const r of pendingRows || []) {
        if (r.task_list_id) {
          pendingCounts[r.task_list_id] = (pendingCounts[r.task_list_id] || 0) + 1
        }
      }
    }

    const enrichedOwned = (owned || []).map((l) => ({
      ...l,
      is_owner: true,
      member_count: memberCounts[l.id] || 0,
      pending_count: pendingCounts[l.id] || 0,
    }))

    const enrichedShared = sharedLists.map((l: any) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      owner_id: l.owner_id,
      created_at: l.created_at,
      updated_at: l.updated_at,
      is_owner: false,
      member_count: memberCounts[l.id] || 0,
      pending_count: pendingCounts[l.id] || 0,
      owner: l.owner
        ? {
            id: l.owner.id,
            commercial_name: l.owner.commercial_name,
            profile_photo_url: l.owner.profile?.profile_photo_url ?? null,
          }
        : null,
    }))

    return NextResponse.json({
      owned: enrichedOwned,
      shared: enrichedShared,
    })
  } catch (err) {
    console.error('Erro ao listar task_lists:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/task-lists — create a new list owned by current user
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = createTaskListSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('task_lists')
      .insert({
        name: validation.data.name,
        color: validation.data.color,
        owner_id: auth.user.id,
      })
      .select('id, name, color, owner_id, created_at, updated_at')
      .single()

    if (error) {
      console.error('Erro ao criar lista:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Erro ao criar task_list:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
