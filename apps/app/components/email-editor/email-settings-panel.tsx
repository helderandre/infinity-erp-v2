'use client'

import React from 'react'
import { useEditor } from '@craftjs/core'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'

export function EmailSettingsPanel() {
  const { actions, selected } = useEditor((state, query) => {
    const [currentNodeId] = state.events.selected

    let selected

    if (currentNodeId) {
      selected = {
        id: currentNodeId,
        name: state.nodes[currentNodeId].data.displayName,
        settings:
          state.nodes[currentNodeId].related &&
          state.nodes[currentNodeId].related.settings,
        isDeletable: query.node(currentNodeId).isDeletable(),
      }
    }

    return { selected }
  })

  return selected ? (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {selected.name}
        </span>
      </div>

      {selected.settings && React.createElement(selected.settings)}

      {selected.isDeletable && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => actions.delete(selected.id)}
        >
          Remover componente
        </Button>
      )}
    </div>
  ) : (
    <div className="p-4 text-sm text-muted-foreground">
      Clique num componente para editar as suas propriedades
    </div>
  )
}
