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
    // type: 'enhanced' | 'staged' | 'all'
    const type = (body.type as string) || 'all'
    // Optional: array of media IDs to clear. If empty, clears all for property.
    const mediaIds = body.mediaIds as string[] | undefined

    const updateData: Record<string, null> = {}
    if (type === 'enhanced' || type === 'all') {
      updateData.ai_enhanced_url = null
    }
    if (type === 'staged' || type === 'all') {
      updateData.ai_staged_url = null
      updateData.ai_staged_style = null
    }

    let query = supabase
      .from('dev_property_media')
      .update(updateData)
      .eq('property_id', id)

    if (mediaIds && mediaIds.length > 0) {
      query = query.in('id', mediaIds)
    }

    const { error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ cleared: count ?? 0, type })
  } catch (error) {
    console.error('Erro ao limpar versões IA:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
