'use client'

import { useNode, useEditor } from '@craftjs/core'
import { ROOT_NODE } from '@craftjs/utils'
import ReactDOM from 'react-dom'
import { useEffect, useRef, useCallback } from 'react'
import { GripVertical, ArrowUp, Trash2 } from 'lucide-react'

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
