import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const isManagement = isManagementRole(auth.roles)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const processType = searchParams.get('process_type') || ''
    const propertyId = searchParams.get('property_id') || ''
    const negocioId = searchParams.get('negocio_id') || ''

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
      // Accept comma-separated list (e.g. "draft,pending_approval,active")
      // for tabs that bundle multiple statuses like "A decorrer".
      const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        query = query.eq('current_status', statuses[0])
      } else if (statuses.length > 1) {
        query = query.in('current_status', statuses)
      }
    }

    if (processType) {
      query = query.eq('process_type' as any, processType)
    }

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    if (negocioId) {
      query = query.eq('negocio_id' as any, negocioId)
    }

    // Visibility scoping: management roles see everything; consultors see
    // only processos onde:
    //   - foram quem pediu (`requested_by = self`)  OR
    //   - o imóvel é deles (`property.consultant_id = self`)  OR
    //   - o negócio é deles (`negocio.assigned_consultant_id = self`)
    if (!isManagement) {
      const userId = auth.user.id

      const [{ data: ownProperties }, { data: ownNegocios }] = await Promise.all([
        supabase.from('dev_properties').select('id').eq('consultant_id', userId),
        supabase.from('negocios').select('id').eq('assigned_consultant_id', userId),
      ])

      const ownPropertyIds = (ownProperties ?? []).map((p: { id: string }) => p.id)
      const ownNegocioIds = (ownNegocios ?? []).map((n: { id: string }) => n.id)

      const orParts = [`requested_by.eq.${userId}`]
      if (ownPropertyIds.length > 0) {
        orParts.push(`property_id.in.(${ownPropertyIds.join(',')})`)
      }
      if (ownNegocioIds.length > 0) {
        orParts.push(`negocio_id.in.(${ownNegocioIds.join(',')})`)
      }

      query = query.or(orParts.join(','))
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
