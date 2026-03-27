import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { businessDaysBetween } from '@/lib/business-days'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createAdminClient() as any

    // Fetch supplier info
    const { data: supplier, error: supErr } = await admin
      .from('temp_partners')
      .select('*')
      .eq('id', id)
      .single()

    if (supErr || !supplier) {
      return NextResponse.json({ error: 'Fornecedor não encontrado.' }, { status: 404 })
    }

    // Fetch all orders for this supplier
    const { data: orders } = await admin
      .from('temp_supplier_orders')
      .select('id, reference, status, total_cost, ordered_at, at_store_at, delivered_at, created_at, expected_delivery_date')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })

    const allOrders = orders || []

    // KPIs
    const totalOrders = allOrders.length
    const totalVolume = allOrders.reduce((s: number, o: any) => s + (Number(o.total_cost) || 0), 0)
    const activeOrders = allOrders.filter((o: any) => ['ordered', 'in_transit', 'at_store'].includes(o.status)).length
    const completedOrders = allOrders.filter((o: any) => ['picked_up', 'delivered', 'completed'].includes(o.status))

    // Avg delivery time (business days: ordered_at → at_store_at)
    const deliveryTimes = completedOrders
      .filter((o: any) => o.ordered_at && o.at_store_at)
      .map((o: any) => businessDaysBetween(o.ordered_at, o.at_store_at))
      .filter((d: number) => d > 0)

    const avgDeliveryDays = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((s: number, d: number) => s + d, 0) / deliveryTimes.length * 10) / 10
      : null

    // Monthly breakdown (last 12 months)
    const now = new Date()
    const monthlyData: { month: string; orders: number; volume: number; avg_delivery: number | null }[] = []

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthOrders = allOrders.filter((o: any) => {
        const created = new Date(o.ordered_at || o.created_at)
        return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}` === monthKey
      })
      const monthDeliveryTimes = monthOrders
        .filter((o: any) => o.ordered_at && o.at_store_at)
        .map((o: any) => businessDaysBetween(o.ordered_at, o.at_store_at))
        .filter((d: number) => d > 0)

      monthlyData.push({
        month: monthKey,
        orders: monthOrders.length,
        volume: monthOrders.reduce((s: number, o: any) => s + (Number(o.total_cost) || 0), 0),
        avg_delivery: monthDeliveryTimes.length > 0
          ? Math.round(monthDeliveryTimes.reduce((s: number, d: number) => s + d, 0) / monthDeliveryTimes.length * 10) / 10
          : null,
      })
    }

    // Status breakdown
    const statusBreakdown: Record<string, number> = {}
    allOrders.forEach((o: any) => {
      statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1
    })

    // Feedback
    const { data: feedback } = await admin
      .from('supplier_order_feedback')
      .select('*, user:dev_users!user_id(id, commercial_name), order:temp_supplier_orders!order_id(reference)')
      .in('order_id', allOrders.map((o: any) => o.id))
      .order('created_at', { ascending: false })

    // Monthly rating trend
    const ratingTrend: { month: string; avg_rating: number | null; count: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthFeedback = (feedback || []).filter((f: any) => {
        const created = new Date(f.created_at)
        return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}` === monthKey
      })
      ratingTrend.push({
        month: monthKey,
        avg_rating: monthFeedback.length > 0
          ? Math.round(monthFeedback.reduce((s: number, f: any) => s + f.rating, 0) / monthFeedback.length * 10) / 10
          : null,
        count: monthFeedback.length,
      })
    }

    return NextResponse.json({
      supplier,
      kpis: {
        total_orders: totalOrders,
        total_volume: totalVolume,
        active_orders: activeOrders,
        avg_delivery_days: avgDeliveryDays,
        rating_avg: supplier.rating_avg || 0,
        rating_count: supplier.rating_count || 0,
      },
      monthly: monthlyData,
      status_breakdown: statusBreakdown,
      rating_trend: ratingTrend,
      feedback: feedback || [],
      orders: allOrders,
    })
  } catch (err) {
    console.error('[supplier stats GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
