// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { submitQuizAttemptSchema } from '@/lib/validations/training'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: quizId } = await params
    const userId = auth.user.id
    const supabase = await createClient()

    const body = await request.json()
    const validation = submitQuizAttemptSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { answers, time_spent_seconds } = validation.data

    // Load quiz
    const { data: quiz, error: quizError } = await supabase
      .from('forma_training_quizzes')
      .select('*, course_id, module_id')
      .eq('id', quizId)
      .single()

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: 'Questionário não encontrado' },
        { status: 404 }
      )
    }

    // Find enrollment (quiz can be linked to course or module->course)
    let courseId = quiz.course_id
    if (!courseId && quiz.module_id) {
      const { data: mod } = await supabase
        .from('forma_training_modules')
        .select('course_id')
        .eq('id', quiz.module_id)
        .single()
      courseId = mod?.course_id
    }

    if (!courseId) {
      return NextResponse.json(
        { error: 'Não foi possível determinar o curso deste questionário' },
        { status: 400 }
      )
    }

    const { data: enrollment, error: enrollError } = await supabase
      .from('forma_training_enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single()

    if (enrollError || !enrollment) {
      return NextResponse.json(
        { error: 'Inscrição não encontrada para este curso' },
        { status: 404 }
      )
    }

    // Check max attempts
    const { count: attemptCount } = await supabase
      .from('forma_training_quiz_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .eq('user_id', userId)

    const currentAttempts = attemptCount || 0

    if (quiz.max_attempts && quiz.max_attempts > 0 && currentAttempts >= quiz.max_attempts) {
      return NextResponse.json(
        { error: `Número máximo de tentativas atingido (${quiz.max_attempts})` },
        { status: 400 }
      )
    }

    // Load questions
    const { data: questions, error: questionsError } = await supabase
      .from('forma_training_quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true })

    if (questionsError || !questions || questions.length === 0) {
      return NextResponse.json(
        { error: 'Questionário sem perguntas' },
        { status: 400 }
      )
    }

    // Calculate score
    let totalPoints = 0
    let earnedPoints = 0
    const answerDetails: Array<{
      question_id: string
      question_text: string
      selected_options: string[]
      correct_options: string[]
      is_correct: boolean
      points: number
      earned_points: number
      explanation: string | null
    }> = []

    for (const question of questions) {
      totalPoints += question.points

      const userAnswer = answers.find(
        (a: { question_id: string }) => a.question_id === question.id
      )
      const selectedOptions = userAnswer?.selected_options || []

      // Get correct option IDs
      const options = question.options as Array<{
        id: string
        text: string
        is_correct: boolean
      }>
      const correctOptions = options
        .filter((o) => o.is_correct)
        .map((o) => o.id)

      // Check if answer is correct
      const isCorrect =
        selectedOptions.length === correctOptions.length &&
        selectedOptions.every((s: string) => correctOptions.includes(s)) &&
        correctOptions.every((c: string) => selectedOptions.includes(c))

      const earned = isCorrect ? question.points : 0
      earnedPoints += earned

      answerDetails.push({
        question_id: question.id,
        question_text: question.question_text,
        selected_options: selectedOptions,
        correct_options: correctOptions,
        is_correct: isCorrect,
        points: question.points,
        earned_points: earned,
        explanation: question.explanation,
      })
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    const passed = score >= quiz.passing_score

    // Save attempt
    const now = new Date().toISOString()
    const { data: attempt, error: attemptError } = await supabase
      .from('forma_training_quiz_attempts')
      .insert({
        user_id: userId,
        quiz_id: quizId,
        enrollment_id: enrollment.id,
        score,
        passed,
        answers: answerDetails,
        started_at: now,
        completed_at: now,
        time_spent_seconds: time_spent_seconds || null,
        attempt_number: currentAttempts + 1,
      })
      .select()
      .single()

    if (attemptError) {
      return NextResponse.json({ error: attemptError.message }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        attempt_id: attempt.id,
        score,
        passed,
        passing_score: quiz.passing_score,
        total_points: totalPoints,
        earned_points: earnedPoints,
        attempt_number: currentAttempts + 1,
        max_attempts: quiz.max_attempts || null,
        answers: quiz.show_correct_answers ? answerDetails : undefined,
      },
    })
  } catch (error) {
    console.error('Erro ao submeter tentativa do questionário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
