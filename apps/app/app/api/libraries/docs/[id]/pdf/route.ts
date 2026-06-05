import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — proxy PDF file from R2 (avoids CORS issues on client-side)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: template, error } = await supabase
      .from('tpl_doc_library')
      .select('file_url, file_name, template_type')
      .eq('id', id)
      .single()

    if (error || !template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }
    if (template.template_type !== 'pdf' || !template.file_url) {
      return NextResponse.json({ error: 'Template não é PDF ou não tem ficheiro' }, { status: 400 })
    }

    const pdfResponse = await fetch(template.file_url)
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Erro ao carregar PDF do storage' }, { status: 502 })
    }

    const pdfBytes = await pdfResponse.arrayBuffer()

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${template.file_name || 'template.pdf'}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Erro ao servir PDF:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
