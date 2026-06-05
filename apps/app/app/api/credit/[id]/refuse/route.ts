import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const uuidRegex = /^[0-9a-f-]{36}$/

const refuseBodySchema = z.object({
  motivo: z.string().min(1, 'Motivo é obrigatório').max(1000),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id } = await params

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const body = await request.json()
    const validation = refuseBodySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { motivo } = validation.data

    // Verificar pedido existe
    const { data: pedido, error: pedidoError } = await db
      .from('temp_pedidos_credito')
      .select('id, status')
      .eq('id', id)
      .single()

    if (pedidoError || !pedido) {
      return NextResponse.json(
        { error: 'Pedido de crédito não encontrado' },
        { status: 404 }
      )
    }

    const agora = new Date().toISOString()

    // Actualizar status para recusado
    const { data: pedidoActualizado, error: updateError } = await db
      .from('temp_pedidos_credito')
      .update({
        status: 'recusado',
        motivo_recusa: motivo,
        updated_at: agora,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao recusar pedido', details: updateError.message },
        { status: 500 }
      )
    }

    // Criar registo de actividade
    await db.from('temp_credito_actividades').insert({
      pedido_credito_id: id,
      user_id: auth.user.id,
      tipo: 'status_change',
      descricao: `Pedido recusado: ${motivo}`,
      metadata: {
        status_anterior: pedido.status,
        status_novo: 'recusado',
        motivo,
      },
    })

    return NextResponse.json(pedidoActualizado)
  } catch (error) {
    console.error('Erro ao recusar pedido:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
