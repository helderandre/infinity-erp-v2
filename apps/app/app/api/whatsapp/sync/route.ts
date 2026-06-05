import { NextResponse } from 'next/server'
import { assertInstanceOwner } from '@/lib/whatsapp/authorize'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, instance_id } = body

    if (!action || !instance_id) {
      return NextResponse.json(
        { error: 'action e instance_id são obrigatórios' },
        { status: 400 }
      )
    }

    const auth = await assertInstanceOwner(instance_id)
    if (!auth.ok) return auth.response

    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-chats-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: errText || 'Erro na edge function' },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Auto-trigger contact match after a successful chats/contacts sync so new
    // contacts get linked to leads/owners without requiring a manual action.
    if (action === 'sync_chats' || action === 'sync_contacts') {
      try {
        const origin = new URL(request.url).origin
        await fetch(`${origin}/api/whatsapp/contacts/auto-match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_id }),
        })
      } catch {
        // Non-fatal — sync already succeeded
      }
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
