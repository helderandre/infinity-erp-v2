import type { ProcessType, SubtaskRule } from './types'
import { angariacaoRules } from './rules/angariacao'

/**
 * Registry central de subtask rules hardcoded.
 *
 * Cada `processType` tem o seu barrel de rules (uma por ficheiro em
 * `rules/<processType>/*.ts`). Novos tipos de processo (negocio,
 * recrutamento, ...) adicionam-se aqui.
 *
 * Invariantes:
 *  - `rule.key` é único dentro do registry COMPLETO (não apenas no
 *    processType). Isto permite lookup O(1) no front-end sem precisar
 *    de saber o processType da linha.
 *  - `rule.key` é imutável depois de publicado em produção. Renames
 *    exigem data migration (ver PATTERN-HARDCODED-SUBTASKS.md).
 */

const REGISTRY: Partial<Record<ProcessType, SubtaskRule[]>> = {
  angariacao: angariacaoRules,
  // negocio: negocioRules, // change futura
}

// Lookup map by key — construído lazy na primeira chamada.
let keyLookup: Map<string, SubtaskRule> | null = null

function buildKeyLookup(): Map<string, SubtaskRule> {
  const map = new Map<string, SubtaskRule>()
  for (const list of Object.values(REGISTRY)) {
    if (!list) continue
    for (const rule of list) {
      if (map.has(rule.key)) {
        throw new Error(
          `[subtasks/registry] Chave duplicada "${rule.key}" — keys têm de ser únicas em todo o registry.`
        )
      }
      map.set(rule.key, rule)
    }
  }
  return map
}

export function getRulesFor(processType: ProcessType): SubtaskRule[] {
  return REGISTRY[processType] ?? []
}

export function getRuleByKey(key: string): SubtaskRule | null {
  if (!keyLookup) keyLookup = buildKeyLookup()
  return keyLookup.get(key) ?? null
}

/**
 * Lista todas as rules dependentes de `key` (para propagação).
 * Só considera dueRule declarativa — a imperativa é opaca e é
 * tratada individualmente pelos callers que a usam.
 */
export function getDependentRules(key: string): SubtaskRule[] {
  const out: SubtaskRule[] = []
  for (const list of Object.values(REGISTRY)) {
    if (!list) continue
    for (const rule of list) {
      if (
        rule.dueRule &&
        typeof rule.dueRule === 'object' &&
        'after' in rule.dueRule &&
        rule.dueRule.after === key
      ) {
        out.push(rule)
      }
    }
  }
  return out
}

/** Reset do lookup — usado em testes quando o registry é reescrito. */
export function __resetRegistryLookup(): void {
  keyLookup = null
}
