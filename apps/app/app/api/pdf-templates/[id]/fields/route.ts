import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET — list fields for a template
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('pdf_template_fields')
      .select('*')
      .eq('template_id', id)
      .order('page_number')
      .order('sort_order')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ fields: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 })
  }
}

// PUT — bulk upsert fields (replaces all fields for the template)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { fields } = await request.json()
    if (!Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields deve ser um array' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Delete existing fields
    await admin.from('pdf_template_fields').delete().eq('template_id', id)

    // Insert new fields
    if (fields.length > 0) {
      const rows = fields.map((f: any, idx: number) => ({
        template_id: id,
        page_number: f.page_number || 1,
        x_percent: f.x_percent,
        y_percent: f.y_percent,
        width_percent: f.width_percent || 20,
        height_percent: f.height_percent || 3,
        variable_key: f.variable_key,
        display_label: f.display_label || null,
        font_size: f.font_size || 11,
        font_color: f.font_color || '#000000',
        text_align: f.text_align || 'left',
        transform: f.transform || null,
        is_required: f.is_required || false,
        ai_detected: f.ai_detected || false,
        ai_confidence: f.ai_confidence || null,
        sort_order: idx,
      }))

      const { error } = await admin.from('pdf_template_fields').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: fields.length })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 })
  }
}
