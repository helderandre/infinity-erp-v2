import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'
import { pLimit } from '@/lib/concurrency'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { createAdminClient } from '@/lib/supabase/admin'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const EDGE_SMTP_SECRET = process.env.EDGE_SMTP_SECRET || ''

const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  mimeType: z.string(),
  size: z.number().nonnegative(),
})

const emailSchema = z.object({
  account_id: z.string().uuid(),
  subject: z.string().min(1),
  body_html: z.string().min(1),
  recipients: z.array(z.string().email()).min(1),
})

const whatsappSchema = z.object({
  instance_id: z.string().uuid(),
  message: z.string().optional(),
  recipients: z.array(z.string().regex(/^\+[1-9]\d{7,14}$/)).min(1),
})

const bodySchema = z.object({
  domain: z.enum(['properties', 'processes']),
  entityId: z.string().uuid(),
  files: z.array(fileSchema).min(1),
  email: emailSchema.optional(),
  whatsapp: whatsappSchema.optional(),
})

type SendResult = {
  channel: 'email' | 'whatsapp'
  to: string
  status: 'success' | 'failed'
  error?: string
}

function phoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, '')
  const variants = new Set<string>()
  variants.add(digits)
  variants.add(`+${digits}`)
  if (digits.startsWith('351')) variants.add(digits.slice(3))
  else if (digits.length === 9) variants.add(`351${digits}`)
  variants.add(`${digits}@s.whatsapp.net`)
  if (digits.startsWith('351')) variants.add(`${digits.slice(3)}@s.whatsapp.net`)
  return [...variants]
}

function toJid(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  const full =
    !digits.startsWith('351') && digits.length === 9 ? `351${digits}` : digits
  return `${full}@s.whatsapp.net`
}

async function resolveWhatsappChat(
  instanceId: string,
  phone: string
): Promise<{ chatId: string; waChatId: string } | null> {
  const admin = createAdminClient()
  const variants = phoneVariants(phone)

  const { data: chats } = await admin
    .from('wpp_chats')
    .select('id, wa_chat_id')
    .eq('instance_id', instanceId)
    .eq('is_group', false)
    .or(
      variants
        .map((v) => `phone.eq.${v}`)
        .concat(variants.map((v) => `wa_chat_id.eq.${v}`))
        .join(',')
    )
    .order('last_message_timestamp', { ascending: false, nullsFirst: false })
    .limit(1)

  if (chats?.length) {
    return { chatId: chats[0].id as string, waChatId: chats[0].wa_chat_id as string }
  }

  const jid = toJid(phone)
  const digits = phone.replace(/\D/g, '')
  const { data: created, error } = await admin
    .from('wpp_chats')
    .insert({
      instance_id: instanceId,
      wa_chat_id: jid,
      name: digits,
      phone: digits,
      is_group: false,
      is_archived: false,
      unread_count: 0,
    })
    .select('id, wa_chat_id')
    .single()

  if (error || !created) return null
  return { chatId: created.id as string, waChatId: created.wa_chat_id as string }
}

async function callWhatsappEdge(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/whatsapp-messaging`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WhatsApp edge ${res.status}: ${text.slice(0, 200)}`)
  }
}

