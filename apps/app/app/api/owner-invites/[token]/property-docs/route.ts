import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInviteByToken, isInviteUsable } from '@/lib/owner-invites/server'
import {
  PROPERTY_DOC_SLOTS,
  slotToDocTypeNamePatterns,
} from '@/lib/owner-invites/property-doc-slots'

interface SlotStatus {
  slug: string
  label: string
  description?: string
  required: boolean
  status: 'present' | 'missing'
  file_name?: string
  uploaded_at?: string
}

// Public — returns the upload status of each property doc slot for the
// imóvel scoped to this token. A slot is "present" if there is at least
// one active doc_registry row for the property whose either:
//   - doc_type.name matches the slot's label/aliases, OR
//   - metadata.slot_slug equals the slot.slug (for invite-uploaded rows).
export async function GET(
  _request: Request,
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

  const admin = createAdminClient()

  // Pull every active property-scoped doc + the doc_type name + metadata.
  const { data: rows, error } = await admin
    .from('doc_registry')
    .select(
      'id, file_name, file_url, metadata, created_at, doc_type:doc_types(name)'
    )
    .eq('property_id', invite.property_id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('property-docs status error:', error)
    return NextResponse.json({ error: 'Erro ao carregar' }, { status: 500 })
  }

  const list = (rows || []) as Array<{
    id: string
    file_name: string
    file_url: string
    metadata: Record<string, unknown> | null
    created_at: string
    doc_type: { name: string | null } | null
  }>

  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()

  const slots: SlotStatus[] = PROPERTY_DOC_SLOTS.map((slot) => {
    const patterns = slotToDocTypeNamePatterns(slot.slug).map(norm)
    const match = list.find((r) => {
      const slotSlug =
        (r.metadata && (r.metadata as any).slot_slug) || undefined
      if (slotSlug === slot.slug) return true
      const name = r.doc_type?.name ? norm(r.doc_type.name) : null
      if (!name) return false
      return patterns.some((p) => name.includes(p) || p.includes(name))
    })
    if (match) {
      return {
        slug: slot.slug,
        label: slot.label,
        description: slot.description,
        required: slot.required,
        status: 'present',
        file_name: match.file_name,
        uploaded_at: match.created_at,
      }
    }
    return {
      slug: slot.slug,
      label: slot.label,
      description: slot.description,
      required: slot.required,
      status: 'missing',
    }
  })

  return NextResponse.json({ slots })
}
