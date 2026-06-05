/**
 * POST /api/crm/referrals/bulk
 *
 * Bulk version of the internal "Referenciar" hand-off. Lets a consultor
 * select several rows in a kanban and refer them all to one colleague in a
 * single action, while keeping themselves as the referrer (commission slice).
 * Mirrors the per-row behaviour of POST /api/crm/referrals (referral_type
 * 'internal'), for the two surfaces that have multi-select:
 *
 *   • negocio_ids → Oportunidades board. Per deal: supersede prior agreement,
 *     INSERT leads_referrals (from=me, to=recipient, %), and UPDATE negocios
 *     SET assigned_consultant_id=recipient, referrer_consultant_id=me,
 *     referral_pct=%. The deal moves to the recipient and shows in my
 *     Referências kanban.
 *   • entry_ids → Leads pipeline board. Per entry: supersede, INSERT
 *     leads_referrals (entry_id, from=me, to=recipient, %), and UPDATE
 *     leads_entries SET assigned_consultant_id=recipient. The lead lands in
 *     the recipient's inbox and shows in my Referências "por qualificar"
 *     sheet; any future négocio the recipient makes with that contacto
 *     inherits my slice (resolveInheritedReferralForNegocio).
 *
 * `from_consultant_id` is always the authenticated caller — never trusted
 * from the body. A consultor may only refer rows they own; management roles
 * may refer any. Each id reports its own ok/error so a partial failure never
 * blocks the rest.
 *
 * Body:  { to_consultant_id, referral_pct?, notes?, (negocio_ids | entry_ids) }
 * Returns: { results: [{ id, ok, error? }] }
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const dynamic = 'force-dynamic'

const DEFAULT_REFERRAL_PCT = 25

const BodySchema = z
  .object({
    negocio_ids: z.array(z.string().uuid()).max(100).optional(),
    entry_ids: z.array(z.string().uuid()).max(100).optional(),
    to_consultant_id: z.string().uuid(),
    referral_pct: z.number().min(1).max(100).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (d) => (d.negocio_ids?.length ? 1 : 0) + (d.entry_ids?.length ? 1 : 0) === 1,
    { message: 'Indique negocio_ids OU entry_ids (exactamente um, não vazio)' },
  )

interface Result {
  id: string
  ok: boolean
  error?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveDefaultPct(supabase: any): Promise<number> {
  const { data } = await supabase
    .from('temp_agency_settings')
    .select('value')
    .eq('key', 'default_referral_pct')
    .maybeSingle()
  const v = parseFloat(data?.value ?? '')
  return Number.isFinite(v) ? v : DEFAULT_REFERRAL_PCT
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const fromConsultantId = auth.user.id
    const canReferAny = isManagementRole(auth.roles)

    const body = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { to_consultant_id, notes } = parsed.data
    const noteValue = notes?.trim() || null

    if (to_consultant_id === fromConsultantId) {
      return NextResponse.json(
        { error: 'Não podes referenciar a ti próprio' },
        { status: 400 },
      )
    }

    const supabase = createCrmAdminClient()
    const effectivePct = parsed.data.referral_pct ?? (await resolveDefaultPct(supabase))

    // Shared per-row hand-off: supersede prior active agreement for the same
    // (contacto, recipient) pair, insert the audit row, then mutate the
    // underlying entity. Rolls the audit row back if the mutation fails so we
    // never leave an agreement pointing at an un-transferred row.
    async function referOne(
      id: string,
      contactId: string,
      auditExtra: Record<string, unknown>,
      applyHandoff: () => Promise<{ error: { message: string } | null }>,
    ): Promise<Result> {
      await supabase
        .from('leads_referrals')
        .update({ status: 'cancelled' })
        .eq('contact_id', contactId)
        .eq('to_consultant_id', to_consultant_id)
        .in('status', ['pending', 'accepted'])

      const { data: audit, error: insertError } = await supabase
        .from('leads_referrals')
        .insert({
          contact_id: contactId,
          referral_type: 'internal',
          from_consultant_id: fromConsultantId,
          to_consultant_id,
          referral_pct: effectivePct,
          notes: noteValue,
          ...auditExtra,
        })
        .select('id')
        .single()

      if (insertError) return { id, ok: false, error: insertError.message }

      const { error: updateError } = await applyHandoff()
      if (updateError) {
        await supabase.from('leads_referrals').delete().eq('id', audit.id)
        return { id, ok: false, error: updateError.message }
      }
      return { id, ok: true }
    }

    const results: Result[] = []

    // ── Oportunidades (négocios) ──────────────────────────────────────────
    if (parsed.data.negocio_ids?.length) {
      const ids = parsed.data.negocio_ids
      const { data: negocios, error } = await supabase
        .from('negocios')
        .select('id, lead_id, assigned_consultant_id')
        .in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const byId = new Map((negocios ?? []).map((n: { id: string }) => [n.id, n]))

      for (const id of ids) {
        const neg = byId.get(id) as
          | { id: string; lead_id: string | null; assigned_consultant_id: string | null }
          | undefined
        if (!neg) { results.push({ id, ok: false, error: 'Negócio não encontrado' }); continue }
        if (!neg.lead_id) { results.push({ id, ok: false, error: 'Negócio sem contacto associado' }); continue }
        if (!canReferAny && neg.assigned_consultant_id !== fromConsultantId) {
          results.push({ id, ok: false, error: 'Não és o responsável por este negócio' }); continue
        }
        results.push(
          await referOne(id, neg.lead_id, { negocio_id: id }, async () => {
            const { error: e } = await supabase
              .from('negocios')
              .update({
                assigned_consultant_id: to_consultant_id,
                referrer_consultant_id: fromConsultantId,
                referral_pct: effectivePct,
              })
              .eq('id', id)
            return { error: e }
          }),
        )
      }
      return NextResponse.json({ results })
    }

    // ── Leads pipeline (lead entries) ─────────────────────────────────────
    const ids = parsed.data.entry_ids!
    const { data: entries, error } = await supabase
      .from('leads_entries')
      .select('id, contact_id, assigned_consultant_id')
      .in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const byId = new Map((entries ?? []).map((e: { id: string }) => [e.id, e]))

    for (const id of ids) {
      const entry = byId.get(id) as
        | { id: string; contact_id: string | null; assigned_consultant_id: string | null }
        | undefined
      if (!entry) { results.push({ id, ok: false, error: 'Lead não encontrada' }); continue }
      if (!entry.contact_id) { results.push({ id, ok: false, error: 'Lead sem contacto associado' }); continue }
      if (!canReferAny && entry.assigned_consultant_id !== fromConsultantId) {
        results.push({ id, ok: false, error: 'Não és o responsável por esta lead' }); continue
      }
      results.push(
        await referOne(id, entry.contact_id, { entry_id: id }, async () => {
          const { error: e } = await supabase
            .from('leads_entries')
            .update({ assigned_consultant_id: to_consultant_id })
            .eq('id', id)
          return { error: e }
        }),
      )
    }
    return NextResponse.json({ results })
  } catch (err) {
    console.error('[referrals/bulk]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
