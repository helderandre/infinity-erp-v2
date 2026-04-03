import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createLeadEntrySchema } from '@/lib/validations/lead-entry'

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from('leads_settings').select('key, value')
  const map: Record<string, string> = {}
  for (const s of data || []) map[s.key] = s.value
  return map
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+')
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  return email.trim().toLowerCase()
}

// ─── GET: List lead entries ───────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const consultant_id = searchParams.get('consultant_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('leads_entries')
      .select(`
        *,
        contact:leads!leads_entries_contact_id_fkey(
          id, nome, email, telemovel, agent_id,
          agent:dev_users!leads_agent_id_fkey(id, commercial_name)
        ),
        campaign:leads_campaigns(id, name, platform),
        assigned_consultant:dev_users!leads_entries_assigned_consultant_id_fkey(id, commercial_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const contact_id = searchParams.get('contact_id')

    if (status) query = query.eq('status', status)
    if (source) query = query.eq('source', source)
    if (consultant_id) query = query.eq('assigned_consultant_id', consultant_id)
    if (contact_id) query = query.eq('contact_id', contact_id)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar lead entries:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// ─── POST: Create lead entry with matching ────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createLeadEntrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const input = parsed.data
    const settings = await getSettings(supabase)

    const normPhone = normalizePhone(input.raw_phone)
    const normEmail = normalizeEmail(input.raw_email)

    // ── Step 1: Match against existing contacts (leads table) ──

    let phoneMatch: any = null
    let emailMatch: any = null

    if (normPhone) {
      // Try telemovel first, then telefone
      const { data: byTelemovel } = await supabase
        .from('leads')
        .select('id, nome, telemovel, email, agent_id')
        .eq('telemovel', normPhone)
        .maybeSingle()

      if (byTelemovel) {
        phoneMatch = byTelemovel
      } else {
        const { data: byTelefone } = await supabase
          .from('leads')
          .select('id, nome, telemovel, email, agent_id')
          .eq('telefone', normPhone)
          .maybeSingle()
        phoneMatch = byTelefone
      }
    }

    if (normEmail) {
      const { data } = await supabase
        .from('leads')
        .select('id, nome, telemovel, email, agent_id')
        .eq('email', normEmail)
        .maybeSingle()
      emailMatch = data
    }

    // ── Step 2: Determine match type ──

    let matchType: string | null = null
    let matchedContactId: string | null = null
    let isDuplicateConflict = false

    const matchPriority = settings.match_priority || 'phone_first'

    if (phoneMatch && emailMatch) {
      if (phoneMatch.id === emailMatch.id) {
        matchType = 'both'
        matchedContactId = phoneMatch.id
      } else {
        // Different contacts for phone vs email — conflict
        isDuplicateConflict = true
        matchType = matchPriority === 'phone_first' ? 'phone' : 'email'
        matchedContactId = matchPriority === 'phone_first' ? phoneMatch.id : emailMatch.id
      }
    } else if (phoneMatch) {
      matchType = 'phone'
      matchedContactId = phoneMatch.id
    } else if (emailMatch) {
      matchType = 'email'
      matchedContactId = emailMatch.id
    } else {
      matchType = 'none'
    }

    const matchDetails: Record<string, unknown> = {
      matched_by_phone: !!phoneMatch,
      matched_by_email: !!emailMatch,
      phone_contact_id: phoneMatch?.id || null,
      email_contact_id: emailMatch?.id || null,
      is_duplicate_conflict: isDuplicateConflict,
    }

    // ── Step 3: Create or link contact ──

    let contactId: string

    if (matchedContactId) {
      contactId = matchedContactId
      matchDetails.matched_contact_id = matchedContactId
    } else {
      // No match — auto-create contact if setting enabled
      const autoCreate = settings.auto_create_contact !== 'false'

      if (autoCreate) {
        const { data: newContact, error: createError } = await supabase
          .from('leads')
          .insert({
            nome: input.raw_name,
            email: normEmail || null,
            telemovel: normPhone || null,
            estado: 'Novo',
            origem: input.source,
            agent_id: input.assigned_consultant_id || null,
          })
          .select('id')
          .single()

        if (createError) {
          return NextResponse.json({ error: 'Erro ao criar contacto: ' + createError.message }, { status: 500 })
        }
        contactId = newContact.id
      } else {
        return NextResponse.json({ error: 'Nenhum contacto correspondente e criacao automatica desactivada' }, { status: 400 })
      }
    }

    // ── Step 4: Determine assignment ──

    let assignedConsultantId = input.assigned_consultant_id || null

    if (matchedContactId && !assignedConsultantId) {
      const assignmentMode = settings.assignment_mode || 'existing_consultant'
      const matchedContact = phoneMatch?.id === matchedContactId ? phoneMatch : emailMatch

      if (assignmentMode === 'existing_consultant' && matchedContact?.agent_id) {
        assignedConsultantId = matchedContact.agent_id
      }
      // round_robin and manual modes: leave null for admin to assign
    }

    // ── Step 5: Insert lead entry ──

    const { data: entry, error: entryError } = await supabase
      .from('leads_entries')
      .insert({
        contact_id: contactId,
        source: input.source,
        campaign_id: input.campaign_id || null,
        partner_id: input.partner_id || null,
        utm_source: input.utm_source || null,
        utm_medium: input.utm_medium || null,
        utm_campaign: input.utm_campaign || null,
        utm_content: input.utm_content || null,
        utm_term: input.utm_term || null,
        form_data: input.form_data || null,
        form_url: input.form_url || null,
        raw_name: input.raw_name,
        raw_email: normEmail,
        raw_phone: normPhone,
        match_type: matchType,
        match_details: matchDetails,
        status: 'new',
        assigned_consultant_id: assignedConsultantId,
        notes: input.notes || null,
        sector: input.sector || null,
        has_referral: input.has_referral || false,
        referral_pct: input.referral_pct ?? null,
        referral_consultant_id: input.referral_consultant_id || null,
        referral_external_name: input.referral_external_name || null,
        referral_external_phone: input.referral_external_phone || null,
        referral_external_email: input.referral_external_email || null,
        referral_external_agency: input.referral_external_agency || null,
      })
      .select()
      .single()

    if (entryError) {
      return NextResponse.json({ error: entryError.message }, { status: 500 })
    }

    // ── Step 6: If recruitment sector, also create a recruitment_candidates record ──

    if (input.sector === 'recruitment') {
      // Map lead entry source to recruitment candidate source
      const sourceMap: Record<string, string> = {
        meta_ads: 'paid_campaign', google_ads: 'paid_campaign',
        social_media: 'social_media', partner: 'referral',
        organic: 'inbound', website: 'inbound', landing_page: 'inbound',
        walk_in: 'inbound', phone_call: 'inbound',
      }
      const candidateSource = sourceMap[input.source] || 'other'

      await supabase.from('recruitment_candidates').insert({
        full_name: input.raw_name,
        phone: normPhone || null,
        email: normEmail || null,
        source: candidateSource,
        source_detail: input.source,
        status: 'prospect',
        assigned_recruiter_id: assignedConsultantId || null,
        notes: input.notes || null,
        first_contact_date: new Date().toISOString().split('T')[0],
      })
    }

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar lead entry:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
