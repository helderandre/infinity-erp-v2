import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { documentStatusSchema } from '@/lib/validations/document'
import { requirePermission } from '@/lib/auth/permissions'
import { uploadDocumentToR2, type DocumentContext } from '@/lib/r2/documents'

// GET — detalhe do documento com doc_type e uploaded_by
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('documents')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category, allowed_extensions),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Documento nao encontrado' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — actualizar metadados (status, file_name, valid_until) e/ou substituir o ficheiro
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('documents')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient() as any
    const contentType = request.headers.get('content-type') || ''

    const updates: Record<string, any> = {}

    if (contentType.includes('multipart/form-data')) {
      // Multipart: optional new file + name/valid_until/notes
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const fileName = formData.get('file_name') as string | null
      const validUntil = formData.get('valid_until') as string | null
      const notes = formData.get('notes') as string | null

      if (typeof fileName === 'string') updates.file_name = fileName
      if (validUntil !== null) updates.valid_until = validUntil || null
      if (notes !== null) updates.notes = notes || null

      if (file && file.size > 0) {
        // Determine context from existing record
        const { data: existing } = await supabase
          .from('doc_registry')
          .select('property_id, owner_id')
          .eq('id', id)
          .single()

        let ctx: DocumentContext
        if (existing?.property_id) ctx = { type: 'property', propertyId: existing.property_id }
        else if (existing?.owner_id) ctx = { type: 'owner', ownerId: existing.owner_id }
        else {
          return NextResponse.json({ error: 'Documento sem contexto válido' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const { url, key } = await uploadDocumentToR2(buffer, file.name, file.type, ctx)

        updates.file_url = url
        // Only override the file_name if user did not specify one explicitly
        if (typeof fileName !== 'string' || !fileName.trim()) updates.file_name = file.name
        updates.metadata = { size: file.size, mimetype: file.type, r2_key: key }
      }
    } else {
      // JSON: status update OR rename / valid_until edit
      const body = await request.json()

      // Status update path (legacy)
      if (body.status) {
        const parsed = documentStatusSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Dados invalidos', details: parsed.error.flatten() },
            { status: 400 }
          )
        }
        updates.status = parsed.data.status
        if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null
      }

      // Generic field updates
      if (typeof body.file_name === 'string') updates.file_name = body.file_name
      if (body.valid_until !== undefined) updates.valid_until = body.valid_until || null
      if (typeof body.notes === 'string') updates.notes = body.notes || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
    }

    const { error } = await supabase
      .from('doc_registry')
      .update(updates)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao actualizar documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — arquivar documento (soft delete: status → archived)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('documents')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('doc_registry')
      .update({ status: 'archived' })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao arquivar documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
