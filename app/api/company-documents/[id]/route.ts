import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { sanitizeFileName } from '@/lib/r2/documents'

async function resolveCategory(
  supabase: any,
  slug: string
): Promise<{ row: { id: string; is_active: boolean } | null; error: string | null }> {
  const { data, error } = await supabase
    .from('company_document_categories')
    .select('id, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (error) return { row: null, error: error.message }
  if (!data) return { row: null, error: 'Categoria inválida' }
  if (!data.is_active) return { row: null, error: 'Categoria inactiva' }
  return { row: data, error: null }
}

// PUT: update document metadata (and optionally replace the file via multipart/form-data)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const updates: Record<string, any> = {}
    let incomingCategory: string | null = null
    let pendingFile: File | null = null

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const name = formData.get('name')
      const description = formData.get('description')
      const category = formData.get('category')
      const file = formData.get('file') as File | null

      if (typeof name === 'string') updates.name = name
      if (typeof description === 'string') updates.description = description
      if (typeof category === 'string') {
        updates.category = category
        incomingCategory = category
      }
      if (file && file.size > 0) pendingFile = file
    } else {
      const body = await request.json()
      if (body.name !== undefined) updates.name = body.name
      if (body.description !== undefined) updates.description = body.description
      if (body.category !== undefined) {
        updates.category = body.category
        incomingCategory = body.category
      }
      if (body.sort_order !== undefined) updates.sort_order = body.sort_order
    }

    // Validate category up-front (before any R2 upload) and set category_id.
    if (incomingCategory !== null) {
      const { row, error } = await resolveCategory(supabase, incomingCategory)
      if (!row) {
        return NextResponse.json({ error }, { status: 400 })
      }
      updates.category_id = row.id
    }

    // Now perform the R2 upload if a new file was provided.
    if (pendingFile) {
      const { data: existing } = await supabase
        .from('company_documents')
        .select('file_path, category')
        .eq('id', id)
        .single()

      const targetCategory =
        (incomingCategory && incomingCategory) || existing?.category || 'outro'
      const sanitized = sanitizeFileName(pendingFile.name)
      const ext = pendingFile.name.split('.').pop()?.toLowerCase() || ''
      const timestamp = Date.now()
      const key = `documentos-empresa/${targetCategory}/${timestamp}-${sanitized}`

      const buffer = new Uint8Array(await pendingFile.arrayBuffer())
      const s3 = getR2Client()

      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: pendingFile.type,
        })
      )

      const url = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key

      updates.file_path = url
      updates.file_name = pendingFile.name
      updates.file_size = pendingFile.size
      updates.mime_type = pendingFile.type
      updates.file_extension = ext

      // Delete old file from R2 (best-effort)
      if (existing?.file_path) {
        try {
          const domain = R2_PUBLIC_DOMAIN || ''
          const oldKey = existing.file_path.replace(`${domain}/`, '')
          if (oldKey && oldKey !== key) {
            await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey }))
          }
        } catch {
          // Silent fail on old file deletion
        }
      }
    }

    const { data, error } = await supabase
      .from('company_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE: remove document (file from R2 + DB record)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get file path to delete from R2
    const { data: doc } = await supabase
      .from('company_documents')
      .select('file_path')
      .eq('id', id)
      .single()

    if (doc?.file_path) {
      try {
        const domain = R2_PUBLIC_DOMAIN || ''
        const key = doc.file_path.replace(`${domain}/`, '')
        if (key) {
          const s3 = getR2Client()
          await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
        }
      } catch {
        // Silent fail on R2 deletion
      }
    }

    const { error } = await supabase
      .from('company_documents')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
