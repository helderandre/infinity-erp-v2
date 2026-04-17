import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { internalReadReceiptSchema } from '@/lib/validations/internal-chat'
import { INTERNAL_CHAT_CHANNEL_ID } from '@/lib/constants'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId') || INTERNAL_CHAT_CHANNEL_ID

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    const { data, error } = await db.from('internal_chat_read_receipts')
      .select(`
        *,
        user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))
      `)
      .eq('channel_id', channelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = internalReadReceiptSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const channelId = body.channel_id || INTERNAL_CHAT_CHANNEL_ID

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    const { error } = await db.from('internal_chat_read_receipts')
      .upsert(
        {
          channel_id: channelId,
          user_id: user.id,
          last_read_message_id: validation.data.last_read_message_id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: 'channel_id,user_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
