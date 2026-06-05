import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendViaSMTP } from '@/lib/email/smtp-client'
import { appendToSentFolder } from '@/lib/email/imap-client'
import { injectOpenTrackingPixel } from '@/lib/email-renderer'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import { z } from 'zod'
import type { LogEmail } from '@/types/process'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

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

    // 1. Buscar email original
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

    // 2. Buscar conta de email SMTP do consultor
    const { data: account, error: accError } = await adminDb
      .from('consultant_email_accounts')
      .select('*')
      .eq('consultant_id', user.id)
      .eq('is_verified', true)
      .eq('is_active', true)
      .single()

    if (accError || !account) {
      return NextResponse.json(
        { error: 'Conta de email não configurada ou não verificada' },
        { status: 404 }
      )
    }

    // 3. Desencriptar senha
    if (!ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'ENCRYPTION_KEY não configurada' }, { status: 500 })
    }

    const { data: password, error: decError } = await adminDb.rpc('decrypt_email_password', {
      p_encrypted: account.encrypted_password,
      p_key: ENCRYPTION_KEY,
    })

    if (decError || !password) {
      return NextResponse.json({ error: 'Erro ao desencriptar credenciais' }, { status: 500 })
    }

    // 4. Criar registo email_messages
    const toAddresses = [original.recipient_email]
    const ccAddresses = original.cc || []

    const { data: message, error: msgError } = await adminDb
      .from('email_messages')
      .insert({
        account_id: account.id,
        direction: 'outbound',
        status: 'sending',
        from_address: account.email_address,
        from_name: account.display_name,
        to_addresses: toAddresses,
        cc_addresses: ccAddresses,
        bcc_addresses: [],
        subject: original.subject || '',
        body_html: original.body_html || '',
        has_attachments: false,
      })
      .select('id')
      .single()

    if (msgError || !message) {
      console.error('[resend-email] Insert message error:', msgError)
      return NextResponse.json({ error: 'Erro ao registar mensagem' }, { status: 500 })
    }

    // 5. Inject tracking pixel and send via SMTP
    const requestOrigin = new URL(req.url).origin
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin
    const bodyHtml = original.body_html || ''
    const trackedHtml = injectOpenTrackingPixel(bodyHtml, message.id, baseUrl)

    const result = await sendViaSMTP(
      {
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_secure,
        user: account.email_address,
        pass: password,
      },
      {
        from: { name: account.display_name, address: account.email_address },
        to: toAddresses,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        subject: original.subject || '',
        html: trackedHtml,
      }
    )

    if (!result.ok) {
      await adminDb
        .from('email_messages')
        .update({ status: 'failed', error_message: result.error })
        .eq('id', message.id)

      return NextResponse.json(
        { error: 'Falha ao reenviar email', detail: result.error },
        { status: 502 }
      )
    }

    // 6. Actualizar email_messages como enviado
    await adminDb
      .from('email_messages')
      .update({
        status: 'sent',
        message_id: result.messageId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', message.id)

    // 7. Append to IMAP Sent folder
    if (result.rawMessage) {
      try {
        await appendToSentFolder(
          {
            host: account.imap_host,
            port: account.imap_port,
            secure: account.imap_secure,
            user: account.email_address,
            pass: password,
          },
          result.rawMessage
        )
      } catch (imapErr) {
        console.warn('[resend-email] Failed to append to Sent folder:', imapErr)
      }
    }

    // 8. Criar novo log_emails com referência ao original
    const db = adminDb as unknown as { from: (t: string) => ReturnType<typeof adminDb.from> }
    const { error: insertError } = await db.from('log_emails').insert({
      proc_task_id: original.proc_task_id,
      proc_subtask_id: original.proc_subtask_id,
      email_message_id: message.id,
      recipient_email: original.recipient_email,
      sender_email: account.email_address,
      sender_name: account.display_name,
      cc: original.cc,
      subject: original.subject,
      body_html: original.body_html,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
      last_event: 'sent',
      events: [{ type: 'sent', timestamp: new Date().toISOString() }],
      parent_email_id: original.id,
      metadata: {
        resent_by: user.id,
        original_email_id: original.id,
        email_message_id: message.id,
        send_method: 'smtp',
      },
    })

    if (insertError) {
      console.error('[resend-email] Erro ao inserir log_emails:', insertError)
    }

    // 9. Logar actividade
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
      { email_message_id: message.id, original_log_email_id: original.id, send_method: 'smtp' }
    )

    return NextResponse.json({ success: true, message_id: message.id })
  } catch (error) {
    console.error('[resend-email] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
