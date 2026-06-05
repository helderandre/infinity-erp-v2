import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/permissions'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { createClient } from '@/lib/supabase/server'

const updateSchema = z.object({
  doc_type_id: z.string().uuid().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requirePermission('pipeline')
  if (!auth.authorized) return auth.response

  const { docId } = await params
  const supabase = await createClient()
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('negocio_documents')
    .update(parsed.data)
    .eq('id', docId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requirePermission('pipeline')
  if (!auth.authorized) return auth.response

  const { docId } = await params
  const supabase = await createClient()

  const { data: existing, error: findError } = await supabase
    .from('negocio_documents')
    .select('file_url')
    .eq('id', docId)
    .single()

  if (findError || !existing) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  }

  // Best-effort R2 cleanup — continue even if it fails so DB state stays clean.
  if (R2_PUBLIC_DOMAIN && existing.file_url.startsWith(R2_PUBLIC_DOMAIN)) {
    const key = existing.file_url.slice(R2_PUBLIC_DOMAIN.length).replace(/^\/+/, '')
    try {
      await getR2Client().send(
        new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
      )
    } catch (err) {
      console.warn('R2 delete falhou para', key, err)
    }
  }

  const { error: deleteError } = await supabase
    .from('negocio_documents')
    .delete()
    .eq('id', docId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'negocio_document',
      entity_id: docId,
      action: 'delete',
      old_data: { file_url: existing.file_url },
    })
  }

  return NextResponse.json({ success: true })
}
