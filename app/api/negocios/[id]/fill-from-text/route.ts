import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serviço de IA não configurado' },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { text } = body as { text: string }

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Texto em falta' }, { status: 400 })
    }

    // Buscar tipo do negocio
    const { data: negocio, error: negError } = await supabase
      .from('negocios')
      .select('tipo')
      .eq('id', id)
      .single()

    if (negError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    const openai = new OpenAI({ apiKey })

    const isCompraEVenda = negocio.tipo === 'Compra e Venda'

    const systemPrompt = isCompraEVenda
      ? `Extrai dados estruturados do seguinte texto livre sobre um negócio imobiliário de tipo "Compra e Venda".
O cliente quer COMPRAR um imóvel e ao mesmo tempo VENDER outro. Distingue entre os dois lados.

Campos para a COMPRA (o que procura):
- tipo_imovel: string (Apartamento, Moradia, Terreno, etc.)
- localizacao: string (zonas/cidades pretendidas, separadas por vírgula se várias. Ex: "Lisboa, Cascais, Oeiras")
- estado_imovel: string (Novo, Usado, Para recuperação, etc.)
- orcamento: number (orçamento mínimo em euros)
- orcamento_max: number (orçamento máximo em euros)
- quartos_min: number
- area_min_m2: number
- motivacao_compra: string
- prazo_compra: string

Campos para a VENDA (o que vende):
- preco_venda: number (preço pretendido em euros)
- tipo_imovel_venda: string (tipo do imóvel que vende)
- localizacao_venda: string (localização do imóvel que vende, separadas por vírgula se várias)
- quartos: number (quartos do imóvel que vende)
- casas_banho: number
- area_m2: number
- distrito: string
- concelho: string
- freguesia: string

Campo comum:
- observacoes: string (informação que não encaixe noutros campos)

IMPORTANTE: Retorna um JSON PLANO (flat) com TODOS os campos ao mesmo nível. NÃO agrupes em sub-objectos como "compra" ou "venda". Usa os nomes exactos dos campos listados acima (ex: tipo_imovel, localizacao, preco_venda, tipo_imovel_venda, localizacao_venda). Valores numéricos devem ser números puros (sem € ou m²). Não incluas campos que não foram mencionados.`
      : `Extrai dados estruturados do seguinte texto livre sobre um negócio imobiliário de tipo "${negocio.tipo}".

Campos possíveis (usa apenas os que conseguires detectar):
- tipo_imovel: string (Apartamento, Moradia, Terreno, etc.)
- localizacao: string (zonas/cidades, separadas por vírgula se várias. Ex: "Lisboa, Cascais")
- estado_imovel: string (Novo, Usado, Para recuperação, etc.)
- orcamento: number (orçamento mínimo em euros)
- orcamento_max: number (orçamento máximo em euros)
- quartos_min: number
- area_min_m2: number
- preco_venda: number
- renda_max_mensal: number
- renda_pretendida: number
- motivacao_compra: string
- prazo_compra: string
- observacoes: string (informação que não encaixe noutros campos)

Retorna APENAS um JSON com os campos detectados. Valores numéricos devem ser números puros (sem € ou m²). Não incluas campos que não foram mencionados.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      max_tokens: 300,
      temperature: 0.2,
    })

    const responseText = completion.choices[0]?.message?.content || '{}'

    let result: Record<string, unknown>
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível extrair dados do texto' },
        { status: 422 }
      )
    }

    // Flatten nested objects (e.g. { compra: {...}, venda: {...} } → flat)
    const flat: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(result)) {
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flat, value as Record<string, unknown>)
      } else {
        flat[key] = value
      }
    }

    return NextResponse.json(flat)
  } catch (error) {
    console.error('Erro ao extrair dados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
