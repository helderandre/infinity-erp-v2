/**
 * Guarda de integridade: garante que o `pipeline_stage_id` de um negócio
 * pertence ao pipeline que corresponde ao seu `tipo`. Um negócio com
 * tipo='Vendedor' mas uma fase do pipeline 'comprador' não renderiza em nenhum
 * kanban (o board filtra por tipo mas monta colunas pelas fases desse pipeline)
 * — fica órfão. Todos os caminhos de criação de negócio devem passar por aqui.
 *
 * Regras:
 *  - tipo desconhecido → devolve o id fornecido tal como está (não força).
 *  - id já pertence ao pipeline correcto → devolve-o inalterado.
 *  - id de OUTRO pipeline → devolve a fase equivalente (mesmo nome; depois mesmo
 *    order_index) do pipeline correcto.
 *  - sem id (ou sem equivalente) → primeira fase não-terminal do pipeline correcto.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

// Aceita os valores actuais + aliases legados por robustez.
const TIPO_TO_PIPELINE: Record<string, string> = {
  Comprador: 'comprador',
  Vendedor: 'vendedor',
  Arrendatário: 'arrendatario',
  Senhorio: 'arrendador',
  Arrendador: 'arrendador',
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

interface StageRow {
  id: string
  name: string | null
  order_index: number | null
  is_terminal: boolean | null
}

export async function resolveConsistentStageId(
  supabase: AdminClient,
  tipo: string | null | undefined,
  providedStageId: string | null | undefined,
): Promise<string | null> {
  const pipelineType = TIPO_TO_PIPELINE[String(tipo ?? '')]
  // Tipo fora do mapa (ex.: 'Outro'): não temos pipeline canónico — respeita o input.
  if (!pipelineType) return providedStageId ?? null

  const { data: stages } = await supabase
    .from('leads_pipeline_stages')
    .select('id, name, order_index, is_terminal')
    .eq('pipeline_type', pipelineType)
    .order('order_index', { ascending: true })
  const list = (stages ?? []) as StageRow[]
  if (list.length === 0) return providedStageId ?? null

  if (providedStageId) {
    // Já é uma fase do pipeline correcto? Mantém.
    if (list.some((s) => s.id === providedStageId)) return providedStageId
    // Fase de outro pipeline → mapeia para a equivalente (nome, depois ordem).
    const { data: cur } = await supabase
      .from('leads_pipeline_stages')
      .select('name, order_index')
      .eq('id', providedStageId)
      .maybeSingle()
    if (cur) {
      const byName = list.find((s) => norm(s.name) === norm(cur.name))
      if (byName) return byName.id
      const byOrder = list.find((s) => s.order_index === cur.order_index)
      if (byOrder) return byOrder.id
    }
  }

  // Sem id fornecido ou sem equivalente → primeira fase não-terminal.
  const firstNonTerminal = list.filter((s) => !s.is_terminal)[0]
  return (firstNonTerminal ?? list[0]).id
}
