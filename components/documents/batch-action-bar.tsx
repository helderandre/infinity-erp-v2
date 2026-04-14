'use client'

import { Download, Send, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'
import { cn } from '@/lib/utils'

type BatchActionBarProps = {
  selectedCount: number
  totalFiles: number
  isBusy?: boolean
  onDownload: () => void
  onSend?: () => void
  onCancel: () => void
}

export function BatchActionBar({
  selectedCount,
  totalFiles,
  isBusy,
  onDownload,
  onSend,
  onCancel,
}: BatchActionBarProps) {
  const visible = selectedCount > 0
  const sendDisabled = totalFiles === 0 || isBusy
  return (
    <div
      role="toolbar"
      aria-hidden={visible ? 'false' : 'true'}
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
        {onSend ? (
          sendDisabled ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                    >
                      <Send className="mr-1 h-4 w-4" />
                      {DOCUMENT_LABELS.actions.send}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {DOCUMENT_LABELS.send.noFiles}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onSend}
            >
              <Send className="mr-1 h-4 w-4" />
              {DOCUMENT_LABELS.actions.send}
            </Button>
          )
        ) : null}
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
