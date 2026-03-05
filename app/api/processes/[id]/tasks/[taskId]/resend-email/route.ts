import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import { z } from 'zod'
import type { LogEmail } from '@/types/process'

const resendSchema = z.object({
  log_email_id: z.string(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createClient()
    const adminDb = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = resendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'log_email_id é obrigatório' }, { status: 400 })
    }

    const { log_email_id } = parsed.data

    // 1. Buscar email original (cast para LogEmail — colunas novas ainda não estão nos generated types)
    const { data: rawOriginal, error: fetchError } = await adminDb
      .from('log_emails')
      .select('*')
      .eq('id', log_email_id)
      .single()

    if (fetchError || !rawOriginal) {
      return NextResponse.json({ error: 'Email não encontrado' }, { status: 404 })
    }

    const original = rawOriginal as unknown as LogEmail

    // Verificar que pertence à tarefa correcta
    if (original.proc_task_id !== taskId) {
      return NextResponse.json({ error: 'Email não pertence a esta tarefa' }, { status: 403 })
    }

    // 2. Reenviar via edge function
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: original.sender_name,
          senderEmail: original.sender_email,
          recipientEmail: original.recipient_email,
          ...(original.cc && original.cc.length > 0 && { cc: original.cc }),
          subject: original.subject,
          body: original.body_html,
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.error || 'Falha ao reenviar email' },
        { status: 502 }
      )
    }

    const sendData = await res.json()

    // 3. Criar novo log_emails com referência ao original
    const db = adminDb as unknown as { from: (t: string) => ReturnType<typeof adminDb.from> }
    const { error: insertError } = await db.from('log_emails').insert({
      proc_task_id: original.proc_task_id,
      proc_subtask_id: original.proc_subtask_id,
      resend_email_id: sendData.id,
      recipient_email: original.recipient_email,
      sender_email: original.sender_email,
      sender_name: original.sender_name,
      cc: original.cc,
      subject: original.subject,
      body_html: original.body_html,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
      last_event: 'sent',
      events: [{ type: 'sent', timestamp: new Date().toISOString() }],
      parent_email_id: original.id,
      metadata: { resent_by: user.id, original_email_id: original.id },
    })

    if (insertError) {
      console.error('[resend-email] Erro ao inserir log_emails:', insertError)
    }

    // 4. Logar actividade
    const { data: userData } = await supabase
      .from('dev_users')
      .select('commercial_name')
      .eq('id', user.id)
      .single()

    await logTaskActivity(
      supabase,
      taskId,
      user.id,
      'email_resent',
      `${userData?.commercial_name || 'Utilizador'} reenviou email para ${original.recipient_email}`,
      { resend_email_id: sendData.id, original_log_email_id: original.id }
    )

    return NextResponse.json({ success: true, id: sendData.id })
  } catch (error) {
    console.error('[resend-email] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
