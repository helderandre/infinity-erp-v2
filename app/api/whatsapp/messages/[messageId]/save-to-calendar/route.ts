import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — Save WhatsApp event message to personal calendar
export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { title, description, start_date, end_date, all_day, category, visibility } = body

    if (!title || !start_date) {
      return NextResponse.json({ error: 'Título e data de início são obrigatórios' }, { status: 400 })
    }

    // Check if already saved
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('wpp_message_id', messageId)
      .eq('created_by', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Este evento já foi guardado no calendário', id: existing.id }, { status: 409 })
    }

    // Create calendar event
    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert({
        title,
        description: description || null,
        category: category || 'reminder',
        start_date,
        end_date: end_date || null,
        all_day: all_day ?? false,
        visibility: visibility || 'private',
        created_by: user.id,
        user_id: user.id,
        wpp_message_id: messageId,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating calendar event:', error)
      return NextResponse.json({ error: 'Erro ao criar evento no calendário' }, { status: 500 })
    }

    return NextResponse.json({ id: event.id })
  } catch (err) {
    console.error('save-to-calendar error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET — Check if a WhatsApp event is saved to calendar
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('wpp_message_id', messageId)
      .eq('created_by', user.id)
      .maybeSingle()

    return NextResponse.json({ saved: !!data, calendar_event_id: data?.id || null })
  } catch (err) {
    console.error('check calendar error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — Remove WhatsApp event from calendar
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('wpp_message_id', messageId)
      .eq('created_by', user.id)

    if (error) {
      console.error('Error deleting calendar event:', error)
      return NextResponse.json({ error: 'Erro ao remover evento do calendário' }, { status: 500 })
    }

    return NextResponse.json({ removed: true })
  } catch (err) {
    console.error('delete calendar event error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
