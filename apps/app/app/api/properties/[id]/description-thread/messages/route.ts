import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'
import {
  buildEditorSystemPrompt,
  formatPropertyData,
  DESCRIPTION_LANGUAGES,
  type DescriptionLanguage,
} from '@/lib/properties/description-prompt'

export const runtime = 'nodejs'

/**
 * POST /api/properties/[id]/description-thread/messages
 *
 * Body: { lang, content, selection_text? }
 *
 * Stream SSE com os seguintes events (linhas `data: {...}`):
 *  - { type: 'user_message', message }       — user msg persistida e ecoa de volta
 *  - { type: 'assistant_delta', delta }      — token a token
 *  - { type: 'tool_call', name, args }       — quando o modelo invoca uma tool
 *  - { type: 'document_updated', document }  — documento depois de aplicar a tool
 *  - { type: 'assistant_message', message }  — mensagem assistant final persistida
 *  - { type: 'error', error }
 *  - [DONE]
 *
 * Ao gravar a mensagem assistant final, sincroniza:
 *  - dev_properties.description_per_language[lang] = document
 *  - dev_properties.description = document (apenas para PT, compat portais)
 *  - property_description_threads.is_auto_generated = false (edição manual)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Serviço de IA não configurado' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const auth = await requirePermission('properties')
  if (!auth.authorized) return auth.response

  const { id: propertyId } = await params

  let body: { lang?: string; content?: string; selection_text?: string | null }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const lang: DescriptionLanguage = (body.lang as DescriptionLanguage) || 'pt'
  if (!DESCRIPTION_LANGUAGES.includes(lang)) {
    return new Response(JSON.stringify({ error: 'Idioma inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const userContent = (body.content || '').trim()
  if (!userContent) {
    return new Response(JSON.stringify({ error: 'Mensagem vazia' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const selectionText = body.selection_text?.trim() || null

  const supabase = await createClient()

  // Carregar imóvel + estado actual
  const { data: prop, error: propErr } = await supabase
    .from('dev_properties')
    .select('*, dev_property_specifications(*), dev_property_internal(*), description_per_language')
    .eq('id', propertyId)
    .single()
  if (propErr || !prop) {
    return new Response(JSON.stringify({ error: 'Imóvel não encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const specsRaw = prop.dev_property_specifications
  const specs = Array.isArray(specsRaw) ? specsRaw[0] : specsRaw
  const internalRaw = prop.dev_property_internal
  const internal = Array.isArray(internalRaw) ? internalRaw[0] : internalRaw
  const propertyData = formatPropertyData(prop, specs, internal)

  const perLang = (prop.description_per_language ?? {}) as Record<string, string>
  const currentDocument = perLang[lang] ?? (lang === 'pt' ? prop.description ?? '' : '')

  // Lookup-or-create da thread
  let { data: thread } = await supabase
    .from('property_description_threads')
    .select('*')
    .eq('property_id', propertyId)
    .eq('language', lang)
    .maybeSingle()

  if (!thread) {
    const { data: created, error: createErr } = await supabase
      .from('property_description_threads')
      .insert({
        property_id: propertyId,
        language: lang,
        created_by: auth.user.id,
      })
      .select()
      .single()
    if (createErr || !created) {
      return new Response(JSON.stringify({ error: createErr?.message || 'Erro ao criar thread' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    thread = created
  }

  // Histórico para o modelo (últimas 20 mensagens, sem snapshots)
  const { data: history } = await supabase
    .from('property_description_messages')
    .select('role, content, selection_text')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(20)

  // Persiste user message imediatamente
  const userMessageContent = selectionText
    ? `${userContent}\n\n[Selecção do utilizador]\n"${selectionText}"`
    : userContent
  const { data: userMsg, error: userMsgErr } = await supabase
    .from('property_description_messages')
    .insert({
      thread_id: thread.id,
      role: 'user',
      content: userMessageContent,
      selection_text: selectionText,
    })
    .select()
    .single()
  if (userMsgErr || !userMsg) {
    return new Response(JSON.stringify({ error: userMsgErr?.message || 'Erro ao gravar mensagem' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const openai = new OpenAI({ apiKey })

  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'replace_document',
        description:
          'Substitui o documento inteiro pelo texto fornecido. Usa quando o utilizador quer regerar do zero, mudar tom radicalmente, ou refazer estrutura.',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'O novo conteúdo completo do documento.',
            },
          },
          required: ['text'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'patch_document',
        description:
          'Substitui um trecho exacto do documento por outro. O parâmetro find tem de ser uma string EXACTA presente no documento (incluindo pontuação e espaços). Para edições cirúrgicas.',
        parameters: {
          type: 'object',
          properties: {
            find: {
              type: 'string',
              description:
                'String exacta a procurar no documento. Tem de existir literal — não regex, não fuzzy.',
            },
            replacement: {
              type: 'string',
              description: 'Texto que vai substituir o find.',
            },
          },
          required: ['find', 'replacement'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'ask_clarification',
        description:
          'Faz uma pergunta ao utilizador sem alterar o documento. Usa quando precisas de informação que não tens no contexto.',
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string' },
          },
          required: ['question'],
          additionalProperties: false,
        },
      },
    },
  ]

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildEditorSystemPrompt({
        language: lang,
        propertyData,
        currentDocument,
      }),
    },
    ...(history || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessageContent },
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      try {
        // Eco da user message para o cliente
        send({ type: 'user_message', message: userMsg })

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          stream: true,
          temperature: 0.7,
          max_tokens: 3000,
          tools,
          messages,
        })

        let assistantText = ''
        // Tool calls são streamed em fragmentos — acumula por index
        const toolCallsAcc: Record<
          number,
          { id?: string; name?: string; argsRaw: string }
        > = {}

        for await (const chunk of completion) {
          const choice = chunk.choices[0]
          if (!choice) continue
          const delta = choice.delta

          if (delta.content) {
            assistantText += delta.content
            send({ type: 'assistant_delta', delta: delta.content })
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { argsRaw: '' }
              if (tc.id) toolCallsAcc[idx].id = tc.id
              if (tc.function?.name) toolCallsAcc[idx].name = tc.function.name
              if (tc.function?.arguments) {
                toolCallsAcc[idx].argsRaw += tc.function.arguments
              }
            }
          }
        }

        // Aplicar tool calls (sequencialmente, na ordem que vieram)
        let updatedDocument = currentDocument
        let documentChanged = false

        const orderedCalls = Object.keys(toolCallsAcc)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => toolCallsAcc[Number(k)])

        for (const call of orderedCalls) {
          if (!call.name) continue
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(call.argsRaw || '{}')
          } catch {
            send({ type: 'error', error: `Argumentos inválidos em ${call.name}` })
            continue
          }
          send({ type: 'tool_call', name: call.name, args })

          if (call.name === 'replace_document' && typeof args.text === 'string') {
            updatedDocument = args.text
            documentChanged = true
          } else if (
            call.name === 'patch_document' &&
            typeof args.find === 'string' &&
            typeof args.replacement === 'string'
          ) {
            if (updatedDocument.includes(args.find)) {
              updatedDocument = updatedDocument.replace(args.find, args.replacement)
              documentChanged = true
            } else {
              // Find não bate — informa o cliente mas não falha o stream
              send({
                type: 'error',
                error: `Não encontrei o trecho "${args.find.slice(0, 60)}…" no documento. Edição ignorada.`,
              })
            }
          }
          // ask_clarification não muda o documento; só o text content da mensagem
        }

        if (documentChanged) {
          send({ type: 'document_updated', document: updatedDocument })
        }

        // Persiste assistant message
        const finalContent = assistantText.trim() || (documentChanged
          ? 'Pronto.'
          : 'Posso ajudar — o que queres mudar?')

        const { data: assistantMsg, error: aErr } = await supabase
          .from('property_description_messages')
          .insert({
            thread_id: thread!.id,
            role: 'assistant',
            content: finalContent,
            document_snapshot: documentChanged ? updatedDocument : null,
          })
          .select()
          .single()

        if (aErr) {
          send({ type: 'error', error: aErr.message })
        } else {
          send({ type: 'assistant_message', message: assistantMsg })
        }

        // Sincronização do documento na property + flag is_auto_generated=false
        if (documentChanged) {
          const newPerLang = { ...perLang, [lang]: updatedDocument }
          const propUpdate: Record<string, unknown> = {
            description_per_language: newPerLang,
            updated_at: new Date().toISOString(),
          }
          if (lang === 'pt') propUpdate.description = updatedDocument

          await supabase
            .from('dev_properties')
            .update(propUpdate)
            .eq('id', propertyId)

          await supabase
            .from('property_description_threads')
            .update({ is_auto_generated: false })
            .eq('id', thread!.id)
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro inesperado'
        send({ type: 'error', error: msg })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
