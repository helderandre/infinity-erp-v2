import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST: track a download (increment counter)
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase.rpc('increment_download_count', { doc_id: id })

    // Fallback if RPC doesn't exist yet
    if (error) {
      await supabase
        .from('company_documents')
        .update({ download_count: supabase.raw('download_count + 1') })
        .eq('id', id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao registar download:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
