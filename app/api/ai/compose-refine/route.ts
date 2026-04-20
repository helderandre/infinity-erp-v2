import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

// Parses a short voice transcript in the context of composing an email/WhatsApp
// about a document the user is about to send. Returns a structured delta that
// the client applies: recipients to add, optional new subject/body, and a flag
// to trigger the send immediately.

const SYSTEM_PROMPT = `És um assistente a ajudar o utilizador a compor uma mensagem (Email ou WhatsApp) que tem de enviar a um ou mais contactos.

Recebes:
- O canal (Email ou WhatsApp)
- O assunto actual (só para email)
- O corpo actual da mensagem
- A transcrição do que o utilizador acabou de dizer

Interpreta o pedido e chama SEMPRE a tool "update_compose" com os deltas aplicáveis:
- Se o utilizador mencionar nomes de pessoas a quem enviar, coloca esses nomes em "recipient_names" (só os nomes, não prefixos tipo "ao", "à").
- Se o utilizador pedir para mudar o assunto (email), devolve "subject" com o novo assunto completo.
- Se o utilizador pedir para mudar ou acrescentar ao corpo, devolve "body" com o texto E escolhe "body_action": "replace" (substituir tudo) ou "append" (acrescentar ao fim).
- Se disser claramente para enviar agora ("envia", "manda", "podes enviar"), devolve "send_now": true.
- Português de Portugal, nunca inventes nomes ou dados.`

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const transcript: string = (body?.transcript ?? '').toString().trim()
    if (!transcript) {
      return NextResponse.json({ message: 'Transcrição vazia.' })
    }
    const channel: 'email' | 'whatsapp' = body?.channel === 'whatsapp' ? 'whatsapp' : 'email'
    const current = body?.current || {}
    const currentSubject = (current.subject ?? '').toString()
    const currentBody = (current.body ?? '').toString()

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'system',
          content: `Canal: ${channel}. Assunto actual: ${currentSubject || '—'}. Corpo actual: ${currentBody || '—'}.`,
        },
        { role: 'user', content: transcript },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'update_compose',
            description: 'Aplica alterações à composição.',
            parameters: {
              type: 'object',
              properties: {
                recipient_names: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Nomes de pessoas a adicionar aos destinatários.',
                },
                subject: { type: 'string', description: 'Novo assunto (email).' },
                body: { type: 'string', description: 'Corpo (completo ou fragmento).' },
                body_action: {
                  type: 'string',
                  enum: ['replace', 'append'],
                  description: 'replace = substituir corpo actual; append = acrescentar ao fim.',
                },
                send_now: { type: 'boolean' },
              },
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'update_compose' } },
    })

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
    let args: Record<string, any> = {}
    if (toolCall?.type === 'function') {
      try {
        args = JSON.parse(toolCall.function.arguments || '{}')
      } catch {
        args = {}
      }
    }

    // Resolve each recipient name against /api/leads by name.
    const names: string[] = Array.isArray(args.recipient_names)
      ? args.recipient_names.map((n: unknown) => String(n).trim()).filter(Boolean)
      : []

    type ResolvedContact = { id: string; nome: string; telemovel?: string; email?: string }
    const resolved: ResolvedContact[] = []
    const notFound: string[] = []

    for (const name of names) {
      const { data } = await supabase
        .from('leads')
        .select('id, nome, telemovel, email')
        .ilike('nome', `%${name}%`)
        .limit(3)
      const rows = (data || []) as any[]
      if (rows.length === 0) {
        notFound.push(name)
        continue
      }
      // Prefer exact (case-insensitive) match, then first result
      const exact = rows.find(
        (r) => String(r.nome ?? '').trim().toLowerCase() === name.toLowerCase()
      )
      const pick = exact || rows[0]
      resolved.push({
        id: String(pick.id),
        nome: String(pick.nome ?? ''),
        telemovel: pick.telemovel ? String(pick.telemovel) : undefined,
        email: pick.email ? String(pick.email) : undefined,
      })
    }

    return NextResponse.json({
      recipients_added: resolved,
      recipients_not_found: notFound,
      subject: typeof args.subject === 'string' ? args.subject : undefined,
      body: typeof args.body === 'string' ? args.body : undefined,
      body_action: args.body_action === 'append' ? 'append' : args.body_action === 'replace' ? 'replace' : undefined,
      send_now: args.send_now === true,
      transcript,
    })
  } catch (error) {
    console.error('Erro em compose-refine:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
