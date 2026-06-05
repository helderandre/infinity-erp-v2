import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { recurringTemplateSchema } from '@/lib/validations/financial'

export async function GET() {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('company_recurring_templates' as any)
      .select('*')
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar templates:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const parsed = recurringTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('company_recurring_templates' as any)
      .insert(parsed.data)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
