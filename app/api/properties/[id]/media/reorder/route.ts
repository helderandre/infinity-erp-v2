import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      order_index: z.number().int().nonnegative(),
    })
  ),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = reorderSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Update each item's order_index
    for (const item of validation.data.items) {
      const { error } = await supabase
        .from('dev_property_media')
        .update({ order_index: item.order_index })
        .eq('id', item.id)

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao reordenar imagens', details: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao reordenar imagens:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
