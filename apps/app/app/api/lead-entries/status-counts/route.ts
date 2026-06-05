import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

/**
 * GET /api/lead-entries/status-counts
 *
 * Counts used by the hero KPI row in /dashboard/crm/leads. Scoped by the same
 * view as the listing (`scope=referred` → entries I referred out; default →
 * entries currently assigned to me).
 *
 * Buckets follow the Leads kanban semantics:
 *   • novo        ← status IN ('new', 'seen')
 *   • contactado  ← status = 'processing'
 *   • qualificado ← status = 'converted'
 *
 * Response: { counts: { novo, contactado, qualificado }, total }
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    // Use untyped client — `leads_entries` lives in the CRM schema and the
    // generated types don't track its columns. Matches /api/lead-entries.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')
    const isReferred = scope === 'referred'

    // Build the row-id whitelist when view=referenciadas.
    let restrictIds: string[] | null = null
    if (isReferred) {
      const { data: refs } = await supabase
        .from('leads_referrals')
        .select('entry_id')
        .eq('from_consultant_id', auth.user.id)
        .not('entry_id', 'is', null)
        .neq('status', 'cancelled')
      restrictIds = Array.from(
        new Set(
          ((refs ?? []) as Array<{ entry_id: string | null }>)
            .map((r) => r.entry_id)
            .filter((id): id is string => !!id),
        ),
      )
      if (restrictIds.length === 0) {
        return NextResponse.json({
          counts: { novo: 0, contactado: 0, qualificado: 0 },
          total: 0,
        })
      }
    }

    const buildCount = async (statuses: string[] | null) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from('leads_entries').select('*', { count: 'exact', head: true })
      if (statuses) q = q.in('status', statuses)
      if (isReferred) {
        if (restrictIds) q = q.in('id', restrictIds)
      } else {
        q = q.eq('assigned_consultant_id', auth.user.id)
      }
      const { count } = await q
      return count ?? 0
    }

    const [novoCount, contactadoCount, qualificadoCount, totalCount] = await Promise.all([
      buildCount(['new', 'seen']),
      buildCount(['processing']),
      buildCount(['converted']),
      buildCount(null),
    ])

    return NextResponse.json({
      counts: {
        novo: novoCount,
        contactado: contactadoCount,
        qualificado: qualificadoCount,
      },
      total: totalCount,
    })
  } catch (error) {
    console.error('Erro a obter contagens de lead entries:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
