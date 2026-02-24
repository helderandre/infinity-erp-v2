import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chatReadReceiptSchema } from '@/lib/validations/chat'

export async function GET(
  _request: Request,
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

    const { data, error } = await (db.from('proc_chat_read_receipts') as ReturnType<typeof supabase.from>)
      .select('*, user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))')
      .eq('proc_instance_id', processId)

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
    const validation = chatReadReceiptSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { error: upsertError } = await (db.from('proc_chat_read_receipts') as ReturnType<typeof supabase.from>)
      .upsert(
        {
          proc_instance_id: processId,
          user_id: user.id,
          last_read_message_id: validation.data.last_read_message_id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: 'proc_instance_id,user_id' }
      )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
