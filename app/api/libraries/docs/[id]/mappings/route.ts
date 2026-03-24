import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bulkMappingSchema = z.object({
  mappings: z.array(
    z.object({
      pdf_field_name: z.string(),
      variable_key: z.string().nullable(),
      default_value: z.string().nullable(),
      transform: z.string().nullable(),
      font_size: z.number().nullable(),
      is_required: z.boolean(),
      display_label: z.string().nullable(),
      display_order: z.number(),
    })
  ),
})

// PUT — bulk update de mapeamentos campo↔variável
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

    // Validate template exists and is PDF
    const { data: template } = await supabase
      .from('tpl_doc_library')
      .select('id, template_type')
      .eq('id', id)
      .single()

    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }
    if (template.template_type !== 'pdf') {
      return NextResponse.json({ error: 'Template não é do tipo PDF' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = bulkMappingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Upsert each mapping
    const upsertData = parsed.data.mappings.map((m) => ({
      template_id: id,
      pdf_field_name: m.pdf_field_name,
      variable_key: m.variable_key,
      default_value: m.default_value,
      transform: m.transform,
      font_size: m.font_size,
      is_required: m.is_required,
      display_label: m.display_label,
      display_order: m.display_order,
    }))

    const { data, error } = await supabase
      .from('doc_pdf_field_mappings')
      .upsert(upsertData, { onConflict: 'template_id,pdf_field_name' })
      .select('*')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar mapeamentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
