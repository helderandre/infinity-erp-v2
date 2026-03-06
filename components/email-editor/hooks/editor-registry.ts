import type { Editor } from '@tiptap/react'

/**
 * Module-level registry to share Tiptap editor instances between
 * Craft.js user components and their settings panels.
 *
 * Keyed by Craft.js node ID.
 */
const registry = new Map<string, Editor>()

export function registerEditor(nodeId: string, editor: Editor) {
  registry.set(nodeId, editor)
}

export function unregisterEditor(nodeId: string) {
  registry.delete(nodeId)
}

export function getEditor(nodeId: string): Editor | null {
  return registry.get(nodeId) ?? null
}
