import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInviteByToken, isInviteUsable } from '@/lib/owner-invites/server'
import {
  findPropertySlot,
  slotToDocTypeNamePatterns,
} from '@/lib/owner-invites/property-doc-slots'

const schema = z.object({
  slot_slug: z.string(),
  file_url: z.string().url(),
  file_name: z.string(),
  file_size: z.number().int().nonnegative(),
  mime_type: z.string(),
  r2_key: z.string(),
})

// Register a property doc that was already uploaded to R2 (e.g. via the
// generic /upload endpoint during the smart-classify flow). No file move
// happens — we just create the doc_registry row pointing to the existing
// URL. Race-tolerant: if the same slot is registered twice, both rows
// stay; the GET status endpoint surfaces the most recent.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invite = await loadInviteByToken(token)
  if (!invite) {
    return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })
  }
  const usable = isInviteUsable(invite)
  if (!usable.ok) {
    return NextResponse.json(
      { error: 'Convite indisponível', reason: usable.reason },
      { status: 410 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const slot = findPropertySlot(parsed.data.slot_slug)
  if (!slot) {
    return NextResponse.json({ error: 'Slot inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const patterns = slotToDocTypeNamePatterns(slot.slug)
  let docTypeId: string | null = null
  if (patterns.length) {
    const orFilter = patterns.map((p) => `name.ilike.%${p}%`).join(',')
    const { data } = await admin
      .from('doc_types')
      .select('id, name')
      .or(orFilter)
      .limit(1)
    if (data && data.length) docTypeId = data[0].id
  }

  const { error } = await admin.from('doc_registry').insert({
    property_id: invite.property_id,
    owner_id: null,
    doc_type_id: docTypeId,
    file_url: parsed.data.file_url,
    file_name: parsed.data.file_name,
    uploaded_by: invite.created_by,
    status: 'active',
    notes: slot.label,
    metadata: {
      size: parsed.data.file_size,
      mimetype: parsed.data.mime_type,
      r2_key: parsed.data.r2_key,
      slot_slug: slot.slug,
      source: 'public_owner_invite',
    },
  } as any)

  if (error) {
    console.error('property-docs register error:', error)
    return NextResponse.json(
      { error: 'Erro a registar documento' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, slot_slug: slot.slug }, { status: 201 })
}
