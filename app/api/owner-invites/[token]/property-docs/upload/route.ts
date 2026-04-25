import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { sanitizeFileName } from '@/lib/r2/documents'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInviteByToken, isInviteUsable } from '@/lib/owner-invites/server'
import { MAX_FILE_SIZE } from '@/lib/validations/document'
import {
  findPropertySlot,
  slotToDocTypeNamePatterns,
} from '@/lib/owner-invites/property-doc-slots'

const ALLOWED_EXT = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'doc',
  'docx',
]

// Public upload of a property-scoped document. Files land under the
// existing imoveis/{propertyId}/... convention and get a doc_registry row
// linked to the property (no owner_id). uploaded_by is set to the invite
// creator so the consultant retains attribution.
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

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const slotSlug = (formData.get('slot_slug') as string | null) || ''
  const slot = findPropertySlot(slotSlug)

  if (!file) {
    return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
  }
  if (!slot) {
    return NextResponse.json({ error: 'Slot inválido' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Ficheiro demasiado grande. Máximo: 20MB' },
      { status: 400 }
    )
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json(
      { error: `Formato não permitido. Aceite: ${ALLOWED_EXT.join(', ')}` },
      { status: 400 }
    )
  }

  const basePath = `${process.env.R2_DOCUMENTS_PATH || 'imoveis'}/${invite.property_id}`
  const key = `${basePath}/${Date.now()}-${sanitizeFileName(file.name)}`

  try {
    const s3 = getR2Client()
    const buffer = Buffer.from(await file.arrayBuffer())
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )
  } catch (err) {
    console.error('Erro no upload R2 (property doc):', err)
    return NextResponse.json(
      { error: 'Erro ao carregar ficheiro' },
      { status: 500 }
    )
  }

  const url = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key

  // Best-effort: resolve doc_type_id by matching the slot's label/aliases
  // against doc_types.name. Fall back to null if no match.
  const admin = createAdminClient()
  const patterns = slotToDocTypeNamePatterns(slotSlug)
  let docTypeId: string | null = null
  if (patterns.length) {
    const orFilter = patterns.map((p) => `name.ilike.%${p}%`).join(',')
    const { data: docTypes } = await admin
      .from('doc_types')
      .select('id, name')
      .or(orFilter)
      .limit(1)
    if (docTypes && docTypes.length) docTypeId = docTypes[0].id
  }

  const { error: insertError } = await admin.from('doc_registry').insert({
    property_id: invite.property_id,
    owner_id: null,
    doc_type_id: docTypeId,
    file_url: url,
    file_name: file.name,
    uploaded_by: invite.created_by,
    status: 'active',
    notes: slot.label,
    metadata: {
      size: file.size,
      mimetype: file.type,
      r2_key: key,
      slot_slug: slot.slug,
      source: 'public_owner_invite',
    },
  } as any)

  if (insertError) {
    console.error('doc_registry insert error:', insertError)
    return NextResponse.json(
      { error: 'Erro a registar documento' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      slot_slug: slot.slug,
      file_url: url,
      file_name: file.name,
    },
    { status: 201 }
  )
}
