import { createAdminClient } from '@/lib/supabase/admin'
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
const UPLOAD_PATH = 'task-attachments'

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('task_attachments')
      .select(`
        *,
        uploader:dev_users(id, commercial_name)
      `)
      .eq('task_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar anexos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro é obrigatório' }, { status: 400 })
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 10MB)' }, { status: 400 })
    }

    const sanitized = sanitizeFilename(file.name)
    const key = `${UPLOAD_PATH}/${id}/${Date.now()}-${sanitized}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await S3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }))

    const fileUrl = `${PUBLIC_DOMAIN}/${key}`

    const supabase = createAdminClient()
    const { data: attachment, error } = await supabase
      .from('task_attachments')
      .insert({
        task_id: id,
        uploaded_by: auth.user.id,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
      })
      .select(`
        *,
        uploader:dev_users(id, commercial_name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload de anexo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
