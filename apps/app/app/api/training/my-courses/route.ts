// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const userId = auth.user.id
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || 'all'

    let query = supabase
      .from('forma_training_enrollments')
      .select(`
        *,
        course:forma_training_courses!forma_training_enrollments_course_id_fkey(
          id,
          title,
          slug,
          cover_image_url,
          difficulty_level,
          estimated_duration_minutes,
          has_certificate,
          is_mandatory,
          category:forma_training_categories!forma_training_courses_category_id_fkey(name, color),
          instructor:dev_users!forma_training_courses_instructor_id_fkey(commercial_name)
        )
      `)
      .eq('user_id', userId)

    if (statusFilter === 'in_progress') {
      query = query.in('status', ['enrolled', 'in_progress'])
    } else if (statusFilter === 'completed') {
      query = query.eq('status', 'completed')
    }

    query = query.order('updated_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const now = new Date()
    const enrollments = (data || []).map((enrollment: Record<string, unknown>) => ({
      ...enrollment,
      is_overdue:
        enrollment.deadline &&
        new Date(enrollment.deadline as string) < now &&
        enrollment.status !== 'completed',
    }))

    return NextResponse.json({ data: enrollments })
  } catch (error) {
    console.error('Erro ao listar os meus cursos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
