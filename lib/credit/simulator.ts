/**
 * Simulador de Crédito Habitação — Sistema de Amortização Português
 *
 * Em Portugal, o crédito habitação usa prestações constantes com revisão
 * periódica da taxa (Euribor 3M, 6M ou 12M + spread fixo).
 *
 * Para simulação assume-se taxa constante ao longo do prazo (cenário base).
 * O stress test permite avaliar impacto de subidas da Euribor.
 *
 * Impostos específicos de Portugal:
 * - IS sobre utilização de crédito: 0,6% do montante (CIST, verba 17.1.4)
 * - IS sobre juros: 4% sobre os juros de cada prestação (CIST, verba 17.3)
 *
 * Limites macroprudenciais (Recomendação BdP 1/2018, revista 2023):
 * - LTV: HPP ≤ 90%, HPS ≤ 80%, Investimento ≤ 70%
 * - DSTI: ≤ 50% (referência: 35%)
 * - Maturidade: max 40 anos; idade + prazo ≤ 75
 */

import type {
  SimulationInput,
  SimulationResult,
  AmortizationRow,
  StressTestResult,
} from '@/types/credit'

// Constantes fiscais Portugal
const IS_CREDITO = 0.006  // 0,6% — Imposto de Selo sobre utilização de crédito
const IS_JUROS = 0.04     // 4% — Imposto de Selo sobre juros

/**
 * Calcula uma simulação de crédito habitação completa.
 */
export function calculateMortgage(input: SimulationInput): SimulationResult {
  const {
    valor_imovel,
    montante_credito,
    prazo_anos,
    euribor,
    spread,
    rendimento_mensal,
  } = input

  const taxaAnual = euribor + spread
  const taxaMensal = taxaAnual / 100 / 12
  const nPrestacoes = prazo_anos * 12
  const capitalProprio = valor_imovel - montante_credito
  const ltv = (montante_credito / valor_imovel) * 100

  // Prestação constante (sistema português — recalculada a cada revisão,
  // mas para simulação assume-se taxa constante)
  let prestacaoMensal: number
  if (taxaMensal === 0) {
    prestacaoMensal = montante_credito / nPrestacoes
  } else {
    prestacaoMensal =
      montante_credito *
      (taxaMensal * Math.pow(1 + taxaMensal, nPrestacoes)) /
      (Math.pow(1 + taxaMensal, nPrestacoes) - 1)
  }

  // Tabela de amortização completa
  const tabelaAmortizacao: AmortizationRow[] = []
  let capitalEmDivida = montante_credito
  let totalJuros = 0
  let totalImpostoSeloJuros = 0

  for (let mes = 1; mes <= nPrestacoes; mes++) {
    const jurosMes = capitalEmDivida * taxaMensal
    const capitalMes = prestacaoMensal - jurosMes
    const isJurosMes = jurosMes * IS_JUROS
    capitalEmDivida -= capitalMes
    totalJuros += jurosMes
    totalImpostoSeloJuros += isJurosMes

    tabelaAmortizacao.push({
      mes,
      prestacao: round2(prestacaoMensal),
      capital: round2(capitalMes),
      juros: round2(jurosMes),
      imposto_selo_juros: round2(isJurosMes),
      capital_em_divida: Math.max(0, round2(capitalEmDivida)),
    })
  }

  // Custos únicos (Portugal)
  const impostoSeloCredito = montante_credito * IS_CREDITO

  // Estimativa de seguros (valores médios mercado português)
  const seguroVidaMensalEstimado = (montante_credito / 1000) * 0.3
  const seguroMultirriscosAnualEstimado = valor_imovel * 0.001

  // MTIC — Montante Total Imputado ao Consumidor (conforme regulamento BdP)
  const totalPrestacoes = prestacaoMensal * nPrestacoes
  const totalSeguros =
    seguroVidaMensalEstimado * nPrestacoes +
    seguroMultirriscosAnualEstimado * prazo_anos
  const mtic = totalPrestacoes + impostoSeloCredito + totalImpostoSeloJuros + totalSeguros

  // Encargo mensal total (para cálculo da taxa de esforço)
  const encargoCreditoMensal =
    prestacaoMensal +
    seguroVidaMensalEstimado +
    seguroMultirriscosAnualEstimado / 12

  // Taxa de esforço (DSTI — recomendação BdP)
  const taxaEsforco = rendimento_mensal
    ? (encargoCreditoMensal / rendimento_mensal) * 100
    : undefined

  return {
    prestacao_mensal: round2(prestacaoMensal),
    total_juros: round2(totalJuros),
    mtic: round2(mtic),
    ltv: round2(ltv),
    capital_proprio: round2(capitalProprio),
    taxa_esforco: taxaEsforco !== undefined ? round2(taxaEsforco) : undefined,
    imposto_selo_credito: round2(impostoSeloCredito),
    total_imposto_selo_juros: round2(totalImpostoSeloJuros),
    seguro_vida_mensal_estimado: round2(seguroVidaMensalEstimado),
    seguro_multirriscos_anual_estimado: round2(seguroMultirriscosAnualEstimado),
    encargo_credito_mensal: round2(encargoCreditoMensal),
    tabela_amortizacao: tabelaAmortizacao,
  }
}

/**
 * Stress test de Euribor — simula o impacto de subidas de taxa.
 *
 * Conforme recomendação BdP, os bancos devem avaliar a capacidade
 * de pagamento com subida de 3pp na taxa. Este simulador oferece
 * essa funcionalidade automaticamente.
 */
export function calculateStressTest(input: {
  montante_credito: number
  valor_imovel: number
  prazo_anos: number
  spread: number
  euribor_actual: number
  euribor_cenarios: number[]
  rendimento_mensal?: number
}): StressTestResult {
  const {
    montante_credito,
    valor_imovel,
    prazo_anos,
    spread,
    euribor_actual,
    euribor_cenarios,
    rendimento_mensal,
  } = input

  // Cenário base
  const base = calculateMortgage({
    valor_imovel,
    montante_credito,
    prazo_anos,
    euribor: euribor_actual,
    spread,
    rendimento_mensal,
  })

  // Cenários de stress
  const cenarios = euribor_cenarios.map((euribor) => {
    const result = calculateMortgage({
      valor_imovel,
      montante_credito,
      prazo_anos,
      euribor,
      spread,
      rendimento_mensal,
    })
    return {
      euribor,
      prestacao: result.prestacao_mensal,
      total_juros: result.total_juros,
      variacao: round2(result.prestacao_mensal - base.prestacao_mensal),
    }
  })

  return {
    cenario_base: {
      prestacao: base.prestacao_mensal,
      total_juros: base.total_juros,
    },
    cenarios,
  }
}

/**
 * Calcula o prazo máximo recomendado com base na idade do mutuário.
 * Regra BdP: idade + prazo ≤ 75 anos
 */
export function calcularPrazoMaximo(dataNascimento: string): number {
  const hoje = new Date()
  const nascimento = new Date(dataNascimento)
  const idade = hoje.getFullYear() - nascimento.getFullYear()
  const prazoMaxBdP = Math.max(0, 75 - idade)
  return Math.min(prazoMaxBdP, 40) // máximo legal: 40 anos
}

/**
 * Retorna o LTV máximo recomendado conforme a finalidade do imóvel.
 * Recomendação Macroprudencial BdP 1/2018.
 */
export function getLtvMaximo(finalidade: string): number {
  switch (finalidade) {
    case 'habitacao_propria_permanente':
      return 90
    case 'habitacao_propria_secundaria':
      return 80
    case 'investimento':
      return 70
    default:
      return 90
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
