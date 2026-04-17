import { createClient } from '@/lib/supabase/server'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

const CATEGORY_LABELS: Record<string, string> = {
  aniversario_contacto: 'Aniversário do contacto (parabéns ao lead/cliente)',
  aniversario_fecho: 'Aniversário de fecho de negócio',
  natal: 'Natal (Boas Festas)',
  ano_novo: 'Ano Novo',
  festividade: 'Festividade genérica',
  boas_vindas: 'Boas-vindas a novo cliente/lead',
  follow_up: 'Follow-up após contacto ou visita',
  lembrete: 'Lembrete (reunião, visita, documento)',
  documentos: 'Envio ou pedido de documentos',
  notificacao: 'Notificação geral',
  marketing: 'Marketing / promoção',
  custom: 'Template personalizado',
  geral: 'Template geral',
  outro: 'Outro',
}

const BASE_SYSTEM_PROMPT = `És um assistente especializado em criar templates de mensagens WhatsApp para uma imobiliária portuguesa (Infinity Group).
Geras uma sequência de mensagens WhatsApp que simula uma conversa natural e profissional.

## Regras de Formatação WhatsApp

O texto das mensagens usa formatação nativa do WhatsApp:
- *texto* para negrito
- _texto_ para itálico
- ~texto~ para rasurado
- Emojis nativos (🎂, 🎉, 📱, 🏠, etc.) — usa com moderação
- \\n para quebras de linha

## Variáveis Disponíveis

Insere variáveis no texto usando a sintaxe {{key}}:

CONSULTOR: {{consultor_nome}}, {{consultor_email}}, {{consultor_telefone}}, {{consultor_telefone2}}
IMÓVEL: {{imovel_tipologia}}, {{imovel_tipo}}, {{imovel_ref}}, {{imovel_titulo}}, {{imovel_morada}}, {{imovel_preco}}, {{imovel_area}}, {{imovel_cert_energetica}}
LEAD: {{lead_nome}}, {{lead_email}}, {{lead_telefone}}, {{lead_telemovel}}, {{lead_origem}}, {{lead_estado}}, {{lead_temperatura}}
NEGÓCIO: {{negocio_tipo}}, {{negocio_estado}}, {{negocio_orcamento}}
PROCESSO: {{processo_ref}}
PROPRIETÁRIO: {{proprietario_nome}}, {{proprietario_email}}, {{proprietario_telefone}}, {{proprietario_morada}}
SISTEMA: {{hora_actual}}, {{data_actual}}, {{empresa_nome}}

## Formato de Resposta

Responde APENAS com dois blocos delimitados. Sem texto antes, entre, ou depois.

**Bloco 1 — Metadados:**
:::WPP_META_START:::
{
  "name": "Nome curto do template (máx. 50 chars)",
  "description": "Descrição breve de quando usar este template",
  "category": "uma das categorias válidas"
}
:::WPP_META_END:::

**Bloco 2 — Mensagens:**
:::WPP_MESSAGES_START:::
[
  {
    "type": "text",
    "content": "Primeira mensagem...",
    "delay": 0
  },
  {
    "type": "text",
    "content": "Segunda mensagem com *negrito* e {{lead_nome}}...",
    "delay": 3
  }
]
:::WPP_MESSAGES_END:::

## Regras

- Usa SEMPRE português de Portugal (PT-PT). "Telemóvel" não "celular", "morada" não "endereço".
- Gera entre 2 e 4 mensagens por template (nunca mais de 5).
- A primeira mensagem tem delay: 0 (enviada imediatamente).
- As restantes mensagens têm delay entre 2 e 5 segundos (simula "a escrever...").
- Cada mensagem deve ser curta e natural — como uma pessoa a escrever no WhatsApp, não um email formal.
- Usa parágrafos curtos (1-2 frases por mensagem).
- Cada mensagem tem apenas type: "text" (v1 não suporta media gerada por IA).
- Usa variáveis quando o contexto pedir dados dinâmicos.
- As categorias válidas são: boas_vindas, follow_up, lembrete, documentos, notificacao, marketing, aniversario_contacto, aniversario_fecho, natal, ano_novo, festividade, custom, geral, outro.
- Responde APENAS com os blocos delimitados. Sem explicações.
`

