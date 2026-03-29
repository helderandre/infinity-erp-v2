import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createFeedbackSchema, feedbackQuerySchema } from '@/lib/validations/feedback'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const params = feedbackQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!params.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const { type, status, submitted_by, limit, offset } = params.data
    const supabase = createAdminClient()

    let query = supabase
      .from('feedback_submissions')
      .select(`
        *,
        submitter:submitted_by(id, commercial_name),
        assignee:assigned_to(id, commercial_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    if (submitted_by) query = query.eq('submitted_by', submitted_by)

    const { data, error, count } = await query

    if (error) {
      console.error('Erro ao listar feedback:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar feedback:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = createFeedbackSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data
    const supabase = createAdminClient()

    const { data: submission, error } = await supabase
      .from('feedback_submissions')
      .insert({
        type: data.type,
        title: data.title,
        description: data.description || null,
        voice_url: data.voice_url || null,
        images: data.images || [],
        submitted_by: auth.user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Erro ao criar feedback:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: submission.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar feedback:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
