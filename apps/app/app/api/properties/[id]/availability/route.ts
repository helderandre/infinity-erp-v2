import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const dateRegex = /^\d{4}-\d{2}-\d{2}$/

const ruleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(timeRegex),
  end_time: z.string().regex(timeRegex),
  active: z.boolean().optional().default(true),
  note: z.string().trim().max(200).optional().nullable(),
})

const windowSchema = z.object({
  start_date: z.string().regex(dateRegex),
  end_date: z.string().regex(dateRegex),
  note: z.string().trim().max(200).optional().nullable(),
  active: z.boolean().optional().default(true),
})

const overrideSchema = z.object({
  override_date: z.string().regex(dateRegex),
  blocked: z.boolean(),
  start_time: z.string().regex(timeRegex).nullable().optional(),
  end_time: z.string().regex(timeRegex).nullable().optional(),
  note: z.string().trim().max(200).optional().nullable(),
})

const putSchema = z.object({
  rules: z.array(ruleSchema),
  windows: z.array(windowSchema).optional().default([]),
  overrides: z.array(overrideSchema).optional().default([]),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('properties')
  if (!auth.authorized) return auth.response

  const { id } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const [rulesRes, windowsRes, overridesRes] = await Promise.all([
    supabase
      .from('property_availability_rules')
      .select('id, day_of_week, start_time, end_time, active, note')
      .eq('property_id', id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }),
    sb
      .from('property_booking_windows')
      .select('id, start_date, end_date, note, active')
      .eq('property_id', id)
      .order('start_date', { ascending: true }),
    sb
      .from('property_date_overrides')
      .select('id, override_date, blocked, start_time, end_time, note')
      .eq('property_id', id)
      .order('override_date', { ascending: true }),
  ])

  if (rulesRes.error) {
    return NextResponse.json({ error: rulesRes.error.message }, { status: 500 })
  }

  return NextResponse.json({
    rules: rulesRes.data ?? [],
    windows: windowsRes.data ?? [],
    overrides: overridesRes.data ?? [],
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('properties')
  if (!auth.authorized) return auth.response

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  for (const rule of parsed.data.rules) {
    if (rule.end_time <= rule.start_time) {
      return NextResponse.json({ error: 'Hora de fim tem de ser posterior à de início' }, { status: 400 })
    }
  }
  for (const w of parsed.data.windows) {
    if (w.end_date < w.start_date) {
      return NextResponse.json({ error: 'Data de fim tem de ser igual ou posterior à de início' }, { status: 400 })
    }
  }
  for (const o of parsed.data.overrides) {
    if (!o.blocked) {
      if (!o.start_time || !o.end_time) {
        return NextResponse.json({ error: 'Override com horário precisa de start_time e end_time' }, { status: 400 })
      }
      if (o.end_time <= o.start_time) {
        return NextResponse.json({ error: 'Hora de fim tem de ser posterior à de início no override' }, { status: 400 })
      }
    }
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Replace-all
  const [delRules, delWin, delOvr] = await Promise.all([
    supabase.from('property_availability_rules').delete().eq('property_id', id),
    sb.from('property_booking_windows').delete().eq('property_id', id),
    sb.from('property_date_overrides').delete().eq('property_id', id),
  ])
  if (delRules.error || delWin.error || delOvr.error) {
    return NextResponse.json(
      { error: 'Erro ao actualizar', details: delRules.error?.message || delWin.error?.message || delOvr.error?.message },
      { status: 500 }
    )
  }

  if (parsed.data.rules.length > 0) {
    const { error } = await supabase.from('property_availability_rules').insert(
      parsed.data.rules.map((r) => ({
        property_id: id,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        active: r.active ?? true,
        note: r.note ?? null,
      }))
    )
    if (error) return NextResponse.json({ error: 'Erro ao guardar regras', details: error.message }, { status: 500 })
  }

  if (parsed.data.windows.length > 0) {
    const { error } = await sb.from('property_booking_windows').insert(
      parsed.data.windows.map((w) => ({
        property_id: id,
        start_date: w.start_date,
        end_date: w.end_date,
        note: w.note ?? null,
        active: w.active ?? true,
      }))
    )
    if (error) return NextResponse.json({ error: 'Erro ao guardar janelas', details: error.message }, { status: 500 })
  }

  if (parsed.data.overrides.length > 0) {
    const { error } = await sb.from('property_date_overrides').insert(
      parsed.data.overrides.map((o) => ({
        property_id: id,
        override_date: o.override_date,
        blocked: o.blocked,
        start_time: o.blocked ? null : (o.start_time ?? null),
        end_time: o.blocked ? null : (o.end_time ?? null),
        note: o.note ?? null,
      }))
    )
    if (error) return NextResponse.json({ error: 'Erro ao guardar overrides', details: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
