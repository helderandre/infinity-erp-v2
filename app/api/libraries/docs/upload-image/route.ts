import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { sanitizeFileName } from '@/lib/r2/documents'

const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/jpg']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const UPLOAD_PATH = 'public/templates/docs/images'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro obrigatório' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de ficheiro não suportado. Use JPEG, PNG ou WebP.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Ficheiro demasiado grande. Máximo 5MB.' },
        { status: 400 }
      )
    }

    const sanitized = sanitizeFileName(file.name)
    const key = `${UPLOAD_PATH}/${Date.now()}-${sanitized}`

    const buffer = Buffer.from(await file.arrayBuffer())
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

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload de imagem de template:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
