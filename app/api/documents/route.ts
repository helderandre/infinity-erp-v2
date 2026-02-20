import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const propertyId = searchParams.get('property_id')
    const ownerId = searchParams.get('owner_id')
    const docTypeId = searchParams.get('doc_type_id')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (propertyId) query = query.eq('property_id', propertyId)
    if (ownerId) query = query.eq('owner_id', ownerId)
    if (docTypeId) query = query.eq('doc_type_id', docTypeId)
    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('file_name', `%${search}%`)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar documentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
