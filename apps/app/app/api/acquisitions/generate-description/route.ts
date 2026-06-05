import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { requirePermission } from '@/lib/auth/permissions'

// Generates a portal-ready property description for a NEW angariação. Unlike
// `/api/properties/[id]/generate-description` (which fetches the property from
// the DB), this works during creation: the consultor still hasn't saved the
// imóvel, so we accept the in-progress form snapshot plus optional voice notes
// (already transcribed by /api/transcribe) and generate a description from both.

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `És um copywriter profissional de imobiliária em Portugal, especializado em descrições de imóveis para portais (Idealista, Imovirtual, RE/MAX).

O teu objectivo é gerar UMA descrição profissional e completa, pronta a copiar para um portal imobiliário.

REGRAS DE FORMATAÇÃO:
- Texto plano, sem markdown (sem #, ##, ###).
- Títulos de secção em **negrito** simples, nunca com markdown headings.
- Bullet points com "- " para listar características.
- Destacar palavras-chave importantes em **negrito**.
- O output deve ser legível exactamente como está, sem necessidade de renderização.

REGRAS DE CONTEÚDO:
1. Escreve em Português de Portugal (não brasileiro). Usa "imóvel", "divisão", "casa de banho", "moradia".
2. Tom profissional e equilibrado, padrão de agência de referência. Se o imóvel tem características premium (preço > 500k, piscina, vistas), ajusta para tom mais sofisticado.
3. Não inventes dados — usa APENAS os fornecidos nos dados estruturados E nas notas de voz do consultor. Se faltar informação, omite.
4. As notas de voz do consultor são a fonte mais rica: incorpora detalhes sobre vizinhança, vivência, acabamentos, sensações, vistas, etc., mesmo que não estejam nos dados estruturados.
5. Preço: incluir se arrendamento (valor mensal). Para venda, não mencionar preço.

ESTRUTURA DA DESCRIÇÃO:
1. Título forte na primeira linha (tipologia + localização + destaque principal)
2. Parágrafo introdutório descrevendo o imóvel e o que o torna especial
3. Secção **Destaques** ou **Características principais** com bullet points
4. Secção **Localização** com bullet points (se houver dados sobre a zona)
5. Se arrendamento: secção **Condições** com valor mensal
6. Frase final de call-to-action (agendar visita) — integrada naturalmente, sem título "CTA"

Gera UMA descrição seguindo este estilo. Devolve APENAS o texto da descrição, sem comentários nem prefácio.`

interface SnapshotInput {
  title?: string
  property_type?: string
  business_type?: string
  listing_price?: number
  property_condition?: string
  energy_certificate?: string
  city?: string
  zone?: string
  address_parish?: string
  address_street?: string
  specifications?: {
    typology?: string
    bedrooms?: number
    bathrooms?: number
    area_gross?: number
    area_util?: number
    construction_year?: number | null
    parking_spaces?: number
    garage_spaces?: number
    has_elevator?: boolean
    features?: string[]
  }
}

function formatSnapshot(p: SnapshotInput): string {
  const lines: string[] = []
  if (p.title) lines.push(`Título: ${p.title}`)
  if (p.property_type) lines.push(`Tipo de imóvel: ${p.property_type}`)
  if (p.business_type) lines.push(`Tipo de negócio: ${p.business_type}`)
  if (p.listing_price) lines.push(`Preço: €${Number(p.listing_price).toLocaleString('pt-PT')}`)
  if (p.property_condition) lines.push(`Condição: ${p.property_condition}`)
  if (p.energy_certificate) lines.push(`Certificado energético: ${p.energy_certificate}`)
  if (p.city) lines.push(`Cidade: ${p.city}`)
  if (p.zone) lines.push(`Zona: ${p.zone}`)
  if (p.address_parish) lines.push(`Freguesia: ${p.address_parish}`)
  if (p.address_street) lines.push(`Morada: ${p.address_street}`)
  const s = p.specifications
  if (s) {
    if (s.typology) lines.push(`Tipologia: ${s.typology}`)
    if (s.bedrooms) lines.push(`Quartos: ${s.bedrooms}`)
    if (s.bathrooms) lines.push(`Casas de banho: ${s.bathrooms}`)
    if (s.area_gross) lines.push(`Área bruta: ${s.area_gross} m²`)
    if (s.area_util) lines.push(`Área útil: ${s.area_util} m²`)
    if (s.construction_year) lines.push(`Ano de construção: ${s.construction_year}`)
    if (s.parking_spaces) lines.push(`Estacionamentos: ${s.parking_spaces}`)
    if (s.garage_spaces) lines.push(`Garagens: ${s.garage_spaces}`)
    if (s.has_elevator) lines.push(`Elevador: Sim`)
    if (s.features?.length) lines.push(`Características: ${s.features.join(', ')}`)
  }
  return lines.join('\n')
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const voiceNotes = String(body.voice_notes ?? '').trim()
    const snapshot: SnapshotInput = body.snapshot ?? {}

    if (!voiceNotes && !snapshot.title) {
      return NextResponse.json(
        { error: 'Indique notas de voz ou pelo menos o título do imóvel.' },
        { status: 400 },
      )
    }

    const structured = formatSnapshot(snapshot)
    const userContent = [
      structured ? `Dados estruturados do imóvel:\n${structured}` : null,
      voiceNotes ? `Notas de voz do consultor (transcritas):\n${voiceNotes}` : null,
    ]
      .filter(Boolean)
      .join('\n\n')

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.8,
      max_tokens: 2500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    })

    const description = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!description) {
      return NextResponse.json({ error: 'A IA não devolveu descrição.' }, { status: 502 })
    }

    return NextResponse.json({ description })
  } catch (err) {
    console.error('[acquisitions/generate-description]', err)
    return NextResponse.json({ error: 'Erro interno ao gerar descrição.' }, { status: 500 })
  }
}
