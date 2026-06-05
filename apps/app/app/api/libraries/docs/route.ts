import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'
import { discoverFields } from '@/lib/pdf/discover-fields'
import { uploadDocumentToR2 } from '@/lib/r2/documents'

const docTemplateCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional().nullable(),
  content_html: z.string().min(1, 'Conteúdo obrigatório'),
  doc_type_id: z.string().optional().nullable(),
  letterhead_url: z.string().optional().nullable(),
  letterhead_file_name: z.string().optional().nullable(),
  letterhead_file_type: z.string().optional().nullable(),
})

// GET — listar templates de documentos
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('settings')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const type = searchParams.get('type') // 'pdf' | 'html' | null

    let query = supabase
      .from('tpl_doc_library')
      .select('*, doc_types:doc_type_id(id, name, category)')
      .order('updated_at', { ascending: false })

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (type === 'pdf' || type === 'html') {
      query = query.eq('template_type', type)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar templates de documentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — criar template de documento (HTML via JSON, PDF via FormData)
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('settings')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const contentType = request.headers.get('content-type') || ''

    // PDF template — multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const name = formData.get('name') as string | null
      const description = (formData.get('description') as string) || null
      const docTypeId = (formData.get('doc_type_id') as string) || null
      const templateType = formData.get('template_type') as string

      if (templateType !== 'pdf') {
        return NextResponse.json({ error: 'template_type deve ser "pdf" para upload' }, { status: 400 })
      }
      if (!file || !name) {
        return NextResponse.json({ error: 'Ficheiro e nome são obrigatórios' }, { status: 400 })
      }
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Ficheiro deve ser um PDF' }, { status: 400 })
      }

      const fileBuffer = new Uint8Array(await file.arrayBuffer())

      // Generate a temporary ID for the R2 path
      const tempId = crypto.randomUUID()

      // Upload PDF to R2 first
      const { url, key } = await uploadDocumentToR2(
        fileBuffer,
        file.name,
        'application/pdf',
        { type: 'pdf-template', templateId: tempId }
      )

      // Discover AcroForm fields — use a copy since libraries may mutate the buffer
      let discoveredFields: Awaited<ReturnType<typeof discoverFields>> = []
      try {
        console.log('[PDF Upload] fileBuffer size:', fileBuffer.length, 'header:', String.fromCharCode(...fileBuffer.slice(0, 5)))
        discoveredFields = await discoverFields(fileBuffer.slice())
        console.log('[PDF Upload] discoverFields returned:', discoveredFields.length, 'fields')
      } catch (e) {
        console.error('[PDF Upload] discoverFields threw:', e)
      }

      // Create template record with file_url (satisfies chk_pdf_has_file constraint)
      const { data: template, error: insertError } = await supabase
        .from('tpl_doc_library')
        .insert({
          name,
          description,
          doc_type_id: docTypeId,
          template_type: 'pdf',
          file_url: url,
          file_key: key,
          file_name: file.name,
          file_size: file.size,
          total_fields: discoveredFields.length,
        })
        .select('*')
        .single()

      if (insertError || !template) {
        return NextResponse.json({ error: insertError?.message || 'Erro ao criar template' }, { status: 500 })
      }

      // Insert discovered fields as mappings (all unmapped initially)
      if (discoveredFields.length > 0) {
        const mappings = discoveredFields.map((f, idx) => ({
          template_id: template.id,
          pdf_field_name: f.name,
          field_type: f.type === 'textarea' ? 'text' : f.type === 'unknown' ? 'text' : f.type,
          field_options: f.options || null,
          variable_key: null,
          default_value: null,
          transform: null,
          font_size: f.suggestedFontSize,
          is_required: false,
          display_label: null,
          display_order: idx,
          page_number: f.page,
        }))

        const { error: mappingError } = await supabase
          .from('doc_pdf_field_mappings')
          .insert(mappings)

        if (mappingError) {
          console.error('Erro ao inserir mapeamentos de campos:', mappingError)
        }
      }

      // Return complete template with fields
      const { data: fullTemplate } = await supabase
        .from('tpl_doc_library')
        .select('*, doc_types:doc_type_id(id, name, category), doc_pdf_field_mappings(*)')
        .eq('id', template.id)
        .single()

      return NextResponse.json(fullTemplate, { status: 201 })
    }

    // HTML template — JSON body (existing flow)
    const body = await request.json()
    const parsed = docTemplateCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tpl_doc_library')
      .insert({ ...parsed.data, template_type: 'html' })
      .select('*, doc_types:doc_type_id(id, name, category)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar template de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
