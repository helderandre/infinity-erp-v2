import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chatReactionSchema } from '@/lib/validations/chat'

export async function POST(
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
    const validation = chatReactionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { emoji } = validation.data

    // Verificar se já existe
    const { data: existing } = await (db.from('proc_chat_reactions') as ReturnType<typeof supabase.from>)
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle()

    if (existing) {
      // Remover reação
      await (db.from('proc_chat_reactions') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('id', (existing as { id: string }).id)

      return NextResponse.json({ action: 'removed' })
    }

    // Adicionar reação
    const { data: reaction, error: insertError } = await (db.from('proc_chat_reactions') as ReturnType<typeof supabase.from>)
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ action: 'added', reaction }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
