import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const uuidRegex = /^[0-9a-f-]{36}$/

const populateSchema = z.object({
  banco_id: z.string().regex(uuidRegex, 'ID do banco inválido'),
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
    const validation = populateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { banco_id } = validation.data

    // Obter documentos exigidos do banco
    const { data: banco, error: bancoError } = await db
      .from('temp_credito_bancos')
      .select('documentos_exigidos')
      .eq('id', banco_id)
      .single()

    if (bancoError) {
      if (bancoError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Banco não encontrado' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Erro ao obter banco', details: bancoError.message },
        { status: 500 }
      )
    }

    const documentosExigidos = banco.documentos_exigidos as Array<{
      nome: string
      categoria: string
      obrigatorio: boolean
    }> | null

    if (!documentosExigidos || documentosExigidos.length === 0) {
      return NextResponse.json(
        { error: 'Este banco não tem documentos exigidos configurados' },
        { status: 400 }
      )
    }

    // Verificar se o pedido tem segundo titular
    const { data: pedido, error: pedidoError } = await db
      .from('temp_pedidos_credito')
      .select('tem_segundo_titular')
      .eq('id', id)
      .single()

    if (pedidoError) {
      if (pedidoError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Pedido de crédito não encontrado' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Erro ao obter pedido', details: pedidoError.message },
        { status: 500 }
      )
    }

    const temSegundoTitular = pedido.tem_segundo_titular === true

    // Criar documentos a partir do template do banco
    const documentsToInsert: Array<Record<string, unknown>> = []
    let orderIndex = 0

    for (const doc of documentosExigidos) {
      // Documento para titular 1
      documentsToInsert.push({
        pedido_credito_id: id,
        nome: doc.nome,
        categoria: doc.categoria,
        obrigatorio: doc.obrigatorio,
        titular: 'titular_1',
        bancos_requeridos: [banco_id],
        status: 'pendente',
        order_index: orderIndex++,
      })

      // Duplicar para titular 2 se aplicável
      if (temSegundoTitular) {
        documentsToInsert.push({
          pedido_credito_id: id,
          nome: doc.nome,
          categoria: doc.categoria,
          obrigatorio: doc.obrigatorio,
          titular: 'titular_2',
          bancos_requeridos: [banco_id],
          status: 'pendente',
          order_index: orderIndex++,
        })
      }
    }

    const { data: createdDocs, error: insertError } = await db
      .from('temp_credito_documentos')
      .insert(documentsToInsert)
      .select()

    if (insertError) {
      return NextResponse.json(
        { error: 'Erro ao criar documentos', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(createdDocs || [], { status: 201 })
  } catch (error) {
    console.error('Erro ao popular documentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
