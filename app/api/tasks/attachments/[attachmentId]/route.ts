import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { attachmentId } = await params
    const supabase = createAdminClient()

    // Get attachment to find R2 key
    const { data: attachment } = await supabase
      .from('task_attachments')
      .select('id, file_url')
      .eq('id', attachmentId)
      .single()

    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 })
    }

    // Delete from R2
    const key = attachment.file_url.replace(`${PUBLIC_DOMAIN}/`, '')
    try {
      await S3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
    } catch (r2Error) {
      console.error('Erro ao eliminar do R2:', r2Error)
    }

    // Delete from DB
    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar anexo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
