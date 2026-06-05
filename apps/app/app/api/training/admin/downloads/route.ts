// @ts-nocheck
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const view = searchParams.get('view') || 'stats'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const courseId = searchParams.get('course_id') || ''
    const from = (page - 1) * limit
    const to = from + limit - 1

    if (view === 'stats') {
      let query = supabase
        .from('forma_material_download_stats')
        .select('*', { count: 'exact' })

      if (courseId) query = query.eq('course_id', courseId)

      const { data, error, count } = await query
        .order('total_downloads', { ascending: false })
        .range(from, to)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data, total: count })
    }

    // view === 'events'
    let query = supabase
      .from('forma_training_material_downloads')
      .select(`
        *,
        user:dev_users!user_id(commercial_name)
      `, { count: 'exact' })

    if (courseId) query = query.eq('course_id', courseId)

    const { data, error, count } = await query
      .order('downloaded_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, total: count })
  } catch (error) {
    console.error('Erro ao listar downloads:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
