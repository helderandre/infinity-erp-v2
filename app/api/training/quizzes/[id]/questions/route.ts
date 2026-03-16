// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth/permissions'
import { createQuestionSchema } from '@/lib/validations/training'

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: quizId } = await params
    const supabase = await createClient()

    // Load quiz to check shuffle setting
    const { data: quiz, error: quizError } = await supabase
      .from('temp_training_quizzes')
      .select('shuffle_questions')
      .eq('id', quizId)
      .single()

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: 'Questionário não encontrado' },
        { status: 404 }
      )
    }

    const { data: questions, error } = await supabase
      .from('temp_training_quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let result = questions || []

    if (quiz.shuffle_questions) {
      result = shuffleArray(result)
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro ao listar perguntas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: quizId } = await params
    const supabase = await createClient()

    // Verify quiz exists
    const { data: quiz, error: quizError } = await supabase
      .from('temp_training_quizzes')
      .select('id')
      .eq('id', quizId)
      .single()

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: 'Questionário não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = createQuestionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('temp_training_quiz_questions')
      .insert({
        quiz_id: quizId,
        ...validation.data,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pergunta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
