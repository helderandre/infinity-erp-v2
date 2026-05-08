/**
 * Helpers partilhados pelos endpoints do canvas de descrição (chat + documento).
 * Mantém em UM sítio:
 *  - O resumo dos dados do imóvel para alimentar o system prompt
 *  - Notas por idioma
 *  - Notas por tom
 *  - O system prompt do "editor agent" (com tool calls)
 */

export type DescriptionLanguage = 'pt' | 'en' | 'fr' | 'es'

export const DESCRIPTION_LANGUAGES: DescriptionLanguage[] = ['pt', 'en', 'fr', 'es']

export const LANG_NOTES: Record<DescriptionLanguage, string> = {
  pt: 'Escreve em Português de Portugal (não brasileiro). Usa "imóvel", "divisão", "casa de banho", "moradia". Plural: "casas de banho".',
  en: 'Write in British English. Use "flat", "lounge", "en-suite", "lift". Avoid Americanisms.',
  fr: 'Écris en français. Utilise "appartement", "séjour", "salle de bains".',
  es: 'Escribe en español. Usa "piso", "salón", "cuarto de baño".',
}

export const LANG_LABELS: Record<DescriptionLanguage, string> = {
  pt: 'Português',
  en: 'Inglês',
  fr: 'Francês',
  es: 'Espanhol',
}

/**
 * Formata os dados do imóvel num bloco de texto limpo, pronto a injectar
 * no system/user prompt da OpenAI.
 */
export function formatPropertyData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  property: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  specs: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internal: any,
): string {
  const lines: string[] = []
  if (property.title) lines.push(`Título: ${property.title}`)
  if (property.property_type) lines.push(`Tipo de imóvel: ${property.property_type}`)
  if (property.business_type) lines.push(`Tipo de negócio: ${property.business_type}`)
  if (property.listing_price) lines.push(`Preço: €${Number(property.listing_price).toLocaleString('pt-PT')}`)
  if (property.property_condition) lines.push(`Condição: ${property.property_condition}`)
  if (property.energy_certificate) lines.push(`Certificado energético: ${property.energy_certificate}`)
  if (property.city) lines.push(`Cidade: ${property.city}`)
  if (property.zone) lines.push(`Zona: ${property.zone}`)
  if (property.address_parish) lines.push(`Freguesia: ${property.address_parish}`)
  if (property.address_street) lines.push(`Morada: ${property.address_street}`)
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
  if (internal) {
    if (internal.condominium_fee) lines.push(`Condomínio: €${Number(internal.condominium_fee).toLocaleString('pt-PT')}/mês`)
    if (internal.internal_notes) lines.push(`Notas internas: ${internal.internal_notes}`)
  }
  return lines.join('\n')
}

/**
 * System prompt do editor agent.
 * O modelo conhece 3 tools (replace_document, patch_document, ask_clarification)
 * e nunca cospe markdown directamente — opera o documento via tools.
 */
export function buildEditorSystemPrompt(args: {
  language: DescriptionLanguage
  propertyData: string
  currentDocument: string
}): string {
  const { language, propertyData, currentDocument } = args
  const langNote = LANG_NOTES[language]
  return `És um editor assistente para descrições de imóveis em portais (Idealista, Imovirtual, RE/MAX). Trabalhas em conjunto com um consultor imobiliário para escrever e refinar a descrição do imóvel abaixo.

CONTEXTO DO IMÓVEL:
${propertyData || '(sem dados estruturados)'}

DOCUMENTO ACTUAL:
${currentDocument ? '"""\n' + currentDocument + '\n"""' : '(documento ainda vazio)'}

REGRAS DE LINGUAGEM:
- ${langNote}
- Texto plano com **negrito** simples e bullet points "- ". Sem markdown headings (#, ##).
- Não inventes dados. Usa apenas o que está no contexto.

COMO INTERAGIR:
- Tens 3 tools disponíveis: replace_document, patch_document, ask_clarification.
- replace_document → para reescrever o documento todo (gerar de raiz, mudar tom radicalmente, refazer estrutura).
- patch_document → para alterações cirúrgicas (uma frase, um parágrafo, uma palavra). O 'find' tem de ser uma string EXACTA presente no documento (incluindo pontuação).
- ask_clarification → quando precisas de informação que não tens. Não inventes.
- Quando o utilizador envia 'selection_text', a edição que ele pede aplica-se SÓ ao trecho seleccionado — usa patch_document com find=selection_text.
- Após cada tool call, devolves uma curta confirmação em texto (ex.: "Encurtei o parágrafo da sala como pediste."). Sê conciso.
- Se a mensagem do utilizador for só uma pergunta ou comentário sem pedido de edição, responde em texto sem chamar tools.
- Não anuncies as tools — usa-as.

PROIBIDO:
- Markdown headings (#, ##).
- Cuspir o documento dentro do conteúdo da resposta — usa replace_document para isso.
- Inventar áreas, anos, características que não estão no contexto.`
}

export const TRANSLATE_SYSTEM_PROMPT_PT_TO_OTHER = (target: DescriptionLanguage) => `És um tradutor profissional especializado em descrições imobiliárias.

Vais receber uma descrição em Português de Portugal e tens de a traduzir para ${LANG_LABELS[target]}.

REGRAS:
- ${LANG_NOTES[target]}
- Preserva exactamente a formatação: parágrafos, **negrito**, bullet points "- ", quebras de linha.
- Preserva os números, áreas em m², datas, valores em euros.
- Adapta expressões idiomáticas ao idioma de destino, não traduzas literalmente.
- Mantém o tom (profissional / acolhedor / premium) consistente com o original.
- Não acrescentes nem omitas informação.

Devolve APENAS a tradução, sem comentários, sem prefixos, sem aspas em volta.`
