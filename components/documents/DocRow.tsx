'use client'

import { useState, useRef, useEffect } from 'react'
import { FileText, CheckCircle2, FileCheck2, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { UploadZone } from './UploadZone'
import type { DocType } from '@/types/document'

interface DocRowProps {
  docType: DocType
  isUploaded: boolean
  isPending?: boolean           // Ficheiro seleccionado, aguarda upload
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  // Deferred mode
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
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
}: DocRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [isOpen])

  // Auto-close when upload completes or file is selected (deferred)
  useEffect(() => {
    if ((isUploaded || isPending) && isOpen) {
      setIsOpen(false)
    }
  }, [isUploaded, isPending, isOpen])

  const canToggle = !isUploaded && !isPending

  return (
    <div className="rounded-lg border bg-card transition-colors">
      {/* Row header */}
      <div
        role={canToggle ? 'button' : undefined}
        tabIndex={canToggle ? 0 : undefined}
        aria-expanded={canToggle ? isOpen : undefined}
        onClick={() => canToggle && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (canToggle && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setIsOpen((prev) => !prev)
          }
        }}
        className={`
          flex items-center gap-3 px-3 py-3
          ${canToggle ? 'cursor-pointer hover:bg-accent/50' : ''}
          transition-colors duration-150
        `}
      >
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm flex-1 min-w-0 truncate">{docType.name}</span>

        {isUploaded ? (
          <Badge className="animate-in bg-emerald-50 text-emerald-600 border-0 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Carregado
          </Badge>
        ) : isPending ? (
          <Badge className="animate-in bg-blue-50 text-blue-600 border-0 dark:bg-blue-950 dark:text-blue-400 shrink-0">
            <FileCheck2 className="mr-1 h-3 w-3" />
            Seleccionado
          </Badge>
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
