'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LOST_REASONS } from '@/lib/constants-leads-crm'

interface LostReasonDialogProps {
  open: boolean
  onConfirm: (reason: string, notes?: string) => void
  onCancel: () => void
}

export function LostReasonDialog({ open, onConfirm, onCancel }: LostReasonDialogProps) {
  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Both the reason (dropdown) and a written description are mandatory.
  const canConfirm = !!reason && notes.trim().length > 0

  function handleConfirm() {
    if (!canConfirm) return
    onConfirm(reason, notes.trim())
    setReason('')
    setNotes('')
  }

  function handleCancel() {
    setReason('')
    setNotes('')
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleCancel() }}>
      <DialogContent className="sm:max-w-[440px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Marcar como Perdido</DialogTitle>
          <DialogDescription>
            Indique o motivo pelo qual este negócio foi perdido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="lost-reason">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="lost-reason">
                <SelectValue placeholder="Seleccionar motivo..." />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lost-notes">
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="lost-notes"
              placeholder="Descreva o que aconteceu / porque é que esta oportunidade foi perdida..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} className="rounded-full">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-full"
          >
            Confirmar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
