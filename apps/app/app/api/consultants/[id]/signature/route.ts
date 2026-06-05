import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro não fornecido' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de ficheiro não suportado. Use PNG, JPEG ou WebP.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande. Máximo 5MB.' }, { status: 400 })
    }

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'png'
    const key = `public/assinaturas/${id}/${Date.now()}.${ext}`

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

    // Update consultant profile
    const { error } = await supabase
      .from('dev_consultant_profiles')
      .upsert({ user_id: id, email_signature_url: url })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[signature upload] Error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
