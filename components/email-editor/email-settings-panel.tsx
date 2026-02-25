'use client'

import React from 'react'
import { useEditor } from '@craftjs/core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
      <div className="flex items-center justify-end">
        <Badge variant="secondary">{selected.name}</Badge>
      </div>

      {selected.settings && React.createElement(selected.settings)}

      {selected.isDeletable && (
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => actions.delete(selected.id)}
        >
          Eliminar
        </Button>
      )}
    </div>
  ) : (
    <div className="p-4 text-sm text-muted-foreground">
      Clique num componente para editar as suas propriedades
    </div>
  )
}
