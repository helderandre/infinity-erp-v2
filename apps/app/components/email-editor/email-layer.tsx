'use client'

import { useLayer, EditableLayerName } from '@craftjs/layers'
import { useEditor } from '@craftjs/core'
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const EmailLayer = ({ children }: { children?: React.ReactNode }) => {
  const {
    id,
    depth,
    expanded,
    connectors: { layer, drag, layerHeader },
    actions: { toggleLayer },
  } = useLayer((layer) => ({
    expanded: layer.expanded,
  }))

  const { hidden, actions, selected, childCount } = useEditor((state, query) => ({
    hidden: state.nodes[id]?.data?.hidden,
    selected: query.getEvent('selected').first() === id,
    childCount: state.nodes[id] ? query.node(id).descendants().length : 0,
  }))

  return (
    <div ref={(ref) => { if (ref) layer(ref) }}>
      <div
        ref={(ref) => { if (ref) drag(ref) }}
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 cursor-pointer text-sm transition-colors',
          selected
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted',
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <button
          type="button"
          className={cn(
            'shrink-0 p-0.5 rounded-sm transition-opacity',
            selected ? 'opacity-80 hover:opacity-100' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={(e) => {
            e.stopPropagation()
            actions.setHidden(id, !hidden)
          }}
        >
          {hidden ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
        </button>
        <div
          ref={(ref) => { if (ref) layerHeader(ref) }}
          className={cn('flex-1 truncate', hidden && 'opacity-50')}
        >
          <EditableLayerName />
        </div>
        {childCount > 0 && (
          <button
            type="button"
            className={cn(
              'shrink-0 p-0.5 rounded-sm transition-opacity',
              selected ? 'opacity-80 hover:opacity-100' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={(e) => {
              e.stopPropagation()
              toggleLayer()
            }}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        )}
      </div>
      {expanded && children ? (
        <div>{children}</div>
      ) : null}
    </div>
  )
}
