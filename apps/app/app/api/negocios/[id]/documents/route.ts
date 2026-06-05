import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/permissions'
import { uploadDocumentToR2 } from '@/lib/r2/documents'
import { createClient } from '@/lib/supabase/server'

type NegocioDocumentRow = {
  id: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  valid_until: string | null
  notes: string | null
  label: string | null
  created_at: string
  doc_type_id: string | null
  doc_type?: { id: string; name: string; category: string | null; applies_to: string[] | null } | null
  uploader?: { id: string; commercial_name: string } | null
}

function resolveFolderCategory(category: string | null | undefined): string {
  const c = (category || '').toLowerCase().trim()
  if (c.startsWith('identif')) return 'identificacao'
  if (c.startsWith('fisc')) return 'fiscal'
  if (c.startsWith('comprov')) return 'comprovativos'
  if (c.startsWith('contrat')) return 'contratos'
  return 'outros'
}

function inferMimeType(name: string, storedMime: string | null): string {
  if (storedMime) return storedMime
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

function toFolders(rows: NegocioDocumentRow[]) {
  type Folder = {
    id: string
    docTypeId: string | null
    name: string
    category: string
    files: Array<Record<string, unknown>>
    hasExpiry: boolean
    expiresAt: string | null
    isCustom: boolean
  }
  const byTypeId = new Map<string, Folder>()

  for (const row of rows) {
    const typeId = row.doc_type_id ?? null
    const typeName = row.doc_type?.name ?? 'Outros documentos'
    const category = resolveFolderCategory(row.doc_type?.category)
    const key = typeId ?? '__untyped__'

    if (!byTypeId.has(key)) {
      byTypeId.set(key, {
        id: key,
        docTypeId: typeId,
        name: typeName,
        category,
        files: [],
        hasExpiry: !!row.valid_until,
        expiresAt: row.valid_until,
        isCustom: false,
      })
    }

    const folder = byTypeId.get(key)!
    folder.files.push({
      id: row.id,
      name: row.file_name,
      url: row.file_url,
      mimeType: inferMimeType(row.file_name, row.mime_type),
      size: row.file_size ?? 0,
      uploadedAt: row.created_at,
      uploadedBy: row.uploader
        ? { id: row.uploader.id, name: row.uploader.commercial_name }
        : null,
      label: row.label,
      validUntil: row.valid_until,
      notes: row.notes,
    })
    if (row.valid_until) {
      folder.hasExpiry = true
      if (!folder.expiresAt || row.valid_until < folder.expiresAt) {
        folder.expiresAt = row.valid_until
      }
    }
  }

  return Array.from(byTypeId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-PT')
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('pipeline')
  if (!auth.authorized) return auth.response

  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('negocio_documents')
    .select(
      'id, file_url, file_name, file_size, mime_type, uploaded_by, valid_until, notes, label, created_at, doc_type_id, doc_type:doc_types(id, name, category, applies_to), uploader:dev_users!uploaded_by(id, commercial_name)'
    )
    .eq('negocio_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const normalized = ((data || []) as unknown as Array<
    NegocioDocumentRow & {
      doc_type?: NegocioDocumentRow['doc_type'] | NegocioDocumentRow['doc_type'][]
      uploader?: NegocioDocumentRow['uploader'] | NegocioDocumentRow['uploader'][]
    }
  >).map((row) => ({
    ...row,
    doc_type: Array.isArray(row.doc_type) ? row.doc_type[0] ?? null : row.doc_type ?? null,
    uploader: Array.isArray(row.uploader) ? row.uploader[0] ?? null : row.uploader ?? null,
  })) as NegocioDocumentRow[]

  return NextResponse.json({ folders: toFolders(normalized) })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('pipeline')
  if (!auth.authorized) return auth.response

  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
  }
  const docTypeId = (form.get('doc_type_id') as string | null) || null
  const validUntil = (form.get('valid_until') as string | null) || null
  const notes = (form.get('notes') as string | null) || null
  const label = (form.get('label') as string | null) || null

  let docTypeSlug: string | undefined
  let allowedExtensions: string[] | null = null
  if (docTypeId) {
    const { data: dt } = await supabase
      .from('doc_types')
      .select('name, allowed_extensions')
      .eq('id', docTypeId)
      .single()
    if (dt?.name) {
      docTypeSlug = dt.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    }
    allowedExtensions = (dt?.allowed_extensions as string[]) ?? null
  }

  if (allowedExtensions && allowedExtensions.length > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!allowedExtensions.map((x) => x.toLowerCase()).includes(ext)) {
      return NextResponse.json({ error: 'Extensão não permitida' }, { status: 400 })
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const { url } = await uploadDocumentToR2(bytes, file.name, file.type, {
    type: 'negocio',
    negocioId: id,
    docTypeSlug,
  })

  const { data, error } = await supabase
    .from('negocio_documents')
    .insert({
      negocio_id: id,
      doc_type_id: docTypeId,
      file_url: url,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: user.id,
      valid_until: validUntil,
      notes,
      label,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('log_audit').insert({
    user_id: user.id,
    entity_type: 'negocio_document',
    entity_id: data.id,
    action: 'create',
    new_data: { negocio_id: id, doc_type_id: docTypeId, file_name: file.name },
  })

  return NextResponse.json(data, { status: 201 })
}
