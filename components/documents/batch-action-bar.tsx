'use client'

import { Download, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'
import { cn } from '@/lib/utils'

type BatchActionBarProps = {
  selectedCount: number
  totalFiles: number
  isBusy?: boolean
  onDownload: () => void
  onUpload?: () => void
  onCancel: () => void
}

export function BatchActionBar({
  selectedCount,
  totalFiles,
  isBusy,
  onDownload,
  onUpload,
  onCancel,
}: BatchActionBarProps) {
  const visible = selectedCount > 0
  return (
    <div
      role="toolbar"
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 transition-all duration-200',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-full opacity-0'
      )}
    >
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur'
        )}
      >
        <span className="text-sm font-medium">
          {DOCUMENT_LABELS.labels.selected(selectedCount)}
        </span>
        <span className="text-xs text-muted-foreground">
          · {DOCUMENT_LABELS.labels.filesCount(totalFiles)}
        </span>
        <div className="mx-2 h-5 w-px bg-border" />
        <Button
          type="button"
          size="sm"
          onClick={onDownload}
          disabled={isBusy || totalFiles === 0}
        >
          <Download className="mr-1 h-4 w-4" />
          {DOCUMENT_LABELS.actions.download}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onUpload}
          disabled
          title="Em breve"
        >
          <Upload className="mr-1 h-4 w-4" />
          {DOCUMENT_LABELS.actions.upload}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
        >
          <X className="mr-1 h-4 w-4" />
          {DOCUMENT_LABELS.actions.cancel}
        </Button>
      </div>
    </div>
  )
}
