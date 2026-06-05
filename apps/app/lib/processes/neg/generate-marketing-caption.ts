/**
 * Geração de legenda de marketing IA para um momento de fecho de negócio
 * (CPCV / Escritura / Contrato Arrendamento / Entrega Chaves).
 *
 * Usa GPT-4o-mini com prompt PT-PT focado em Instagram/LinkedIn. Não usa
 * vision API — gera apenas a partir do contexto textual (event_type +
 * morada do imóvel + nome do consultor). As fotos são apenas attachments.
 *
 * Caller envolve em try/catch.
 */

import OpenAI from 'openai'

const MODEL = 'gpt-4o-mini'

export type MarketingCaptionContext = {
  moment_type: 'cpcv' | 'escritura' | 'contrato_arrendamento' | 'entrega_chaves'
  property_address?: string | null
  property_typology?: string | null
  consultant_name?: string | null
  business_type?: 'venda' | 'arrendamento' | 'trespasse' | string | null
}

const MOMENT_LABELS: Record<MarketingCaptionContext['moment_type'], string> = {
  cpcv: 'assinatura do Contrato de Promessa de Compra e Venda (CPCV)',
  escritura: 'escritura',
  contrato_arrendamento: 'assinatura do contrato de arrendamento',
  entrega_chaves: 'entrega de chaves',
}

export async function generateMarketingCaption(
  ctx: MarketingCaptionContext
): Promise<{ caption: string; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const openai = new OpenAI({ apiKey })

  const momentLabel = MOMENT_LABELS[ctx.moment_type]
  const contextLines: string[] = [`Momento: ${momentLabel}`]
  if (ctx.property_address) contextLines.push(`Imóvel: ${ctx.property_address}`)
  if (ctx.property_typology) contextLines.push(`Tipologia: ${ctx.property_typology}`)
  if (ctx.consultant_name) contextLines.push(`Consultor responsável: ${ctx.consultant_name}`)
  if (ctx.business_type) contextLines.push(`Tipo de negócio: ${ctx.business_type}`)

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    max_tokens: 350,
    messages: [
      {
        role: 'system',
        content: `És um assistente de marketing imobiliário para a Infinity Group (Portugal).
Geras uma legenda em PT-PT para publicação no Instagram/LinkedIn de um momento marcante de um negócio fechado.

Regras:
- 60 a 120 palavras
- Tom formal-descontraído, profissional, celebrativo
- Nunca uses nomes pessoais dos clientes — usa "os nossos clientes" ou "uma família"
- Realça o profissionalismo, a confiança e o acompanhamento ao longo do processo
- Inclui 3-5 hashtags relevantes em PT-PT no fim (ex.: #ImobiliariaPortuguesa #InfinityGroup #SonhosRealizados #CompraEVenda)
- Não inventes detalhes que não estejam no contexto
- Termina com uma chamada à acção curta (ex.: "Está a pensar comprar/vender? Fale connosco.")
- Responde APENAS com a legenda final em texto plano (sem comentários, sem markdown).`,
      },
      {
        role: 'user',
        content: contextLines.join('\n'),
      },
    ],
  })

  const caption = completion.choices?.[0]?.message?.content?.trim() ?? ''
  if (!caption) return null

  return { caption, model: MODEL }
}
