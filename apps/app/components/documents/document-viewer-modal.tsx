'use client'

import { ChevronLeft, ChevronRight, Download, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { DocIcon } from '@/components/icons/doc-icon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  getExtensionFromFile,
  isDocxMime,
  isImageMime,
  isPdfMime,
  humanFileSize,
} from '@/lib/documents/file-icon'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'
import { cn } from '@/lib/utils'

import type { DocumentFile } from './types'

type DocumentViewerModalProps = {
  open: boolean
  files: DocumentFile[]
  initialFileId?: string
  onOpenChange: (open: boolean) => void
  onDownload?: (file: DocumentFile) => void
  onDelete?: (file: DocumentFile) => Promise<void> | void
  onReplace?: (file: DocumentFile, newFile: File) => Promise<void> | void
}

export function DocumentViewerModal({
  open,
  files,
  initialFileId,
  onOpenChange,
  onDownload,
  onDelete,
  onReplace,
}: DocumentViewerModalProps) {
  const initialIndex = useMemo(() => {
    if (!initialFileId) return 0
    const idx = files.findIndex((f) => f.id === initialFileId)
    return idx >= 0 ? idx : 0
  }, [files, initialFileId])

  const [index, setIndex] = useState(initialIndex)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [open, initialIndex])

  const current = files[index]

  const goPrev = useCallback(() => {
    setIndex((i) => (files.length ? (i - 1 + files.length) % files.length : 0))
  }, [files.length])
  const goNext = useCallback(() => {
    setIndex((i) => (files.length ? (i + 1) % files.length : 0))
  }, [files.length])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, goPrev, goNext])

  if (!current) return null

  const handleDelete = async () => {
    if (!onDelete) return
    setIsBusy(true)
    try {
      await onDelete(current)
      setConfirmDeleteOpen(false)
      if (files.length <= 1) onOpenChange(false)
      else setIndex((i) => Math.max(0, Math.min(i, files.length - 2)))
    } finally {
      setIsBusy(false)
    }
  }

  const handleReplacePick = async (file: File) => {
    if (!onReplace) return
    setIsBusy(true)
    try {
      await onReplace(current, file)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[85vh] !max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
          showCloseButton
        >
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col bg-muted/20">
              <div className="flex items-center justify-between border-b bg-background/80 px-4 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <DocIcon
                    extension={getExtensionFromFile({
                      mimeType: current.mimeType,
                      name: current.name,
                    })}
                    className="h-6 w-5"
                  />
                  <div className="min-w-0">
                    {current.label && (
                      <p className="truncate text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                        {current.label}
                      </p>
                    )}
                    <p className="truncate text-sm font-medium">{current.name}</p>
                    {current.size > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {humanFileSize(current.size)}
                      </p>
                    )}
                  </div>
                </div>
                {files.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="icon" onClick={goPrev} aria-label="Anterior">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {DOCUMENT_LABELS.labels.fileOfTotal(index + 1, files.length)}
                    </span>
                    <Button type="button" variant="ghost" size="icon" onClick={goNext} aria-label="Próximo">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                <FilePreview file={current} />
              </div>
            </div>

            <aside className="hidden w-72 shrink-0 flex-col border-l bg-background md:flex">
              <div className="border-b px-4 py-3 text-sm font-medium">
                {DOCUMENT_LABELS.labels.filesCount(files.length)}
              </div>
              <ul className="flex-1 space-y-1 overflow-y-auto p-2">
                {files.map((file, i) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition',
                        i === index ? 'bg-muted' : 'hover:bg-muted/60'
                      )}
                      onClick={() => setIndex(i)}
                    >
                      <DocIcon
                        extension={getExtensionFromFile({
                          mimeType: file.mimeType,
                          name: file.name,
                        })}
                        className="h-8 w-7"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{file.name}</p>
                        {file.label && (
                          <p className="truncate text-[0.65rem] text-muted-foreground">
                            {file.label}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 border-t p-3">
                {onDownload && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onDownload(current)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    {DOCUMENT_LABELS.actions.download}
                  </Button>
                )}
                {onReplace && (
                  <label className="inline-flex cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void handleReplacePick(f)
                        e.currentTarget.value = ''
                      }}
                    />
                    <span className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted">
                      <Upload className="mr-1 h-4 w-4" />
                      {DOCUMENT_LABELS.actions.replace}
                    </span>
                  </label>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={isBusy}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {DOCUMENT_LABELS.actions.delete}
                  </Button>
                )}
              </div>
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{DOCUMENT_LABELS.actions.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {DOCUMENT_LABELS.labels.confirmDelete}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>
              {DOCUMENT_LABELS.actions.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isBusy}
            >
              {DOCUMENT_LABELS.actions.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function FilePreview({ file }: { file: DocumentFile }) {
  if (isPdfMime(file.mimeType)) {
    return (
      <iframe
        src={`${file.url}#toolbar=1&navpanes=0`}
        title={file.name}
        className="h-full w-full"
      />
    )
  }
  if (isImageMime(file.mimeType)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.url} alt={file.name} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }
  if (isDocxMime(file.mimeType) && file.url.startsWith('http')) {
    const src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`
    return <iframe src={src} title={file.name} className="h-full w-full" />
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <DocIcon
        extension={getExtensionFromFile({ mimeType: file.mimeType, name: file.name })}
        className="h-24 w-20"
      />
      <p className="text-sm text-muted-foreground">
        {DOCUMENT_LABELS.labels.noMimePreview}
      </p>
      <a
        href={file.url}
        download={file.name}
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Download className="mr-2 h-4 w-4" />
        {DOCUMENT_LABELS.actions.download}
      </a>
    </div>
  )
}
