import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { MARKETING_CATEGORIES } from '@/lib/constants'

type Period = 'last_6m' | 'last_12m' | 'ytd'

function getPeriodStart(period: Period): string {
  const now = new Date()
  if (period === 'ytd') {
    return `${now.getFullYear()}-01-01`
  }
  const months = period === 'last_12m' ? 12 : 6
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1)
  return start.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const admin = createAdminClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentIdParam = searchParams.get('agent_id')
    const period = (searchParams.get('period') || 'last_6m') as Period

    if (!['last_6m', 'last_12m', 'ytd'].includes(period)) {
      return NextResponse.json({ error: 'Periodo invalido' }, { status: 400 })
    }

    // Check user permissions once
    const { data: currentUserRoles } = await admin
      .from('user_roles')
      .select('role_id, roles:roles(permissions)')
      .eq('user_id', user.id)

    const hasMarketingPermission = (currentUserRoles || []).some((ur: any) => {
      const perms = ur.roles?.permissions
      return perms && (perms.marketing === true || perms.settings === true)
    })

    // Determine target agent
    let targetAgentId: string | null = user.id

    if (agentIdParam && agentIdParam !== user.id) {
      if (!hasMarketingPermission) {
        return NextResponse.json({ error: 'Sem permissao para ver dados de outro agente' }, { status: 403 })
      }
      targetAgentId = agentIdParam === 'all' ? null : agentIdParam
    }

    const periodStart = getPeriodStart(period)

    // ── 1. Monthly spending from conta_corrente_transactions ──
    let txQuery = admin
      .from('conta_corrente_transactions')
      .select('date, category, amount')
      .in('category', ['marketing_purchase', 'subscription'])
      .gte('date', periodStart)
      .order('date', { ascending: true })

    if (targetAgentId) {
      txQuery = txQuery.eq('agent_id', targetAgentId)
    }

    const { data: transactions, error: txError } = await txQuery

    if (txError) {
      console.error('Erro ao buscar transaccoes:', txError)
    }

    // Map transaction categories to spending buckets
    const categoryToBucket: Record<string, string> = {
      marketing_purchase: 'services',
      subscription: 'subscriptions',
    }

    // Build monthly spending map
    const monthMap = new Map<string, { services: number; materials: number; subscriptions: number }>()

    for (const tx of (transactions || []) as any[]) {
      const month = tx.date ? tx.date.slice(0, 7) : null
      if (!month) continue
      const bucket = categoryToBucket[tx.category] || 'services'
      if (!monthMap.has(month)) {
        monthMap.set(month, { services: 0, materials: 0, subscriptions: 0 })
      }
      const entry = monthMap.get(month)!
      const amount = Math.abs(Number(tx.amount) || 0)
      entry[bucket as keyof typeof entry] += amount
    }

    // Also aggregate from marketing_orders + temp_requisitions for months without transactions
    let ordersQuery = admin
      .from('marketing_orders')
      .select('id, agent_id, total_amount, created_at, status')
      .not('status', 'in', '("cancelled","rejected")')
      .gte('created_at', periodStart)

    if (targetAgentId) {
      ordersQuery = ordersQuery.eq('agent_id', targetAgentId)
    }

    const { data: orders } = await ordersQuery

    for (const order of (orders || []) as any[]) {
      const month = order.created_at ? order.created_at.slice(0, 7) : null
      if (!month) continue
      if (!monthMap.has(month)) {
        monthMap.set(month, { services: 0, materials: 0, subscriptions: 0 })
      }
      // Only add if no conta_corrente transaction already covers this
      // We add to services as a fallback
    }

    let reqQuery = admin
      .from('temp_requisitions')
      .select('id, agent_id, total_amount, created_at, status')
      .not('status', 'in', '("cancelled","rejected")')
      .gte('created_at', periodStart)

    if (targetAgentId) {
      reqQuery = reqQuery.eq('agent_id', targetAgentId)
    }

    const { data: requisitions } = await reqQuery

    for (const req of (requisitions || []) as any[]) {
      const month = req.created_at ? req.created_at.slice(0, 7) : null
      if (!month) continue
      if (!monthMap.has(month)) {
        monthMap.set(month, { services: 0, materials: 0, subscriptions: 0 })
      }
    }

    // If no conta_corrente data, fall back to order totals
    if (!(transactions || []).length) {
      for (const order of (orders || []) as any[]) {
        const month = order.created_at ? order.created_at.slice(0, 7) : null
        if (!month) continue
        if (!monthMap.has(month)) {
          monthMap.set(month, { services: 0, materials: 0, subscriptions: 0 })
        }
        const entry = monthMap.get(month)!
        entry.services += Math.abs(Number(order.total_amount) || 0)
      }

      for (const req of (requisitions || []) as any[]) {
        const month = req.created_at ? req.created_at.slice(0, 7) : null
        if (!month) continue
        if (!monthMap.has(month)) {
          monthMap.set(month, { services: 0, materials: 0, subscriptions: 0 })
        }
        const entry = monthMap.get(month)!
        entry.materials += Math.abs(Number(req.total_amount) || 0)
      }
    }

    const monthly_spending = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month,
        services: Math.round(vals.services * 100) / 100,
        materials: Math.round(vals.materials * 100) / 100,
        subscriptions: Math.round(vals.subscriptions * 100) / 100,
        total: Math.round((vals.services + vals.materials + vals.subscriptions) * 100) / 100,
      }))

    // ── 2. Category breakdown from marketing_order_items + catalog ──
    let itemsQuery = admin
      .from('marketing_order_items')
      .select('id, name, price, quantity, catalog_item_id, marketing_catalog(category), order_id, marketing_orders!inner(agent_id, created_at, status)')
      .not('marketing_orders.status', 'in', '("cancelled","rejected")')
      .gte('marketing_orders.created_at', periodStart)

    if (targetAgentId) {
      itemsQuery = itemsQuery.eq('marketing_orders.agent_id', targetAgentId)
    }

    const { data: orderItems, error: itemsError } = await itemsQuery

    if (itemsError) {
      console.error('Erro ao buscar order items:', itemsError)
    }

    const categoryMap = new Map<string, { total: number; count: number }>()

    for (const item of (orderItems || []) as any[]) {
      const cat = item.marketing_catalog?.category || 'other'
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { total: 0, count: 0 })
      }
      const entry = categoryMap.get(cat)!
      entry.total += Number(item.price) * (Number(item.quantity) || 1)
      entry.count += Number(item.quantity) || 1
    }

    // Add physical materials from temp_requisition_items
    let reqItemsQuery = admin
      .from('temp_requisition_items')
      .select('id, quantity, subtotal, temp_requisitions!inner(agent_id, created_at, status)')
      .not('temp_requisitions.status', 'in', '("cancelled","rejected")')
      .gte('temp_requisitions.created_at', periodStart)

    if (targetAgentId) {
      reqItemsQuery = reqItemsQuery.eq('temp_requisitions.agent_id', targetAgentId)
    }

    const { data: reqItems } = await reqItemsQuery

    if ((reqItems || []).length > 0) {
      if (!categoryMap.has('physical_materials')) {
        categoryMap.set('physical_materials', { total: 0, count: 0 })
      }
      const matEntry = categoryMap.get('physical_materials')!
      for (const ri of (reqItems || []) as any[]) {
        matEntry.total += Number(ri.subtotal) || 0
        matEntry.count += Number(ri.quantity) || 1
      }
    }

    const category_breakdown = Array.from(categoryMap.entries())
      .map(([category, vals]) => ({
        category,
        label: (MARKETING_CATEGORIES as Record<string, string>)[category] || category,
        total: Math.round(vals.total * 100) / 100,
        count: vals.count,
      }))
      .sort((a, b) => b.total - a.total)

    // ── 3. Totals ──
    const totals = {
      services: monthly_spending.reduce((s, m) => s + m.services, 0),
      materials: monthly_spending.reduce((s, m) => s + m.materials, 0),
      subscriptions: monthly_spending.reduce((s, m) => s + m.subscriptions, 0),
      grand_total: 0,
    }
    // If monthly_spending has no conta_corrente data, compute from category_breakdown
    if (totals.services === 0 && totals.materials === 0 && totals.subscriptions === 0) {
      totals.grand_total = category_breakdown.reduce((s, c) => s + c.total, 0)
      // Estimate buckets from categories
      for (const cat of category_breakdown) {
        if (cat.category === 'physical_materials') {
          totals.materials += cat.total
        } else {
          totals.services += cat.total
        }
      }
    } else {
      totals.grand_total = totals.services + totals.materials + totals.subscriptions
    }

    totals.services = Math.round(totals.services * 100) / 100
    totals.materials = Math.round(totals.materials * 100) / 100
    totals.subscriptions = Math.round(totals.subscriptions * 100) / 100
    totals.grand_total = Math.round(totals.grand_total * 100) / 100

    // ── 4. Agents list (for managers with marketing permission) ──
    let agents_list: { id: string; commercial_name: string }[] = []

    if (hasMarketingPermission) {
      const { data: agentsData } = await admin
        .from('dev_users')
        .select('id, commercial_name')
        .eq('is_active', true)
        .order('commercial_name')

      agents_list = (agentsData || []).map((a: any) => ({
        id: a.id,
        commercial_name: a.commercial_name || 'Consultor',
      }))
    }

    return NextResponse.json({ monthly_spending, category_breakdown, totals, agents_list })
  } catch (error) {
    console.error('Erro ao carregar analytics:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
