import type { ComponentType } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hardcoded subtask runtime — contrato público do registry.
 *
 * Ver docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md para a base de
 * conhecimento reutilizável (cookbook para replicar este padrão em
 * processos futuros — negócio, recrutamento, etc.).
 */

export type ProcessType = 'angariacao' | 'negocio'

/**
 * Row como vive em `proc_subtasks` (post-migration
 * 20260501_proc_subtasks_hardcoded).
 *
 * Linhas criadas pelo path hardcoded têm `tpl_subtask_id = null` e
 * `subtask_key` apontando para uma entrada do registry.
 */
export interface ProcSubtaskRow {
  id: string
  proc_task_id: string
  tpl_subtask_id: string | null
  subtask_key: string
  title: string
  is_mandatory: boolean | null
  is_completed: boolean | null
  completed_at: string | null
  completed_by: string | null
  owner_id: string | null
  due_date: string | null
  assigned_to: string | null
  assigned_role: string | null
  priority: string
  order_index: number
  config: Record<string, unknown> | null
  created_at: string | null
  started_at: string | null
  is_blocked: boolean
  dependency_type: string | null
  dependency_proc_subtask_id: string | null
  dependency_proc_task_id: string | null
  unblocked_at: string | null
}

/**
 * Owner de um imóvel expandido (lido de `property_owners`).
 * Usado pelo populate quando `rule.repeatPerOwner === true`.
 */
export interface OwnerRef {
  owner_id: string
  ownership_percentage: number | null
  is_main_contact: boolean
  person_type: 'singular' | 'coletiva' | null
  name: string
  email: string | null
}

/**
 * Contexto genérico disponível às rules no momento do populate
 * (titleBuilder, assignedToResolver) e complete (handler).
 *
 * `businessDay(date)` consulta `holidays_pt` e devolve o próximo dia
 * útil — se `date` já for dia útil, devolve-o inalterado.
 */
export interface SubtaskContext {
  supabase: SupabaseClient
  processId: string
  procTaskId: string
  propertyId: string
  consultantId: string | null
  owner: OwnerRef | null
  businessDay: (date: Date) => Promise<Date>
}

/**
 * Contexto específico do handler `complete()`.
 * `rule` e `subtask` ficam disponíveis para o handler poder ler o
 * `subtask_key`, a rule completa, e o id/payload da linha.
 */
export interface SubtaskCompleteContext extends SubtaskContext {
  userId: string
  subtask: ProcSubtaskRow
  body: Record<string, unknown> | null
}

/**
 * Forma declarativa: "24h depois da conclusão de `after`, opcional
 * shift para o próximo dia útil".
 *
 * `offset` aceita: `"Nh"` (horas) | `"Nd"` (dias úteis ou de calendário
 * conforme `shiftOnNonBusinessDay`). Exs: `"24h"`, `"3d"`, `"1d"`.
 */
export interface DueRuleDeclarative {
  after: string // subtask_key de que depende
  offset: string
  shiftOnNonBusinessDay?: boolean
}

/**
 * Forma imperativa: o caller recebe o momento do prerequisito completado
 * e um helper `businessDay` e devolve a data calculada.
 *
 * Escape hatch para regras compostas (ex.: "24h depois mas nunca antes
 * das 9h da manhã"). A maioria das rules usa a forma declarativa.
 */
export interface DueRuleImperativeContext {
  prereqCompletedAt: Date
  businessDay: (date: Date) => Promise<Date>
}

export type DueRuleImperative = (
  ctx: DueRuleImperativeContext
) => Date | Promise<Date>

export type DueRule = DueRuleDeclarative | DueRuleImperative

export function isDeclarativeDueRule(
  rule: DueRule
): rule is DueRuleDeclarative {
  return typeof rule === 'object' && rule !== null && 'after' in rule
}

/**
 * Props recebidas pelo componente React de cada rule — renderiza o UI
 * dentro do detalhe da task/subtarefa.
 */
export interface SubtaskComponentProps {
  subtask: ProcSubtaskRow
  processId: string
  onComplete: (body?: Record<string, unknown>) => Promise<void>
}

/**
 * Contrato imutável de uma subtarefa hardcoded.
 *
 * `key` é o identificador estável que vive em `proc_subtasks.subtask_key`.
 * Depois de publicado em produção NÃO PODE MUDAR sem migration (ver
 * REVERT + CI check no PATTERN doc).
 */
export interface SubtaskRule {
  /** Chave estável — lowercase snake_case, única em todo o registry. */
  key: string

  /** Descrição curta para docs/tooling (não mostrada no UI). */
  description?: string

  /**
   * Nome do `action_type`/kind da `proc_tasks` onde a rule se materializa.
   * Ex: "UPLOAD_DOCS_PROPRIETARIO", "EMAIL_PEDIDO_DOC", "KYC", "CPCV".
   * Corresponde ao `kind` (ou equivalente) do template de task.
   */
  taskKind: string

