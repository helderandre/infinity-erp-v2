import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/permissions'
import { uploadDocumentToR2 } from '@/lib/r2/documents'
import { createClient } from '@/lib/supabase/server'

type LeadAttachmentRow = {
  id: string
  url: string
  name: string | null
  created_at: string
  doc_type_id: string | null
  valid_until?: string | null
  notes?: string | null
  file_size?: number | null
  mime_type?: string | null
  doc_type?: { id: string; name: string; category: string | null; applies_to: string[] | null } | null
}

const DOMAIN_CATEGORIES = {
  identificacao: { label: 'Identificação' },
  fiscal: { label: 'Fiscal' },
  comprovativos: { label: 'Comprovativos' },
  outros: { label: 'Outros' },
} as const

function resolveFolderCategory(category: string | null | undefined): string {
  const c = (category || '').toLowerCase().trim()
  if (c.startsWith('identif')) return 'identificacao'
  if (c.startsWith('fisc')) return 'fiscal'
  if (c.startsWith('comprov')) return 'comprovativos'
  return 'outros'
}

function inferMimeType(name: string | null, storedMime?: string | null): string {
  if (storedMime) return storedMime
  const lower = (name || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

function toFolders(rows: LeadAttachmentRow[]) {
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
    const typeName = row.doc_type?.name ?? 'Outros anexos'
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
        expiresAt: row.valid_until ?? null,
        isCustom: false,
      })
    }

    const folder = byTypeId.get(key)!
    folder.files.push({
      id: row.id,
      name: row.name || 'Anexo',
      url: row.url,
      mimeType: inferMimeType(row.name, row.mime_type),
      size: row.file_size ?? 0,
      uploadedAt: row.created_at,
      uploadedBy: null,
      validUntil: row.valid_until ?? null,
      notes: row.notes ?? null,
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
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('lead_attachments')
      .select(
        'id, url, name, created_at, doc_type_id, valid_until, notes, file_size, mime_type, doc_type:doc_types(id, name, category, applies_to)'
      )
      .eq('lead_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Normalize Supabase's nested array-vs-object shape for the joined doc_type
    const normalized = ((data || []) as unknown as Array<
      LeadAttachmentRow & { doc_type?: LeadAttachmentRow['doc_type'] | LeadAttachmentRow['doc_type'][] }
    >).map((row) => ({
      ...row,
      doc_type: Array.isArray(row.doc_type) ? row.doc_type[0] ?? null : row.doc_type ?? null,
    })) as LeadAttachmentRow[]

    return NextResponse.json({
      folders: toFolders(normalized),
      categories: Object.entries(DOMAIN_CATEGORIES).map(([id, v]) => ({ id, ...v })),
    })
  } catch (error) {
    console.error('Erro ao listar anexos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

const urlBodySchema = z.object({
  url: z.string().url('URL inválida'),
  name: z.string().optional(),
  doc_type_id: z.string().uuid().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const contentType = request.headers.get('content-type') ?? ''

    // Multipart: real file upload → R2 → DB record
    if (contentType.includes('multipart/form-data')) {
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
      if (docTypeId) {
        const { data: dt } = await supabase
          .from('doc_types')
          .select('name')
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
      }

      const bytes = Buffer.from(await file.arrayBuffer())
      const { url } = await uploadDocumentToR2(bytes, file.name, file.type, {
        type: 'lead',
        leadId: id,
        docTypeSlug,
      })

      const { data, error } = await supabase
        .from('lead_attachments')
        .insert({
          lead_id: id,
          url,
          name: label || file.name,
          doc_type_id: docTypeId,
          valid_until: validUntil,
          notes,
          file_size: file.size,
          mime_type: file.type || null,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data, { status: 201 })
    }

    // JSON body (legacy — external URL link)
    const body = await request.json()
    const parsed = urlBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('lead_attachments')
      .insert({
        lead_id: id,
        url: parsed.data.url,
        name: parsed.data.name ?? null,
        doc_type_id: parsed.data.doc_type_id ?? null,
        valid_until: parsed.data.valid_until ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar anexo:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
