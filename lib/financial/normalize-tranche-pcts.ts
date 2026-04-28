/**
 * Normaliza o par (cpcv_pct, escritura_pct) para que somem 100.
 *
 * Regras:
 *   - Ambos preenchidos → respeita os dois (mas se não somarem 100, ajusta
 *     escritura para complementar cpcv — cpcv é a "verdade" preferencial).
 *   - Só cpcv preenchido  → escritura = 100 − cpcv.
 *   - Só escritura preenchido → cpcv = 100 − escritura.
 *   - Nenhum preenchido → 50/50 (split mais comum em PT residencial).
 *
 * Valores fora de [0, 100] são clamped.
 */
export function normalizeTranchePcts(input: {
  cpcv_pct?: number | string | null
  escritura_pct?: number | string | null
}): { cpcv_pct: number; escritura_pct: number } {
  const cpcvRaw = input.cpcv_pct
  const escRaw = input.escritura_pct
  const cpcvSet = cpcvRaw !== null && cpcvRaw !== undefined && cpcvRaw !== ''
  const escSet = escRaw !== null && escRaw !== undefined && escRaw !== ''

  const clamp = (n: number) => Math.max(0, Math.min(100, n))

  if (cpcvSet) {
    const c = clamp(Number(cpcvRaw) || 0)
    return { cpcv_pct: c, escritura_pct: clamp(100 - c) }
  }
  if (escSet) {
    const e = clamp(Number(escRaw) || 0)
    return { cpcv_pct: clamp(100 - e), escritura_pct: e }
  }
  return { cpcv_pct: 50, escritura_pct: 50 }
}
