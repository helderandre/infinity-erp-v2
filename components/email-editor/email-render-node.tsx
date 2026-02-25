'use client'

import { useNode, useEditor, NodeTree } from '@craftjs/core'
import { ROOT_NODE, getRandomId } from '@craftjs/utils'
import ReactDOM from 'react-dom'
import { useEffect, useRef, useCallback } from 'react'
import { GripVertical, ArrowUp, Trash2, Copy } from 'lucide-react'

function cloneTreeWithNewIds(tree: NodeTree): NodeTree {
  const oldToNew: Record<string, string> = {}

  // Generate new IDs for every node in the tree
  for (const oldId of Object.keys(tree.nodes)) {
    oldToNew[oldId] = getRandomId()
  }

  const newNodes: NodeTree['nodes'] = {}

  for (const [oldId, node] of Object.entries(tree.nodes)) {
    const newId = oldToNew[oldId]
    const cloned = JSON.parse(JSON.stringify(node))

    // Remap child node references
    if (cloned.data.nodes) {
      cloned.data.nodes = cloned.data.nodes.map(
        (childId: string) => oldToNew[childId] ?? childId
      )
    }

    // Remap linked nodes
    if (cloned.data.linkedNodes) {
      const remapped: Record<string, string> = {}
      for (const [key, linkedId] of Object.entries(cloned.data.linkedNodes)) {
        remapped[key] = oldToNew[linkedId as string] ?? (linkedId as string)
      }
      cloned.data.linkedNodes = remapped
    }

    // Remap parent (only for non-root nodes of the tree)
    if (cloned.data.parent && oldToNew[cloned.data.parent]) {
      cloned.data.parent = oldToNew[cloned.data.parent]
    }

    newNodes[newId] = cloned
  }

  return {
    rootNodeId: oldToNew[tree.rootNodeId],
    nodes: newNodes,
  }
}

export function duplicateNode(
  id: string,
  query: ReturnType<typeof useEditor>['query'],
  actions: ReturnType<typeof useEditor>['actions']
) {
  try {
    const node = query.node(id).get()
    if (!node.data.parent) return

    const parentId = node.data.parent
    const siblings = query.node(parentId).get().data.nodes || []
    const index = siblings.indexOf(id)

    const tree = query.node(id).toNodeTree()
    const cloned = cloneTreeWithNewIds(tree)
    actions.addNodeTree(cloned, parentId, index + 1)
  } catch {
    // silently fail if node can't be duplicated
  }
}

export const RenderNode = ({ render }: { render: React.ReactNode }) => {
  const { id } = useNode()
  const { actions, query, isActive } = useEditor((_, query) => ({
    isActive: query.getEvent('selected').contains(id),
  }))

  const {
    isHover,
    dom,
    name,
    moveable,
    deletable,
    connectors: { drag },
    parent,
  } = useNode((node) => ({
    isHover: node.events.hovered,
    dom: node.dom,
    name: node.data.custom?.displayName || node.data.displayName,
    moveable: query.node(node.id).isDraggable(),
    deletable: query.node(node.id).isDeletable(),
    parent: node.data.parent,
  }))

  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dom) {
      if (isActive || isHover) dom.classList.add('component-selected')
      else dom.classList.remove('component-selected')
    }
  }, [dom, isActive, isHover])

  const getToolbarPosition = useCallback(() => {
    if (!dom) return { left: 0, top: 0 }
    const rect = dom.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top - 28,
    }
  }, [dom])

  const handleDuplicate = useCallback(() => {
    duplicateNode(id, query, actions)
  }, [id, query, actions])

  return (
    <>
      {(isHover || isActive) && dom &&
        ReactDOM.createPortal(
          <div
            ref={toolbarRef}
            className="fixed flex items-center gap-1 px-2 py-1 text-xs text-white bg-primary rounded z-[9999]"
            style={getToolbarPosition()}
          >
            <span className="mr-1">{name}</span>
            {moveable && (
              <span
                ref={(ref) => {
                  if (ref) drag(ref)
                }}
                className="cursor-move"
              >
                <GripVertical className="h-3 w-3" />
              </span>
            )}
            {id !== ROOT_NODE && (
              <span
                className="cursor-pointer hover:opacity-75"
                onClick={() => actions.selectNode(parent!)}
              >
                <ArrowUp className="h-3 w-3" />
              </span>
            )}
            {id !== ROOT_NODE && (
              <span
                className="cursor-pointer hover:opacity-75"
                title="Duplicar (Ctrl+D)"
                onClick={handleDuplicate}
              >
                <Copy className="h-3 w-3" />
              </span>
            )}
            {deletable && (
              <span
                className="cursor-pointer hover:opacity-75"
                onClick={() => actions.delete(id)}
              >
                <Trash2 className="h-3 w-3" />
              </span>
            )}
          </div>,
          document.body
        )}
      {render}
    </>
  )
}
