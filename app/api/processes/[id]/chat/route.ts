import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chatMessageSchema } from '@/lib/validations/chat'
import { notificationService } from '@/lib/notifications/service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    let query = (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        parent_message:proc_chat_messages!parent_message_id(id, content, sender_id, sender:dev_users(id, commercial_name)),
        attachments:proc_chat_attachments(*),
        reactions:proc_chat_reactions(id, emoji, user_id)
      `)
      .eq('proc_instance_id', processId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
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
    const validation = chatMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Verificar que o processo existe
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, external_ref')
      .eq('id', processId)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const { data: message, error: insertError } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .insert({
        proc_instance_id: processId,
        sender_id: user.id,
        content: validation.data.content,
        mentions: validation.data.mentions,
        parent_message_id: validation.data.parent_message_id || null,
      })
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        parent_message:proc_chat_messages!parent_message_id(id, content, sender_id, sender:dev_users(id, commercial_name))
      `)
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // --- Notificações ---
    try {
      const procRef = (proc as any).external_ref || ''

      // #8: Menções no chat
      if (validation.data.mentions && validation.data.mentions.length > 0) {
        for (const mention of validation.data.mentions) {
          if (mention.user_id !== user.id) {
            await notificationService.create({
              recipientId: mention.user_id,
              senderId: user.id,
              notificationType: 'chat_mention',
              entityType: 'proc_chat_message',
              entityId: (message as any).id,
              title: 'Mencionado no chat',
              body: `${(message as any).sender?.commercial_name || 'Alguém'} mencionou-o no chat do processo ${procRef}`,
              actionUrl: `/dashboard/processos/${processId}?tab=chat&message=${(message as any).id}`,
              metadata: { process_ref: procRef },
            })
          }
        }
      }
    } catch (notifError) {
      console.error('[Chat] Erro ao enviar notificações:', notifError)
    }

    return NextResponse.json(message, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
