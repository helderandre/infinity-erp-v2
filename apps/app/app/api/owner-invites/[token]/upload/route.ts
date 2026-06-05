import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { sanitizeFileName } from '@/lib/r2/documents'
import { loadInviteByToken, isInviteUsable } from '@/lib/owner-invites/server'
import { MAX_FILE_SIZE } from '@/lib/validations/document'

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

// Public upload — stores a single file under proprietarios/invites/{token}/...
// The file is only tied to an owner at submit-time, once owner rows exist.
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
  const slotSlug = (formData.get('slot_slug') as string | null) || 'unknown'

  if (!file) {
    return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
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
      {
        error: `Formato não permitido. Aceite: ${ALLOWED_EXT.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const safeSlot = sanitizeFileName(slotSlug) || 'unknown'
  const key = `proprietarios/invites/${token}/${safeSlot}/${Date.now()}-${sanitizeFileName(
    file.name
  )}`

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
    console.error('Erro ao fazer upload ao R2:', err)
    return NextResponse.json(
      { error: 'Erro ao carregar ficheiro' },
      { status: 500 }
    )
  }

  const url = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key

  return NextResponse.json(
    {
      slot_slug: safeSlot,
      file_url: url,
      r2_key: key,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    },
    { status: 201 }
  )
}
