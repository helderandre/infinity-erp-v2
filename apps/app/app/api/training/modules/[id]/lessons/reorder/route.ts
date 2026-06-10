// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * Reorders the lessons of a module. Body: { lesson_ids: string[] } in the new
 * order. Each lesson's `order_index` is set to its position in the array.
 * Scoped to the module so a stray id from another module can't be touched.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: moduleId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const lessonIds: unknown = body?.lesson_ids
    if (!Array.isArray(lessonIds) || lessonIds.some((l) => typeof l !== 'string')) {
      return NextResponse.json(
        { error: 'lesson_ids deve ser um array de IDs' },
        { status: 400 }
      )
    }

    for (let index = 0; index < lessonIds.length; index++) {
      const { error } = await supabase
        .from('forma_training_lessons')
        .update({ order_index: index })
        .eq('id', lessonIds[index])
        .eq('module_id', moduleId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao reordenar lições:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
