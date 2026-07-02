/**
 * Ingestão de candidatos de Recrutamento a partir de campanhas Meta.
 *
 * Quando a regra de atribuição de uma campanha/anúncio declara
 * lead_sector='recruitment', o bridge Meta→CRM (lib/mube/handlers.ts) desvia o
 * lead para aqui em vez de o entregar ao ingestLead do CRM de vendas: cria uma
 * row em recruitment_candidates (status 'novo', source 'paid_campaign') e o
 * lead NUNCA toca em leads/leads_entries — decisão do stakeholder (2026-07-02).
 *
 * Idempotência: por meta_leadgen_id (unique parcial na tabela — re-entregas do
 * webhook devolvem o candidato existente) e dedupe soft por email/telefone
 * (nova candidatura da mesma pessoa reactiva o candidato existente em vez de
 * duplicar).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>

export interface IngestRecruitmentInput {
  name: string
  email?: string | null
  phone?: string | null
  form_data?: Record<string, unknown> | null
  notes?: string | null
  /** Consultor/recrutador da regra de atribuição. */
  assigned_recruiter_id?: string | null
}

export interface IngestRecruitmentResult {
  candidate_id: string
  already_existed: boolean
}

export async function ingestRecruitmentCandidate(
  supabase: SupabaseClient,
  input: IngestRecruitmentInput,
): Promise<IngestRecruitmentResult> {
  const leadgenId = typeof input.form_data?.leadgen_id === 'string' ? (input.form_data.leadgen_id as string) : null
  const campaignExternalId = typeof input.form_data?.meta_campaign_id === 'string' ? (input.form_data.meta_campaign_id as string) : null
  const adExternalId = typeof input.form_data?.meta_ad_id === 'string' ? (input.form_data.meta_ad_id as string) : null

  // 1. Idempotência dura — re-entrega do mesmo lead Meta.
  if (leadgenId) {
    const { data: existing } = await supabase
      .from('recruitment_candidates')
      .select('id')
      .eq('meta_leadgen_id', leadgenId)
      .limit(1)
      .maybeSingle()
    if (existing?.id) return { candidate_id: existing.id, already_existed: true }
  }

  // 2. Dedupe soft — a mesma pessoa voltou a candidatar-se (outra campanha ou
  //    re-submissão). Reactiva o candidato existente: actualiza a última
  //    interacção e carimba o leadgen_id se ainda estiver vazio (para a
  //    idempotência dura apanhar re-entregas futuras).
  let existingId: string | null = null
  if (input.email) {
    const { data } = await supabase
      .from('recruitment_candidates')
      .select('id, meta_leadgen_id')
      .eq('email', input.email)
      .limit(1)
      .maybeSingle()
    if (data?.id) existingId = data.id
  }
  if (!existingId && input.phone) {
    const { data } = await supabase
      .from('recruitment_candidates')
      .select('id, meta_leadgen_id')
      .eq('phone', input.phone)
      .limit(1)
      .maybeSingle()
    if (data?.id) existingId = data.id
  }
  if (existingId) {
    const patch: Record<string, unknown> = {
      last_interaction_date: new Date().toISOString().split('T')[0],
    }
    if (leadgenId) patch.meta_leadgen_id = leadgenId
    await supabase.from('recruitment_candidates').update(patch).eq('id', existingId)
    return { candidate_id: existingId, already_existed: true }
  }

  // 3. Criar o candidato.
  const { data: candidate, error } = await supabase
    .from('recruitment_candidates')
    .insert({
      full_name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      source: 'paid_campaign',
      source_detail: 'meta_ads',
      status: 'novo',
      assigned_recruiter_id: input.assigned_recruiter_id || null,
      notes: input.notes || null,
      meta_leadgen_id: leadgenId,
      campaign_external_id: campaignExternalId,
      ad_external_id: adExternalId,
      form_data: input.form_data || null,
    })
    .select('id')
    .single()

  if (error || !candidate) {
    throw new Error(`Failed to create recruitment candidate: ${error?.message}`)
  }

  // 4. Stage log (best-effort — não bloqueia a ingestão).
  try {
    await supabase.from('recruitment_stage_log').insert({
      candidate_id: candidate.id,
      from_status: null,
      to_status: 'novo',
      changed_by: null,
      notes: 'Candidato criado automaticamente (campanha Meta — atribuição Recrutamento)',
    })
  } catch {
    /* best-effort */
  }

  // 5. Push ao recrutador atribuído (fire-and-forget).
  if (input.assigned_recruiter_id) {
    import('./send-push')
      .then(({ sendPushToUser }) =>
        sendPushToUser(supabase, input.assigned_recruiter_id!, {
          title: 'Novo candidato de recrutamento',
          body: `${input.name} — via Meta Ads`,
          url: `/dashboard/recrutamento/${candidate.id}`,
          tag: `recruitment-candidate-${candidate.id}`,
        }),
      )
      .catch(() => {})
  }

  return { candidate_id: candidate.id, already_existed: false }
}
