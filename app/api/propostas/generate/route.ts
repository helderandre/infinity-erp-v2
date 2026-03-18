import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fillProposta } from '@/lib/pdf/fill-proposta'
import type { PropostaData } from '@/types/proposta'

/**
 * POST /api/propostas/generate
 *
 * Generates a filled "Proposta de Compra" PDF from ERP data.
 *
 * Body:
 * - property_id: UUID of the property
 * - lead_id: UUID of the lead (buyer/proponente)
 * - preco: number (proposed price)
 * - valor_contrato: number (deposit on contract signing)
 * - valor_conclusao: number (final payment)
 * - natureza: 'arrendamento' | 'propriedade_plena' | 'cedencia_posicao' | 'superficie' | 'outro'
 * - natureza_outro?: string
 * - tem_financiamento: boolean
 * - valor_financiamento?: number
 * - valor_reforco_1?: number
 * - data_reforco_1?: string (DD/MM/YYYY)
 * - valor_reforco_2?: number
 * - data_reforco_2?: string (DD/MM/YYYY)
 * - condicoes_complementares?: string
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      property_id,
      lead_id,
      preco,
      valor_contrato,
      valor_conclusao,
      natureza = 'propriedade_plena',
      natureza_outro,
      tem_financiamento = false,
      valor_financiamento,
      valor_reforco_1,
      data_reforco_1,
      valor_reforco_2,
      data_reforco_2,
      condicoes_complementares,
    } = body

    if (!property_id || !lead_id) {
      return NextResponse.json(
        { error: 'property_id e lead_id são obrigatórios' },
        { status: 400 }
      )
    }

    // Fetch property with owner
    const { data: property, error: propError } = await supabase
      .from('dev_properties')
      .select(`
        *,
        property_owners(
          is_main_contact,
          owners(name)
        )
      `)
      .eq('id', property_id)
      .single()

    if (propError || !property) {
      return NextResponse.json(
        { error: 'Imóvel não encontrado' },
        { status: 404 }
      )
    }

    // Fetch lead (buyer)
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead não encontrado' },
        { status: 404 }
      )
    }

    // Get main owner name
    const mainOwner = property.property_owners?.find(
      (po: { is_main_contact: boolean; owners: { name: string } }) => po.is_main_contact
    )
    const ownerName = mainOwner?.owners?.name
      || property.property_owners?.[0]?.owners?.name
      || ''

    // Build reference
    const angariacao = property.external_ref || property.slug || property.id.slice(0, 8)

    // Today's date in DD/MM/YYYY
    const today = new Date()
    const dataProposta = [
      String(today.getDate()).padStart(2, '0'),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getFullYear()),
    ].join('/')

    const propostaData: PropostaData = {
      proprietario_nome: ownerName,
      proponente_nome: lead.nome || lead.name || '',
      morada: property.address_street || '',
      concelho: property.city || '',
      zona: property.zone || '',
      angariacao_ref: angariacao,
      natureza,
      natureza_outro,
      tem_financiamento,
      valor_financiamento,
      preco: preco ?? property.listing_price ?? 0,
      valor_contrato: valor_contrato ?? 0,
      valor_conclusao: valor_conclusao ?? 0,
      valor_reforco_1,
      data_reforco_1,
      valor_reforco_2,
      data_reforco_2,
      data_proposta: dataProposta,
      condicoes_complementares,
    }

    const pdfBytes = await fillProposta(propostaData)

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="proposta-${angariacao}-${lead.name?.replace(/\s+/g, '_') || 'proponente'}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Erro ao gerar proposta:', error)
    return NextResponse.json(
      { error: 'Erro interno ao gerar proposta' },
      { status: 500 }
    )
  }
}
