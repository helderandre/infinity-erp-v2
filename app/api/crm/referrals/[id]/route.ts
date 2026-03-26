import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { updateReferralStatusSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const parsed = updateReferralStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = createCrmAdminClient()

    const updates: Record<string, unknown> = { status: parsed.data.status }
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

    const { data, error } = await supabase
      .from('leads_referrals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Referência não encontrada' }, { status: 404 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
