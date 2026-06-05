'use client'

import { Upload, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import { DocIcon } from '@/components/icons/doc-icon'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getExtensionFromFile, humanFileSize } from '@/lib/documents/file-icon'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'
import { cn } from '@/lib/utils'

const MAX_FILE_BYTES = 50 * 1024 * 1024

export type DocTypeOption = {
  id: string
  name: string
  slug: string
  hasExpiry: boolean
  expiryRequired: boolean
  allowedExtensions?: string[] | null
  categoryId?: string | null
}

export type UploadItem = {
  file: File
  label: string
}

export type DocumentUploadSubmitInput = {
  docType: DocTypeOption
  items: UploadItem[]
  validUntil?: string | null
  notes?: string | null
}

type DocumentUploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  docTypes: DocTypeOption[]
  defaultDocTypeId?: string | null
  onSubmit: (input: DocumentUploadSubmitInput) => Promise<void> | void
  title?: string
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  docTypes,
  defaultDocTypeId,
  onSubmit,
  title,
}: DocumentUploadDialogProps) {
  const [docTypeId, setDocTypeId] = useState<string | null>(defaultDocTypeId ?? null)
  const [items, setItems] = useState<UploadItem[]>([])
  const [validUntil, setValidUntil] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setDocTypeId(defaultDocTypeId ?? docTypes[0]?.id ?? null)
    setItems([])
    setValidUntil('')
    setNotes('')
  }, [open, defaultDocTypeId, docTypes])

  const docType = useMemo(
    () => docTypes.find((t) => t.id === docTypeId) ?? null,
    [docTypes, docTypeId]
  )

  const allowedExtensions = docType?.allowedExtensions?.map((x) =>
    x.toLowerCase().replace(/^\./, '')
  )

  const onDrop = useCallback(
    (accepted: File[], rejected: { file: File }[]) => {
      const valid: UploadItem[] = []
      for (const f of accepted) {
        if (f.size > MAX_FILE_BYTES) {
          toast.error(DOCUMENT_LABELS.toasts.fileTooLarge(f.name))
          continue
        }
        if (allowedExtensions && allowedExtensions.length > 0) {
          const ext = (f.name.split('.').pop() ?? '').toLowerCase()
          if (!allowedExtensions.includes(ext)) {
            toast.error(DOCUMENT_LABELS.toasts.fileRejected(f.name))
            continue
          }
        }
        valid.push({ file: f, label: '' })
      }
      for (const r of rejected) {
        toast.error(DOCUMENT_LABELS.toasts.fileRejected(r.file.name))
      }
      setItems((prev) => [...prev, ...valid])
    },
    [allowedExtensions]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_BYTES,
    multiple: true,
  })

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx))

  const updateLabel = (idx: number, label: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, label } : it)))

  const canSubmit =
    !isBusy &&
    !!docType &&
    items.length > 0 &&
    (!docType.expiryRequired || !!validUntil)

  const handleSubmit = async () => {
    if (!docType || items.length === 0) return
    setIsBusy(true)
    try {
      await onSubmit({
        docType,
        items,
        validUntil: validUntil || null,
        notes: notes || null,
      })
      onOpenChange(false)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !isBusy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title ?? DOCUMENT_LABELS.actions.uploadDocument}</DialogTitle>
          <DialogDescription>{DOCUMENT_LABELS.labels.uploadAccepted}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {docTypes.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="upload-doc-type">{DOCUMENT_LABELS.labels.docType}</Label>
              <Select value={docTypeId ?? undefined} onValueChange={setDocTypeId}>
                <SelectTrigger id="upload-doc-type">
                  <SelectValue placeholder={DOCUMENT_LABELS.labels.docType} />
                </SelectTrigger>
                <SelectContent>
                  {docTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            {...getRootProps()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/30 hover:border-primary/50'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{DOCUMENT_LABELS.labels.uploadDrag}</p>
            <p className="text-xs text-muted-foreground">
              {DOCUMENT_LABELS.labels.uploadAccepted}
            </p>
          </div>

          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-md border bg-muted/30 p-2"
                >
                  <DocIcon
                    extension={getExtensionFromFile({
                      mimeType: it.file.type,
                      name: it.file.name,
                    })}
                    className="h-8 w-7 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {humanFileSize(it.file.size)}
                    </p>
                    <Input
                      value={it.label}
                      onChange={(e) => updateLabel(i, e.target.value)}
                      placeholder={DOCUMENT_LABELS.labels.fileLabelPlaceholder}
                      className="mt-1 h-7 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(i)}
                    disabled={isBusy}
                    aria-label="Remover ficheiro"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {docType?.hasExpiry && (
            <div className="grid gap-2">
              <Label htmlFor="upload-expiry">
                {docType.expiryRequired
                  ? DOCUMENT_LABELS.labels.expiryRequired
                  : DOCUMENT_LABELS.labels.expiryOptional}
              </Label>
              <DatePicker
                id="upload-expiry"
                value={validUntil}
                onChange={(v) => setValidUntil(v)}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="upload-notes">{DOCUMENT_LABELS.labels.notes}</Label>
            <Textarea
              id="upload-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            {DOCUMENT_LABELS.actions.cancel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {DOCUMENT_LABELS.actions.upload}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
