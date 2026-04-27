import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { sanitizeFileName } from '@/lib/r2/documents'
import { requireAuth } from '@/lib/auth/permissions'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_BYTES = 15 * 1024 * 1024 // 15MB por foto

/**
 * POST /api/deals/[id]/marketing-moments/upload
 *
 * Multipart upload de UMA foto para R2. Retorna a URL pública. O caller
 * (UI) deve coleccionar as URLs e enviá-las no body do POST
 * /api/deals/[id]/marketing-moments para criar o row em
 * `deal_marketing_moments`.
 *
 * Path R2: marketing-moments/{deal_id}/{timestamp}-{sanitized}
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: dealId } = await params

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Ficheiro em falta (campo "file")' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Tipo de ficheiro não suportado: ${file.type}` },
        { status: 415 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Ficheiro demasiado grande (max ${MAX_BYTES / 1024 / 1024}MB)` },
        { status: 413 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitized = sanitizeFileName(file.name)
    const key = `marketing-moments/${dealId}/${Date.now()}-${sanitized}`

    const s3 = getR2Client()
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )

    const url = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key

    return NextResponse.json({ url, key, size: file.size, mime_type: file.type })
  } catch (err) {
    console.error('[marketing-moments/upload]', err)
    return NextResponse.json({ error: 'Erro ao carregar foto' }, { status: 500 })
  }
}
