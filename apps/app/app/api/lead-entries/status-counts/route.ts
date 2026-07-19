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
 * Buckets follow the Leads kanban semantics. "Contactado" agrega todos os
 * estados de lead já trabalhada (contactada/tentada), incluindo as colunas
 * "Não atendeu" — senão essas leads não apareciam em nenhum contador:
 *   • novo        ← status IN ('new', 'seen')
 *   • contactado  ← status IN ('processing', 'no_answer', 'no_answer_2plus')
 *   • qualificado ← status = 'converted'
 *   • perdido     ← status = 'discarded'
 *
 * Response: { counts: { novo, contactado, qualificado, perdido }, total }
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
          counts: { novo: 0, contactado: 0, qualificado: 0, perdido: 0 },
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
        // Consultor view — exclui entries soft-deleted (consultor_hidden_at).
        q = q.eq('assigned_consultant_id', auth.user.id).is('consultor_hidden_at', null)
      }
      const { count } = await q
      return count ?? 0
    }

    const [novoCount, contactadoCount, qualificadoCount, perdidoCount, totalCount] = await Promise.all([
      buildCount(['new', 'seen']),
      buildCount(['processing', 'no_answer', 'no_answer_2plus']),
      buildCount(['converted']),
      buildCount(['discarded']),
      buildCount(null),
    ])

    return NextResponse.json({
      counts: {
        novo: novoCount,
        contactado: contactadoCount,
        qualificado: qualificadoCount,
        perdido: perdidoCount,
      },
      total: totalCount,
    })
  } catch (error) {
    console.error('Erro a obter contagens de lead entries:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
