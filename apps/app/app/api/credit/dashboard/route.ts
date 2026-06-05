import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET() {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    // All requests
    const { data: pedidos } = await db
      .from('temp_pedidos_credito')
      .select('id, status, montante_solicitado, taxa_esforco, ltv_calculado, imovel_finalidade, created_at, data_submissao_bancos, data_aprovacao_final, assigned_to')

    const allPedidos = pedidos || []

    // All proposals
    const { data: propostas } = await db
      .from('temp_propostas_banco')
      .select('id, pedido_credito_id, status, spread, prestacao_mensal, banco, montante_aprovado, is_selected')

    const allPropostas = propostas || []

    // All documents
    const { data: documentos } = await db
      .from('temp_credito_documentos')
      .select('id, pedido_credito_id, status, obrigatorio')

    const allDocs = documentos || []

    // Recent activities (last 10)
    const { data: recentActivities } = await db
      .from('temp_credito_actividades')
      .select('id, pedido_credito_id, user_id, tipo, descricao, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get user names for activities
    const userIds = [...new Set((recentActivities || []).map((a: any) => a.user_id))]
    let userMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('dev_users')
        .select('id, commercial_name')
        .in('id', userIds as string[])
      if (users) {
        userMap = Object.fromEntries(users.map((u: any) => [u.id, u.commercial_name]))
      }
    }

    // Get pedido references for activities
    const pedidoIds = [...new Set((recentActivities || []).map((a: any) => a.pedido_credito_id))]
    let pedidoRefMap: Record<string, string> = {}
    if (pedidoIds.length > 0) {
      const { data: refs } = await db
        .from('temp_pedidos_credito')
        .select('id, reference')
        .in('id', pedidoIds)
      if (refs) {
        pedidoRefMap = Object.fromEntries(refs.map((r: any) => [r.id, r.reference]))
      }
    }

    // === Compute KPIs ===

    const activeStatuses = ['novo', 'recolha_docs', 'analise_financeira', 'submetido_bancos', 'pre_aprovado', 'aprovado', 'contratado', 'escriturado']
    const activos = allPedidos.filter((p: any) => activeStatuses.includes(p.status))
    const concluidos = allPedidos.filter((p: any) => p.status === 'concluido')
    const recusados = allPedidos.filter((p: any) => p.status === 'recusado')

    // Volume total em pipeline (montante solicitado dos activos)
    const volumePipeline = activos.reduce((sum: number, p: any) => sum + (p.montante_solicitado || 0), 0)

    // Volume aprovado
    const aprovadosStatuses = ['aprovado', 'contratado', 'escriturado', 'concluido']
    const volumeAprovado = allPedidos
      .filter((p: any) => aprovadosStatuses.includes(p.status))
      .reduce((sum: number, p: any) => sum + (p.montante_solicitado || 0), 0)

    // Taxa de aprovação
    const decididos = allPedidos.filter((p: any) => ['aprovado', 'contratado', 'escriturado', 'concluido', 'recusado'].includes(p.status))
    const taxaAprovacao = decididos.length > 0
      ? Math.round((decididos.filter((p: any) => p.status !== 'recusado').length / decididos.length) * 100)
      : 0

    // Melhor spread das propostas aprovadas/aceites
    const spreadValues = allPropostas
      .filter((p: any) => ['aprovada', 'aceite', 'contratada', 'pre_aprovada'].includes(p.status) && p.spread)
      .map((p: any) => p.spread)
    const melhorSpread = spreadValues.length > 0 ? Math.min(...spreadValues) : null

    // Taxa de esforço média dos activos
    const teValues = activos.filter((p: any) => p.taxa_esforco).map((p: any) => p.taxa_esforco)
    const taxaEsforcoMedia = teValues.length > 0
      ? Math.round((teValues.reduce((a: number, b: number) => a + b, 0) / teValues.length) * 10) / 10
      : null

    // LTV médio dos activos
    const ltvValues = activos.filter((p: any) => p.ltv_calculado).map((p: any) => p.ltv_calculado)
    const ltvMedio = ltvValues.length > 0
      ? Math.round((ltvValues.reduce((a: number, b: number) => a + b, 0) / ltvValues.length) * 10) / 10
      : null

    // Documentos: pendentes obrigatórios nos activos
    const activePedidoIds = new Set(activos.map((p: any) => p.id))
    const docsActivos = allDocs.filter((d: any) => activePedidoIds.has(d.pedido_credito_id))
    const docsPendentes = docsActivos.filter((d: any) => d.obrigatorio && !['recebido', 'validado'].includes(d.status)).length
    const docsTotal = docsActivos.length

    // Per-status count
    const statusCounts: Record<string, number> = {}
    for (const p of allPedidos) {
      statusCounts[(p as any).status] = (statusCounts[(p as any).status] || 0) + 1
    }

    // Propostas por banco (top banks)
    const bankCounts: Record<string, { total: number; aprovadas: number }> = {}
    for (const prop of allPropostas) {
      const b = (prop as any).banco
      if (!bankCounts[b]) bankCounts[b] = { total: 0, aprovadas: 0 }
      bankCounts[b].total++
      if (['aprovada', 'aceite', 'contratada', 'pre_aprovada'].includes((prop as any).status)) {
        bankCounts[b].aprovadas++
      }
    }

    // Alertas activos
    const alertas: { tipo: 'urgente' | 'aviso' | 'info'; mensagem: string; pedido_id?: string; pedido_ref?: string }[] = []

    // Pedidos com taxa de esforço > 50%
    for (const p of activos) {
      if ((p as any).taxa_esforco && (p as any).taxa_esforco > 50) {
        alertas.push({
          tipo: 'urgente',
          mensagem: `Taxa de esforço ${(p as any).taxa_esforco}% excede limite BdP (50%)`,
          pedido_id: (p as any).id,
          pedido_ref: pedidoRefMap[(p as any).id],
        })
      }
    }

    // Pedidos com taxa de esforço entre 35-50% (aviso)
    for (const p of activos) {
      if ((p as any).taxa_esforco && (p as any).taxa_esforco > 35 && (p as any).taxa_esforco <= 50) {
        alertas.push({
          tipo: 'aviso',
          mensagem: `Taxa de esforço ${(p as any).taxa_esforco}% acima do recomendado (35%)`,
          pedido_id: (p as any).id,
          pedido_ref: pedidoRefMap[(p as any).id],
        })
      }
    }

    // Docs pendentes obrigatórios
    if (docsPendentes > 0) {
      alertas.push({
        tipo: 'aviso',
        mensagem: `${docsPendentes} documento(s) obrigatório(s) pendente(s) em pedidos activos`,
      })
    }

    // Propostas a expirar (< 15 dias)
    const now = new Date()
    const soon = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
    for (const prop of allPropostas) {
      const p = prop as any
      if (p.data_validade_aprovacao && ['aprovada', 'pre_aprovada'].includes(p.status)) {
        const validade = new Date(p.data_validade_aprovacao)
        if (validade <= soon && validade >= now) {
          alertas.push({
            tipo: 'urgente',
            mensagem: `Proposta ${p.banco} expira em ${Math.ceil((validade.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))} dias`,
            pedido_id: p.pedido_credito_id,
            pedido_ref: pedidoRefMap[p.pedido_credito_id],
          })
        }
      }
    }

    // Format activities
    const actividades = (recentActivities || []).map((a: any) => ({
      ...a,
      user_name: userMap[a.user_id] || 'Utilizador',
      pedido_ref: pedidoRefMap[a.pedido_credito_id] || a.pedido_credito_id,
    }))

    return NextResponse.json({
      kpis: {
        total_pedidos: allPedidos.length,
        pedidos_activos: activos.length,
        pedidos_concluidos: concluidos.length,
        pedidos_recusados: recusados.length,
        volume_pipeline: volumePipeline,
        volume_aprovado: volumeAprovado,
        taxa_aprovacao: taxaAprovacao,
        melhor_spread: melhorSpread,
        taxa_esforco_media: taxaEsforcoMedia,
        ltv_medio: ltvMedio,
        docs_pendentes: docsPendentes,
        docs_total: docsTotal,
        total_propostas: allPropostas.length,
      },
      status_counts: statusCounts,
      bank_stats: bankCounts,
      alertas,
      actividades,
    })
  } catch (error) {
    console.error('Erro ao carregar dashboard de crédito:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
