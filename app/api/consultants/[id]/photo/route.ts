import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { sanitizeFileName } from '@/lib/r2/documents'
import { requirePermission } from '@/lib/auth/permissions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('consultants')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro não fornecido' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Apenas imagens são permitidas' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 5MB)' }, { status: 400 })
    }

    // Get current photo to delete old one
    const { data: profile } = await supabase
      .from('dev_consultant_profiles')
      .select('profile_photo_url')
      .eq('user_id', id)
      .single()

    // Upload new photo to R2 under usuarios-fotos path
    const bytes = await file.arrayBuffer()
    const buffer = new Uint8Array(bytes)
    const sanitized = sanitizeFileName(file.name)
    const key = `public/usuarios-fotos/${id}/${Date.now()}-${sanitized}`

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

    // Update profile
    const { error: updateError } = await supabase
      .from('dev_consultant_profiles')
      .upsert({
        user_id: id,
        profile_photo_url: url,
      })

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao actualizar foto', details: updateError.message },
        { status: 500 }
      )
    }

    // Delete old photo from R2 if exists
    if (profile?.profile_photo_url) {
      try {
        const domain = R2_PUBLIC_DOMAIN || ''
        const oldKey = profile.profile_photo_url.replace(`${domain}/`, '')
        if (oldKey) {
          await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey }))
        }
      } catch {
        // Silent fail on old photo deletion
      }
    }

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Erro ao fazer upload de foto:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
