import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createOrderSchema } from '@/lib/validations/marketing'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const agent_id = searchParams.get('agent_id')
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)
    const offset = Number(searchParams.get('offset')) || 0

    let query = supabase
      .from('marketing_orders')
      .select(`
        *,
        agent:dev_users!marketing_orders_agent_id_fkey(id, commercial_name),
        property:dev_properties(id, title, slug),
        marketing_order_items(id, catalog_item_id, pack_id, name, price)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (agent_id) query = query.eq('agent_id', agent_id)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const orders = (data || []).map((order: any) => ({
      ...order,
      items: order.marketing_order_items || [],
      marketing_order_items: undefined,
    }))

    return NextResponse.json({ data: orders, total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar encomendas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { items, checkout_group_id, payment_method, property_id, property_bundle_data, proposed_dates } = parsed.data
    const total_amount = items.reduce((sum, item) => sum + item.price, 0)

    // Extract address fields from property_bundle_data for indexed columns
    const bundleData = property_bundle_data && typeof property_bundle_data === 'object' ? property_bundle_data : null
    const addressFields = bundleData ? {
      address: bundleData.address || null,
      city: bundleData.city || null,
      parish: bundleData.parish || null,
      postal_code: bundleData.postal_code || null,
      ...(bundleData.availability?.will_be_present !== undefined ? {
        contact_is_agent: bundleData.availability.will_be_present,
        contact_name: bundleData.availability.replacement_name || null,
        contact_phone: bundleData.availability.replacement_phone || null,
      } : {}),
    } : {}

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('marketing_orders')
      .insert({
        agent_id: user.id,
        total_amount,
        status: 'pending',
        payment_method,
        ...(property_id ? { property_id } : {}),
        ...(property_bundle_data ? { property_bundle_data } : {}),
        ...(checkout_group_id ? { checkout_group_id } : {}),
        ...addressFields,
      })
      .select()
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Erro ao criar encomenda' }, { status: 500 })
    }

    // Create order items — attach proposed_dates from availability
    const proposedDatesJson = proposed_dates && proposed_dates.length > 0 ? proposed_dates : []
    const orderItems = items.map(item => ({
      order_id: order.id,
      catalog_item_id: item.catalog_item_id || null,
      pack_id: item.pack_id || null,
      name: item.name,
      price: item.price,
      status: 'available',
      proposed_dates: proposedDatesJson,
    }))

    const { data: createdItems, error: itemsError } = await supabase
      .from('marketing_order_items')
      .insert(orderItems)
      .select()

    if (itemsError) {
      await supabase.from('marketing_orders').delete().eq('id', order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Create subscriptions for subscription-based catalog items
    if (createdItems && createdItems.length > 0) {
      const catalogItemIds = createdItems
        .filter((ci: any) => ci.catalog_item_id)
        .map((ci: any) => ci.catalog_item_id)

      if (catalogItemIds.length > 0) {
        const { data: catalogItems } = await supabase
          .from('marketing_catalog')
          .select('id, is_subscription, billing_cycle')
          .in('id', catalogItemIds)

        const subscriptionCatalogMap = new Map<string, any>()
        for (const ci of (catalogItems || [])) {
          if (ci.is_subscription) {
            subscriptionCatalogMap.set(ci.id, ci)
          }
        }

        if (subscriptionCatalogMap.size > 0) {
          const now = new Date()
          const subscriptionRows = createdItems
            .filter((oi: any) => oi.catalog_item_id && subscriptionCatalogMap.has(oi.catalog_item_id))
            .map((oi: any) => {
              const catalogItem = subscriptionCatalogMap.get(oi.catalog_item_id)
              const billingCycle = catalogItem.billing_cycle || 'monthly'
              const periodEnd = new Date(now)

              if (billingCycle === 'quarterly') {
                periodEnd.setMonth(periodEnd.getMonth() + 3)
              } else if (billingCycle === 'yearly') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1)
              } else {
                // monthly (default)
                periodEnd.setMonth(periodEnd.getMonth() + 1)
              }

              return {
                agent_id: user.id,
                order_item_id: oi.id,
                catalog_item_id: oi.catalog_item_id,
                billing_cycle: billingCycle,
                price_per_cycle: oi.price,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                next_billing_date: periodEnd.toISOString(),
                status: 'active',
              }
            })

          if (subscriptionRows.length > 0) {
            const { error: subError } = await supabase
              .from('marketing_subscriptions')
              .insert(subscriptionRows)

            if (subError) {
              console.error('Erro ao criar subscrições:', subError.message)
            }
          }
        }
      }
    }

    // Debit conta corrente (skip if payment method is invoice)
    if (payment_method !== 'invoice') {
      // Get current balance
      const { data: lastTx } = await supabase
        .from('conta_corrente_transactions')
        .select('balance_after')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const currentBalance = lastTx?.balance_after ?? 0
      const newBalance = currentBalance - total_amount

      await supabase.from('conta_corrente_transactions').insert({
        agent_id: user.id,
        type: 'DEBIT',
        category: 'marketing_purchase',
        amount: total_amount,
        description: `Encomenda Marketing — ${items.map(i => i.name).join(', ')}`,
        reference_id: order.id,
        reference_type: 'marketing_order',
        balance_after: newBalance,
        created_by: user.id,
      })
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar encomenda:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
