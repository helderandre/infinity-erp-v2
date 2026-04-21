import { createClient } from '@/lib/supabase/server'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

const CATEGORY_LABELS: Record<string, string> = {
  aniversario_contacto: 'Aniversário do contacto (parabéns ao lead/cliente)',
  aniversario_fecho: 'Aniversário de fecho de negócio (celebrar a data da compra/venda)',
  natal: 'Natal (Boas Festas)',
  ano_novo: 'Ano Novo (votos para o novo ano)',
  festividade: 'Festividade genérica',
  custom: 'Template personalizado',
  geral: 'Template geral',
}

const BASE_SYSTEM_PROMPT = `És um assistente especializado em criar templates de email para uma imobiliária portuguesa (Infinity Group).
Geras o corpo do email em formato JSON Craft.js. O header e footer são fixos — geras APENAS os nós do corpo (body).

## Componentes Disponíveis

Usa apenas estes componentes para montar o corpo do email:

### EmailContainer
Contentor flexbox. Props: direction ("column"|"row"), align, justify, gap (number), padding (number), background (hex), width, borderRadius, boxShadow ("none"|"sm"|"md"|"lg").
Usa isCanvas: true quando queres que tenha filhos.

### EmailHeading
Título. Props: html (string com texto, pode incluir variáveis), level ("h1"|"h2"|"h3"|"h4"), fontSize (number, default 24), fontWeight ("400"|"600"|"700"), color (hex), textAlign ("left"|"center"|"right"), fontFamily ("Arial, sans-serif"), padding (number).

### EmailText
Texto rico. Props: html (string HTML simples — pode ter <strong>, <em>, <a>, <ul>, <ol>, <li> e variáveis {{key}}), fontSize (number, default 16), color (hex, default "#000000"), textAlign, lineHeight (number, default 1.5), fontFamily.

### EmailButton
Botão CTA. Props: text (string), href (string URL ou variável), backgroundColor (hex, default "#576c98"), color (hex, default "#fafafa"), borderRadius ("65px"), fontSize (16), paddingX (24), paddingY (12), align ("left"|"center"|"right"), fullWidth (boolean), boxShadow.

### EmailDivider
Linha divisória. Props: color (hex, default "#e5e7eb"), thickness (number, default 1), marginY (number, default 16), style ("solid"|"dashed"|"dotted").

### EmailSpacer
Espaço vertical. Props: height (number, default 20).

### EmailGrid
Grelha multi-coluna. Props: columns (number, default 2), rows (number, default 1), gap (16), padding (0), background, borderRadius, borderColor, borderWidth. Usa isCanvas: true. Cada célula é um nó filho EmailContainer com isCanvas: true.

## Variáveis Disponíveis

Insere variáveis no html dos componentes de texto usando a sintaxe {{key}}:

CONSULTOR: {{consultor_nome}}, {{consultor_email}}, {{consultor_telefone}}, {{consultor_telefone2}}
IMÓVEL: {{imovel_tipologia}}, {{imovel_tipo}}, {{imovel_ref}}, {{imovel_titulo}}, {{imovel_morada}}, {{imovel_preco}}, {{imovel_area}}, {{imovel_cert_energetica}}
LEAD: {{lead_nome}}, {{lead_email}}, {{lead_telefone}}, {{lead_telemovel}}, {{lead_origem}}, {{lead_estado}}, {{lead_temperatura}}
NEGÓCIO: {{negocio_tipo}}, {{negocio_estado}}, {{negocio_orcamento}}
PROCESSO: {{processo_ref}}
PROPRIETÁRIO: {{proprietario_nome}}, {{proprietario_email}}, {{proprietario_telefone}}, {{proprietario_morada}}
SISTEMA: {{hora_actual}}, {{data_actual}}, {{empresa_nome}}

## Formato de Resposta

Responde APENAS com dois blocos delimitados. Sem texto antes, entre, ou depois.

**Bloco 1 — Metadados do template:**
:::EMAIL_META_START:::
{
  "name": "Nome do template (curto e descritivo, ex: 'Feliz Aniversário')",
  "subject": "Assunto do email (o que o destinatário vê, ex: 'Feliz Aniversário, {{lead_nome}}!')",
  "category": "uma das categorias: aniversario_contacto, aniversario_fecho, natal, ano_novo, festividade, custom, geral"
}
:::EMAIL_META_END:::

**Bloco 2 — Nós do corpo Craft.js:**
:::EMAIL_STATE_START:::
{
  "body-root": {
    "type": {"resolvedName": "EmailContainer"},
    "isCanvas": true,
    "props": {"direction": "column", "padding": 24, "gap": 16, "background": "#ffffff", "width": "100%", "align": "stretch", "justify": "flex-start"},
    "nodes": ["heading-1", "text-1"],
    "linkedNodes": {},
    "parent": null,
    "displayName": "EmailContainer",
    "custom": {},
    "hidden": false
  },
  "heading-1": { ... },
  "text-1": { ... }
}
:::EMAIL_STATE_END:::

Regras para metadados:
- "name": nome curto e descritivo do template em PT-PT (máx. 50 chars)
- "subject": assunto que aparece na caixa de entrada do destinatário, pode incluir variáveis {{key}}
- "category": escolhe a categoria mais adequada. Usa "aniversario_contacto" para aniversários do lead, "natal" para Natal, "ano_novo" para Ano Novo, "festividade" para outras festividades, "geral" para emails genéricos, "custom" para tudo o resto

## Regras

- Usa SEMPRE português de Portugal (PT-PT). "Telemóvel" não "celular", "morada" não "endereço".
- Gera emails profissionais e visualmente apelativos.
- Cada nó DEVE ter: type, isCanvas, props, nodes, linkedNodes, parent, displayName, custom, hidden.
- Os IDs dos nós devem ser descritivos (heading-1, text-1, button-1, etc.).
- O nó raiz ("body-root") tem parent: null.
- Todos os outros nós têm parent apontando para o pai correcto.
- NÃO uses EmailHeader, EmailFooter, EmailSignature, EmailAttachment, EmailPortalLinks ou EmailPropertyGrid.
- Usa variáveis quando o contexto pedir dados dinâmicos.
- Aplica boas práticas de design de email: espaçamento generoso, hierarquia visual clara, CTAs evidentes.
- Responde APENAS com os blocos delimitados. Sem explicações.
`

