import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    // Fetch deals for this property
    const { data: deals, error: dealsErr } = await supabase
      .from('temp_deals')
      .select(`
        id, reference, deal_type, deal_value, deal_date, status,
        consultant:dev_users!temp_deals_consultant_id_fkey(commercial_name)
      `)
      .eq('property_id', id)
      .order('deal_date', { ascending: false })

    if (dealsErr) {
      return NextResponse.json({ error: dealsErr.message }, { status: 500 })
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json([])
    }

    // Fetch compliance records for these deals
    const dealIds = deals.map((d: any) => d.id)
    const { data: complianceRecords } = await supabase
      .from('temp_deal_compliance')
      .select('*')
      .in('deal_id', dealIds)

    const complianceMap = new Map<string, any>()
    if (complianceRecords) {
      for (const c of complianceRecords) {
        complianceMap.set(c.deal_id, c)
      }
    }

    const result = deals.map((deal: any) => ({
      deal,
      compliance: complianceMap.get(deal.id) || null,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao carregar dados IMPIC:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
