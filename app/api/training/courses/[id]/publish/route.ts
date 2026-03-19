// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Validate course has at least 1 module with at least 1 lesson
    const { data: modules, error: modulesError } = await supabase
      .from('forma_training_modules')
      .select(`
        id,
        lessons:forma_training_lessons(id)
      `)
      .eq('course_id', id)

    if (modulesError) {
      return NextResponse.json({ error: modulesError.message }, { status: 500 })
    }

    if (!modules || modules.length === 0) {
      return NextResponse.json(
        { error: 'O curso deve ter pelo menos 1 módulo para ser publicado' },
        { status: 400 }
      )
    }

    const hasLessons = modules.some(
      (m: any) => m.lessons && m.lessons.length > 0
    )
    if (!hasLessons) {
      return NextResponse.json(
        { error: 'O curso deve ter pelo menos 1 módulo com pelo menos 1 lição para ser publicado' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('forma_training_courses')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Curso não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao publicar curso:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