  /** Cria uma linha por owner de `property_owners` (default: false). */
  repeatPerOwner?: boolean

  /**
   * Escopo de owner para a rule. Substitui/complementa `repeatPerOwner`:
   * - `'none'` (default se ambos omitidos) — 1 row sem `owner_id`
   * - `'main_contact_only'` — 1 row com `owner_id` = contacto principal
   *   do imóvel (resolvido no populate)
   * - `'all'` — equivalente a `repeatPerOwner: true`
   *
   * Quando declarado, **prevalece** sobre `repeatPerOwner`. Mantido
   * opcional para retrocompatibilidade das rules antigas.
   */
  ownerScope?: 'none' | 'main_contact_only' | 'all'

  /**
   * Filtra owners por `person_type` antes de aplicar `ownerScope`.
   * Espelha o legacy `tpl_subtasks.config.person_type_filter`.
   * - `'all'` (default) — não filtra
   * - `'singular'` — só owners com `person_type='singular'`
   * - `'coletiva'` — só owners com `person_type='coletiva'`
   *
   * Ex: "Estado civil e regime de casamento" tem `personTypeFilter: 'singular'`
   * porque só se aplica a pessoas singulares.
   *
   * Ignorado quando `ownerScope === 'none'`.
   */
  personTypeFilter?: 'all' | 'singular' | 'coletiva'

  /** Se false, linha nasce com `is_mandatory=false`. Default: true. */
  isMandatory?: boolean

  /**
   * Texto auxiliar mostrado em pequeno debaixo do título do card.
   * Ex: "Obrigatório para imóveis posteriores a 07 de Agosto de 1951",
   *     "Código de acesso válido", "Uma por proprietário, mesmo em caso de casados".
   *
   * Propagado para `proc_subtasks.config.hint` e lido pelo card legacy
   * (SubtaskCardBase / variantes) ou pelo GroupedSubtasksView.
   */
  hint?: string

  /** Gera o `proc_subtasks.title` — pode ler owner/context. */
  titleBuilder: (ctx: SubtaskContext) => string

  /**
   * Resolve `proc_subtasks.assigned_to`. Se undefined, herda o
   * `assigned_to` da `proc_task` pai (ou null).
   */
  assignedToResolver?: (ctx: SubtaskContext) => string | null | Promise<string | null>

  /** Regra de propagação de due_date — ver DueRule. */
  dueRule?: DueRule

  /**
   * Componente React que renderiza a subtarefa no detalhe da task.
   *
   * Quando `null`, a rule é **hybrid**: a row fica na pista hardcoded
   * (`subtask_key` + `tpl_subtask_id=null`) mas o rendering delega no
   * switch legacy de `subtask-card-list.tsx`, que resolve por
   * `config.type`. Usar com `configBuilder` para popular o `config` no
   * shape que a UI legacy espera (ex.: `type: 'email'`, `email_library_id`).
   */
  Component: ComponentType<SubtaskComponentProps> | null

  /**
   * tpl_subtask_id(s) que esta rule substitui. Antes de inserir as rows
   * hardcoded, o populate apaga as linhas legacy com estes
   * `tpl_subtask_id` no mesmo processo (`subtask_key LIKE 'legacy_%'`).
   *
   * Use quando a rule é uma **substituição** de uma subtarefa já definida
   * no template — o legacy `_populate_subtasks` vai popular a row
   * automaticamente durante a aprovação, e esta rule remove-a antes de
   * inserir o seu par hardcoded.
   */
  supersedesTplSubtaskId?: string | string[]

  /**
   * Resolve o `proc_subtasks.config` de uma row hardcoded no momento do
   * populate. O objecto devolvido é **merged** com os marcadores default
   * (`hardcoded: true`, `process_type`, `rule_key`) — os marcadores
   * prevalecem em caso de colisão.
   *
   * Típico para rules **hybrid**: popular `type`, `email_library_id`,
   * `has_person_type_variants`, etc. para que o rendering legacy funcione.
   */
  configBuilder?: (ctx: SubtaskContext) => Record<string, unknown>

  /**
   * Handler invocado pelo endpoint `POST /complete` antes de marcar a
   * subtarefa como concluída. Pode devolver `payload` que fica gravado
   * em `config.payload` para referência futura.
   *
   * Lançar excepção aborta a conclusão. Em rules hybrid (Component=null)
   * o handler típico é no-op — o rendering legacy completa a row via o
   * endpoint PUT tradicional.
   */
  complete: (
    ctx: SubtaskCompleteContext
  ) => Promise<{ payload?: Record<string, unknown> } | void>
}

/**
 * Barrel exportado por cada domínio (`rules/angariacao/index.ts`,
 * `rules/negocio/index.ts`, etc.).
 */
export type RulesByProcessType = Record<ProcessType, SubtaskRule[]>
