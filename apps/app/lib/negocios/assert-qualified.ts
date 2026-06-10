// Server-side qualification guard for négocios (oportunidades).
//
// Every create path (Novo negócio dialog, Qualificar entrada, voice assistant,
// raw API) funnels through /api/negocios or /api/crm/negocios. This guard makes
// the *data* obligation uniform: a négocio cannot be created without
//   • a location (structured zonas OR free-text localizacao/distrito/…), and
//   • a value appropriate to its tipo.
// When only free text is given, it is best-effort upgraded to a structured
// admin-area zone (so the matching engine gets `zonas_geom` via the
// negocios_recompute_zonas_geom trigger). It NEVER blocks on unresolvable
// text — the localizacao stays as a working legacy fallback.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface QualifyResult {
  ok: boolean
  payload?: Record<string, any>
  error?: string
  field?: string
  status?: number
}

const pos = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0
}

/**
 * Resolve a free-text location ("Cascais", "Estoril, Cascais") to the best
 * matching admin_areas row. Prefers exact, then starts-with; prefers concelho
 * granularity, then distrito, then freguesia. Returns null when nothing fits.
 */
export async function resolveAdminAreaByText(
  supabase: any,
  text: string,
): Promise<{ area_id: string; label: string } | null> {
  const q = String(text ?? '').trim()
  if (q.length < 2) return null

  // Try the full string first, then the first segment ("Estoril, Cascais" → "Estoril").
  const candidates = [q]
  const firstSeg = q.split(/[,–—/]| - /)[0]?.trim()
  if (firstSeg && firstSeg !== q && firstSeg.length >= 2) candidates.push(firstSeg)

  const typePref = (t: string) => (t === 'concelho' ? 0 : t === 'distrito' ? 1 : 2)

  for (const term of candidates) {
    const { data } = await supabase
      .from('admin_areas')
      .select('id, type, name, parent_id')
      .ilike('name', `%${term}%`)
      .in('type', ['distrito', 'concelho', 'freguesia'])
      .limit(30)
    const rows = (data ?? []) as Array<{ id: string; type: string; name: string }>
    if (rows.length === 0) continue

    const lc = term.toLowerCase()
    const rank = (name: string) => {
      const n = name.toLowerCase()
      return n === lc ? 0 : n.startsWith(lc) ? 1 : 2
    }
    rows.sort((a, b) => {
      const ra = rank(a.name)
      const rb = rank(b.name)
      if (ra !== rb) return ra - rb
      const ta = typePref(a.type)
      const tb = typePref(b.type)
      if (ta !== tb) return ta - tb
      return a.name.localeCompare(b.name, 'pt-PT')
    })

    const best = rows[0]
    if (best) {
      const typeLabel = best.type.charAt(0).toUpperCase() + best.type.slice(1)
      return { area_id: best.id, label: `${best.name} (${typeLabel})` }
    }
  }
  return null
}

/**
 * Validate + enrich a négocio insert payload. Call AFTER Zod parse and legacy
 * tipo/business_type normalization (so `tipo` is the perspective value:
 * Comprador / Vendedor / Arrendatário / Senhorio).
 *
 * On success returns the (possibly zonas-augmented) payload. On failure returns
 * a 422 with a PT-PT message + the offending field.
 */
export async function qualifyNegocioPayload(
  supabase: any,
  payload: Record<string, any>,
): Promise<QualifyResult> {
  const p: Record<string, any> = { ...payload }
  const tipo = String(p.tipo ?? '')

  // ── 1. Location present ────────────────────────────────────────────────
  const zonas = Array.isArray(p.zonas) ? p.zonas : []
  const hasZonas = zonas.length > 0
  const locText = [p.localizacao, p.distrito, p.concelho, p.freguesia]
    .map((x) => String(x ?? '').trim())
    .find((x) => x.length > 0)
  if (!hasZonas && !locText) {
    return {
      ok: false,
      status: 422,
      field: 'localizacao',
      error: 'Localização é obrigatória para qualificar a oportunidade.',
    }
  }

  // ── 2. Value present, by tipo ──────────────────────────────────────────
  const valueCheck = ((): { ok: true } | { ok: false; field: string; msg: string } => {
    switch (tipo) {
      case 'Comprador':
        if (!pos(p.orcamento)) return { ok: false, field: 'orcamento', msg: 'Orçamento mínimo é obrigatório.' }
        if (!pos(p.orcamento_max)) return { ok: false, field: 'orcamento_max', msg: 'Orçamento máximo é obrigatório.' }
        if (Number(p.orcamento_max) < Number(p.orcamento))
          return { ok: false, field: 'orcamento_max', msg: 'O orçamento máximo tem de ser ≥ ao mínimo.' }
        return { ok: true }
      case 'Arrendatário':
        return pos(p.orcamento) || pos(p.renda_max_mensal) || pos(p.expected_value)
          ? { ok: true }
          : { ok: false, field: 'renda_max_mensal', msg: 'Valor de renda é obrigatório.' }
      case 'Vendedor':
        return pos(p.preco_venda) || pos(p.expected_value)
          ? { ok: true }
          : { ok: false, field: 'preco_venda', msg: 'Preço de venda é obrigatório.' }
      case 'Senhorio':
        return pos(p.renda_pretendida) || pos(p.expected_value)
          ? { ok: true }
          : { ok: false, field: 'renda_pretendida', msg: 'Renda pretendida é obrigatória.' }
      default:
        return pos(p.orcamento) || pos(p.preco_venda) || pos(p.renda_max_mensal) ||
          pos(p.renda_pretendida) || pos(p.expected_value)
          ? { ok: true }
          : { ok: false, field: 'valor', msg: 'Valor/orçamento é obrigatório.' }
    }
  })()
  if (!valueCheck.ok) {
    return { ok: false, status: 422, field: valueCheck.field, error: valueCheck.msg }
  }

  // ── 3. Auto-upgrade free-text location → structured zone (never blocks) ─
  if (!hasZonas && locText) {
    const resolved = await resolveAdminAreaByText(supabase, locText)
    if (resolved) {
      p.zonas = [{ kind: 'admin', area_id: resolved.area_id, label: resolved.label }]
    }
  }

  return { ok: true, payload: p }
}
