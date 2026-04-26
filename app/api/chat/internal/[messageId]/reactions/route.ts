import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { toggleInternalReactionSchema } from '@/lib/validations/internal-chat'
import { getMessageChannelId, isChannelMember } from '@/lib/chat/membership'

export async function POST(
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
    const validation = toggleInternalReactionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Privacidade: só pode reagir a mensagens em canais a que pertence.
    const channelId = await getMessageChannelId(supabase, messageId)
    if (!channelId) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }
    const allowed = await isChannelMember(supabase, user.id, channelId)
    if (!allowed) {
      return NextResponse.json({ error: 'Sem acesso a este canal' }, { status: 403 })
    }

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    // Check if reaction exists (toggle)
    const { data: existing } = await db.from('internal_chat_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', validation.data.emoji)
      .maybeSingle()

    if (existing) {
      await db.from('internal_chat_reactions')
        .delete()
        .eq('id', (existing as any).id)

      return NextResponse.json({ action: 'removed' })
    }

    const { data: reaction, error: insertError } = await db.from('internal_chat_reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji: validation.data.emoji,
      })
      .select('id, emoji, user_id, user:dev_users(commercial_name)')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ action: 'added', reaction }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