function buildContextPrompt(
  scope: string | undefined,
  category: string | undefined,
  consultant: { name: string; bio: string | null; specializations: string[] | null; phone: string | null } | null,
  automationName?: string | null,
  automationDescription?: string | null,
): string {
  const parts: string[] = []

  // Scope context
  if (scope === 'consultant' && consultant) {
    parts.push(`## Contexto: Template pessoal do consultor`)
    parts.push(`O consultor "${consultant.name}" está a criar um template pessoal para enviar aos seus contactos/leads.`)
    parts.push(`IMPORTANTE: Escreve o email na PRIMEIRA PESSOA do singular, como se fosse o próprio consultor a escrever.`)
    parts.push(`Usa um tom pessoal, caloroso e profissional. O consultor fala directamente ao destinatário.`)
    parts.push(`Usa a variável {{consultor_nome}} para a assinatura e {{lead_nome}} para o nome do destinatário.`)
    if (consultant.bio) {
      parts.push(`Bio do consultor: "${consultant.bio}" — usa isto para dar um toque pessoal se relevante.`)
    }
    if (consultant.specializations?.length) {
      parts.push(`Especializações: ${consultant.specializations.join(', ')}`)
    }
    if (consultant.phone) {
      parts.push(`Contacto directo: ${consultant.phone}`)
    }
  } else if (scope === 'global') {
    parts.push(`## Contexto: Template global da empresa`)
    parts.push(`Este é um template institucional da Infinity Group. Usa tom profissional e corporativo.`)
    parts.push(`Escreve na terceira pessoa ou em nome da empresa ("A equipa da Infinity Group deseja-lhe...").`)
  }

  // Custom automation context (when category is a UUID / custom event)
  if (automationName) {
    parts.push(`\n## Automação personalizada: "${automationName}"`)
    parts.push(`Este email é para a automação "${automationName}" — uma data comemorativa personalizada criada pelo consultor.`)
    if (automationDescription) {
      parts.push(`Descrição da automação: "${automationDescription}"`)
    }
    parts.push(`O conteúdo do email deve ser adequado a esta ocasião/data comemorativa.`)
    parts.push(`Usa um tom festivo e adequado ao tema "${automationName}".`)
    parts.push(`Usa {{lead_nome}} para o nome do destinatário e {{consultor_nome}} para a assinatura.`)
  }

  // Category context
  if (category && CATEGORY_LABELS[category]) {
    parts.push(`\n## Tipo de email: ${CATEGORY_LABELS[category]}`)

    if (category === 'aniversario_contacto') {
      parts.push(`Este email é enviado automaticamente no dia de aniversário do contacto.`)
      parts.push(`Deve ser caloroso, celebratório e mostrar que o consultor/empresa se lembra do cliente.`)
      parts.push(`Usa {{lead_nome}} para o nome do aniversariante. NÃO incluir idade.`)
    } else if (category === 'aniversario_fecho') {
      parts.push(`Este email é enviado no aniversário da data de fecho de um negócio (compra, venda ou arrendamento).`)
      parts.push(`Deve celebrar o marco, relembrar o momento, e manter a relação activa.`)
    } else if (category === 'natal') {
      parts.push(`Email de Boas Festas / Feliz Natal. Caloroso, festivo, com votos sinceros.`)
      parts.push(`Pode incluir agradecimento pela confiança ao longo do ano.`)
    } else if (category === 'ano_novo') {
      parts.push(`Email de Feliz Ano Novo. Optimista, com votos de prosperidade.`)
      parts.push(`Pode mencionar perspectivas para o novo ano no mercado imobiliário.`)
    } else if (category === 'festividade') {
      parts.push(`Email festivo genérico. Adapta ao tom da festividade descrita pelo utilizador.`)
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
    const { prompt, scope, category, automation_name, automation_description } = body

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

    // Build enriched system prompt
    const contextPrompt = buildContextPrompt(scope, category, consultant, automation_name, automation_description)
    const fullSystemPrompt = BASE_SYSTEM_PROMPT + contextPrompt

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: fullSystemPrompt,
      prompt: prompt.trim(),
      temperature: 0.7,
      maxOutputTokens: 4000,
    })

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[ai-generate] Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
}
