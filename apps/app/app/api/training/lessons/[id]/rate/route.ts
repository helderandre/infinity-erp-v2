import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { rateLessonSchema } from '@/lib/validations/training'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: lessonId } = await params
    const supabase = await createClient()

    // Rating do utilizador
    const { data: userRating } = await supabase
      .from('forma_training_lesson_ratings' as any)
      .select('rating')
      .eq('lesson_id', lessonId)
      .eq('user_id', auth.user.id)
      .single()

    // Média e total
    const { data: stats } = await supabase
      .from('forma_training_lesson_ratings' as any)
      .select('rating')
      .eq('lesson_id', lessonId)

    const ratings = (stats || []) as any[]
    const average = ratings.length > 0
      ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length
      : 0

    return NextResponse.json({
      user_rating: (userRating as any)?.rating || null,
      average_rating: Math.round(average * 10) / 10,
      total_ratings: ratings.length,
    })
  } catch (err) {
    console.error('Erro ao obter rating:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: lessonId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = rateLessonSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { rating } = validation.data

    const { data, error } = await supabase
      .from('forma_training_lesson_ratings' as any)
      .upsert(
        {
          user_id: auth.user.id,
          lesson_id: lessonId,
          rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lesson_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Erro ao guardar rating:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
