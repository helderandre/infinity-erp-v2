import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

function getAttachmentType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  if (
    mimeType === 'application/pdf' ||
    mimeType === 'application/msword' ||
    mimeType.startsWith('application/vnd.')
  ) return 'document'
  return 'file'
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const processId = formData.get('processId') as string | null
    const messageId = formData.get('messageId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro não encontrado' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Ficheiro excede 20MB' }, { status: 400 })
    }
    if (!processId || !uuidRegex.test(processId)) {
      return NextResponse.json({ error: 'processId inválido' }, { status: 400 })
    }
    if (!messageId || !uuidRegex.test(messageId)) {
      return NextResponse.json({ error: 'messageId inválido' }, { status: 400 })
    }

    const sanitizedFilename = sanitizeFilename(file.name)
    const storageKey = `chat/${processId}/${Date.now()}-${sanitizedFilename}`
    const attachmentType = getAttachmentType(file.type)

    // Upload to R2
    const S3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })

    const buffer = Buffer.from(await file.arrayBuffer())
    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: storageKey,
        Body: buffer,
        ContentType: file.type,
      })
    )

    const fileUrl = `${process.env.R2_PUBLIC_DOMAIN}/${storageKey}`

    // Insert attachment record
    const { data: attachment, error: insertError } = await (db.from('proc_chat_attachments') as ReturnType<typeof supabase.from>)
      .insert({
        message_id: messageId,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        attachment_type: attachmentType,
        storage_key: storageKey,
        uploaded_by: user.id,
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Mark message as having attachments
    await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .update({ has_attachments: true })
      .eq('id', messageId)

    return NextResponse.json(attachment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
