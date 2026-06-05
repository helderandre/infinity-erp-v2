// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createCommentSchema } from '@/lib/validations/training'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { lessonId } = await params

    if (!lessonId) {
      return NextResponse.json(
        { error: 'ID da lição é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch all comments for this lesson, with user info
    const { data: comments, error } = await supabase
      .from('forma_training_comments')
      .select(`
        *,
        user:dev_users(id, commercial_name)
      `)
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build threaded structure: top-level comments with nested replies
    const commentList = comments || []
    const topLevel = commentList.filter((c: any) => !c.parent_id)
    const replies = commentList.filter((c: any) => !!c.parent_id)

    const threaded = topLevel.map((comment: any) => ({
      ...comment,
      replies: replies.filter((r: any) => r.parent_id === comment.id),
    }))

    return NextResponse.json({ data: threaded })
  } catch (error) {
    console.error('Erro ao listar comentários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { lessonId } = await params

    if (!lessonId) {
      return NextResponse.json(
        { error: 'ID da lição é obrigatório' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = createCommentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const insertData: Record<string, unknown> = {
      lesson_id: lessonId,
      user_id: auth.user.id,
      content: validation.data.content,
    }

    // Only set parent_id if provided and not empty string
    if (validation.data.parent_id && validation.data.parent_id !== '') {
      insertData.parent_id = validation.data.parent_id
    }

    const { data, error } = await supabase
      .from('forma_training_comments')
      .insert(insertData)
      .select(`
        *,
        user:dev_users(id, commercial_name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar comentário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
