import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/permissions'

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const dateRegex = /^\d{4}-\d{2}-\d{2}$/

const ruleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(timeRegex, 'Hora inválida'),
  end_time: z.string().regex(timeRegex, 'Hora inválida'),
  active: z.boolean().optional().default(true),
})

const settingsSchema = z.object({
  slot_duration_minutes: z.number().int().min(5).max(240),
  buffer_minutes: z.number().int().min(0).max(240),
  advance_days: z.number().int().min(1).max(180),
  min_notice_hours: z.number().int().min(0).max(168),
  public_booking_enabled: z.boolean(),
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
  settings: settingsSchema,
  windows: z.array(windowSchema).optional().default([]),
  overrides: z.array(overrideSchema).optional().default([]),
})

const DEFAULT_SETTINGS = {
  slot_duration_minutes: 30,
  buffer_minutes: 0,
  advance_days: 30,
  min_notice_hours: 24,
  public_booking_enabled: false,
}

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const consultantId = auth.user.id

  const [rulesRes, settingsRes, windowsRes, overridesRes] = await Promise.all([
    supabase
      .from('consultant_availability_rules')
      .select('id, day_of_week, start_time, end_time, active')
      .eq('consultant_id', consultantId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase
      .from('consultant_booking_settings')
      .select('*')
      .eq('consultant_id', consultantId)
      .maybeSingle(),
    sb
      .from('consultant_booking_windows')
      .select('id, start_date, end_date, note, active')
      .eq('consultant_id', consultantId)
      .order('start_date', { ascending: true }),
    sb
      .from('consultant_date_overrides')
      .select('id, override_date, blocked, start_time, end_time, note')
      .eq('consultant_id', consultantId)
      .order('override_date', { ascending: true }),
  ])

  return NextResponse.json({
    rules: rulesRes.data ?? [],
    settings: settingsRes.data ?? { consultant_id: consultantId, ...DEFAULT_SETTINGS },
    windows: windowsRes.data ?? [],
    overrides: overridesRes.data ?? [],
  })
}

export async function PUT(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

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
  const consultantId = auth.user.id

  // Replace-all for all four sets
  const [delRules, delWin, delOvr] = await Promise.all([
    supabase.from('consultant_availability_rules').delete().eq('consultant_id', consultantId),
    sb.from('consultant_booking_windows').delete().eq('consultant_id', consultantId),
    sb.from('consultant_date_overrides').delete().eq('consultant_id', consultantId),
  ])
  if (delRules.error || delWin.error || delOvr.error) {
    return NextResponse.json(
      { error: 'Erro ao actualizar', details: delRules.error?.message || delWin.error?.message || delOvr.error?.message },
      { status: 500 }
    )
  }

  if (parsed.data.rules.length > 0) {
    const { error } = await supabase.from('consultant_availability_rules').insert(
      parsed.data.rules.map((r) => ({
        consultant_id: consultantId,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        active: r.active ?? true,
      }))
    )
    if (error) return NextResponse.json({ error: 'Erro ao guardar regras', details: error.message }, { status: 500 })
  }

  if (parsed.data.windows.length > 0) {
    const { error } = await sb.from('consultant_booking_windows').insert(
      parsed.data.windows.map((w) => ({
        consultant_id: consultantId,
        start_date: w.start_date,
        end_date: w.end_date,
        note: w.note ?? null,
        active: w.active ?? true,
      }))
    )
    if (error) return NextResponse.json({ error: 'Erro ao guardar janelas', details: error.message }, { status: 500 })
  }

  if (parsed.data.overrides.length > 0) {
    const { error } = await sb.from('consultant_date_overrides').insert(
      parsed.data.overrides.map((o) => ({
        consultant_id: consultantId,
        override_date: o.override_date,
        blocked: o.blocked,
        start_time: o.blocked ? null : (o.start_time ?? null),
        end_time: o.blocked ? null : (o.end_time ?? null),
        note: o.note ?? null,
      }))
    )
    if (error) return NextResponse.json({ error: 'Erro ao guardar overrides', details: error.message }, { status: 500 })
  }

  const { error: settingsError } = await supabase
    .from('consultant_booking_settings')
    .upsert(
      {
        consultant_id: consultantId,
        ...parsed.data.settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'consultant_id' }
    )

  if (settingsError) {
    return NextResponse.json({ error: 'Erro ao guardar configurações', details: settingsError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
