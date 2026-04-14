'use client'

import { FolderOpen, List } from 'lucide-react'
import { useState } from 'react'

import { PropertyDocumentsFoldersView } from './property-documents-folders-view'
import { PropertyDocumentsTab } from './property-documents-tab'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type ViewMode = 'lista' | 'pastas'

interface PropertyDocumentsRootProps {
  propertyId: string
}

export function PropertyDocumentsRoot({ propertyId }: PropertyDocumentsRootProps) {
  const [view, setView] = useState<ViewMode>('lista')

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as ViewMode)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="lista" aria-label="Vista Lista">
            <List className="h-3.5 w-3.5" />
            Lista
          </ToggleGroupItem>
          <ToggleGroupItem value="pastas" aria-label="Vista Pastas">
            <FolderOpen className="h-3.5 w-3.5" />
            Pastas
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === 'lista' ? (
        <PropertyDocumentsTab propertyId={propertyId} />
      ) : (
        <PropertyDocumentsFoldersView propertyId={propertyId} />
      )}
    </div>
  )
}
