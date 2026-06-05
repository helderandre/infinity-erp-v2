// Compute the auto-managed `leads.estado` value for a contact, based on
// the state of their negocios. Pure function — no DB access. The wrapper
// in `sync-lead-estado.ts` does the fetch + write.
//
// Rule mapping (highest match wins):
//
//   1. closed_count >= 4              → Cliente Premium
//   2. closed_count == 2 or 3         → Cliente Recorrente
//   3. closed_count == 1              → 1 Negocio Fechado
//   4. any non-terminal negocio with stage in MID_STAGES_BY_PIPELINE
//                                     → Cliente Activo
//   5. any non-terminal negocio with stage in OPENING_STAGES_BY_PIPELINE
//                                     → Potencial Cliente
//   6. has any negocio at all (incl. first-stage / all-Perdido)
//                                     → Contactado
//   7. no negocios                    → Lead
//
// The first/opening stage of each pipeline (Pesquisa de Imóveis for
// comprador/arrendatario, Pré-Angariação for vendedor/arrendador) is
// treated as Contactado — it falls through the OPENING and MID checks
// and lands on the catch-all. The legacy 'Leads' stage (now redundant)
// also lands on the catch-all.
//
// Stage groupings come from the seed in
// `supabase/migrations/20260330_update_pipeline_stages.sql`.

export type AutoEstado =
  | 'Lead'
  | 'Contactado'
  | 'Potencial Cliente'
  | 'Cliente Activo'
  | '1 Negocio Fechado'
  | 'Cliente Recorrente'
  | 'Cliente Premium'

export interface NegocioForEstado {
  pipeline_type: string | null
  stage_name: string | null
  is_terminal: boolean | null
  terminal_type: string | null
}

// Stages where contact = Potencial Cliente. Excludes the first stage of
// each pipeline (those are Contactado via the catch-all).
const OPENING_STAGES_BY_PIPELINE: Record<string, ReadonlySet<string>> = {
  comprador: new Set(),
  arrendatario: new Set(),
  vendedor: new Set(['Estudo de Mercado']),
  arrendador: new Set(['Estudo de Mercado']),
}

// Stages where contact = Cliente Activo (mid pipeline, pre-terminal).
const MID_STAGES_BY_PIPELINE: Record<string, ReadonlySet<string>> = {
  comprador: new Set(['Visitas', 'Proposta', 'CPCV', 'Escritura']),
  arrendatario: new Set(['Visitas', 'Proposta', 'Contrato']),
  vendedor: new Set([
    'Angariação',
    'Promoção',
    'Proposta Aceite',
    'CPCV',
    'Escritura',
  ]),
  arrendador: new Set([
    'Angariação',
    'Promoção',
    'Proposta Aceite',
    'Contrato',
  ]),
}

function inSet(
  map: Record<string, ReadonlySet<string>>,
  pipelineType: string | null | undefined,
  stageName: string | null | undefined
): boolean {
  if (!pipelineType || !stageName) return false
  return map[pipelineType]?.has(stageName) ?? false
}

export function computeLeadEstado(negocios: NegocioForEstado[]): AutoEstado {
  if (negocios.length === 0) return 'Lead'

  const closedCount = negocios.filter(
    (n) => n.is_terminal && n.terminal_type === 'won'
  ).length

  if (closedCount >= 4) return 'Cliente Premium'
  if (closedCount >= 2) return 'Cliente Recorrente'
  if (closedCount === 1) return '1 Negocio Fechado'

  const active = negocios.filter((n) => !n.is_terminal)

  if (
    active.some((n) =>
      inSet(MID_STAGES_BY_PIPELINE, n.pipeline_type, n.stage_name)
    )
  ) {
    return 'Cliente Activo'
  }

  if (
    active.some((n) =>
      inSet(OPENING_STAGES_BY_PIPELINE, n.pipeline_type, n.stage_name)
    )
  ) {
    return 'Potencial Cliente'
  }

  return 'Contactado'
}

// Manual estados that the auto-sync should NOT override. These are set by
// the consultant and have semantics outside the negocios pipeline (e.g.
// "this contact is dormant", "this contact was lost without a deal").
export const MANUAL_ESTADOS: ReadonlySet<string> = new Set([
  'Qualificado',
  'Perdido',
  'Inactivo',
])

export function isAutoManaged(currentEstado: string | null | undefined): boolean {
  if (!currentEstado) return true
  return !MANUAL_ESTADOS.has(currentEstado)
}
