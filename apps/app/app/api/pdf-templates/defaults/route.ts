import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET — list all defaults
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('template_defaults')
      .select('*, template:tpl_doc_library(id, name, file_url)')
      .order('section')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ defaults: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 })
  }
}

// PUT — upsert a default for a section
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { section, template_id, label } = await request.json()
    if (!section || !template_id) {
      return NextResponse.json({ error: 'section e template_id obrigatorios' }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('template_defaults')
      .upsert(
        { section, template_id, label: label || null, updated_by: user.id },
        { onConflict: 'section' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 })
  }
}
