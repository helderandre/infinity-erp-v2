import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET(
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

    // Buscar dados do negocio + lead
    const { data: negocio, error } = await supabase
      .from('negocios')
      .select('*, lead:leads(nome, email, telemovel)')
      .eq('id', id)
      .single()

    if (error || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // Formatar campos preenchidos
    const fieldLabels: Record<string, string> = {
      tipo: 'Tipo de negócio',
      estado: 'Estado',
      tipo_imovel: 'Tipo de imóvel',
      localizacao: 'Localização',
      estado_imovel: 'Estado do imóvel',
      orcamento: 'Orçamento mínimo',
      orcamento_max: 'Orçamento máximo',
      quartos_min: 'Quartos mínimos',
      area_min_m2: 'Área mínima',
      preco_venda: 'Preço de venda',
      renda_max_mensal: 'Renda máxima',
      renda_pretendida: 'Renda pretendida',
      motivacao_compra: 'Motivação',
      prazo_compra: 'Prazo',
      credito_pre_aprovado: 'Crédito pré-aprovado',
      financiamento_necessario: 'Financiamento necessário',
      valor_credito: 'Valor do crédito',
      capital_proprio: 'Capital próprio',
      observacoes: 'Observações',
    }

    const filledFields: string[] = []
    for (const [key, label] of Object.entries(fieldLabels)) {
      const val = (negocio as Record<string, unknown>)[key]
      if (val !== null && val !== undefined && val !== '') {
        filledFields.push(`- ${label}: ${val}`)
      }
    }

    const lead = negocio.lead as { nome: string; email: string | null; telemovel: string | null } | null
    const leadName = lead?.nome || 'Cliente desconhecido'

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Gera um resumo profissional em português de Portugal (2-4 parágrafos) sobre este negócio imobiliário. O resumo deve ser claro, conciso e adequado para partilhar com colegas.`,
        },
        {
          role: 'user',
          content: `Cliente: ${leadName}
Email: ${lead?.email || 'não disponível'}
Telemóvel: ${lead?.telemovel || 'não disponível'}

Dados do negócio:
${filledFields.join('\n') || 'Sem dados preenchidos'}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.4,
    })

    const summary = completion.choices[0]?.message?.content || 'Não foi possível gerar o resumo.'

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Erro ao gerar resumo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
