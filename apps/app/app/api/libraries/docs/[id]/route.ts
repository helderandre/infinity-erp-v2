import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { deleteDocumentFromR2 } from '@/lib/r2/documents'

const docTemplateUpdateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  description: z.string().optional().nullable(),
  content_html: z.string().min(1, 'Conteúdo obrigatório').optional(),
  doc_type_id: z.string().optional().nullable(),
  letterhead_url: z.string().optional().nullable(),
  letterhead_file_name: z.string().optional().nullable(),
  letterhead_file_type: z.string().optional().nullable(),
  font_path: z.string().optional().nullable(),
})

// GET — detalhe do template de documento
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // First fetch the template to check type
    const { data, error } = await supabase
      .from('tpl_doc_library')
      .select('*, doc_types:doc_type_id(id, name, category), doc_pdf_field_mappings(*)')
      .eq('id', id)
      .single()

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter template de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — actualizar template de documento
export async function PUT(
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

    const body = await request.json()
    const parsed = docTemplateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Don't allow changing template_type
    const updateData = { ...parsed.data, updated_at: new Date().toISOString() }

    const { data, error } = await supabase
      .from('tpl_doc_library')
      .update(updateData)
      .eq('id', id)
      .select('*, doc_types:doc_type_id(id, name, category)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar template de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — eliminar template de documento
export async function DELETE(
  _request: Request,
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

    // Check if it's a PDF template to clean up R2
    const { data: template } = await supabase
      .from('tpl_doc_library')
      .select('template_type, file_key')
      .eq('id', id)
      .single()

    if (template?.template_type === 'pdf' && template.file_key) {
      try {
        await deleteDocumentFromR2(template.file_key)
      } catch (e) {
        console.error('Erro ao eliminar ficheiro do R2:', e)
      }
    }

    // Mappings are deleted automatically via CASCADE
    const { error } = await supabase
      .from('tpl_doc_library')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar template de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
