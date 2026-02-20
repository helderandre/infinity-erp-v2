import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    let query = supabase
      .from('proc_instances')
      .select(`
        id,
        external_ref,
        current_status,
        percent_complete,
        started_at,
        updated_at,
        requested_by,
        approved_at,
        notes,
        dev_properties (
          id,
          title,
          city,
          zone,
          business_type,
          listing_price,
          property_type,
          status
        ),
        tpl_processes (
          id,
          name
        )
      `)
      .order('updated_at', { ascending: false, nullsFirst: false })

    if (status) {
      query = query.eq('current_status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao carregar processos:', error)
      return NextResponse.json(
        { error: 'Erro ao carregar processos', details: error.message },
        { status: 500 }
      )
    }

    // Filtrar por search no servidor (external_ref ou titulo do imovel)
    let results = data || []
    if (search) {
      const term = search.toLowerCase()
      results = results.filter(
        (p: any) =>
          p.external_ref?.toLowerCase().includes(term) ||
          p.dev_properties?.title?.toLowerCase().includes(term) ||
          p.dev_properties?.city?.toLowerCase().includes(term)
      )
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Erro ao carregar processos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
