import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { discoverFields } from '@/lib/pdf/discover-fields'
import type { PdfFieldWithMapping } from '@/types/pdf-template'

// GET — retorna campos PDF com posições e mapeamento actual
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch template
    const { data: template, error: tplError } = await supabase
      .from('tpl_doc_library')
      .select('id, template_type, file_url')
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

    // Fetch existing mappings from DB
    const { data: mappings } = await supabase
      .from('doc_pdf_field_mappings')
      .select('*')
      .eq('template_id', id)
      .order('display_order', { ascending: true })

    // Fetch PDF from URL and discover fields with positions
    let pdfResponse: Response
    try {
      pdfResponse = await fetch(template.file_url)
    } catch (fetchErr) {
      console.error('Erro ao fazer fetch do PDF (URL:', template.file_url, '):', fetchErr)
      return NextResponse.json({ error: 'Erro ao carregar ficheiro PDF do storage' }, { status: 502 })
    }
    if (!pdfResponse.ok) {
      console.error('PDF fetch falhou — status:', pdfResponse.status, 'URL:', template.file_url)
      return NextResponse.json({ error: 'Erro ao carregar ficheiro PDF' }, { status: 502 })
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())

    let discoveredFields: Awaited<ReturnType<typeof discoverFields>> = []
    try {
      console.log('[Fields API] PDF bytes:', pdfBytes.length, 'header:', String.fromCharCode(...pdfBytes.slice(0, 5)))
      discoveredFields = await discoverFields(pdfBytes)
      console.log('[Fields API] discoverFields returned:', discoveredFields.length, 'fields')
    } catch (discoverErr) {
      console.error('[Fields API] discoverFields threw:', discoverErr)
    }

    // Merge: discovered fields + DB mappings
    const mappingsByName = new Map(
      (mappings || []).map((m) => [m.pdf_field_name, m])
    )

    const result: PdfFieldWithMapping[] = discoveredFields.map((field) => {
      const dbMapping = mappingsByName.get(field.name)
      return {
        ...field,
        mapping: dbMapping
          ? {
              id: dbMapping.id,
              variable_key: dbMapping.variable_key,
              default_value: dbMapping.default_value,
              transform: dbMapping.transform,
              font_size: dbMapping.font_size,
              is_required: dbMapping.is_required ?? false,
              display_label: dbMapping.display_label,
              display_order: dbMapping.display_order ?? 0,
            }
          : null,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao obter campos do PDF:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
