import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const processType = searchParams.get('process_type') || ''
    const propertyId = searchParams.get('property_id') || ''

    let query = supabase
      .from('proc_instances')
      .select(`
        *,
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
        ),
        requested_by_user:dev_users!proc_instances_requested_by_fkey(
          id,
          commercial_name
        )
      `)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false, nullsFirst: false })

    if (status) {
      query = query.eq('current_status', status)
    } else {
      // By default, exclude drafts unless explicitly filtered
      // (drafts appear only when the "Rascunhos" tab is selected)
    }

    if (processType) {
      query = query.eq('process_type' as any, processType)
    }

    if (propertyId) {
      query = query.eq('property_id', propertyId)
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
          p.dev_properties?.city?.toLowerCase().includes(term) ||
          p.requested_by_user?.commercial_name?.toLowerCase().includes(term)
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
