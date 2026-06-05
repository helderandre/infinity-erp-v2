/**
 * Deriva o `expected_value` denormalizado a partir do `tipo` + campos de preço.
 *
 * `negocios.expected_value` é o snapshot usado pelos cards do kanban, totais
 * de comissão (possível/prevista) e drill-downs financeiros. A coluna não
 * tem trigger, por isso PUT/POST têm de a recomputar sempre que algum dos
 * campos-fonte é tocado — caso contrário a UI mostra o valor antigo mesmo
 * depois de o consultor editar o "Preço pretendido" / "Orçamento" no
 * detalhe do negócio (bug reportado em 2026-06-XX).
 *
 * Mapping (espelha a lógica de display em `<NegocioDetailSheet>` e
 * `negocioValue()` em `/api/crm/kanban/[pipelineType]`):
 *   Arrendatário          → renda_max_mensal
 *   Senhorio / Arrendador → renda_pretendida
 *   Comprador / Compra    → orcamento_max ?? orcamento
 *   resto (Vendedor, Venda, Estudo de Mercado, …) → preco_venda
 *
 * Devolve `null` quando o campo-fonte não está preenchido. Callers podem
 * tratar `null` como "limpar" (UPDATE com NULL) ou como "preservar" — ver
 * `mergeExpectedValue()` que faz a fusão correcta com o estado prévio.
 */

type PriceFields = {
  tipo?: string | null
  preco_venda?: number | string | null
  orcamento?: number | string | null
  orcamento_max?: number | string | null
  renda_pretendida?: number | string | null
  renda_max_mensal?: number | string | null
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function deriveExpectedValue(row: PriceFields): number | null {
  const tipo = row.tipo ?? ''
  if (tipo === 'Arrendatário') return toNum(row.renda_max_mensal)
  if (tipo === 'Senhorio' || tipo === 'Arrendador') return toNum(row.renda_pretendida)
  if (tipo === 'Comprador' || tipo === 'Compra') {
    return toNum(row.orcamento_max) ?? toNum(row.orcamento)
  }
  return toNum(row.preco_venda)
}

/**
 * Campos cuja mudança força recomputação de `expected_value`. Inclui `tipo`
 * porque a derivação depende do tipo (mudar de Comprador para Vendedor
 * troca a coluna-fonte).
 */
export const EXPECTED_VALUE_SOURCE_FIELDS = [
  'tipo',
  'preco_venda',
  'orcamento',
  'orcamento_max',
  'renda_pretendida',
  'renda_max_mensal',
] as const

export type ExpectedValueSourceField = (typeof EXPECTED_VALUE_SOURCE_FIELDS)[number]

export function patchTouchesExpectedValueSources(
  patch: Record<string, unknown>,
): boolean {
  return EXPECTED_VALUE_SOURCE_FIELDS.some((k) => k in patch)
}