async function fetchAttachmentsAsBase64(
  files: z.infer<typeof fileSchema>[]
): Promise<Array<{ filename: string; content_type: string; data_base64: string }>> {
  return Promise.all(
    files.map(async (f) => {
      const res = await fetch(f.url)
      if (!res.ok) {
        throw new Error(`Falha ao descarregar ${f.name} (${res.status})`)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      return {
        filename: f.name,
        content_type: f.mimeType,
        data_base64: buf.toString('base64'),
      }
    })
  )
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { domain, entityId, files, email, whatsapp } = parsed.data

    if (!email && !whatsapp) {
      return NextResponse.json(
        { error: 'Nenhum canal seleccionado' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const isWhatsappAdmin = auth.roles.some((r) =>
      WHATSAPP_ADMIN_ROLES.some(
        (allowed) => allowed.toLowerCase() === r.toLowerCase()
      )
    )

    let resolvedAccount:
      | Awaited<ReturnType<typeof resolveEmailAccount>>
      | null = null
    if (email) {
      resolvedAccount = await resolveEmailAccount(email.account_id)
      if (!resolvedAccount.ok) {
        return NextResponse.json(
          { error: resolvedAccount.error },
          { status: resolvedAccount.status }
        )
      }
    }

    let whatsappInstance: {
      id: string
      uazapi_token: string
    } | null = null
    if (whatsapp) {
      const { data: instance, error } = await admin
        .from('auto_wpp_instances')
        .select('id, user_id, uazapi_token, status, connection_status')
        .eq('id', whatsapp.instance_id)
        .maybeSingle()
      if (error || !instance) {
        return NextResponse.json(
          { error: 'Instância de WhatsApp não encontrada' },
          { status: 404 }
        )
      }
      if (instance.status !== 'active') {
        return NextResponse.json(
          { error: 'Instância de WhatsApp inactiva' },
          { status: 400 }
        )
      }
      if (instance.connection_status !== 'connected') {
        return NextResponse.json(
          { error: 'Instância de WhatsApp não está conectada' },
          { status: 400 }
        )
      }
      if (!isWhatsappAdmin && instance.user_id !== auth.user.id) {
        return NextResponse.json(
          { error: 'Sem permissão para usar esta instância' },
          { status: 403 }
        )
      }
      whatsappInstance = {
        id: instance.id,
        uazapi_token: instance.uazapi_token,
      }
    }

    const results: SendResult[] = []
    const emailLimit = pLimit(3)
    const whatsappLimit = pLimit(2)

    // EMAIL
    if (email && resolvedAccount?.ok) {
      let attachments: Array<{
        filename: string
        content_type: string
        data_base64: string
      }>
      try {
        attachments = await fetchAttachmentsAsBase64(files)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro a preparar anexos'
        for (const to of email.recipients) {
          results.push({ channel: 'email', to, status: 'failed', error: msg })
        }
        attachments = []
      }

      if (attachments.length > 0) {
        const { account, password } = resolvedAccount.data
        const edgeUrl = `${SUPABASE_URL}/functions/v1/smtp-send`

        await Promise.all(
          email.recipients.map((to) =>
            emailLimit(async () => {
              try {
                const edgePayload = {
                  smtp: {
                    host: account.smtp_host,
                    port: account.smtp_port,
                    secure: account.smtp_secure,
                    user: account.email_address,
                    pass: password,
                  },
                  from: {
                    name: account.display_name,
                    address: account.email_address,
                  },
                  to: [to],
                  subject: email.subject,
                  html: email.body_html,
                  attachments,
                }
                const res = await fetch(edgeUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(EDGE_SMTP_SECRET
                      ? { 'x-edge-secret': EDGE_SMTP_SECRET }
                      : {}),
                  },
                  body: JSON.stringify(edgePayload),
                })
                const text = await res.text()
                let payload: { ok?: boolean; error?: string } = {}
                try {
                  payload = JSON.parse(text)
                } catch {
                  throw new Error(`Edge non-JSON: ${text.slice(0, 160)}`)
                }
                if (!payload.ok) {
                  throw new Error(payload.error || 'SMTP falhou')
                }
                results.push({ channel: 'email', to, status: 'success' })
              } catch (err) {
                const msg =
                  err instanceof Error ? err.message : 'Erro desconhecido'
                results.push({
                  channel: 'email',
                  to,
                  status: 'failed',
                  error: msg,
                })
              }
            })
          )
        )
      }
    }

    // WHATSAPP
    if (whatsapp && whatsappInstance) {
      await Promise.all(
        whatsapp.recipients.map((to) =>
          whatsappLimit(async () => {
            try {
              const chat = await resolveWhatsappChat(whatsappInstance!.id, to)
              if (!chat) {
                throw new Error('Não foi possível resolver o chat')
              }
              if (whatsapp.message && whatsapp.message.trim()) {
                await callWhatsappEdge({
                  action: 'send_text',
                  instance_id: whatsappInstance!.id,
                  wa_chat_id: chat.waChatId,
                  text: whatsapp.message.trim(),
                })
              }
              for (const file of files) {
                const isImage = file.mimeType.startsWith('image/')
                const isVideo = file.mimeType.startsWith('video/')
                const type = isImage ? 'image' : isVideo ? 'video' : 'document'
                await callWhatsappEdge({
                  action: 'send_media',
                  instance_id: whatsappInstance!.id,
                  wa_chat_id: chat.waChatId,
                  type,
                  file_url: file.url,
                  file_name: file.name,
                  doc_name: file.name,
                  mime_type: file.mimeType,
                  file_size: file.size,
                })
              }
              results.push({ channel: 'whatsapp', to, status: 'success' })
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : 'Erro desconhecido'
              results.push({
                channel: 'whatsapp',
                to,
                status: 'failed',
                error: msg,
              })
            }
          })
        )
      )
    }

    const attempted = results.length
    const succeeded = results.filter((r) => r.status === 'success').length

    // Audit (best-effort)
    try {
      await admin.from('log_audit').insert({
        user_id: auth.user.id,
        entity_type: domain === 'properties' ? 'property' : 'process',
        entity_id: entityId,
        action: 'documents.send',
        new_data: {
          channels: {
            email: email
              ? {
                  account_id: email.account_id,
                  recipients: email.recipients.length,
                  subject: email.subject,
                }
              : null,
            whatsapp: whatsapp
              ? {
                  instance_id: whatsapp.instance_id,
                  recipients: whatsapp.recipients.length,
                }
              : null,
          },
          files: files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
          })),
          results,
        },
      })
    } catch (auditErr) {
      console.warn('[documents/send] audit insert failed:', auditErr)
    }

    return NextResponse.json({ results, attempted, succeeded })
  } catch (err) {
    console.error('[documents/send] Exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
