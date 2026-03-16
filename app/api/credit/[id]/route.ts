import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { updateCreditRequestSchema } from '@/lib/validations/credit'
import { z } from 'zod'

const uuidSchema = z.string().regex(/^[0-9a-f-]{36}$/)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id } = await params
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    // Obter pedido principal com lead e utilizador atribuído
    const { data: pedido, error } = await db
      .from('temp_pedidos_credito')
      .select('*, lead:leads!inner(id, nome, email, telemovel, nif), assigned_user:dev_users!temp_pedidos_credito_assigned_to_fkey(id, commercial_name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Pedido de crédito não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Obter negócio se existir
    let negocio = null
    if (pedido.negocio_id) {
      const { data } = await supabase
        .from('negocios')
        .select('id, tipo, orcamento, estado')
        .eq('id', pedido.negocio_id)
        .single()
      negocio = data
    }

    // Obter propriedade se existir
    let property = null
    if (pedido.property_id) {
      const { data } = await supabase
        .from('dev_properties')
        .select('id, title, listing_price, city')
        .eq('id', pedido.property_id)
        .single()
      property = data
    }

    // Obter propostas de banco
    const { data: propostas } = await db
      .from('temp_propostas_banco')
      .select('*')
      .eq('pedido_credito_id', id)
      .order('created_at', { ascending: false })

    // Obter documentos
    const { data: documentos } = await db
      .from('temp_credito_documentos')
      .select('*')
      .eq('pedido_credito_id', id)
      .order('created_at', { ascending: false })

    // Obter simulações
    const { data: simulacoes } = await db
      .from('temp_credito_simulacoes')
      .select('*')
      .eq('pedido_credito_id', id)
      .order('created_at', { ascending: false })

    // Calcular métricas
    const propostasList = propostas || []
    const documentosList = documentos || []

    const total_propostas = propostasList.length
    const propostas_aprovadas = propostasList.filter(
      (p: any) => p.status === 'aprovada' || p.status === 'aceite' || p.status === 'contratada'
    ).length

    const propostasComSpread = propostasList.filter((p: any) => p.spread != null && p.spread > 0)
    const melhor_spread = propostasComSpread.length > 0
      ? Math.min(...propostasComSpread.map((p: any) => p.spread))
      : null

    const propostasComPrestacao = propostasList.filter((p: any) => p.prestacao_mensal != null && p.prestacao_mensal > 0)
    const melhor_prestacao = propostasComPrestacao.length > 0
      ? Math.min(...propostasComPrestacao.map((p: any) => p.prestacao_mensal))
      : null

    const docs_total = documentosList.length
    const docs_pendentes = documentosList.filter((d: any) => d.status === 'pendente').length

    const createdAt = new Date(pedido.created_at)
    const now = new Date()
    const dias_em_processo = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    return NextResponse.json({
      ...pedido,
      negocio,
      property,
      propostas: propostasList,
      documentos: documentosList,
      simulacoes: simulacoes || [],
      metrics: {
        total_propostas,
        propostas_aprovadas,
        melhor_spread,
        melhor_prestacao,
        docs_pendentes,
        docs_total,
        dias_em_processo,
      },
    })
  } catch (error) {
    console.error('Erro ao obter pedido de crédito:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id } = await params
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const body = await request.json()
    const validation = updateCreditRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Se body vazio, retornar sem update
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id })
    }

    // Trim strings e converter strings vazias em null
    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue
      if (typeof value === 'string') {
        const trimmed = value.trim()
        updateData[key] = trimmed || null
      } else {
        updateData[key] = value
      }
    }

    // Recalcular LTV se campos relevantes mudaram
    const recalcLtv = 'montante_solicitado' in data || 'imovel_valor_avaliacao' in data
    const recalcTaxa = 'rendimento_mensal_liquido' in data
      || 'segundo_titular_rendimento_liquido' in data
      || 'outros_rendimentos' in data
      || 'encargos_creditos_existentes' in data
      || 'encargos_cartoes' in data
      || 'encargos_pensao_alimentos' in data
      || 'outros_encargos' in data

    if (recalcLtv || recalcTaxa) {
      // Obter valores actuais para merge
      const { data: current, error: fetchError } = await db
        .from('temp_pedidos_credito')
        .select('montante_solicitado, imovel_valor_avaliacao, rendimento_mensal_liquido, segundo_titular_rendimento_liquido, outros_rendimentos, encargos_creditos_existentes, encargos_cartoes, encargos_pensao_alimentos, outros_encargos')
        .eq('id', id)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return NextResponse.json({ error: 'Pedido de crédito não encontrado' }, { status: 404 })
        }
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      // Merge: valores do body sobrepõem os actuais
      const merged = { ...current, ...data }

      if (recalcLtv) {
        if (merged.montante_solicitado && merged.imovel_valor_avaliacao && merged.imovel_valor_avaliacao > 0) {
          updateData.ltv_calculado = Number(((merged.montante_solicitado / merged.imovel_valor_avaliacao) * 100).toFixed(2))
        } else {
          updateData.ltv_calculado = null
        }
      }

      if (recalcTaxa) {
        const rendimentoTotal = (merged.rendimento_mensal_liquido || 0)
          + (merged.segundo_titular_rendimento_liquido || 0)
          + (merged.outros_rendimentos || 0)

        if (rendimentoTotal > 0) {
          const encargosTotal = (merged.encargos_creditos_existentes || 0)
            + (merged.encargos_cartoes || 0)
            + (merged.encargos_pensao_alimentos || 0)
            + (merged.outros_encargos || 0)

          updateData.taxa_esforco = Number(((encargosTotal / rendimentoTotal) * 100).toFixed(2))
        } else {
          updateData.taxa_esforco = null
        }
      }
    }

    const { error } = await db
      .from('temp_pedidos_credito')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao actualizar pedido de crédito', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Erro ao actualizar pedido de crédito:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id } = await params
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    // Ler motivo de desistência do body (opcional)
    let motivo_desistencia: string | null = null
    try {
      const body = await request.json()
      if (body.motivo_desistencia && typeof body.motivo_desistencia === 'string') {
        motivo_desistencia = body.motivo_desistencia.trim() || null
      }
    } catch {
      // Body vazio é aceitável
    }

    const updateData: Record<string, unknown> = {
      status: 'desistencia',
    }
    if (motivo_desistencia) {
      updateData.motivo_desistencia = motivo_desistencia
    }

    const { error } = await db
      .from('temp_pedidos_credito')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao cancelar pedido de crédito', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao cancelar pedido de crédito:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
