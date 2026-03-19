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

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const courseId = searchParams.get('course_id') || ''
    const reason = searchParams.get('reason') || ''
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('forma_training_lesson_reports')
      .select(`
        *,
        user:dev_users!user_id(commercial_name, id),
        lesson:forma_training_lessons!lesson_id(
          title,
          module:forma_training_modules!module_id(
            course:forma_training_courses!course_id(id, title)
          )
        )
      `, { count: 'exact' })

    if (status) query = query.eq('status', status)
    if (reason) query = query.eq('reason', reason)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Flatten nested structure
    const reports = (data || []).map((r: any) => ({
      ...r,
      lesson_title: r.lesson?.title,
      course_id: r.lesson?.module?.course?.id,
      course_title: r.lesson?.module?.course?.title,
      user_name: r.user?.commercial_name,
    }))

    // Filter by course_id if provided (post-query due to nested join)
    const filtered = courseId
      ? reports.filter((r: any) => r.course_id === courseId)
      : reports

    return NextResponse.json({ data: filtered, total: courseId ? filtered.length : count })
  } catch (error) {
    console.error('Erro ao listar reports:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
