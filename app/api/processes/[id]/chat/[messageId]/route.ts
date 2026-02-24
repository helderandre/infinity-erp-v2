export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data, error } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        parent_message:proc_chat_messages!parent_message_id(id, content, sender_id, sender:dev_users(id, commercial_name)),
        attachments:proc_chat_attachments(*),
        reactions:proc_chat_reactions(id, emoji, user_id, user:dev_users(commercial_name))
      `)
      .eq('id', messageId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Mensagem não encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const editSchema = z.object({
  content: z.string().min(1).max(10000),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = editSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Verificar que a mensagem pertence ao user
    const { data: existing, error: fetchError } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .select('id, sender_id')
      .eq('id', messageId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    if ((existing as { sender_id: string }).sender_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão para editar esta mensagem' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .update({
        content: validation.data.content,
        is_edited: true,
        edited_at: now,
        updated_at: now,
      })
      .eq('id', messageId)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar que a mensagem pertence ao user
    const { data: existing, error: fetchError } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .select('id, sender_id')
      .eq('id', messageId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    if ((existing as { sender_id: string }).sender_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão para eliminar esta mensagem' }, { status: 403 })
    }

    const { error: updateError } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        content: '',
      })
      .eq('id', messageId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
