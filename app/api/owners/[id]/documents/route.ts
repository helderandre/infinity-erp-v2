import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ownerId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .eq('owner_id', ownerId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao obter documentos do proprietario:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
