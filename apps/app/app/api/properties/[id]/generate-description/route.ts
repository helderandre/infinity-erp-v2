import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'

const TONE_MAP: Record<string, string> = {
  professional:
    'Profissional e equilibrado, tom padrão de agência imobiliária de referência.',
  premium:
    'Luxo e exclusividade, linguagem sofisticada, enfatizar prestígio e raridade.',
  cozy: 'Acolhedor e familiar, enfatizar conforto, vizinhança, qualidade de vida.',
}

const LANG_NOTES: Record<string, string> = {
  pt: 'Escreve em Português de Portugal (não brasileiro). Usar "imóvel", "divisão", "casa de banho", "moradia".',
  en: 'Write in British English. Use "flat", "lounge", "en-suite", "lift".',
  fr: 'Écrire en français. Utiliser "appartement", "séjour", "salle de bains".',
  es: 'Escribir en español. Usar "piso", "salón", "cuarto de baño".',
}

function buildSystemPrompt(language: string, tone: string) {
  return `És um copywriter profissional de imobiliária em Portugal, especializado em descrições de imóveis para portais (Idealista, Imovirtual, RE/MAX).

O teu objectivo é gerar UMA descrição profissional e completa, pronta a copiar para um portal imobiliário.

REGRAS DE FORMATAÇÃO:
- Texto plano, sem markdown (sem #, ##, ###).
- Títulos de secção em **negrito** simples, nunca com markdown headings.
- Bullet points com "- " para listar características.
- Destacar palavras-chave importantes em **negrito**.
- O output deve ser legível exactamente como está, sem necessidade de renderização.

REGRAS DE CONTEÚDO:
1. ${LANG_NOTES[language] || LANG_NOTES.pt}
2. Tom: ${TONE_MAP[tone] || TONE_MAP.professional}
3. Não inventes dados — usa APENAS os fornecidos. Se faltar informação, omite.
4. Preço: incluir se arrendamento (valor mensal). Para venda, não mencionar preço.
5. Se o imóvel tem características premium (preço > 500k, piscina, vistas), ajusta o tom para mais sofisticado.

ESTRUTURA DA DESCRIÇÃO (seguir esta ordem, integrado num texto fluído):
1. Título forte na primeira linha (tipologia + localização + destaque principal)
2. Parágrafo introdutório descrevendo o imóvel e o que o torna especial
3. Secção **Destaques do apartamento/moradia** ou **Características principais** com bullet points
4. Secção **Localização** ou **Vantagens de viver em [zona]** com bullet points
5. Se arrendamento: secção **Condições** com valor mensal
6. Frase final de call-to-action (agendar visita) — integrada naturalmente, sem título "CTA"
7. Se arrendamento: menção obrigatória à Licença de Utilização como última linha:
   - Construído antes de 1951: "Dispensado de licença de utilização por ter sido inscrito na matriz antes de 1951, conforme o Decreto Lei nº 38382"
   - Construído depois de 1951: "Imóvel com Licença de Utilização válida"
   - Ano desconhecido: "Licença de Utilização disponível mediante solicitação"

EXEMPLOS DE REFERÊNCIA (segue este estilo):

Exemplo venda:
"**Apartamento T3 | Rua Gonçalves Crespo – Último Andar no Coração de Lisboa**
Descubra este magnífico apartamento T3, localizado no **6.º e último piso** de um edifício de referência, com **dois elevadores**, na prestigiada **Rua Gonçalves Crespo** — uma das zonas mais centrais e valorizadas de Lisboa.

**Principais características**
- Último andar de edifício construído em **1987** bem conservado.
- **Dois elevadores.**
- **Distribuição inteligente** dos espaços, com excelente aproveitamento das áreas.
- **Armários embutidos** em todas as divisões.
- **Excelente exposição solar**, com luz natural em todas as divisões.

**Distribuição e áreas**
- **Sala de estar** – 21,73 m², ampla e luminosa
- **Cozinha** – 8,00 m², funcional e bem organizada
- **Quarto 1** – 13,44 m²
- **Quarto 2** – 10,12 m²
- **Quarto 3** – 9,19 m²

**Localização privilegiada**
- Metro: Picoas, Saldanha e Marquês de Pombal a poucos minutos a pé
- Supermercados e comércio de proximidade
- Restaurantes, pastelarias e cafés com esplanada

Não perca esta oportunidade. Marque já a sua visita e venha descobrir o seu próximo lar em Lisboa."

Exemplo arrendamento:
"**Apartamento para Arrendamento, Avenidas Novas, Lisboa**
Uma proposta de elevada qualidade numa das zonas mais centrais de Lisboa, ideal para quem procura conforto, privacidade e uma localização estratégica.

* Apartamento totalmente a estrear num prédio novo, mobilado e equipado

**Destaques do apartamento**
* Elevador com acesso direto ao andar
* Duas suítes espaçosas
* Cozinha totalmente equipada, funcional e moderna
* Acabamentos de qualidade e ambiente contemporâneo

**Condições**
* Valor de arrendamento: **4.970€ mensais**
* Disponível para entrada imediata

Este apartamento oferece uma solução equilibrada entre conforto, localização e qualidade de vida.
Dispensado de licença de utilização por ter sido inscrito na matriz antes de 1951, conforme o Decreto Lei nº 38382"

Gera UMA descrição seguindo este estilo e as regras acima.`
}

