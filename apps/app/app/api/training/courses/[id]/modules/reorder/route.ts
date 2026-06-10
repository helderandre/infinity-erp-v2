// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * Reorders the modules of a course. Body: { module_ids: string[] } in the new
 * order. Each module's `order_index` is set to its position in the array.
 * Scoped to the course so a stray id from another course can't be touched.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: courseId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const moduleIds: unknown = body?.module_ids
    if (!Array.isArray(moduleIds) || moduleIds.some((m) => typeof m !== 'string')) {
      return NextResponse.json(
        { error: 'module_ids deve ser um array de IDs' },
        { status: 400 }
      )
    }

    for (let index = 0; index < moduleIds.length; index++) {
      const { error } = await supabase
        .from('forma_training_modules')
        .update({ order_index: index })
        .eq('id', moduleIds[index])
        .eq('course_id', courseId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao reordenar módulos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
