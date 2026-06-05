import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { simulationSchema } from '@/lib/validations/credit'
import { calculateMortgage } from '@/lib/credit/simulator'

const uuidRegex = /^[0-9a-f-]{36}$/

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id } = await params

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const { data, error } = await db
      .from('temp_credito_simulacoes')
      .select('*')
      .eq('pedido_credito_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar simulações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id } = await params

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const body = await request.json()
    const validation = simulationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const input = validation.data

    // Calcular simulação
    const result = calculateMortgage({
      valor_imovel: input.valor_imovel,
      montante_credito: input.montante_credito,
      prazo_anos: input.prazo_anos,
      euribor: input.euribor,
      spread: input.spread,
      rendimento_mensal: input.rendimento_mensal,
    })

    const taxaJuro = input.euribor + input.spread

    // Guardar na BD
    const { data: simulacao, error } = await db
      .from('temp_credito_simulacoes')
      .insert({
        pedido_credito_id: id,
        label: input.label || null,
        valor_imovel: input.valor_imovel,
        montante_credito: input.montante_credito,
        prazo_anos: input.prazo_anos,
        euribor: input.euribor,
        spread: input.spread,
        taxa_juro: taxaJuro,
        prestacao_mensal: result.prestacao_mensal,
        total_juros: result.total_juros,
        mtic: result.mtic,
        ltv: result.ltv,
        taxa_esforco: result.taxa_esforco || null,
        imposto_selo_credito: result.imposto_selo_credito,
        seguro_vida_mensal_estimado: result.seguro_vida_mensal_estimado,
        seguro_multirriscos_anual_estimado: result.seguro_multirriscos_anual_estimado,
        encargo_credito_mensal: result.encargo_credito_mensal,
        notas: input.notas || null,
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao guardar simulação', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(simulacao, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar simulação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
