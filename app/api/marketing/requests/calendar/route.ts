import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: calendar data for marketing requests
export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const month = searchParams.get('month') // YYYY-MM
    if (!month) {
      return NextResponse.json({ error: 'Parâmetro month é obrigatório (YYYY-MM)' }, { status: 400 })
    }

    const startDate = `${month}-01`
    const [year, m] = month.split('-').map(Number)
    const endDate = `${year}-${String(m + 1).padStart(2, '0')}-01`

    const { data, error } = await supabase
      .from('marketing_requests')
      .select(`
        id, status, preferred_date, preferred_time, confirmed_date, confirmed_time,
        agent:dev_users!marketing_requests_agent_id_fkey(id, commercial_name),
        order_item:marketing_order_items(name,
          catalog_item:marketing_catalog(name, category)
        ),
        property:dev_properties(title, city)
      `)
      .or(`preferred_date.gte.${startDate},confirmed_date.gte.${startDate}`)
      .or(`preferred_date.lt.${endDate},confirmed_date.lt.${endDate}`)
      .in('status', ['pending', 'scheduled', 'in_progress'])
      .order('preferred_date', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao obter calendário:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
