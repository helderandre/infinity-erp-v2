import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const { linkId } = await params
    const supabase = await createClient() as any
    const body = await request.json()

    const updateData: Record<string, any> = {}
    if (body.status) {
      updateData.status = body.status
      if (body.status === 'sent') updateData.sent_at = new Date().toISOString()
      if (body.status === 'visited') updateData.visited_at = new Date().toISOString()
    }
    if (body.notes !== undefined) updateData.notes = body.notes

    const { data, error } = await supabase
      .from('negocio_properties')
      .update(updateData)
      .eq('id', linkId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar interessado:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const { linkId } = await params
    const supabase = await createClient() as any

    const { error } = await supabase
      .from('negocio_properties')
      .delete()
      .eq('id', linkId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao remover interessado:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
