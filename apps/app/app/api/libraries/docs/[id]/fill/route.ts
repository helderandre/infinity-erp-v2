import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { fillPdfGeneric } from '@/lib/pdf/fill-generic'
import type { PdfFieldMapping, FillPdfRequest } from '@/types/pdf-template'

// POST — gera PDF preenchido com dados reais
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Fetch template
    const { data: template, error: tplError } = await supabase
      .from('tpl_doc_library')
      .select('id, name, template_type, file_url')
      .eq('id', id)
      .single()

    if (tplError || !template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }
    if (template.template_type !== 'pdf') {
      return NextResponse.json({ error: 'Template não é do tipo PDF' }, { status: 400 })
    }
    if (!template.file_url) {
      return NextResponse.json({ error: 'Template não tem ficheiro PDF' }, { status: 400 })
    }

    const body: FillPdfRequest = await request.json()

    // Fetch PDF bytes
    const pdfResponse = await fetch(template.file_url)
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Erro ao carregar ficheiro PDF' }, { status: 500 })
    }
    const templateBytes = new Uint8Array(await pdfResponse.arrayBuffer())

    // Fetch mappings
    const { data: dbMappings } = await supabase
      .from('doc_pdf_field_mappings')
      .select('*')
      .eq('template_id', id)

    const mappings: PdfFieldMapping[] = (dbMappings || []).map((m) => ({
      id: m.id,
      template_id: m.template_id,
      pdf_field_name: m.pdf_field_name,
      field_type: m.field_type as PdfFieldMapping['field_type'],
      field_options: m.field_options,
      variable_key: m.variable_key,
      default_value: m.default_value,
      transform: m.transform,
      font_size: m.font_size,
      is_required: m.is_required ?? false,
      display_label: m.display_label,
      display_order: m.display_order ?? 0,
      page_number: m.page_number,
    }))

    // Resolve variables using the same preview-data logic
    let resolvedVariables: Record<string, string> = {}

    // Only resolve if we have entity IDs
    if (body.property_id || body.owner_id || body.consultant_id || body.process_id) {
      try {
        const previewRes = await fetch(
          new URL('/api/libraries/emails/preview-data', request.url).toString(),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              property_id: body.property_id,
              owner_id: body.owner_id,
              consultant_id: body.consultant_id,
              process_id: body.process_id,
            }),
          }
        )
        if (previewRes.ok) {
          const previewData = await previewRes.json()
          resolvedVariables = previewData.variables || {}
        }
      } catch (e) {
        console.error('Erro ao resolver variáveis:', e)
      }
    }

    // Merge: resolved variables + manual values + defaults
    const mergedValues: Record<string, string> = { ...resolvedVariables }
    if (body.manual_values) {
      Object.assign(mergedValues, body.manual_values)
    }

    // Fill PDF
    console.log('[Fill API] Starting fillPdfGeneric with', mappings.length, 'mappings,', Object.keys(mergedValues).length, 'resolved variables')
    const pdfBytes = await fillPdfGeneric(templateBytes, mappings, mergedValues)
    const header = Array.from(pdfBytes.slice(0, 5)).map(b => String.fromCharCode(b)).join('')
    console.log('[Fill API] fillPdfGeneric returned', pdfBytes.length, 'bytes, header:', header)

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${template.name}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[Fill API] Erro ao preencher PDF:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
