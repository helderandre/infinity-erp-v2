import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN!

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro é obrigatório' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagem demasiado grande (máx. 5MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'webp'
    const key = `feedback/${auth.user.id}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await S3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'image/webp',
    }))

    const url = `${PUBLIC_DOMAIN}/${key}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Erro ao fazer upload:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
