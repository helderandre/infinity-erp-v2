import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { uploadToR2 } from '@/lib/r2/upload'
import { sanitizeFileName } from '@/lib/r2/documents'

const ACCEPTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Esperado multipart/form-data' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
    }
    const mime = file.type || 'application/octet-stream'
    if (!ACCEPTED_MIME.has(mime)) {
      return NextResponse.json(
        { error: `Tipo não suportado: ${mime}. Aceites: imagens (JPEG, PNG, WebP, HEIC) e PDF.` },
        { status: 415 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Ficheiro excede 10MB.' }, { status: 413 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = sanitizeFileName(file.name || 'recibo')
    const key = `personal-expenses/${auth.user.id}/${Date.now()}-${safeName}`

    const { url } = await uploadToR2({ key, body: buf, contentType: mime })

    return NextResponse.json({
      url,
      mimetype: mime,
      size_bytes: file.size,
      name: file.name || null,
    })
  } catch (error) {
    console.error('Erro ao fazer upload do recibo:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
