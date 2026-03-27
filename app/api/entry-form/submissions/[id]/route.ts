import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(
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

    // Only allow updating specific fields
    const allowedFields = [
      'full_name', 'display_name', 'cc_number', 'cc_expiry', 'cc_issue_date',
      'date_of_birth', 'nif', 'niss', 'naturalidade', 'estado_civil',
      'full_address', 'professional_phone', 'personal_email',
      'emergency_contact_name', 'emergency_contact_phone',
      'email_suggestion_1', 'email_suggestion_2', 'email_suggestion_3',
      'instagram_handle', 'facebook_page',
    ]

    const updates: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key] || null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para actualizar.' }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const { error } = await admin
      .from('recruitment_entry_submissions')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('[entry-form/submissions PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[entry-form/submissions PUT]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
