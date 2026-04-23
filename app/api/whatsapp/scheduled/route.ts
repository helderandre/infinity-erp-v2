import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertChatOwner } from '@/lib/whatsapp/authorize'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chat_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = (supabase as any)
      .from('wpp_scheduled_messages')
      .select(`
        *,
        wpp_chats!inner(name, phone, wa_chat_id)
      `)
      .eq('created_by', user.id)
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    if (chatId) query = query.eq('chat_id', chatId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ messages: data || [] })
  } catch (err) {
    console.error('[scheduled-get]', err)
    return NextResponse.json({ error: 'Erro ao carregar mensagens agendadas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { chat_id, instance_id, message_type, text, media_url, media_file_name, scheduled_at } = body

    if (!chat_id || !instance_id || !scheduled_at) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 })
    }

    if (!text && !media_url) {
      return NextResponse.json({ error: 'Mensagem ou media obrigatório' }, { status: 400 })
    }

    // Ownership of the chat implies ownership of the underlying instance.
    const chatAuth = await assertChatOwner(chat_id)
    if (!chatAuth.ok) return chatAuth.response

    if (chatAuth.data.instanceId !== instance_id) {
      return NextResponse.json(
        { error: 'chat_id não pertence à instância indicada' },
        { status: 400 }
      )
    }

    const scheduledDate = new Date(scheduled_at)
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ error: 'A data deve ser no futuro' }, { status: 400 })
    }

    const { data, error } = await (supabase as any)
      .from('wpp_scheduled_messages')
      .insert({
        chat_id,
        instance_id,
        message_type: message_type || 'text',
        text,
        media_url,
        media_file_name,
        scheduled_at: scheduledDate.toISOString(),
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ message: data })
  } catch (err) {
    console.error('[scheduled-post]', err)
    return NextResponse.json({ error: 'Erro ao agendar mensagem' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const { error } = await (supabase as any)
      .from('wpp_scheduled_messages')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('created_by', user.id)
      .eq('status', 'pending')

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[scheduled-delete]', err)
    return NextResponse.json({ error: 'Erro ao cancelar mensagem' }, { status: 500 })
  }
}
