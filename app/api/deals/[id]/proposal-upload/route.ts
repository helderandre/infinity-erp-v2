import { createClient } from '@/lib/supabase/server'
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

// POST /api/deals/[id]/proposal-upload — Upload proposal PDF to R2
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro nao fornecido' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de ficheiro nao permitido' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `deals/${id}/proposta-${Date.now()}-${sanitizedName}`

    await S3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }))

    const fileUrl = `${process.env.R2_PUBLIC_DOMAIN}/${key}`

    // Update deal with file info
    const { error: updateError } = await supabase
      .from('deals')
      .update({
        proposal_file_url: fileUrl,
        proposal_file_name: file.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Also create a doc_registry entry for the proposal
    const { data: propostaDocType } = await supabase
      .from('doc_types')
      .select('id')
      .eq('name', 'Proposta de Compra')
      .maybeSingle()

    if (propostaDocType) {
      await supabase.from('doc_registry').insert({
        deal_id: id,
        doc_type_id: propostaDocType.id,
        file_url: fileUrl,
        file_name: file.name,
        uploaded_by: auth.user.id,
        status: 'active',
        metadata: { size: file.size, mimetype: file.type },
      })
    }

    return NextResponse.json({ url: fileUrl, name: file.name })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