function buildContextPrompt(
  scope: string | undefined,
  category: string | undefined,
  consultant: { name: string; bio: string | null; specializations: string[] | null; phone: string | null } | null
): string {
  const parts: string[] = []

  if (scope === 'consultant' && consultant) {
    parts.push(`## Contexto: Template pessoal do consultor`)
    parts.push(`O consultor "${consultant.name}" está a criar um template pessoal para enviar aos seus contactos/leads.`)
    parts.push(`IMPORTANTE: Escreve na PRIMEIRA PESSOA do singular, como se fosse o próprio consultor a escrever no WhatsApp.`)
    parts.push(`Tom: pessoal, caloroso, directo — como uma pessoa real a enviar mensagens. Não uses linguagem corporativa.`)
    parts.push(`Usa {{consultor_nome}} para a assinatura e {{lead_nome}} para o nome do destinatário.`)
    if (consultant.bio) {
      parts.push(`Bio do consultor: "${consultant.bio}"`)
    }
    if (consultant.specializations?.length) {
      parts.push(`Especializações: ${consultant.specializations.join(', ')}`)
    }
    if (consultant.phone) {
      parts.push(`Contacto directo: ${consultant.phone}`)
    }
  } else if (scope === 'global') {
    parts.push(`## Contexto: Template global da empresa`)
    parts.push(`Template institucional da Infinity Group. Tom profissional mas acessível — é WhatsApp, não email.`)
  }

  if (category && CATEGORY_LABELS[category]) {
    parts.push(`\n## Tipo: ${CATEGORY_LABELS[category]}`)

    if (category === 'aniversario_contacto') {
      parts.push(`Mensagens de aniversário — calorosas, pessoais, celebratórias. NÃO mencionar idade.`)
    } else if (category === 'natal') {
      parts.push(`Mensagens de Natal — festivas, calorosas, com votos de Boas Festas.`)
    } else if (category === 'ano_novo') {
      parts.push(`Mensagens de Ano Novo — optimistas, com votos de prosperidade.`)
    } else if (category === 'boas_vindas') {
      parts.push(`Mensagens de boas-vindas a novo lead/cliente — acolhedoras, apresentação breve, disponibilidade.`)
    } else if (category === 'follow_up') {
      parts.push(`Follow-up após contacto ou visita — relembrar, mostrar interesse, próximos passos.`)
    }
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n') : ''
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })
    }

    const body = await request.json()
    const { prompt, scope, category } = body

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt é obrigatório' }), { status: 400 })
    }

    // Fetch consultant data if scope is consultant
    let consultant: { name: string; bio: string | null; specializations: string[] | null; phone: string | null } | null = null

    if (scope === 'consultant') {
      const { data: userData } = await supabase
        .from('dev_users')
        .select(`
          commercial_name,
          dev_consultant_profiles(bio, specializations, phone_commercial)
        `)
        .eq('id', user.id)
        .single()

      if (userData) {
        const profile = userData.dev_consultant_profiles as { bio: string | null; specializations: string[] | null; phone_commercial: string | null } | null
        consultant = {
          name: userData.commercial_name,
          bio: profile?.bio ?? null,
          specializations: profile?.specializations ?? null,
          phone: profile?.phone_commercial ?? null,
        }
      }
    }

    const contextPrompt = buildContextPrompt(scope, category, consultant)
    const fullSystemPrompt = BASE_SYSTEM_PROMPT + contextPrompt

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: fullSystemPrompt,
      prompt: prompt.trim(),
      temperature: 0.7,
      maxOutputTokens: 3000,
    })

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[wpp-ai-generate] Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
}
