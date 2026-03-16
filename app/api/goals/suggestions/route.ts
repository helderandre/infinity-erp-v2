// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * GET /api/goals/suggestions?consultant_id=xxx
 *
 * Returns suggested funnel parameters derived from real data.
 * Each field includes: value, source ('data' | 'market_default'), sample_size
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const consultantId = searchParams.get('consultant_id')

    const supabase = await createClient()

    // ─── SELLER FUNNEL ──────────────────────────────────

    // 1. Avg sale value — from consultant's properties, fallback to global
    let avgSaleValue: { value: number; source: string; sample: number } | null = null

    if (consultantId) {
      const { data: consultantProps } = await supabase
        .from('dev_properties')
        .select('listing_price')
        .eq('consultant_id', consultantId)
        .not('listing_price', 'is', null)
        .gt('listing_price', 0)

      if (consultantProps && consultantProps.length >= 3) {
        const avg = consultantProps.reduce((s, p) => s + Number(p.listing_price), 0) / consultantProps.length
        avgSaleValue = { value: Math.round(avg), source: 'data', sample: consultantProps.length }
      }
    }

    if (!avgSaleValue) {
      const { data: allProps } = await supabase
        .from('dev_properties')
        .select('listing_price')
        .not('listing_price', 'is', null)
        .gt('listing_price', 0)
        .neq('status', 'cancelled')

      if (allProps && allProps.length > 0) {
        const avg = allProps.reduce((s, p) => s + Number(p.listing_price), 0) / allProps.length
        avgSaleValue = { value: Math.round(avg), source: 'data', sample: allProps.length }
      } else {
        avgSaleValue = { value: 250000, source: 'market_default', sample: 0 }
      }
    }

    // 2. Avg commission % — from dev_property_internal, filter sane values (1-10%)
    let avgCommission: { value: number; source: string; sample: number } | null = null

    const commissionQuery = consultantId
      ? supabase
          .from('dev_property_internal')
          .select('commission_agreed, property_id')
          .gt('commission_agreed', 0)
          .lte('commission_agreed', 10)
      : supabase
          .from('dev_property_internal')
          .select('commission_agreed')
          .gt('commission_agreed', 0)
          .lte('commission_agreed', 10)

    if (consultantId) {
      // Need to join through properties to filter by consultant
      const { data: consultantCommissions } = await supabase.rpc('get_consultant_commissions' as any, { p_consultant_id: consultantId }).select('*') as any

      // Fallback: get all commissions with sane values
      const { data: allCommissions } = await supabase
        .from('dev_property_internal')
        .select('commission_agreed')
        .gt('commission_agreed', 0)
        .lte('commission_agreed', 10)

      if (allCommissions && allCommissions.length > 0) {
        const avg = allCommissions.reduce((s, c) => s + Number(c.commission_agreed), 0) / allCommissions.length
        avgCommission = { value: Math.round(avg * 10) / 10, source: 'data', sample: allCommissions.length }
      }
    } else {
      const { data: allCommissions } = await supabase
        .from('dev_property_internal')
        .select('commission_agreed')
        .gt('commission_agreed', 0)
        .lte('commission_agreed', 10)

      if (allCommissions && allCommissions.length > 0) {
        const avg = allCommissions.reduce((s, c) => s + Number(c.commission_agreed), 0) / allCommissions.length
        avgCommission = { value: Math.round(avg * 10) / 10, source: 'data', sample: allCommissions.length }
      }
    }

    if (!avgCommission) {
      avgCommission = { value: 5, source: 'market_default', sample: 0 }
    }

    // 3. % listings sold — sold / total for consultant or global
    let pctListingsSold: { value: number; source: string; sample: number }

    if (consultantId) {
      const { count: totalCount } = await supabase
        .from('dev_properties')
        .select('id', { count: 'exact', head: true })
        .eq('consultant_id', consultantId)
        .neq('status', 'cancelled')

      const { count: soldCount } = await supabase
        .from('dev_properties')
        .select('id', { count: 'exact', head: true })
        .eq('consultant_id', consultantId)
        .eq('status', 'sold')

      const total = totalCount || 0
      const sold = soldCount || 0

      if (total >= 5 && sold > 0) {
        pctListingsSold = { value: Math.round((sold / total) * 100), source: 'data', sample: total }
      } else {
        // Global fallback
        const { count: gTotal } = await supabase
          .from('dev_properties')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'cancelled')

        const { count: gSold } = await supabase
          .from('dev_properties')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'sold')

        if ((gTotal || 0) > 0 && (gSold || 0) > 0) {
          pctListingsSold = { value: Math.round(((gSold || 0) / (gTotal || 1)) * 100), source: 'data', sample: gTotal || 0 }
        } else {
          pctListingsSold = { value: 22, source: 'market_default', sample: 0 }
        }
      }
    } else {
      pctListingsSold = { value: 22, source: 'market_default', sample: 0 }
    }

    // 4. Conversion rates — from activity log if available, else market defaults
    let pctVisitToListing: { value: number; source: string; sample: number } = { value: 25, source: 'market_default', sample: 0 }
    let pctLeadToVisit: { value: number; source: string; sample: number } = { value: 20, source: 'market_default', sample: 0 }
    let avgCallsPerLead: { value: number; source: string; sample: number } = { value: 3, source: 'market_default', sample: 0 }

    // Try to derive from activity log
    if (consultantId) {
      const { data: actLogs } = await supabase
        .from('temp_goal_activity_log')
        .select('activity_type')
        .eq('consultant_id', consultantId)
        .eq('origin', 'sellers')

      if (actLogs && actLogs.length >= 20) {
        const visits = actLogs.filter(a => a.activity_type === 'visit').length
        const listings = actLogs.filter(a => a.activity_type === 'listing').length
        const leads = actLogs.filter(a => a.activity_type === 'lead_contact').length
        const calls = actLogs.filter(a => a.activity_type === 'call').length

        if (visits > 0 && listings > 0) {
          pctVisitToListing = { value: Math.round((listings / visits) * 100), source: 'data', sample: visits }
        }
        if (leads > 0 && visits > 0) {
          pctLeadToVisit = { value: Math.round((visits / leads) * 100), source: 'data', sample: leads }
        }
        if (leads > 0 && calls > 0) {
          avgCallsPerLead = { value: Math.round((calls / leads) * 10) / 10, source: 'data', sample: leads }
        }
      }
    }

    // ─── BUYER FUNNEL ───────────────────────────────────

    // 1. Avg purchase value — from negocios tipo Compra
    let avgPurchaseValue: { value: number; source: string; sample: number }

    const { data: buyerNegocios } = await supabase
      .from('negocios')
      .select('orcamento')
      .in('tipo', ['Compra', 'Compra e Venda'])
      .not('orcamento', 'is', null)
      .gt('orcamento', 0)

    if (buyerNegocios && buyerNegocios.length >= 3) {
      const avg = buyerNegocios.reduce((s, n) => s + Number(n.orcamento), 0) / buyerNegocios.length
      avgPurchaseValue = { value: Math.round(avg), source: 'data', sample: buyerNegocios.length }
    } else {
      // Use same as sale value as fallback
      avgPurchaseValue = { value: avgSaleValue.value, source: avgSaleValue.source === 'data' ? 'data' : 'market_default', sample: avgSaleValue.sample }
    }

    // 2. Buyer commission — usually same as seller, slight adjustment
    const buyerCommission = { ...avgCommission }

    // 3. Buyer close rate and conversion — market defaults unless we have activity data
    let buyerCloseRate: { value: number; source: string; sample: number } = { value: 16.67, source: 'market_default', sample: 0 }
    let buyerPctLeadToQualified: { value: number; source: string; sample: number } = { value: 20, source: 'market_default', sample: 0 }
    let buyerAvgCallsPerLead: { value: number; source: string; sample: number } = { value: 3, source: 'market_default', sample: 0 }

    if (consultantId) {
      const { data: buyerActs } = await supabase
        .from('temp_goal_activity_log')
        .select('activity_type')
        .eq('consultant_id', consultantId)
        .eq('origin', 'buyers')

      if (buyerActs && buyerActs.length >= 20) {
        const closes = buyerActs.filter(a => a.activity_type === 'buyer_close').length
        const qualified = buyerActs.filter(a => a.activity_type === 'buyer_qualify').length
        const leads = buyerActs.filter(a => a.activity_type === 'lead_contact').length
        const calls = buyerActs.filter(a => a.activity_type === 'call').length

        if (qualified > 0 && closes > 0) {
          buyerCloseRate = { value: Math.round((closes / qualified) * 100 * 100) / 100, source: 'data', sample: qualified }
        }
        if (leads > 0 && qualified > 0) {
          buyerPctLeadToQualified = { value: Math.round((qualified / leads) * 100), source: 'data', sample: leads }
        }
        if (leads > 0 && calls > 0) {
          buyerAvgCallsPerLead = { value: Math.round((calls / leads) * 10) / 10, source: 'data', sample: leads }
        }
      }
    }

    // ─── RESPONSE ───────────────────────────────────────

    return NextResponse.json({
      sellers: {
        avg_sale_value: avgSaleValue,
        avg_commission_pct: avgCommission,
        pct_listings_sold: pctListingsSold,
        pct_visit_to_listing: pctVisitToListing,
        pct_lead_to_visit: pctLeadToVisit,
        avg_calls_per_lead: avgCallsPerLead,
      },
      buyers: {
        avg_purchase_value: avgPurchaseValue,
        avg_commission_pct: buyerCommission,
        close_rate: buyerCloseRate,
        pct_lead_to_qualified: buyerPctLeadToQualified,
        avg_calls_per_lead: buyerAvgCallsPerLead,
      },
    })
  } catch (error) {
    console.error('Erro ao calcular sugestões:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
