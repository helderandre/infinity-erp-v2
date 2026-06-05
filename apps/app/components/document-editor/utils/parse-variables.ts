import type { JSONContent } from '@tiptap/core'
import type { ParsedVariable } from '../types'

const VARIABLE_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g

export function extractVariableKeysFromText(text: string): string[] {
  const keys = new Set<string>()
  let match
  while ((match = VARIABLE_REGEX.exec(text)) !== null) {
    keys.add(match[1].trim())
  }
  return Array.from(keys)
}

export function extractVariablesFromJSON(
  doc: JSONContent,
  systemKeys: string[] = []
): ParsedVariable[] {
  const counts = new Map<string, number>()

  function walk(node: JSONContent) {
    if (node.type === 'variable' && node.attrs?.key) {
      const key = String(node.attrs.key)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child)
      }
    }
  }

  walk(doc)

  return Array.from(counts.entries()).map(([key, count]) => ({
    key,
    displayKey: `{{${key}}}`,
    isSystem: systemKeys.includes(key),
    count,
  }))
}

export function categorizeVariables(variables: ParsedVariable[]) {
  const system = variables.filter((v) => v.isSystem)
  const custom = variables.filter((v) => !v.isSystem)
  return { system, custom }
}
