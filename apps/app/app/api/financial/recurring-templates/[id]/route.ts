import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { recurringTemplateSchema } from '@/lib/validations/financial'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const parsed = recurringTemplateSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('company_recurring_templates' as any)
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('company_recurring_templates' as any)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao desactivar template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
