import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { sanitizeFileName } from '@/lib/r2/documents'

type MarketingResourceRow = {
  id: string
  parent_id: string | null
  is_folder: boolean
  name: string
  file_path: string | null
  file_url: string | null
  mime_type: string | null
  file_size: number | null
}

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * POST /api/marketing/recursos/upload
 *
 * multipart form-data:
 *   file:      File (required)
 *   parent_id: uuid | "" (optional — empty/missing = upload to root)
 *
 * Stores the file in R2 under marketing-recursos/<resource_id>-<safe_name>
 * and inserts a row in `marketing_resources`. Returns the inserted row.
 */
export async function POST(request: Request) {
  const auth = await requirePermission('marketing')
  if (!auth.authorized) return auth.response

  if (!R2_PUBLIC_DOMAIN) {
    return NextResponse.json(
      { error: 'R2_PUBLIC_DOMAIN não configurado no servidor' },
      { status: 500 },
    )
  }

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: 'Form data inválido' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Ficheiro demasiado grande (limite ${MAX_FILE_BYTES / 1024 / 1024}MB)` },
      { status: 413 },
    )
  }

  const rawParent = form.get('parent_id')
  const parentId =
    typeof rawParent === 'string' && rawParent.length > 0 && rawParent !== 'null'
      ? rawParent
      : null

  const supabase = await createClient()

  // Validate parent if given
  if (parentId) {
    const { data: parentData, error: pErr } = await supabase
      .from('marketing_resources' as any)
      .select('id, is_folder')
      .eq('id', parentId)
      .single()
    if (pErr || !parentData) {
      return NextResponse.json({ error: 'Pasta-pai não encontrada' }, { status: 404 })
    }
    const parent = parentData as unknown as Pick<MarketingResourceRow, 'id' | 'is_folder'>
    if (!parent.is_folder) {
      return NextResponse.json(
        { error: 'O destino não é uma pasta' },
        { status: 400 },
      )
    }
  }

  // Insert placeholder row first to get a stable id we can put in the R2 key.
  // We update file_path/file_url after the upload succeeds.
  const sanitized = sanitizeFileName(file.name)
  const buffer = Buffer.from(await file.arrayBuffer())

  // Reserve an id locally; insert with placeholder file_path so the CHECK
  // constraint is satisfied — then we update with the real path & url after
  // the R2 PUT succeeds.
  const tempPath = `pending/${Date.now()}-${sanitized}`
  const tempUrl = `${R2_PUBLIC_DOMAIN}/${tempPath}`

  const { data: insertedData, error: insertErr } = await supabase
    .from('marketing_resources' as any)
    .insert({
      name: file.name,
      parent_id: parentId,
      is_folder: false,
      file_path: tempPath,
      file_url: tempUrl,
      mime_type: file.type || null,
      file_size: file.size,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (insertErr || !insertedData) {
    return NextResponse.json(
      { error: insertErr?.message || 'Erro ao criar registo' },
      { status: 500 },
    )
  }
  const row = insertedData as unknown as MarketingResourceRow

  const finalKey = `marketing-recursos/${row.id}-${sanitized}`
  const finalUrl = `${R2_PUBLIC_DOMAIN}/${finalKey}`

  try {
    const s3 = getR2Client()
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: finalKey,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      }),
    )
  } catch (err) {
    // Roll back the row if the upload failed
    await supabase.from('marketing_resources' as any).delete().eq('id', row.id)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro no upload' },
      { status: 500 },
    )
  }

  const { data: updated, error: updateErr } = await supabase
    .from('marketing_resources' as any)
    .update({ file_path: finalKey, file_url: finalUrl })
    .eq('id', row.id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json(updated, { status: 201 })
}
