import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json().catch(() => ({}))
    const mediaIds = body.mediaIds as string[] | undefined

    let query = supabase
      .from('dev_property_media')
      .update({ ai_staged_url: null, ai_staged_style: null })
      .eq('property_id', id)

    if (mediaIds && mediaIds.length > 0) {
      query = query.in('id', mediaIds)
    }

    const { error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ cleared: count ?? 0 })
  } catch (error) {
    console.error('Erro ao limpar versões IA:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
