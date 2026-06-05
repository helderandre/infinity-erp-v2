import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { businessDaysBetween } from '@/lib/business-days'

// GET — compare two suppliers
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) || []

    if (ids.length !== 2) {
      return NextResponse.json({ error: 'Forneça exactamente 2 IDs de fornecedores.' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    const results = await Promise.all(ids.map(async (id) => {
      const { data: supplier } = await admin.from('temp_partners').select('*').eq('id', id).single()
      const { data: orders } = await admin
        .from('temp_supplier_orders')
        .select('id, status, total_cost, ordered_at, at_store_at, created_at')
        .eq('supplier_id', id)

      const allOrders = orders || []
      const completed = allOrders.filter((o: any) => ['picked_up', 'delivered', 'completed'].includes(o.status))
      const deliveryTimes = completed
        .filter((o: any) => o.ordered_at && o.at_store_at)
        .map((o: any) => businessDaysBetween(o.ordered_at, o.at_store_at))
        .filter((d: number) => d > 0)

      const { data: feedback } = await admin
        .from('supplier_order_feedback')
        .select('rating, would_recommend')
        .in('order_id', allOrders.map((o: any) => o.id))

      const allFeedback = feedback || []
      const recommendPct = allFeedback.length > 0
        ? Math.round(allFeedback.filter((f: any) => f.would_recommend).length / allFeedback.length * 100)
        : null

      return {
        supplier,
        total_orders: allOrders.length,
        total_volume: allOrders.reduce((s: number, o: any) => s + (Number(o.total_cost) || 0), 0),
        active_orders: allOrders.filter((o: any) => ['ordered', 'in_transit', 'at_store'].includes(o.status)).length,
        avg_delivery_days: deliveryTimes.length > 0
          ? Math.round(deliveryTimes.reduce((s: number, d: number) => s + d, 0) / deliveryTimes.length * 10) / 10
          : null,
        rating_avg: supplier?.rating_avg || 0,
        rating_count: supplier?.rating_count || 0,
        recommend_pct: recommendPct,
        feedback_count: allFeedback.length,
      }
    }))

    return NextResponse.json({ suppliers: results })
  } catch (err) {
    console.error('[suppliers compare GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
