import type { HealthSummaryRow } from "@/types/custom-event"

export type HealthBucket =
  | "completed_one_shot"
  | "failures_unresolved"
  | "ok"
  | "idle"

/**
 * Mapa puro de HealthSummaryRow → bucket visual do card.
 *
 * Prioridade (conforme spec `contact-automation-hub`):
 *   1. failures_unresolved  — alerta vermelho vence tudo o resto
 *      (é o único bucket que exige acção).
 *   2. completed_one_shot   — one-shot executado com sucesso.
 *   3. ok                   — último run foi sent nos 30 dias.
 *   4. idle                 — sem dados ou sem runs recentes.
 *
 * Nota: um one-shot pode estar completed_one_shot=true E ter
 * failures_unresolved>0 em simultâneo (lote com sucessos+falhas).
 * Neste caso o dot é vermelho (acção necessária) mas o card
 * continua a mostrar a label "Concluído" — que é renderizada
 * separadamente a partir do campo `completed_one_shot` directo.
 */
export function resolveHealthBucket(health?: HealthSummaryRow | null): HealthBucket {
  if (!health) return "idle"
  if (health.failed_unresolved_count > 0) return "failures_unresolved"
  if (health.completed_one_shot) return "completed_one_shot"
  if (health.last_run_status === "sent") return "ok"
  return "idle"
}
