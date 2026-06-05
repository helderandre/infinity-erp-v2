import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { simulationSchema } from '@/lib/validations/credit'
import { calculateMortgage, calculateStressTest } from '@/lib/credit/simulator'

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = simulationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const input = validation.data
    const taxaJuro = input.euribor + input.spread

    const result = calculateMortgage({
      valor_imovel: input.valor_imovel,
      montante_credito: input.montante_credito,
      prazo_anos: input.prazo_anos,
      euribor: input.euribor,
      spread: input.spread,
      rendimento_mensal: input.rendimento_mensal,
    })

    let stress_test = undefined
    if (input.euribor_cenarios && input.euribor_cenarios.length > 0) {
      stress_test = calculateStressTest({
        montante_credito: input.montante_credito,
        valor_imovel: input.valor_imovel,
        prazo_anos: input.prazo_anos,
        spread: input.spread,
        euribor_actual: input.euribor,
        euribor_cenarios: input.euribor_cenarios,
        rendimento_mensal: input.rendimento_mensal,
      })
    }

    return NextResponse.json({ result, stress_test })
  } catch (error) {
    console.error('Erro ao calcular simulação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
