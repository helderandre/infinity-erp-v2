import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parâmetro month é obrigatório (formato: YYYY-MM)' },
        { status: 400 }
      )
    }

    // Compute first and last day of the month
    const [year, mon] = month.split('-').map(Number)
    const firstDay = `${month}-01`
    const lastDay = new Date(year, mon, 0).toISOString().split('T')[0]

    const events: Array<{
      date: string
      type: string
      label: string
      metadata: Record<string, any>
    }> = []

    // a) marketing_requests — services scheduled in this month
    const { data: requests, error: reqError } = await supabase
      .from('marketing_requests')
      .select(`
        id, status, preferred_date, confirmed_date, property_id, notes,
        order_item:marketing_order_items(id, name, price)
      `)
      .eq('agent_id', user.id)
      .or(
        `and(confirmed_date.gte.${firstDay},confirmed_date.lte.${lastDay}),` +
        `and(preferred_date.gte.${firstDay},preferred_date.lte.${lastDay})`
      )

    if (reqError) {
      console.error('Erro ao buscar requests:', reqError)
    } else if (requests) {
      for (const r of requests as any[]) {
        const date = r.confirmed_date || r.preferred_date
        if (!date) continue

        // Ensure the chosen date actually falls within the month range
        if (date < firstDay || date > lastDay) continue

        events.push({
          date,
          type: 'service_scheduled',
          label: r.order_item?.name || 'Serviço agendado',
          metadata: {
            request_id: r.id,
            status: r.status,
            property_id: r.property_id,
            is_confirmed: !!r.confirmed_date,
            price: r.order_item?.price,
            notes: r.notes,
          },
        })
      }
    }

    // b) marketing_orders — purchases made in this month
    const { data: orders, error: ordError } = await supabase
      .from('marketing_orders')
      .select(`
        id, total_amount, status, created_at,
        marketing_order_items(id, name, price)
      `)
      .eq('agent_id', user.id)
      .gte('created_at', `${firstDay}T00:00:00`)
      .lte('created_at', `${lastDay}T23:59:59`)

    if (ordError) {
      console.error('Erro ao buscar orders:', ordError)
    } else if (orders) {
      for (const o of orders as any[]) {
        const itemNames = (o.marketing_order_items || []).map((i: any) => i.name)
        const shortLabel = itemNames.length > 0
          ? itemNames.slice(0, 2).join(', ') + (itemNames.length > 2 ? ` +${itemNames.length - 2}` : '')
          : 'Compra'

        events.push({
          date: o.created_at.split('T')[0],
          type: 'purchase',
          label: shortLabel,
          metadata: {
            order_id: o.id,
            total_amount: o.total_amount,
            status: o.status,
            items: (o.marketing_order_items || []).map((i: any) => ({
              name: i.name,
              price: i.price,
            })),
          },
        })
      }
    }

    // c) marketing_subscriptions — renewals in this month
    const { data: subs, error: subError } = await supabase
      .from('marketing_subscriptions')
      .select(`
        id, status, next_billing_date, amount,
        catalog_item:marketing_catalog!marketing_subscriptions_catalog_item_id_fkey(id, name, category)
      `)
      .eq('agent_id', user.id)
      .eq('status', 'active')
      .gte('next_billing_date', firstDay)
      .lte('next_billing_date', lastDay)

    if (subError) {
      console.error('Erro ao buscar subscriptions:', subError)
    } else if (subs) {
      for (const s of subs as any[]) {
        events.push({
          date: s.next_billing_date,
          type: 'subscription_renewal',
          label: s.catalog_item?.name || 'Renovação subscrição',
          metadata: {
            subscription_id: s.id,
            amount: s.amount,
            catalog_item_id: s.catalog_item?.id,
            category: s.catalog_item?.category,
          },
        })
      }
    }

    // Sort events by date
    events.sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Erro ao carregar calendário gestão:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
