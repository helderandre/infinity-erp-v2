import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { assertContactOwner } from '@/lib/whatsapp/authorize'

/**
 * Link a wpp_contact directly to a lead (or owner). Used when the agent creates
 * a new contacto from WhatsApp — we want the link to be immediate without
 * waiting for a full auto-match scan.
 *
 * POST { lead_id?: string; owner_id?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params

    const auth = await assertContactOwner(contactId)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { lead_id, owner_id } = body as { lead_id?: string; owner_id?: string }

    if (!lead_id && !owner_id) {
      return NextResponse.json(
        { error: 'lead_id ou owner_id é obrigatório' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (lead_id) {
      patch.lead_id = lead_id
      patch.owner_id = null // lead takes precedence
    } else if (owner_id) {
      patch.owner_id = owner_id
    }

    const { error } = await supabase
      .from('wpp_contacts')
      .update(patch)
      .eq('id', contactId)
      .eq('instance_id', auth.data.instanceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[whatsapp/contacts/link]', err)
    return NextResponse.json({ error: 'Erro ao vincular contacto' }, { status: 500 })
  }
}