function formatPropertyData(property: any, specs: any, internal: any) {
  const lines: string[] = []

  // Basic info
  if (property.title) lines.push(`Título: ${property.title}`)
  if (property.property_type) lines.push(`Tipo de imóvel: ${property.property_type}`)
  if (property.business_type) lines.push(`Tipo de negócio: ${property.business_type}`)
  if (property.listing_price) lines.push(`Preço: €${Number(property.listing_price).toLocaleString('pt-PT')}`)
  if (property.property_condition) lines.push(`Condição: ${property.property_condition}`)
  if (property.energy_certificate) lines.push(`Certificado energético: ${property.energy_certificate}`)

  // Location
  if (property.city) lines.push(`Cidade: ${property.city}`)
  if (property.zone) lines.push(`Zona: ${property.zone}`)
  if (property.address_parish) lines.push(`Freguesia: ${property.address_parish}`)
  if (property.address_street) lines.push(`Morada: ${property.address_street}`)

  // Specifications
  if (specs) {
    if (specs.typology) lines.push(`Tipologia: ${specs.typology}`)
    if (specs.bedrooms) lines.push(`Quartos: ${specs.bedrooms}`)
    if (specs.bathrooms) lines.push(`Casas de banho: ${specs.bathrooms}`)
    if (specs.area_gross) lines.push(`Área bruta: ${specs.area_gross} m²`)
    if (specs.area_util) lines.push(`Área útil: ${specs.area_util} m²`)
    if (specs.construction_year) lines.push(`Ano de construção: ${specs.construction_year}`)
    if (specs.parking_spaces) lines.push(`Estacionamentos: ${specs.parking_spaces}`)
    if (specs.garage_spaces) lines.push(`Garagens: ${specs.garage_spaces}`)
    if (specs.has_elevator) lines.push(`Elevador: Sim`)
    if (specs.fronts_count) lines.push(`Frentes: ${specs.fronts_count}`)
    if (specs.solar_orientation?.length) lines.push(`Orientação solar: ${specs.solar_orientation.join(', ')}`)
    if (specs.views?.length) lines.push(`Vistas: ${specs.views.join(', ')}`)
    if (specs.features?.length) lines.push(`Características: ${specs.features.join(', ')}`)
    if (specs.equipment?.length) lines.push(`Equipamentos: ${specs.equipment.join(', ')}`)
    if (specs.balcony_area) lines.push(`Varanda: ${specs.balcony_area} m²`)
    if (specs.pool_area) lines.push(`Piscina: ${specs.pool_area} m²`)
    if (specs.storage_area) lines.push(`Arrecadação: ${specs.storage_area} m²`)
  }

  // Internal
  if (internal) {
    if (internal.condominium_fee) lines.push(`Condomínio: €${Number(internal.condominium_fee).toLocaleString('pt-PT')}/mês`)
    if (internal.internal_notes) lines.push(`Notas internas: ${internal.internal_notes}`)
  }

  return lines.join('\n')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Serviço de IA não configurado' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { id } = await params
    const body = await request.json()
    const language = body.language || 'pt'
    const tone = body.tone || 'professional'
    const additionalNotes = body.additional_notes || ''
    const audioNotes = body.audio_notes || ''

    // Fetch property with specs and internal
    const { data: property, error: propError } = await supabase
      .from('dev_properties')
      .select('*, dev_property_specifications(*), dev_property_internal(*)')
      .eq('id', id)
      .single()

    if (propError || !property) {
      return new Response(JSON.stringify({ error: 'Imóvel não encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const specsRaw = property.dev_property_specifications
    const specs = Array.isArray(specsRaw) ? specsRaw[0] : specsRaw
    const internalRaw = property.dev_property_internal
    const internal = Array.isArray(internalRaw) ? internalRaw[0] : internalRaw

    const propertyData = formatPropertyData(property, specs, internal)

    const notes = [additionalNotes, audioNotes].filter(Boolean).join('\n\n')

    const openai = new OpenAI({ apiKey })

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      temperature: 0.8,
      max_tokens: 3000,
      messages: [
        { role: 'system', content: buildSystemPrompt(language, tone) },
        {
          role: 'user',
          content: `Dados do imóvel:\n${propertyData}${notes ? `\n\nNotas do consultor:\n${notes}` : ''}`,
        },
      ],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar descrição:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
