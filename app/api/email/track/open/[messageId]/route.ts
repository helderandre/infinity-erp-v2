import { createAdminClient } from '@/lib/supabase/admin'

// 1x1 transparent GIF pixel (43 bytes)
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

const PIXEL_HEADERS = {
  'Content-Type': 'image/gif',
  'Content-Length': String(TRACKING_PIXEL.length),
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
} as const

/**
 * GET /api/email/track/open/[messageId]
 *
 * Regista o evento "opened" para um email e retorna um pixel transparente 1x1.
 * Chamado automaticamente quando o cliente de email carrega a imagem embebida no HTML.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params

  // Retornar pixel imediatamente — o tracking é fire-and-forget
  const pixelResponse = new Response(TRACKING_PIXEL, {
    status: 200,
    headers: PIXEL_HEADERS,
  })

  // Registar evento em background (não bloqueia a resposta)
  void trackOpenEvent(messageId).catch((err) =>
    console.error('[email/track/open] Erro ao registar evento:', err)
  )

  return pixelResponse
}

async function trackOpenEvent(messageId: string) {
  // Validação básica de UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
    return
  }

  const adminDb = createAdminClient()
  const now = new Date().toISOString()

  // 1. Actualizar email_messages — marcar como aberto (apenas a primeira vez)
  const { data: message } = await adminDb
    .from('email_messages')
    .select('id, status')
    .eq('id', messageId)
    .single()

  if (!message) return

  // Actualizar status para 'opened' se ainda não foi
  // Usamos metadata para guardar first_opened_at
  await adminDb
    .from('email_messages')
    .update({
      is_read: true,
    })
    .eq('id', messageId)

  // 2. Actualizar log_emails — registar evento "opened"
  const db = adminDb as unknown as { from: (t: string) => ReturnType<typeof adminDb.from> }

  const { data: logEmail } = await db
    .from('log_emails')
    .select('id, last_event, events, metadata')
    .eq('email_message_id', messageId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  if (!logEmail) return

  const existingEvents = (logEmail as any).events || []
  const existingMetadata = (logEmail as any).metadata || {}

  // Verificar se já foi registado um open (evitar duplicados excessivos)
  const alreadyOpened = existingEvents.some((e: { type: string }) => e.type === 'opened')

  const updatedEvents = [
    ...existingEvents,
    { type: 'opened', timestamp: now },
  ]

  const updatedMetadata = {
    ...existingMetadata,
    ...(!alreadyOpened && { first_opened_at: now }),
    last_opened_at: now,
    open_count: (existingMetadata.open_count || 0) + 1,
  }

  await db
    .from('log_emails')
    .update({
      last_event: 'opened',
      events: updatedEvents,
      delivery_status: 'opened',
      metadata: updatedMetadata,
    })
    .eq('id', (logEmail as any).id)
}
