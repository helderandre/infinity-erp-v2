/**
 * GET /api/analise-meta/forms/[form_id]
 *
 * Form-detail bundle for the glassmorphic FormDetailSheet. Returns the form, its
 * questions, response statistics (answer distribution per question, computed
 * server-side), lead total, and recent leads.
 *
 * Reads the `meta` schema via the admin client; gated by an authenticated session.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATS_SCAN = 5000

interface FormQuestion {
  id: string
  key: string
  label: string
  type: string
  options?: Array<{ key: string; value: string }>
}

interface LeadEnvelope {
  lead?: { field_data?: Array<{ name: string; values: string[] }> }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ form_id: string }> }) {
  const { form_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const db = createCrmAdminClient()

  const { data: form } = await db
    .schema('meta')
    .from('meta_forms_raw')
    .select('form_id, form_name, status, locale, fb_created_time, payload')
    .eq('form_id', form_id)
    .maybeSingle()

  if (!form) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [countRes, recentRes, statsRes] = await Promise.all([
    db.schema('meta').from('meta_leads_raw').select('id', { count: 'exact', head: true }).eq('form_id', form_id),
    db
      .schema('meta')
      .from('meta_leads_raw')
      .select('id, full_name, email, phone, ad_id, fb_created_time, received_at, processed')
      .eq('form_id', form_id)
      .order('fb_created_time', { ascending: false, nullsFirst: false })
      .order('received_at', { ascending: false })
      .limit(10),
    db.schema('meta').from('meta_leads_raw').select('payload').eq('form_id', form_id).limit(STATS_SCAN),
  ])

  const statsLeads = (statsRes.data ?? []) as Array<{ payload: unknown }>
  const statsTruncated = statsLeads.length >= STATS_SCAN

  // Tally answers: question_key → (answer_value → count).
  const tally = new Map<string, Map<string, number>>()
  for (const l of statsLeads) {
    const fd = (l.payload as LeadEnvelope | undefined)?.lead?.field_data ?? []
    for (const f of fd) {
      if (!f?.name || !Array.isArray(f.values)) continue
      let qmap = tally.get(f.name)
      if (!qmap) {
        qmap = new Map()
        tally.set(f.name, qmap)
      }
      for (const v of f.values) qmap.set(v, (qmap.get(v) ?? 0) + 1)
    }
  }

  const questions: FormQuestion[] =
    (form.payload as { form?: { questions?: FormQuestion[] } })?.form?.questions ?? []

  const stats = questions.map((q) => {
    const qTally = tally.get(q.key)
    let total = 0
    if (qTally) for (const n of qTally.values()) total += n

    let choices: { label: string; count: number }[] | null = null
    if (q.options && q.options.length > 0) {
      choices = q.options
        .map((o) => ({ label: o.value, count: qTally?.get(o.key) ?? 0 }))
        .sort((a, b) => b.count - a.count)
    }
    return { key: q.key, label: q.label, type: q.type, total, choices }
  })

  // Resolve the ad name behind each recent lead (small colored tag in the UI).
  const recent = (recentRes.data ?? []) as Array<{ ad_id: string | null; [k: string]: unknown }>
  const adIds = [...new Set(recent.map((l) => l.ad_id).filter(Boolean) as string[])]
  const adsRes = adIds.length
    ? await db.schema('meta').from('meta_ads_raw').select('ad_id, name').in('ad_id', adIds)
    : { data: [] as { ad_id: string; name: string | null }[] }
  const adNameById = new Map((adsRes.data ?? []).map((a) => [a.ad_id, a.name]))
  const recentLeads = recent.map((l) => ({
    ...l,
    ad_name: l.ad_id ? adNameById.get(l.ad_id) ?? null : null,
  }))

  return NextResponse.json({
    form: {
      form_id: form.form_id,
      form_name: form.form_name,
      status: form.status,
      locale: form.locale,
      fb_created_time: form.fb_created_time,
    },
    totalLeads: countRes.count ?? 0,
    statsTruncated,
    stats,
    recentLeads,
  })
}
