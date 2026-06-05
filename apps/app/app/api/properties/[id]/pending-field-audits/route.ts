import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/properties/[id]/pending-field-audits
 *
 * Returns owner_field_audit rows where `acknowledged_at IS NULL` for any owner
 * of this property. Used by PropertyCmiReadiness to mark field requirements
 * as `pending_review`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id: propertyId } = await params
    const admin = createAdminClient() as unknown as {
      from: (t: string) => ReturnType<typeof supabase.from>
    }

    const { data: ownerLinks, error: ownersErr } = await admin
      .from('property_owners')
      .select('owner_id')
      .eq('property_id', propertyId) as { data: any[] | null; error: any }

    if (ownersErr) {
      console.error('[pending-field-audits] owners:', ownersErr.message)
      return NextResponse.json({ error: ownersErr.message }, { status: 500 })
    }

    const ownerIds = (ownerLinks ?? []).map((o) => o.owner_id).filter(Boolean)
    if (ownerIds.length === 0) {
      return NextResponse.json({ audits: [] })
    }

    // Only audits NOT made by a consultor through the ERP. Edits via ERP set
    // edited_via='erp' (or have edited_by_auth_user_id matching a dev_users
    // row), and shouldn't show as pending because the consultor IS the
    // reviewer.
    const { data, error } = await admin
      .from('owner_field_audit')
      .select('id, owner_id, field_name, old_value, new_value, edited_via, created_at')
      .in('owner_id', ownerIds)
      .is('acknowledged_at', null)
      .neq('edited_via', 'erp')
      .order('created_at', { ascending: false }) as { data: any[] | null; error: any }

    if (error) {
      console.error('[pending-field-audits] audits:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ audits: data ?? [] })
  } catch (err: any) {
    console.error('[pending-field-audits] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
