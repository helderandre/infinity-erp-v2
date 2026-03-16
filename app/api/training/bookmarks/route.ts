// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createBookmarkSchema } from '@/lib/validations/training'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const userId = auth.user.id
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('temp_training_bookmarks')
      .select(`
        *,
        course:temp_training_courses(id, title, slug, cover_image_url, difficulty_level),
        lesson:temp_training_lessons(id, title, content_type, module_id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Erro ao listar favoritos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const userId = auth.user.id
    const supabase = await createClient()

    const body = await request.json()
    const validation = createBookmarkSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { course_id, lesson_id } = validation.data

    // Build match filter for toggle
    let matchFilter: Record<string, string> = { user_id: userId }
    if (course_id && course_id !== '') {
      matchFilter.course_id = course_id
    }
    if (lesson_id && lesson_id !== '') {
      matchFilter.lesson_id = lesson_id
    }

    // Check if bookmark exists
    let query = supabase
      .from('temp_training_bookmarks')
      .select('id')
      .eq('user_id', userId)

    if (course_id && course_id !== '') {
      query = query.eq('course_id', course_id)
    } else {
      query = query.is('course_id', null)
    }

    if (lesson_id && lesson_id !== '') {
      query = query.eq('lesson_id', lesson_id)
    } else {
      query = query.is('lesson_id', null)
    }

    const { data: existing } = await query.single()

    if (existing) {
      // Remove bookmark (toggle off)
      const { error } = await supabase
        .from('temp_training_bookmarks')
        .delete()
        .eq('id', existing.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ bookmarked: false })
    } else {
      // Create bookmark (toggle on)
      const insertData: Record<string, unknown> = { user_id: userId }
      if (course_id && course_id !== '') insertData.course_id = course_id
      if (lesson_id && lesson_id !== '') insertData.lesson_id = lesson_id

      const { data, error } = await supabase
        .from('temp_training_bookmarks')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ bookmarked: true, data }, { status: 201 })
    }
  } catch (error) {
    console.error('Erro ao alternar favorito:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
