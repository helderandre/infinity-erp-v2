// ============================================================
// condition-evaluator.ts — Avaliação de regras condicionais
// Fase 2 do Sistema de Automações
// ============================================================

import type { ConditionRule } from "@/lib/types/automation-flow"

/**
 * Avalia um conjunto de regras condicionais.
 * Usado pelo worker (execução real) e pelo frontend (preview).
 */
export function evaluateCondition(
  rules: ConditionRule[],
  logic: "and" | "or",
  variables: Record<string, string | null | undefined>
): boolean {
  if (rules.length === 0) return true

  const results = rules.map((rule) => {
    const value = (variables[rule.field] ?? "").toString()
    const target = rule.value ?? ""

    switch (rule.operator) {
      case "equals":
        return value === target
      case "not_equals":
        return value !== target
      case "contains":
        return value.toLowerCase().includes(target.toLowerCase())
      case "not_contains":
        return !value.toLowerCase().includes(target.toLowerCase())
      case "greater":
        return Number(value) > Number(target)
      case "less":
        return Number(value) < Number(target)
      case "empty":
        return !value || value.trim() === ""
      case "not_empty":
        return !!value && value.trim() !== ""
      case "starts_with":
        return value.toLowerCase().startsWith(target.toLowerCase())
      case "ends_with":
        return value.toLowerCase().endsWith(target.toLowerCase())
      default:
        return false
    }
  })

  return logic === "and" ? results.every(Boolean) : results.some(Boolean)
}
