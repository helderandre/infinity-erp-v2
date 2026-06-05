import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { visitFeedbackSchema } from '@/lib/validations/visit'

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

    const body = await request.json()
    const parsed = visitFeedbackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // Verify visit exists and is completed or confirmed
    const { data: visit, error: fetchError } = await admin
      .from('visits')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !visit) {
      return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 })
    }

    // Update visit with feedback and mark as completed
    const { data, error } = await admin
      .from('visits')
      .update({
        ...parsed.data,
        feedback_submitted_at: new Date().toISOString(),
        status: 'completed',
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[visits/[id]/feedback POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id]/feedback POST]', err)
    return NextResponse.json({ error: 'Erro interno ao submeter feedback.' }, { status: 500 })
  }
}
