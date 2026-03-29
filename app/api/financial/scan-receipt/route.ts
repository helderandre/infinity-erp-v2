import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { image } = await request.json()
    if (!image) {
      return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })
    }

    // Determine if base64 or URL
    const isUrl = image.startsWith('http')
    const imageContent = isUrl
      ? { type: 'image_url' as const, image_url: { url: image } }
      : { type: 'image_url' as const, image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `Analisa imagens de faturas/recibos portugueses e extrai dados estruturados. Responde APENAS com JSON valido, sem markdown.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analisa esta imagem de uma fatura/recibo portuguesa e extrai os seguintes campos:
- entity_name: Nome do fornecedor/empresa
- entity_nif: NIF do fornecedor
- amount_net: Valor sem IVA (numero)
- amount_gross: Valor com IVA (numero)
- vat_amount: Valor do IVA (numero)
- vat_pct: Taxa de IVA em percentagem (numero)
- invoice_number: Numero da fatura/recibo
- invoice_date: Data da fatura (formato YYYY-MM-DD)
- description: Descricao dos servicos/produtos
- category: Categoria sugerida (uma de: Rendas, Software & Subscricoes, Salarios, Portais Imobiliarios, Ofertas Consultores, Material Fisico, Servicos Profissionais, Outros)
- confidence: Confianca geral na extraccao de 0.0 a 1.0
- field_confidences: Objecto com confianca por campo (0.0 a 1.0) para cada campo extraido. Exemplo: { "entity_name": 0.95, "entity_nif": 0.9, "amount_net": 0.85, "amount_gross": 0.85, "vat_amount": 0.8, "vat_pct": 0.9, "invoice_number": 0.7, "invoice_date": 0.95, "description": 0.6 }. Se o campo for null, a confianca deve ser 0.0.

Se nao conseguires ler um campo, coloca null. Responde apenas com o objecto JSON.`,
            },
            imageContent,
          ],
        },
      ],
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 500 })
    }

    // Parse JSON (handle possible markdown wrapping)
    let parsed
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Erro ao interpretar resposta da IA', raw: content }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Erro ao digitalizar recibo:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
