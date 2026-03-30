import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { z } from 'zod'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const schema = z.object({
  subject: z.string(),
  from_name: z.string().optional(),
  from_email: z.string().optional(),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  tone: z.enum(['professional', 'friendly', 'formal']).optional().default('professional'),
  instruction: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('leads') as any
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { subject, from_name, from_email, body_text, body_html, tone, instruction } = validation.data

    // Get current user's name for signing
    const supabase = await createClient()
    const { data: user } = await supabase
      .from('dev_users')
      .select('commercial_name, dev_consultant_profiles(email_signature_url)')
      .eq('id', auth.user.id)
      .single()

    const userName = user?.commercial_name || 'Consultor'
    const signatureUrl = (user?.dev_consultant_profiles as { email_signature_url?: string | null } | null)?.email_signature_url || null

    // Strip HTML tags for context
    const plainBody = body_text || (body_html
      ? body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
      : '')

    const toneMap = {
      professional: 'profissional e cortês',
      friendly: 'amigável mas profissional',
      formal: 'formal e respeitoso',
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `És um redactor de emails para a imobiliária Infinity Group (Portugal).
Escreves em Português de Portugal (PT-PT). Tom: ${toneMap[tone]}.
O consultor que assina é: ${userName}.

REGRA CRÍTICA: Se o utilizador deu uma instrução sobre O QUE responder, segue-a EXACTAMENTE. Se diz "não quero", "recusar", "nao", "declinar" — a resposta DEVE ser uma recusa educada. NUNCA contradigas a intenção do utilizador.

Estilo:
- Profissional e educado, sem ser excessivamente efusivo — directo mas cortês
- Ao recusar, agradece brevemente e indica o motivo de forma clara
- Usa 2-4 parágrafos curtos. Nunca respostas secas de 1-2 linhas, mas também não exageres
- Começa com saudação simples (Ex: "Bom dia,", "Boa tarde,")
- PT-PT (não PT-BR): "Imóvel", "telemóvel", "morada"
- NÃO incluas saudação de fecho com nome (a assinatura é adicionada separadamente)
- NÃO termines com "Cumprimentos, [Nome]" ou similar — termina com "Com os melhores cumprimentos," ou "Atenciosamente," apenas
- Se for sobre imóveis, usa terminologia imobiliária portuguesa`,
        },
        {
          role: 'user',
          content: `${instruction ? `INSTRUÇÃO DO UTILIZADOR (seguir obrigatoriamente): ${instruction}\n\n` : ''}Email a que estou a responder:
De: ${from_name || 'Desconhecido'} <${from_email || ''}>
Assunto: ${subject}

Conteúdo:
${plainBody || '(sem conteúdo)'}

${instruction ? 'Redige a resposta seguindo a instrução acima.' : 'Redige uma resposta adequada.'}`,
        },
      ],
    })

    const draft = response.choices[0]?.message?.content || ''

    return NextResponse.json({
      draft,
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
