'use client'

import { useState, useCallback, useEffect } from 'react'
import { calculateMortgage, calculateStressTest } from '@/lib/credit/simulator'
import type { SimulationInput, SimulationResult, StressTestResult, CreditSimulation } from '@/types/credit'

interface UseCreditSimulatorReturn {
  result: SimulationResult | null
  stressTest: StressTestResult | null
  isCalculating: boolean
  calculate: (params: SimulationInput) => void
  save: (creditId: string, params: SimulationInput, label?: string) => Promise<void>
  savedSimulations: CreditSimulation[]
  loadSaved: (creditId: string) => Promise<void>
}

export function useCreditSimulator(): UseCreditSimulatorReturn {
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [stressTest, setStressTest] = useState<StressTestResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [savedSimulations, setSavedSimulations] = useState<CreditSimulation[]>([])

  const calculate = useCallback((params: SimulationInput) => {
    setIsCalculating(true)
    try {
      const taxaJuroAnual = params.euribor + params.spread
      const simResult = calculateMortgage({
        ...params,
        euribor: params.euribor,
        spread: params.spread,
      })
      setResult(simResult)

      if (params.euribor_cenarios && params.euribor_cenarios.length > 0) {
        const stress = calculateStressTest({
          montante_credito: params.montante_credito,
          valor_imovel: params.valor_imovel,
          prazo_anos: params.prazo_anos,
          spread: params.spread,
          euribor_actual: params.euribor,
          euribor_cenarios: params.euribor_cenarios,
          rendimento_mensal: params.rendimento_mensal,
        })
        setStressTest(stress)
      } else {
        // Default stress test: +1pp, +2pp, +3pp
        const stress = calculateStressTest({
          montante_credito: params.montante_credito,
          valor_imovel: params.valor_imovel,
          prazo_anos: params.prazo_anos,
          spread: params.spread,
          euribor_actual: params.euribor,
          euribor_cenarios: [
            params.euribor + 1,
            params.euribor + 2,
            params.euribor + 3,
          ],
          rendimento_mensal: params.rendimento_mensal,
        })
        setStressTest(stress)
      }
    } finally {
      setIsCalculating(false)
    }
  }, [])

  const save = useCallback(async (creditId: string, params: SimulationInput, label?: string) => {
    const res = await fetch(`/api/credit/${creditId}/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, label }),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao guardar simulação')
    }
    await loadSaved(creditId)
  }, [])

  const loadSaved = useCallback(async (creditId: string) => {
    const res = await fetch(`/api/credit/${creditId}/simulations`)
    if (res.ok) {
      const json = await res.json()
      setSavedSimulations(json.data || [])
    }
  }, [])

  return { result, stressTest, isCalculating, calculate, save, savedSimulations, loadSaved }
}
