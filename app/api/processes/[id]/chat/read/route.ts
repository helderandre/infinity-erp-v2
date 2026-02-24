import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { chatReadReceiptSchema } from '@/lib/validations/chat'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
    const supabase = await createClient()

    // Auth check with user client
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Use admin client to bypass RLS — fetch ALL receipts for this process
    const admin = createAdminClient()
    const adminDb = admin as unknown as {
      from: (table: string) => ReturnType<typeof admin.from>
    }

    console.log('[DEBUG API read GET] Fetching receipts for process:', processId, 'user:', user.id)

    const { data, error } = await (adminDb.from('proc_chat_read_receipts') as ReturnType<typeof admin.from>)
      .select('*, user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))')
      .eq('proc_instance_id', processId)

    console.log('[DEBUG API read GET] Result:', { count: data?.length, data, error })

    if (error) {
      console.error('[DEBUG API read GET] ERROR:', error)
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

    // Auth check with user client
    const { data: { user }, error: authError } = await supabase.auth.getUser()
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

    // Use admin client to bypass RLS for upsert
    const admin = createAdminClient()
    const adminDb = admin as unknown as {
      from: (table: string) => ReturnType<typeof admin.from>
    }

    const upsertPayload = {
      proc_instance_id: processId,
      user_id: user.id,
      last_read_message_id: validation.data.last_read_message_id,
      last_read_at: new Date().toISOString(),
    }
    console.log('[DEBUG API read] Upserting read receipt:', upsertPayload)

    const { data: upsertData, error: upsertError } = await (adminDb.from('proc_chat_read_receipts') as ReturnType<typeof admin.from>)
      .upsert(upsertPayload, { onConflict: 'proc_instance_id,user_id' })
      .select()

    console.log('[DEBUG API read] Upsert result:', { data: upsertData, error: upsertError })

    if (upsertError) {
      console.error('[DEBUG API read] Upsert ERROR:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, debug: { upserted: upsertData } })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
