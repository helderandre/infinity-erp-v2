import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { z } from 'zod'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * AI email draft endpoint.
 *
 * Two modes:
 *   1. Reply — caller provides original subject + body_text/html → AI drafts a reply.
 *   2. Compose from scratch — caller provides `instruction` (possibly a voice transcript)
 *      without an original email → AI drafts a fresh email including a subject.
 *
 * Response: { subject, body, signature_url, user_name }
 * Subject is always included — when replying, it's the user's original subject
 * (unchanged) unless the AI chooses a better one, and for fresh drafts it's generated.
 */
const schema = z.object({
  // Original email context (reply mode) — all optional
  subject: z.string().optional(),
  from_name: z.string().optional(),
  from_email: z.string().optional(),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  // Compose mode
  contact_name: z.string().optional(),   // recipient display name
  contact_email: z.string().optional(),
  // Common
  tone: z.enum(['professional', 'friendly', 'formal']).optional().default('professional'),
  instruction: z.string().optional(),    // user's free-text (or transcribed voice) instruction
})

const DRAFT_SCHEMA = {
  name: 'email_draft',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      subject: { type: 'string', description: 'Assunto do email, em PT-PT' },
      body: { type: 'string', description: 'Corpo do email em texto simples (sem HTML), em PT-PT' },
    },
    required: ['subject', 'body'],
  },
} as const

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('leads') as any
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const {
      subject, from_name, from_email, body_text, body_html,
      contact_name, contact_email, tone, instruction,
    } = validation.data

    const supabase = await createClient()
    const { data: user } = await supabase
      .from('dev_users')
      .select('commercial_name, dev_consultant_profiles(email_signature_url)')
      .eq('id', auth.user.id)
      .single()

    const userName = user?.commercial_name || 'Consultor'
    const signatureUrl = (user?.dev_consultant_profiles as { email_signature_url?: string | null } | null)?.email_signature_url || null

    const plainBody = body_text || (body_html
      ? body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
      : '')

    const toneMap = {
      professional: 'profissional e cortês',
      friendly: 'amigável mas profissional',
      formal: 'formal e respeitoso',
    }

    const isReply = !!(subject || plainBody || from_email)

    const systemPrompt = `És um redactor de emails para a imobiliária Infinity Group (Portugal).
Escreves em Português de Portugal (PT-PT). Tom: ${toneMap[tone]}.
O consultor que assina é: ${userName}.

REGRA CRÍTICA: Se o utilizador deu uma instrução sobre O QUE dizer, segue-a EXACTAMENTE. Se diz "não quero", "recusar", "não", "declinar" — a resposta DEVE ser uma recusa educada. NUNCA contradigas a intenção do utilizador.

Estilo do CORPO:
- Profissional e educado, sem ser excessivamente efusivo — directo mas cortês
- 2-4 parágrafos curtos. Nunca respostas secas de 1-2 linhas, mas também não exageres
- Começa com saudação simples (Ex: "Bom dia,", "Boa tarde,")
- PT-PT (não PT-BR): "Imóvel", "telemóvel", "morada"
- NÃO incluas saudação de fecho com nome (a assinatura é adicionada separadamente)
- Termina com "Com os melhores cumprimentos," ou "Atenciosamente," apenas (SEM nome)
- Texto simples — sem markdown, sem HTML

Estilo do ASSUNTO:
- Conciso (idealmente até 60 caracteres), sem emojis
- Reflecte o conteúdo principal da mensagem de forma clara
${isReply ? '- Se o email original já tem um assunto apropriado, reutiliza-o (com prefixo "Re: " se fizer sentido e ainda não existir)' : '- Cria um assunto novo adequado ao conteúdo'}

DEVOLVE SEMPRE um JSON com ambos os campos "subject" e "body".`

    const contextLines: string[] = []
    if (instruction) {
      contextLines.push(`INSTRUÇÃO DO UTILIZADOR (seguir obrigatoriamente): ${instruction}`)
    }
    if (isReply) {
      contextLines.push('')
      contextLines.push('Email a que estou a responder:')
      contextLines.push(`De: ${from_name || 'Desconhecido'} <${from_email || ''}>`)
      contextLines.push(`Assunto: ${subject || '(sem assunto)'}`)
      contextLines.push('')
      contextLines.push('Conteúdo:')
      contextLines.push(plainBody || '(sem conteúdo)')
    } else if (contact_name || contact_email) {
      contextLines.push('')
      contextLines.push(`Destinatário: ${contact_name || ''} <${contact_email || ''}>`)
    }
    contextLines.push('')
    contextLines.push(isReply ? 'Redige a resposta completa (assunto + corpo).' : 'Redige o email completo (assunto + corpo).')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextLines.join('\n') },
      ],
      response_format: { type: 'json_schema', json_schema: DRAFT_SCHEMA },
    })

    const raw = response.choices[0]?.message?.content || '{}'
    let parsed: { subject?: string; body?: string } = {}
    try { parsed = JSON.parse(raw) } catch {}

    return NextResponse.json({
      subject: parsed.subject || subject || '',
      body: parsed.body || '',
      // Legacy field for callers still expecting `draft`
      draft: parsed.body || '',
      signature_url: signatureUrl,
      user_name: userName,
    })
  } catch (error) {
    console.error('Erro ao gerar rascunho IA:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar rascunho' },
      { status: 500 }
    )
  }
}
