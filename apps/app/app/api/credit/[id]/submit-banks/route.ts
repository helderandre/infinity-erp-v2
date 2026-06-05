import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

const uuidRegex = /^[0-9a-f-]{36}$/

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

    // Verificar pedido e status
    const { data: pedido, error: pedidoError } = await db
      .from('temp_pedidos_credito')
      .select('id, status, reference')
      .eq('id', id)
      .single()

    if (pedidoError || !pedido) {
      return NextResponse.json(
        { error: 'Pedido de crédito não encontrado' },
        { status: 404 }
      )
    }

    const statusPermitidos = ['novo', 'recolha_docs', 'analise_financeira']
    if (!statusPermitidos.includes(pedido.status)) {
      return NextResponse.json(
        { error: `Não é possível submeter aos bancos com o status actual: ${pedido.status}` },
        { status: 400 }
      )
    }

    // Verificar documentos obrigatórios pendentes
    const { data: docsPendentes, error: docsError } = await db
      .from('temp_credito_documentos')
      .select('id')
      .eq('pedido_credito_id', id)
      .eq('obrigatorio', true)
      .not('status', 'in', '("recebido","validado")')

    if (docsError) {
      return NextResponse.json(
        { error: 'Erro ao verificar documentos', details: docsError.message },
        { status: 500 }
      )
    }

    if (docsPendentes && docsPendentes.length > 0) {
      return NextResponse.json(
        {
          error: `Existem ${docsPendentes.length} documento(s) obrigatório(s) em falta ou não validado(s)`,
          docs_pendentes: docsPendentes.length,
        },
        { status: 400 }
      )
    }

    // Verificar contagem de propostas (aviso, não bloqueante)
    const { count: propostasCount } = await db
      .from('temp_propostas_banco')
      .select('id', { count: 'exact', head: true })
      .eq('pedido_credito_id', id)

    const avisoPropostas = (propostasCount || 0) < 3

    // Actualizar status do pedido
    const agora = new Date().toISOString()

    const { data: pedidoActualizado, error: updateError } = await db
      .from('temp_pedidos_credito')
      .update({
        status: 'submetido_bancos',
        data_submissao_bancos: agora,
        updated_at: agora,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao actualizar pedido', details: updateError.message },
        { status: 500 }
      )
    }

    // Actualizar propostas com status 'rascunho' para 'submetida'
    await db
      .from('temp_propostas_banco')
      .update({
        status: 'submetida',
        data_submissao: agora,
      })
      .eq('pedido_credito_id', id)
      .eq('status', 'rascunho')

    // Criar registo de actividade
    await db.from('temp_credito_actividades').insert({
      pedido_credito_id: id,
      user_id: auth.user.id,
      tipo: 'status_change',
      descricao: `Pedido submetido aos bancos (${propostasCount || 0} proposta(s))`,
      metadata: {
        status_anterior: pedido.status,
        status_novo: 'submetido_bancos',
        propostas_count: propostasCount || 0,
      },
    })

    return NextResponse.json({
      ...pedidoActualizado,
      aviso_propostas: avisoPropostas
        ? `Recomendado submeter pelo menos 3 propostas (actual: ${propostasCount || 0})`
        : null,
    })
  } catch (error) {
    console.error('Erro ao submeter aos bancos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
