import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/permissions'
import { ensureDmMembership } from '@/lib/chat/membership'
import { getDmChannelId } from '@/lib/constants'
import { sendPushToUser } from '@/lib/crm/send-push'
import { FEEDBACK_TYPE_LABELS } from '@/types/feedback'

// ─────────────────────────────────────────────────────────────────────────
// Comentários no detalhe de feedback (tech pipeline)
//
// GET: lista comentários (mais antigo → mais novo, para fluir leitura
// estilo timeline). Inclui author hidratado.
//
// POST: cria comentário. Quando `send_via_chat=true`, dispara também uma
// DM ao destinatário escolhido — por defeito é o submetente original
// ("responder ao autor"); pode ser outro user para reencaminhar/pedir
// input. A mensagem de chat junta:
//   • Cabeçalho com tipo e título (preview do contexto)
//   • Quote do pedido original (description) cortado a 240 chars
//   • Remark do commenter
// O comentário é gravado SEMPRE em feedback_comments — sent_to_chat é
// só metadata; a observação não desaparece se o envio do chat falhar.
// ─────────────────────────────────────────────────────────────────────────

const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comentário vazio').max(4000),
  send_via_chat: z.boolean().optional(),
  // Default: submitter do feedback. Pass-through para reencaminhar.
  chat_recipient_id: z.string().uuid().optional().nullable(),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    // Tipos do Supabase ainda não conhecem `feedback_comments` (migration
    // 20260530). Cast minimal para `any` no `.from(...)` evita propagar
    // `as never` por todo o lado e mantém os campos visíveis na response.
    const db = supabase as unknown as { from: (t: string) => any }
    const { data, error } = await db
      .from('feedback_comments')
      .select(`
        id,
        content,
        sent_to_chat,
        sent_to_chat_at,
        chat_recipient_id,
        created_at,
        author:author_id(id, commercial_name),
        chat_recipient:chat_recipient_id(id, commercial_name)
      `)
      .eq('feedback_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('Erro ao listar comentários:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const userId = auth.user.id

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = createCommentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()
    // Cast minimal — a tabela `feedback_comments` (migration 20260530) ainda
    // não está nos tipos gerados. Resto continua tipado.
    const db = supabase as unknown as { from: (t: string) => any }

    // Carrega o feedback para o cabeçalho do chat + resolver submitter
    const { data: feedback, error: fetchErr } = await supabase
      .from('feedback_submissions')
      .select('id, type, title, description, submitted_by, images')
      .eq('id', id)
      .single()

    if (fetchErr || !feedback) {
      return NextResponse.json({ error: 'Feedback não encontrado' }, { status: 404 })
    }

    // Resolver autor (commercial_name) para o template do chat.
    const { data: authorRow } = await supabase
      .from('dev_users')
      .select('commercial_name')
      .eq('id', userId)
      .single()
    const authorName = authorRow?.commercial_name || 'Equipa Infinity'

    // Decidir destinatário do chat (quando aplicável)
    let chatRecipientId: string | null = null
    if (parsed.data.send_via_chat) {
      chatRecipientId = parsed.data.chat_recipient_id || feedback.submitted_by || null
      if (!chatRecipientId) {
        return NextResponse.json(
          { error: 'Sem destinatário para o chat — feedback anónimo e nenhum colega selecionado.' },
          { status: 400 },
        )
      }
      if (chatRecipientId === userId) {
        return NextResponse.json(
          { error: 'Não podes enviar a ti próprio.' },
          { status: 400 },
        )
      }
    }

    // 1) Gravar comentário (idempotente em si — não há dedup explícito;
    //    spam de duplicados é improvável no fluxo manual e não custa).
    const { data: comment, error: insertErr } = await db
      .from('feedback_comments')
      .insert({
        feedback_id: id,
        author_id: userId,
        content: parsed.data.content,
        sent_to_chat: !!parsed.data.send_via_chat,
        chat_recipient_id: chatRecipientId,
        sent_to_chat_at: parsed.data.send_via_chat ? new Date().toISOString() : null,
      })
      .select(`
        id,
        content,
        sent_to_chat,
        sent_to_chat_at,
        chat_recipient_id,
        created_at,
        author:author_id(id, commercial_name),
        chat_recipient:chat_recipient_id(id, commercial_name)
      `)
      .single()

    if (insertErr || !comment) {
      return NextResponse.json(
        { error: insertErr?.message || 'Erro ao gravar comentário' },
        { status: 500 },
      )
    }

    // 2) Despacho do chat (best-effort — falhas não revertem o comentário,
    //    mas devolvemos `chat_warning` para a UI alertar o consultor).
    let chatWarning: string | null = null
    if (parsed.data.send_via_chat && chatRecipientId) {
      try {
        const channelId = getDmChannelId(userId, chatRecipientId)
        const ensure = await ensureDmMembership(
          supabase as unknown as Parameters<typeof ensureDmMembership>[0],
          channelId,
          [userId, chatRecipientId],
        )
        if (!ensure.ok) {
          throw new Error(ensure.error)
        }

        const typeLabel = FEEDBACK_TYPE_LABELS[feedback.type as keyof typeof FEEDBACK_TYPE_LABELS] || feedback.type
        const isForward = feedback.submitted_by !== chatRecipientId
        const headerLine = isForward
          ? `📨 Reencaminhamento — ${typeLabel}: "${feedback.title}"`
          : `💬 Resposta ao teu ${typeLabel.toLowerCase()}: "${feedback.title}"`

        const descPreview = (feedback.description || '').trim()
        const descBlock = descPreview
          ? '\n\n' + descPreview.slice(0, 240).split('\n').map((l) => `> ${l}`).join('\n') + (descPreview.length > 240 ? '…' : '')
          : ''

        const remark = `\n\n— ${authorName}:\n${parsed.data.content}`
        const chatContent = headerLine + descBlock + remark

        // Se o ticket tem imagens, anexa-as à DM como attachments tipo
        // 'image'. Reutilizamos as URLs públicas do R2 — sem re-upload —
        // e marcamos has_attachments=true para o renderer das mensagens
        // saber que tem de carregar a relação.
        const ticketImages: string[] = Array.isArray(feedback.images)
          ? (feedback.images as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0)
          : []
        const hasImages = ticketImages.length > 0

        const { data: msg, error: msgErr } = await supabase
          .from('internal_chat_messages')
          .insert({
            channel_id: channelId,
            sender_id: userId,
            content: chatContent,
            mentions: [],
            parent_message_id: null,
            has_attachments: hasImages,
          })
          .select('id')
          .single()

        if (msgErr || !msg) {
          throw new Error(msgErr?.message || 'Erro ao inserir mensagem')
        }

        if (hasImages) {
          const attachmentRows = ticketImages.map((url) => {
            // O `storage_key` antigo do R2 não é recuperável a partir só
            // da URL pública; gravamos a URL como key (apenas usada para
            // delete via signed URL, que neste caso seria no-op porque o
            // ficheiro vive no bucket de feedback). file_name extraído do
            // último segmento (sem query string).
            const lastSeg = url.split('?')[0].split('/').pop() || 'imagem.jpg'
            return {
              message_id: msg.id,
              file_name: lastSeg,
              file_url: url,
              storage_key: url,
              attachment_type: 'image',
              uploaded_by: userId,
              mime_type: null as string | null,
              file_size: null as number | null,
            }
          })
          const { error: attErr } = await db
            .from('internal_chat_attachments')
            .insert(attachmentRows)
          if (attErr) {
            // Falha de attachments não rebenta o envio principal — a
            // mensagem fica sem imagens mas o texto chegou. Log only.
            console.error('Erro ao anexar imagens à DM:', attErr)
          }
        }

        // Push notification (best-effort) — informa o destinatário.
        try {
          await sendPushToUser(supabase, chatRecipientId, {
            title: isForward
              ? `${authorName} reencaminhou um ${typeLabel.toLowerCase()}`
              : `${authorName} comentou o teu ${typeLabel.toLowerCase()}`,
            body: parsed.data.content.slice(0, 120),
            url: `/dashboard/comunicacao/chat?dm=${userId}`,
            tag: `feedback-comment-${comment.id}`,
          })
        } catch (pushErr) {
          console.error('Push para destinatário do chat falhou:', pushErr)
        }
      } catch (chatErr) {
        console.error('Erro a despachar DM de comentário:', chatErr)
        chatWarning = chatErr instanceof Error ? chatErr.message : 'Erro a enviar via chat'
        // Reverter os campos de chat no comentário gravado, para a UI mostrar
        // que o envio falhou e o consultor poder reabrir o flow.
        await db
          .from('feedback_comments')
          .update({ sent_to_chat: false, sent_to_chat_at: null, chat_recipient_id: null })
          .eq('id', comment.id)
        ;(comment as Record<string, unknown>).sent_to_chat = false
        ;(comment as Record<string, unknown>).sent_to_chat_at = null
        ;(comment as Record<string, unknown>).chat_recipient_id = null
      }
    }

    return NextResponse.json({
      comment,
      chat_warning: chatWarning,
    })
  } catch (err) {
    console.error('Erro ao criar comentário:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
