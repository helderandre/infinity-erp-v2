import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyProposalCreated } from '@/lib/visits/notifications'
import { sendEmail } from '@/lib/email/send'
import {
  isValidSlot,
  type AvailabilityRule,
  type BookingSettings,
  type BookingWindow,
  type DateOverride,
  type ExistingVisit,
} from '@/lib/booking/slot-generator'

const bookingRequestSchema = z.object({
  name: z.string().trim().min(2, 'Nome obrigatório').max(120),
  email: z.string().trim().email('Email inválido').max(160),
  phone: z.string().trim().min(6, 'Telemóvel inválido').max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida'),
  message: z.string().trim().max(1000).optional(),
  client_type: z.enum(['private', 'consultant']).optional().default('private'),
  client_agency: z.string().trim().max(120).optional(),
}).refine(
  (d) => d.client_type !== 'consultant' || (d.client_agency && d.client_agency.length >= 2),
  { message: 'Agência obrigatória quando és consultor', path: ['client_agency'] }
)

function buildRequestReceivedEmail(params: {
  clientName: string
  propertyTitle: string
  propertySlug: string
  date: string
  time: string
}) {
  const friendly = (() => {
    try {
      return new Date(`${params.date}T00:00:00`).toLocaleDateString('pt-PT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch {
      return params.date
    }
  })()

  return `
    <h2 style="margin:0 0 12px 0; font-size:20px; color:#0a0a0a;">Pedido de visita recebido</h2>
    <p style="margin:0 0 16px 0; color:#4a4a4a; font-size:14px; line-height:1.6;">
      Olá <strong>${params.clientName}</strong>,
    </p>
    <p style="margin:0 0 16px 0; color:#4a4a4a; font-size:14px; line-height:1.6;">
      Recebemos o seu pedido de visita ao imóvel <strong>${params.propertyTitle}</strong>.
      O consultor responsável vai confirmar a disponibilidade em breve e receberá uma nova mensagem nossa.
    </p>
    <div style="background-color:#f5f5f5; border-radius:12px; padding:16px; margin:20px 0;">
      <p style="margin:0 0 6px 0; font-size:12px; color:#6a6a6a; text-transform:uppercase; letter-spacing:0.5px;">Detalhes</p>
      <p style="margin:0; font-size:14px; color:#0a0a0a;"><strong>Data:</strong> ${friendly}</p>
      <p style="margin:0; font-size:14px; color:#0a0a0a;"><strong>Hora:</strong> ${params.time}</p>
    </div>
    <p style="margin:0; color:#6a6a6a; font-size:12px; line-height:1.6;">
      Se não fez este pedido, pode ignorar este email.
    </p>
  `
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ propertySlug: string }> }
) {
  try {
    const { propertySlug } = await params
    const body = await request.json().catch(() => null)
    const parsed = bookingRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const input = parsed.data
    const normalizedTime = input.time.length === 5 ? `${input.time}:00` : input.time

    const supabase = createAdminClient()

    // Fetch property + consultant
    const { data: property, error: propertyError } = await supabase
      .from('dev_properties')
      .select('id, slug, title, consultant_id')
      .eq('slug', propertySlug)
      .maybeSingle()

    if (propertyError || !property || !property.consultant_id) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    // Settings check — only block if explicitly disabled
    const { data: settingsRow } = await supabase
      .from('consultant_booking_settings')
      .select('*')
      .eq('consultant_id', property.consultant_id)
      .maybeSingle()

    if (settingsRow && !settingsRow.public_booking_enabled) {
      return NextResponse.json(
        { error: 'Agendamento público não está disponível' },
        { status: 404 }
      )
    }

    const settings: BookingSettings = {
      slot_duration_minutes: settingsRow?.slot_duration_minutes ?? 30,
      buffer_minutes: settingsRow?.buffer_minutes ?? 0,
      advance_days: settingsRow?.advance_days ?? 30,
      min_notice_hours: settingsRow?.min_notice_hours ?? 24,
      public_booking_enabled: true,
    }

    // Rules: property overrides replace consultant completely when any active row exists
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
      return NextResponse.json(
        { error: 'Sem disponibilidade configurada' },
        { status: 400 }
      )
    }

    // Fetch existing visits for the consultant on the target date
    const { data: visitsRows } = await supabase
      .from('visits')
      .select('visit_date, visit_time, duration_minutes')
      .eq('consultant_id', property.consultant_id)
      .eq('visit_date', input.date)
      .in('status', ['proposal', 'scheduled'])

    const existingVisits: ExistingVisit[] = (visitsRows ?? [])
      .filter((v) => v.visit_date && v.visit_time)
      .map((v) => ({
        visit_date: v.visit_date as string,
        visit_time: v.visit_time as string,
        duration_minutes: v.duration_minutes,
      }))

    // Booking windows + overrides for server-side revalidation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: propWindows } = await sb
      .from('property_booking_windows')
      .select('start_date, end_date, active')
      .eq('property_id', property.id)
      .eq('active', true)

    let windows: BookingWindow[] = []
    if (propWindows && propWindows.length > 0) {
      windows = propWindows
    } else {
      const { data: consultWindows } = await sb
        .from('consultant_booking_windows')
        .select('start_date, end_date, active')
        .eq('consultant_id', property.consultant_id)
        .eq('active', true)
      windows = consultWindows ?? []
    }

    const { data: propOvr } = await sb
      .from('property_date_overrides')
      .select('override_date, blocked, start_time, end_time')
      .eq('property_id', property.id)
      .eq('override_date', input.date)
    const { data: consultOvr } = await sb
      .from('consultant_date_overrides')
      .select('override_date, blocked, start_time, end_time')
      .eq('consultant_id', property.consultant_id)
      .eq('override_date', input.date)

    const overrides: DateOverride[] = ((propOvr && propOvr.length > 0) ? propOvr : (consultOvr ?? [])) as DateOverride[]

    // Revalidate the slot (race condition safety: another booking may have taken it)
    const stillValid = isValidSlot({
      targetDate: input.date,
      targetTime: input.time,
      rules,
      settings,
      existingVisits,
      windows,
      overrides,
    })

    if (!stillValid) {
      return NextResponse.json(
        { error: 'Esse horário já não está disponível. Escolha outro.' },
        { status: 409 }
      )
    }

    // Create visit in proposal state, mark as coming from public booking
    const { data: created, error: insertError } = await supabase
      .from('visits')
      .insert({
        property_id: property.id,
        consultant_id: property.consultant_id,
        seller_consultant_id: property.consultant_id,
        status: 'proposal',
        visit_date: input.date,
        visit_time: normalizedTime,
        duration_minutes: settings.slot_duration_minutes,
        client_name: input.name,
        client_email: input.email,
        client_phone: input.phone,
        booking_source: 'public',
        public_token: crypto.randomUUID(),
        notes: input.message ? input.message : null,
        client_type: input.client_type ?? 'private',
        client_agency: input.client_type === 'consultant' ? (input.client_agency ?? null) : null,
      })
      .select('id, public_token')
      .single()

    if (insertError || !created) {
      console.error('Erro ao criar visita pública:', insertError)
      return NextResponse.json(
        { error: 'Erro ao registar pedido de visita', details: insertError?.message },
        { status: 500 }
      )
    }

    // Create a to-do task for the consultant to respond to this request
    void supabase
      .from('tasks')
      .insert({
        title: `Responder a pedido de visita — ${input.name}`,
        description: `Pedido público de agendamento para ${property.title ?? 'imóvel'} em ${input.date} às ${input.time.slice(0, 5)}.`,
        assigned_to: property.consultant_id,
        created_by: property.consultant_id,
        due_date: input.date,
        priority: 3,
        entity_type: 'visit',
        entity_id: created.id,
      })
      .then(({ error }) => {
        if (error) console.error('[booking task create]', error)
      })

    // Fire-and-forget notifications (don't block the response on failure)
    void notifyProposalCreated(supabase, property.consultant_id, {
      id: created.id,
      property_title: property.title ?? null,
      client_name: input.name,
      visit_date: input.date,
      visit_time: normalizedTime,
    })

    // Confirmation email to the prospect
    void sendEmail({
      to: input.email,
      subject: `Pedido de visita recebido — ${property.title}`,
      bodyHtml: buildRequestReceivedEmail({
        clientName: input.name,
        propertyTitle: property.title ?? 'Imóvel',
        propertySlug: property.slug ?? '',
        date: input.date,
        time: input.time.slice(0, 5),
      }),
    }).catch((err) => console.error('[booking email]', err))

    return NextResponse.json(
      {
        ok: true,
        visit_id: created.id,
        status: 'proposal',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro em POST /api/visita/[propertySlug]/request:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
