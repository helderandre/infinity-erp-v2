import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('documents')
    if (!auth.authorized) return auth.response

    const { id: ownerId } = await params
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    const supabase = await createClient()

    let query = supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .eq('owner_id', ownerId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    // When property_id is supplied, return only docs linked to BOTH this owner
    // AND this specific property (strict scope).
    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao obter documentos do proprietario:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
