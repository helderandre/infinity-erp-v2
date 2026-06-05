import { getRandomId } from '@craftjs/utils'

interface CraftNode {
  type: { resolvedName: string }
  isCanvas?: boolean
  props: Record<string, unknown>
  nodes: string[]
  linkedNodes: Record<string, string>
  parent: string | null
  displayName?: string
  custom?: Record<string, unknown>
  hidden?: boolean
}

type EditorState = Record<string, CraftNode>

export interface EmailMeta {
  name: string
  subject: string
  category: string
}

export interface AiGenerateResult {
  nodes: EditorState
  meta: EmailMeta | null
}

function extractBlock<T>(text: string, startMarker: string, endMarker: string): T | null {
  const startIdx = text.indexOf(startMarker)
  const endIdx = text.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const jsonStr = text.slice(startIdx + startMarker.length, endIdx).trim()

  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

/**
 * Extract the JSON block from the AI streamed text.
 * Looks for content between :::EMAIL_STATE_START::: and :::EMAIL_STATE_END:::
 */
export function extractJsonFromStream(text: string): EditorState | null {
  return extractBlock<EditorState>(text, ':::EMAIL_STATE_START:::', ':::EMAIL_STATE_END:::')
}

/**
 * Extract metadata (name, subject, category) from the AI streamed text.
 */
export function extractMetaFromStream(text: string): EmailMeta | null {
  return extractBlock<EmailMeta>(text, ':::EMAIL_META_START:::', ':::EMAIL_META_END:::')
}

/**
 * Extract both nodes and metadata from the AI streamed text.
 */
export function extractAiResult(text: string): AiGenerateResult | null {
  const nodes = extractJsonFromStream(text)
  if (!nodes) return null
  const meta = extractMetaFromStream(text)
  return { nodes, meta }
}

/**
 * Re-map node IDs to unique Craft.js IDs.
 * Returns a new EditorState with fresh IDs and correct parent/nodes references.
 */
function remapNodeIds(aiNodes: EditorState): EditorState {
  const oldToNew: Record<string, string> = {}

  // Generate new IDs for all nodes
  for (const oldId of Object.keys(aiNodes)) {
    oldToNew[oldId] = getRandomId()
  }

  const result: EditorState = {}

  for (const [oldId, node] of Object.entries(aiNodes)) {
    const newId = oldToNew[oldId]
    result[newId] = {
      ...node,
      nodes: node.nodes.map((childId) => oldToNew[childId] ?? childId),
      linkedNodes: Object.fromEntries(
        Object.entries(node.linkedNodes).map(([k, v]) => [k, oldToNew[v] ?? v])
      ),
      parent: node.parent ? (oldToNew[node.parent] ?? node.parent) : null,
    }
  }

  return result
}

/**
 * Find the body container in the editor state.
 * The body container is the EmailContainer that sits between the header and signature/footer.
 * It's typically the second child of ROOT (after EmailHeader).
 */
function findBodyContainerId(state: EditorState): string | null {
  const root = state['ROOT']
  if (!root) return null

  for (const childId of root.nodes) {
    const child = state[childId]
    if (!child) continue
    // The body container is an EmailContainer that is NOT a header, footer, or signature
    if (
      child.type.resolvedName === 'EmailContainer' &&
      child.isCanvas === true
    ) {
      return childId
    }
  }

  return null
}

/**
 * Collect all node IDs in a subtree (recursive).
 */
function collectSubtreeIds(state: EditorState, rootId: string): string[] {
  const ids: string[] = [rootId]
  const node = state[rootId]
  if (!node) return ids
  for (const childId of node.nodes) {
    ids.push(...collectSubtreeIds(state, childId))
  }
  for (const linkedId of Object.values(node.linkedNodes)) {
    ids.push(...collectSubtreeIds(state, linkedId))
  }
  return ids
}

/**
 * Inject AI-generated body nodes into the current editor state,
 * preserving header, footer, and signature.
 */
export function injectAiBodyIntoEditorState(
  currentStateJson: string,
  aiBodyNodes: EditorState
): string {
  const state: EditorState = JSON.parse(currentStateJson)

  // Find the body container
  const bodyContainerId = findBodyContainerId(state)
  if (!bodyContainerId) {
    throw new Error('Não foi possível encontrar o contentor do corpo do email')
  }

  // Remove old body container children (keep the container itself)
  const bodyContainer = state[bodyContainerId]
  const oldChildIds = [...bodyContainer.nodes]
  for (const childId of oldChildIds) {
    const subtreeIds = collectSubtreeIds(state, childId)
    for (const id of subtreeIds) {
      delete state[id]
    }
  }

  // Remap AI node IDs to unique ones
  const remapped = remapNodeIds(aiBodyNodes)

  // Find the root node in AI output (the one with parent: null)
  let aiRootId: string | null = null
  for (const [id, node] of Object.entries(remapped)) {
    if (node.parent === null) {
      aiRootId = id
      break
    }
  }

  if (!aiRootId) {
    throw new Error('Não foi possível encontrar o nó raiz na resposta da IA')
  }

  const aiRoot = remapped[aiRootId]

  // Option A: If the AI root is an EmailContainer, use its children directly
  // and copy its props to the existing body container
  if (aiRoot.type.resolvedName === 'EmailContainer') {
    // Copy relevant props from AI root to body container
    bodyContainer.props = {
      ...bodyContainer.props,
      ...aiRoot.props,
    }

    // Set the body container's children to the AI root's children
    bodyContainer.nodes = [...aiRoot.nodes]

    // Add all child nodes, updating their parent references
    for (const [id, node] of Object.entries(remapped)) {
      if (id === aiRootId) continue // Skip the root (we merged it)
      if (node.parent === aiRootId) {
        // Direct children — point to body container
        state[id] = { ...node, parent: bodyContainerId }
      } else {
        state[id] = node
      }
    }
  } else {
    // Option B: Single non-container node — just add it
    bodyContainer.nodes = [aiRootId]
    for (const [id, node] of Object.entries(remapped)) {
      if (node.parent === null) {
        state[id] = { ...node, parent: bodyContainerId }
      } else {
        state[id] = node
      }
    }
  }

  return JSON.stringify(state)
}

/**
 * Check if the body container has meaningful content (not just the default text).
 */
export function bodyHasContent(editorStateJson: string): boolean {
  try {
    const state: EditorState = JSON.parse(editorStateJson)
    const bodyContainerId = findBodyContainerId(state)
    if (!bodyContainerId) return false

    const bodyContainer = state[bodyContainerId]
    if (bodyContainer.nodes.length === 0) return false

    // Check if the only child is the default text
    if (bodyContainer.nodes.length === 1) {
      const child = state[bodyContainer.nodes[0]]
      if (
        child?.type.resolvedName === 'EmailText' &&
        typeof child.props.html === 'string' &&
        child.props.html.includes('Escreva o conteúdo do email aqui')
      ) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}
