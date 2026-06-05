import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: list company documents with filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const categoryId = searchParams.get('category_id')
    const search = searchParams.get('search')

    let query = supabase
      .from('company_documents')
      .select(`
        *,
        uploaded_by_user:dev_users!company_documents_uploaded_by_fkey(commercial_name)
      `)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    // category_id takes priority over category slug when both are supplied
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    } else if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar documentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
