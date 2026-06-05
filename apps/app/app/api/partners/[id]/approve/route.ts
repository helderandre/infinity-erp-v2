import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isPartnersStaff } from '@/lib/auth/partners-staff'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const isStaff = await isPartnersStaff(user.id)
    if (!isStaff) {
      return NextResponse.json({ error: 'Sem permissão para aprovar parceiros.' }, { status: 403 })
    }

    const { data: existing, error: fetchError } = await admin
      .from('temp_partners')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    }

    if (existing.status === 'approved') {
      return NextResponse.json({ error: 'Esta proposta já foi aprovada.' }, { status: 409 })
    }

    const { data, error } = await admin
      .from('temp_partners')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[partners/[id]/approve POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[partners/[id]/approve POST]', err)
    return NextResponse.json({ error: 'Erro interno ao aprovar parceiro.' }, { status: 500 })
  }
}
