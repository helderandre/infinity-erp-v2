import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// POST — upload CV
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'Ficheiro em falta.' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const key = `recrutamento/cv/${id}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await S3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'application/pdf',
    }))

    const url = `${process.env.R2_PUBLIC_DOMAIN}/${key}`

    const admin = createAdminClient() as any
    await admin.from('recruitment_candidates').update({ cv_url: url }).eq('id', id)

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[cv upload]', err)
    return NextResponse.json({ error: 'Erro ao carregar CV.' }, { status: 500 })
  }
}

// DELETE — remove CV
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const admin = createAdminClient() as any
    const { data: candidate } = await admin.from('recruitment_candidates').select('cv_url').eq('id', id).single()

    if (candidate?.cv_url) {
      try {
        const key = candidate.cv_url.replace(`${process.env.R2_PUBLIC_DOMAIN}/`, '')
        await S3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }))
      } catch { /* ignore R2 delete errors */ }
    }

    await admin.from('recruitment_candidates').update({ cv_url: null }).eq('id', id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cv delete]', err)
    return NextResponse.json({ error: 'Erro ao eliminar CV.' }, { status: 500 })
  }
}
