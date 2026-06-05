import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { fillPdfOverlay } from '@/lib/pdf/fill-overlay'
import type { PdfTemplateField } from '@/types/pdf-overlay'

/**
 * POST — Fill a PDF template using the overlay system.
 *
 * Body: { variables: Record<string, string> }
 * Returns: filled PDF as download
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { variables, filename } = await request.json()
    if (!variables || typeof variables !== 'object') {
      return NextResponse.json({ error: 'variables obrigatorio' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Fetch template
    const { data: template } = await admin
      .from('tpl_doc_library')
      .select('id, name, file_url')
      .eq('id', id)
      .single()

    if (!template?.file_url) {
      return NextResponse.json({ error: 'Template nao encontrado ou sem ficheiro' }, { status: 404 })
    }

    // Fetch PDF bytes
    const pdfRes = await fetch(template.file_url)
    if (!pdfRes.ok) {
      return NextResponse.json({ error: 'Erro ao carregar PDF do template' }, { status: 500 })
    }
    const templateBytes = new Uint8Array(await pdfRes.arrayBuffer())

    // Fetch overlay fields
    const { data: dbFields } = await admin
      .from('pdf_template_fields')
      .select('*')
      .eq('template_id', id)
      .order('page_number')
      .order('sort_order')

    const fields = (dbFields || []) as PdfTemplateField[]

    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'Este template nao tem campos configurados. Abra o editor visual e configure os campos.' },
        { status: 400 }
      )
    }

    // Fill PDF
    const filledBytes = await fillPdfOverlay(templateBytes, fields, variables)

    const outputName = filename || `${template.name}.pdf`

    return new Response(Buffer.from(filledBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${outputName}"`,
      },
    })
  } catch (err: any) {
    console.error('[pdf-templates/fill]', err)
    return NextResponse.json({ error: err?.message || 'Erro ao preencher PDF' }, { status: 500 })
  }
}
