// ============================================================
// webhook-mapping.ts — Mapeamento de payload webhook → variáveis
// Fase 2 do Sistema de Automações
// ============================================================

export interface WebhookFieldMapping {
  webhookPath: string
  variableKey: string
  transform?: "uppercase" | "lowercase" | "trim" | "none"
}

/**
 * Extrai valor de um objecto por path em dot notation.
 * Suporta arrays: "items[0].name"
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      const arr = (current as Record<string, unknown>)[arrayMatch[1]]
      return Array.isArray(arr) ? arr[Number(arrayMatch[2])] : undefined
    }
    return (current as Record<string, unknown>)[key]
  }, obj)
}

/**
 * Resolve mapeamento de payload webhook para variáveis.
 */
export function resolveWebhookMapping(
  payload: Record<string, unknown>,
  mappings: WebhookFieldMapping[]
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const mapping of mappings) {
    const value = getNestedValue(payload, mapping.webhookPath)
    if (value !== null && value !== undefined) {
      let strValue = String(value)
      switch (mapping.transform) {
        case "uppercase":
          strValue = strValue.toUpperCase()
          break
        case "lowercase":
          strValue = strValue.toLowerCase()
          break
        case "trim":
          strValue = strValue.trim()
          break
      }
      result[mapping.variableKey] = strValue
    }
  }

  return result
}

/**
 * Extrai recursivamente todos os caminhos de um objecto JSON.
 * Usado para popular o seletor de campos no mapeamento de webhook.
 */
export function extractAllPaths(
  obj: Record<string, unknown>,
  prefix = "",
  maxDepth = 5
): Array<{ path: string; value: unknown; type: string }> {
  const paths: Array<{ path: string; value: unknown; type: string }> = []
  if (maxDepth <= 0) return paths

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key
    const valueType = Array.isArray(value)
      ? "array"
      : value === null
        ? "null"
        : typeof value

    paths.push({ path: currentPath, value, type: valueType })

    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(
        ...extractAllPaths(value as Record<string, unknown>, currentPath, maxDepth - 1)
      )
    }
  }

  return paths
}
