'use client'

import { useUploadStore } from '@/stores/upload-store'
import type { UploadItem } from '@/stores/upload-store'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Image as ImageIcon,
  FileText,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

function UploadItemRow({ item }: { item: UploadItem }) {
  const { removeItem } = useUploadStore()

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group">
      {/* Thumbnail or icon */}
      <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : item.fileName.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{item.fileName}</p>
        {item.context && (
          <p className="text-[10px] text-muted-foreground truncate">{item.context}</p>
        )}
        {/* Progress bar */}
        {item.status === 'uploading' && (
          <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
        {item.status === 'error' && (
          <p className="text-[10px] text-destructive mt-0.5 truncate">{item.error}</p>
        )}
      </div>

      {/* Status indicator */}
      <div className="shrink-0 flex items-center gap-1">
        {item.status === 'pending' && (
          <span className="text-[10px] text-muted-foreground">Em fila</span>
        )}
        {item.status === 'uploading' && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground tabular-nums">{item.progress}%</span>
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          </div>
        )}
        {item.status === 'done' && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
        {item.status === 'error' && (
          <div className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <button
              onClick={() => removeItem(item.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function UploadPanel() {
  const { items, isMinimized, toggleMinimized, clearDone, removeItem } = useUploadStore()
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null)

  const uploading = items.filter((i) => i.status === 'uploading' || i.status === 'pending')
  const done = items.filter((i) => i.status === 'done')
  const errors = items.filter((i) => i.status === 'error')

  const totalActive = uploading.length
  const totalDone = done.length
  const totalErrors = errors.length

  // Auto-clear done items after 8 seconds of no activity
  useEffect(() => {
    if (totalActive === 0 && totalDone > 0 && totalErrors === 0) {
      const timer = setTimeout(() => {
        clearDone()
      }, 8000)
      setAutoHideTimer(timer)
      return () => clearTimeout(timer)
    }
    if (autoHideTimer) {
      clearTimeout(autoHideTimer)
      setAutoHideTimer(null)
    }
  }, [totalActive, totalDone, totalErrors])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 text-white cursor-pointer"
          onClick={toggleMinimized}
        >
          <div className="flex items-center gap-2">
            {totalActive > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : totalErrors > 0 ? (
              <AlertCircle className="h-4 w-4 text-red-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            <span className="text-xs font-medium">
              {totalActive > 0
                ? `A enviar ${totalActive} ficheiro${totalActive !== 1 ? 's' : ''}...`
                : totalErrors > 0
                  ? `${totalErrors} erro${totalErrors !== 1 ? 's' : ''}`
                  : `${totalDone} ficheiro${totalDone !== 1 ? 's' : ''} enviado${totalDone !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {totalDone > 0 && totalActive === 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation()
                  clearDone()
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {isMinimized ? (
              <ChevronUp className="h-4 w-4 text-white/50" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/50" />
            )}
          </div>
        </div>

        {/* Items */}
        {!isMinimized && (
          <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
            {items.map((item) => (
              <UploadItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
