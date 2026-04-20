import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateSlots,
  type AvailabilityRule,
  type BookingSettings,
  type BookingWindow,
  type DateOverride,
  type ExistingVisit,
} from '@/lib/booking/slot-generator'

// Public endpoint — returns available slot start-times per date.
// Query params: from=YYYY-MM-DD, to=YYYY-MM-DD (max 60 days range)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertySlug: string }> }
) {
  try {
    const { propertySlug } = await params
    const url = new URL(request.url)
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')

    if (!fromParam || !toParam) {
      return NextResponse.json({ error: 'Parâmetros from e to obrigatórios' }, { status: 400 })
    }

    const fromDate = new Date(fromParam)
    const toDate = new Date(toParam)
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 })
    }
    const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    if (rangeDays < 0 || rangeDays > 62) {
      return NextResponse.json({ error: 'Intervalo excede 62 dias' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: property, error: propertyError } = await supabase
      .from('dev_properties')
      .select('id, consultant_id')
      .eq('slug', propertySlug)
      .maybeSingle()

    if (propertyError || !property || !property.consultant_id) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const { data: settingsRow } = await supabase
      .from('consultant_booking_settings')
      .select('*')
      .eq('consultant_id', property.consultant_id)
      .maybeSingle()

    // Only block if explicitly disabled; missing row means "use defaults + enabled"
    if (settingsRow && !settingsRow.public_booking_enabled) {
      return NextResponse.json({ slots: {} })
    }

    const settings: BookingSettings = {
      slot_duration_minutes: settingsRow?.slot_duration_minutes ?? 30,
      buffer_minutes: settingsRow?.buffer_minutes ?? 0,
      advance_days: settingsRow?.advance_days ?? 30,
      min_notice_hours: settingsRow?.min_notice_hours ?? 24,
      public_booking_enabled: true,
    }

    // Rules: property overrides replace consultant rules completely when any active row exists
    const { data: propertyRules } = await supabase
      .from('property_availability_rules')
      .select('day_of_week, start_time, end_time, active')
      .eq('property_id', property.id)
      .eq('active', true)

    let rules: AvailabilityRule[] = []
    if (propertyRules && propertyRules.length > 0) {
      rules = propertyRules
    } else {
      const { data: consultantRules } = await supabase
        .from('consultant_availability_rules')
        .select('day_of_week, start_time, end_time, active')
        .eq('consultant_id', property.consultant_id)
        .eq('active', true)
      rules = consultantRules ?? []
    }

    if (rules.length === 0) {
      return NextResponse.json({ slots: {} })
    }

    // Existing visits for the consultant in the requested window
    const { data: visitsRows } = await supabase
      .from('visits')
      .select('visit_date, visit_time, duration_minutes')
      .eq('consultant_id', property.consultant_id)
      .gte('visit_date', fromParam)
      .lte('visit_date', toParam)
      .in('status', ['proposal', 'scheduled'])

    const existingVisits: ExistingVisit[] = (visitsRows ?? [])
      .filter((v) => v.visit_date && v.visit_time)
      .map((v) => ({
        visit_date: v.visit_date as string,
        visit_time: v.visit_time as string,
        duration_minutes: v.duration_minutes,
      }))

    // Booking windows: property level REPLACES consultant level when any exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: propWindows } = await sb
      .from('property_booking_windows')
      .select('start_date, end_date, active')
      .eq('property_id', property.id)
      .eq('active', true)
      .gte('end_date', fromParam)
      .lte('start_date', toParam)

    let windows: BookingWindow[] = []
    if (propWindows && propWindows.length > 0) {
      windows = propWindows
    } else {
      const { data: consultWindows } = await sb
        .from('consultant_booking_windows')
        .select('start_date, end_date, active')
        .eq('consultant_id', property.consultant_id)
        .eq('active', true)
        .gte('end_date', fromParam)
        .lte('start_date', toParam)
      windows = consultWindows ?? []
    }

    // Date overrides: per-date — property takes precedence over consultant for a given date
    const { data: propOverrides } = await sb
      .from('property_date_overrides')
      .select('override_date, blocked, start_time, end_time')
      .eq('property_id', property.id)
      .gte('override_date', fromParam)
      .lte('override_date', toParam)

    const { data: consultOverrides } = await sb
      .from('consultant_date_overrides')
      .select('override_date, blocked, start_time, end_time')
      .eq('consultant_id', property.consultant_id)
      .gte('override_date', fromParam)
      .lte('override_date', toParam)

    const overrideMap = new Map<string, DateOverride>()
    for (const o of (consultOverrides ?? []) as DateOverride[]) {
      overrideMap.set(o.override_date, o)
    }
    for (const o of (propOverrides ?? []) as DateOverride[]) {
      overrideMap.set(o.override_date, o) // property wins for that date
    }
    const overrides = Array.from(overrideMap.values())

    const slots = generateSlots({
      fromDate,
      toDate,
      rules,
      settings,
      existingVisits,
      windows,
      overrides,
    })

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Erro a gerar slots:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
