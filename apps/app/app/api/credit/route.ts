import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createCreditRequestSchema } from '@/lib/validations/credit'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const assigned_to = searchParams.get('assigned_to')
    const lead_id = searchParams.get('lead_id')
    const search = searchParams.get('search')
    const page = Math.max(Number(searchParams.get('page')) || 1, 1)
    const per_page = Math.min(Math.max(Number(searchParams.get('per_page')) || 20, 1), 100)
    const offset = (page - 1) * per_page

    let query = db
      .from('temp_pedidos_credito')
      .select(
        '*, lead:leads!inner(id, nome, email, telemovel, nif), assigned_user:dev_users!temp_pedidos_credito_assigned_to_fkey(id, commercial_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + per_page - 1)

    // Filtro por status (csv)
    if (status) {
      const statusList = status.split(',').map((s) => s.trim()).filter(Boolean)
      if (statusList.length === 1) {
        query = query.eq('status', statusList[0])
      } else if (statusList.length > 1) {
        query = query.in('status', statusList)
      }
    }

    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to)
    }

    if (lead_id) {
      query = query.eq('lead_id', lead_id)
    }

    // Search por referencia ou lead nome
    if (search) {
      query = query.or(`reference.ilike.%${search}%,leads.nome.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Para cada pedido, obter contagem de propostas e docs pendentes
    const pedidoIds = (data || []).map((p: any) => p.id)

    let propostasCountMap: Record<string, number> = {}
    let docsCountMap: Record<string, { pending: number; total: number }> = {}

    if (pedidoIds.length > 0) {
      // Contar propostas por pedido
      const { data: propostas } = await db
        .from('temp_propostas_banco')
        .select('pedido_credito_id')
        .in('pedido_credito_id', pedidoIds)

      if (propostas) {
        for (const p of propostas) {
          propostasCountMap[p.pedido_credito_id] = (propostasCountMap[p.pedido_credito_id] || 0) + 1
        }
      }

      // Contar documentos pendentes e total por pedido
      const { data: docs } = await db
        .from('temp_credito_documentos')
        .select('pedido_credito_id, status')
        .in('pedido_credito_id', pedidoIds)

      if (docs) {
        for (const d of docs) {
          if (!docsCountMap[d.pedido_credito_id]) {
            docsCountMap[d.pedido_credito_id] = { pending: 0, total: 0 }
          }
          docsCountMap[d.pedido_credito_id].total += 1
          if (d.status === 'pendente') {
            docsCountMap[d.pedido_credito_id].pending += 1
          }
        }
      }
    }

    const enriched = (data || []).map((pedido: any) => ({
      ...pedido,
      propostas_count: propostasCountMap[pedido.id] || 0,
      docs_pendentes: docsCountMap[pedido.id]?.pending || 0,
      docs_total: docsCountMap[pedido.id]?.total || 0,
    }))

    return NextResponse.json({
      data: enriched,
      total: count || 0,
      page,
      per_page,
    })
  } catch (error) {
    console.error('Erro ao listar pedidos de crédito:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const body = await request.json()
    const validation = createCreditRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Calcular LTV se houver dados suficientes
    let ltv_calculado: number | null = null
    if (data.montante_solicitado && data.imovel_valor_avaliacao && data.imovel_valor_avaliacao > 0) {
      ltv_calculado = Number(((data.montante_solicitado / data.imovel_valor_avaliacao) * 100).toFixed(2))
    }

    // Calcular taxa de esforço se houver rendimento
    let taxa_esforco: number | null = null
    const rendimentoTotal = (data.rendimento_mensal_liquido || 0)
      + (data.segundo_titular_rendimento_liquido || 0)
      + (data.outros_rendimentos || 0)

    if (rendimentoTotal > 0) {
      const encargosTotal = (data.encargos_creditos_existentes || 0)
        + (data.encargos_cartoes || 0)
        + (data.encargos_pensao_alimentos || 0)
        + (data.outros_encargos || 0)

      taxa_esforco = Number(((encargosTotal / rendimentoTotal) * 100).toFixed(2))
    }

    const insertData = {
      ...data,
      assigned_to: auth.user.id,
      ltv_calculado,
      taxa_esforco,
    }

    const { data: pedido, error } = await db
      .from('temp_pedidos_credito')
      .insert(insertData)
      .select('id, reference')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar pedido de crédito', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id: pedido.id, reference: pedido.reference }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pedido de crédito:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
