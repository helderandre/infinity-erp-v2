import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { editInternalMessageSchema } from '@/lib/validations/internal-chat'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    const { data, error } = await db.from('internal_chat_messages')
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        parent_message:internal_chat_messages!parent_message_id(id, content, sender_id, sender:dev_users(id, commercial_name)),
        attachments:internal_chat_attachments(*),
        reactions:internal_chat_reactions(id, emoji, user_id, user:dev_users(commercial_name))
      `)
      .eq('id', messageId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = editInternalMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    const { data, error } = await db.from('internal_chat_messages')
      .update({
        content: validation.data.content,
        is_edited: true,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('sender_id', user.id)
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        attachments:internal_chat_attachments(*),
        reactions:internal_chat_reactions(id, emoji, user_id, user:dev_users(commercial_name))
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erro ao editar mensagem' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    const { error } = await db.from('internal_chat_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('sender_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Erro ao eliminar mensagem' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
