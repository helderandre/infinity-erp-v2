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
    const isResolved = searchParams.get('is_resolved')
    const courseId = searchParams.get('course_id') || ''
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('forma_training_comments')
      .select(`
        *,
        user:dev_users!user_id(commercial_name),
        lesson:forma_training_lessons!lesson_id(
          title,
          module:forma_training_modules!module_id(
            course:forma_training_courses!course_id(id, title)
          )
        ),
        replies:forma_training_comments!parent_id(
          id, content, created_at,
          user:dev_users!user_id(commercial_name)
        )
      `, { count: 'exact' })
      .is('parent_id', null)

    if (isResolved === 'true') query = query.eq('is_resolved', true)
    if (isResolved === 'false') query = query.eq('is_resolved', false)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Flatten
    const comments = (data || []).map((c: any) => ({
      ...c,
      lesson_title: c.lesson?.title,
      course_id: c.lesson?.module?.course?.id,
      course_title: c.lesson?.module?.course?.title,
      user_name: c.user?.commercial_name,
    }))

    // Filter by course_id if provided
    const filtered = courseId
      ? comments.filter((c: any) => c.course_id === courseId)
      : comments

    return NextResponse.json({ data: filtered, total: courseId ? filtered.length : count })
  } catch (error) {
    console.error('Erro ao listar comentários admin:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
