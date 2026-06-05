import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const supabase = await createClient()

    // 1. Documentos directos do imovel
    const { data: propertyDocs, error: propError } = await supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .eq('property_id', propertyId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (propError) {
      return NextResponse.json({ error: propError.message }, { status: 500 })
    }

    // 2. Buscar proprietarios do imovel
    const { data: owners } = await supabase
      .from('property_owners')
      .select('owner_id')
      .eq('property_id', propertyId)

    const ownerIds = owners?.map((o) => o.owner_id).filter(Boolean) || []

    // 3. Documentos reutilizaveis dos proprietarios (property_id IS NULL)
    let ownerDocs: any[] = []
    if (ownerIds.length > 0) {
      const { data } = await supabase
        .from('doc_registry')
        .select(`
          *,
          doc_type:doc_types(id, name, category),
          uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
        `)
        .in('owner_id', ownerIds)
        .is('property_id', null)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })

      ownerDocs = data || []
    }

    return NextResponse.json({
      property_documents: propertyDocs || [],
      owner_documents: ownerDocs,
    })
  } catch (error) {
    console.error('Erro ao obter documentos do imovel:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
