'use client'

import { useState, useRef, useEffect } from 'react'
import { CheckCircle2, FileCheck2, ChevronDown, Trash2, Square, CheckSquare } from 'lucide-react'
import { DocIcon } from '@/components/icons/doc-icon'
import { Badge } from '@/components/ui/badge'
import { UploadZone } from './UploadZone'
import { cn } from '@/lib/utils'
import type { DocType } from '@/types/document'

interface DocRowProps {
  docType: DocType
  isUploaded: boolean
  isPending?: boolean
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
  // Deletion
  onDeleteSingle?: (docTypeId: string) => void
  isSelectedForDeletion?: boolean
  onToggleDeleteSelection?: (docTypeId: string) => void
  isInDeleteMode?: boolean
}

export function DocRow({
  docType,
  isUploaded,
  isPending,
  onUploaded,
  propertyId,
  ownerId,
  consultantId,
  deferred,
  onFileSelected,
  onDeleteSingle,
  isSelectedForDeletion,
  onToggleDeleteSelection,
  isInDeleteMode,
}: DocRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Auto-close when upload completes or file is selected (deferred)
  useEffect(() => {
    if ((isUploaded || isPending) && isOpen) {
      setIsOpen(false)
    }
  }, [isUploaded, isPending, isOpen])

  const canToggle = !isUploaded && !isPending
  const hasDoc = isUploaded || isPending

  return (
    <div className={cn(
      'rounded-lg border bg-card transition-colors',
      isSelectedForDeletion && 'border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800'
    )}>
      {/* Row header */}
      <div
        role={canToggle ? 'button' : undefined}
        tabIndex={canToggle ? 0 : undefined}
        aria-expanded={canToggle ? isOpen : undefined}
        onClick={() => {
          if (isInDeleteMode && hasDoc) {
            onToggleDeleteSelection?.(docType.id)
          } else if (canToggle) {
            setIsOpen((prev) => !prev)
          }
        }}
        onKeyDown={(e) => {
          if (canToggle && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setIsOpen((prev) => !prev)
          }
        }}
        className={`
          flex items-center gap-3 px-3 py-3
          ${canToggle || (isInDeleteMode && hasDoc) ? 'cursor-pointer hover:bg-accent/50' : ''}
          transition-colors duration-150
        `}
      >
        {/* Checkbox in delete mode */}
        {isInDeleteMode && hasDoc ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleDeleteSelection?.(docType.id) }}
            className="shrink-0"
          >
            {isSelectedForDeletion ? (
              <CheckSquare className="h-5 w-5 text-red-500" />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground/40" />
            )}
          </button>
        ) : (
          <DocIcon className="h-6 w-6 shrink-0" />
        )}

        <span className={cn('text-sm flex-1 min-w-0 truncate', isSelectedForDeletion && 'line-through text-muted-foreground')}>{docType.name}</span>

        {isUploaded ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className="animate-in bg-emerald-50 text-emerald-600 border-0 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Carregado
            </Badge>
            {!isInDeleteMode && onDeleteSingle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteSingle(docType.id) }}
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Remover documento"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : isPending ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className="animate-in bg-blue-50 text-blue-600 border-0 dark:bg-blue-950 dark:text-blue-400">
              <FileCheck2 className="mr-1 h-3 w-3" />
              Seleccionado
            </Badge>
            {!isInDeleteMode && onDeleteSingle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteSingle(docType.id) }}
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Remover documento"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <ChevronDown
            className={`
              h-4 w-4 shrink-0 text-muted-foreground
              transition-transform duration-250 ease-in-out
              ${isOpen ? 'rotate-180' : ''}
            `}
          />
        )}
      </div>

      {/* Collapsible upload zone */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="overflow-hidden" ref={contentRef}>
          {canToggle && (
            <UploadZone
              docTypeId={docType.id}
              allowedExtensions={docType.allowed_extensions}
              onUploaded={onUploaded}
              propertyId={propertyId}
              ownerId={ownerId}
              consultantId={consultantId}
              deferred={deferred}
              onFileSelected={onFileSelected}
            />
          )}
        </div>
      </div>
    </div>
  )
}
