// @ts-nocheck
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

interface AcompanhamentoCreditFormProps {
  initialData?: {
    pre_approval_amount?: number | null
    credit_intermediation?: boolean
    credit_entity?: string | null
    credit_notes?: string | null
    notes?: string | null
  }
  onSubmit: (data: any) => Promise<any>
  onCancel?: () => void
}

/**
 * Simplified form — only the acompanhamento-specific fields (credit + notes).
 * Buyer criteria (budget, location, type, etc.) is edited on the negócio page.
 */
export function AcompanhamentoCreditForm({
  initialData,
  onSubmit,
  onCancel,
}: AcompanhamentoCreditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [preApprovalAmount, setPreApprovalAmount] = useState(initialData?.pre_approval_amount || '')
  const [creditIntermediation, setCreditIntermediation] = useState(initialData?.credit_intermediation || false)
  const [creditEntity, setCreditEntity] = useState(initialData?.credit_entity || '')
  const [creditNotes, setCreditNotes] = useState(initialData?.credit_notes || '')
  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit({
        pre_approval_amount: preApprovalAmount ? Number(preApprovalAmount) : null,
        credit_intermediation: creditIntermediation,
        credit_entity: creditEntity || null,
        credit_notes: creditNotes || null,
        notes: notes || null,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Intermediação de Crédito
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Montante Pré-Aprovado (€)</Label>
            <Input
              className="rounded-xl"
              type="number"
              value={preApprovalAmount}
              onChange={(e) => setPreApprovalAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Entidade Bancária</Label>
            <Input
              className="rounded-xl"
              placeholder="Nome do banco"
              value={creditEntity}
              onChange={(e) => setCreditEntity(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={creditIntermediation} onCheckedChange={setCreditIntermediation} />
          <Label className="text-xs">Necessita intermediação de crédito</Label>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">Notas de Crédito</Label>
          <Textarea
            className="rounded-xl"
            rows={2}
            placeholder="Observações sobre crédito..."
            value={creditNotes}
            onChange={(e) => setCreditNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Notas
        </h4>
        <Textarea
          className="rounded-xl"
          rows={3}
          placeholder="Observações gerais sobre o acompanhamento..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="rounded-full px-6" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </form>
  )
}
