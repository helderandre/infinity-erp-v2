'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'

import type { DocTypeOption } from './document-upload-dialog'
import type { DocumentDomain } from './types'

type CustomDocTypeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  domain: DocumentDomain
  /** Created type is returned so the caller can open the upload dialog with it. */
  onCreated: (docType: DocTypeOption) => void
}

export function CustomDocTypeDialog({
  open,
  onOpenChange,
  domain,
  onCreated,
}: CustomDocTypeDialogProps) {
  const [name, setName] = useState('')
  const [hasExpiry, setHasExpiry] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setHasExpiry(false)
    }
  }, [open])

  const canSubmit = !isBusy && name.trim().length > 1

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsBusy(true)
    try {
      const res = await fetch('/api/libraries/doc-types/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          has_expiry: hasExpiry,
          applies_to: [domain],
          category: 'outros',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro')
      }
      const created = (await res.json()) as DocTypeOption
      toast.success(DOCUMENT_LABELS.toasts.typeCreated)
      onCreated(created)
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : DOCUMENT_LABELS.toasts.typeCreateError
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !isBusy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{DOCUMENT_LABELS.actions.customType}</DialogTitle>
          <DialogDescription>
            Crie um novo tipo de documento para esta categoria &quot;Outros&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="custom-type-name">
              {DOCUMENT_LABELS.labels.docTypeName}
            </Label>
            <Input
              id="custom-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Certificado de parque"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex flex-col">
              <Label htmlFor="custom-type-expiry" className="cursor-pointer">
                {DOCUMENT_LABELS.labels.hasExpiry}
              </Label>
              <span className="text-xs text-muted-foreground">
                Adiciona campo de data de validade ao enviar.
              </span>
            </div>
            <Switch
              id="custom-type-expiry"
              checked={hasExpiry}
              onCheckedChange={setHasExpiry}
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
            {DOCUMENT_LABELS.actions.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
