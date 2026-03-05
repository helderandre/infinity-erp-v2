import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createAdminClient } from '@/lib/supabase/admin'

const webhookSecret = process.env.RESEND_WEBHOOK_SECRET!

interface ResendWebhookPayload {
  type: string
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    bounce?: { message: string; type: string; subType: string }
    click?: { ipAddress: string; link: string; timestamp: string; userAgent: string }
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  let event: ResendWebhookPayload
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // Use untyped db accessor for columns not yet in generated types
  const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
  const resendEmailId = event.data.email_id
  const eventType = event.type.replace('email.', '')

  // 1. Buscar log_emails pelo resend_email_id
  const { data: rawLogEmail } = await db.from('log_emails')
    .select('id, proc_task_id, proc_subtask_id, events')
    .eq('resend_email_id', resendEmailId)
    .single()

  const logEmail = rawLogEmail as { id: string; proc_task_id: string | null; proc_subtask_id: string | null; events: unknown[] } | null

  if (!logEmail) {
    return NextResponse.json({ received: true, matched: false })
  }

  // 2. Actualizar status e append ao histórico de eventos
  const events = Array.isArray(logEmail.events) ? logEmail.events : []
  events.push({
    type: eventType,
    timestamp: event.created_at,
    metadata: event.data.bounce || event.data.click || null,
  })

  await db.from('log_emails').update({
    last_event: eventType,
    delivery_status: eventType,
    events,
    ...(event.data.bounce && { error_message: event.data.bounce.message }),
  }).eq('id', logEmail.id)

  // 3. Logar actividade na tarefa
  if (logEmail.proc_task_id) {
    const activityMap: Record<string, string> = {
      delivered: 'email_delivered',
      opened: 'email_opened',
      clicked: 'email_clicked',
      bounced: 'email_bounced',
      failed: 'email_failed',
      complained: 'email_bounced',
    }
    const activityType = activityMap[eventType]
    if (activityType) {
      await db.from('proc_task_activities').insert({
        proc_task_id: logEmail.proc_task_id,
        user_id: null,
        activity_type: activityType,
        description: `Email ${eventType}: ${event.data.subject}`,
        metadata: {
          resend_email_id: resendEmailId,
          event_type: eventType,
          recipient: event.data.to?.[0],
          ...(event.data.bounce && { bounce: event.data.bounce }),
          ...(event.data.click && { click: event.data.click }),
        },
      })
    }
  }

  return NextResponse.json({ received: true })
}
