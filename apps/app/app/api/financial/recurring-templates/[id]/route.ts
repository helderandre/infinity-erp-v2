import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
    // Hard delete. A FK em company_transactions.recurring_template_id é NO ACTION,
    // por isso soltamos primeiro o backlink nas despesas já geradas (que se mantêm)
    // e só depois apagamos o template. Usa admin client (já gated por permissão).
    const admin = createAdminClient() as any

    await admin
      .from('company_transactions')
      .update({ recurring_template_id: null })
      .eq('recurring_template_id', id)

    const { error } = await admin
      .from('company_recurring_templates')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
