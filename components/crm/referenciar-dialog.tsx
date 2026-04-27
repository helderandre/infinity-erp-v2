'use client'

/**
 * Refer a contacto / lead_entry / negócio to another consultor.
 *
 * One dialog used from three call-sites:
 *   - négocio detail header: subject = { kind: 'negocio', id, contact_id }
 *   - lead-entries inbox row: subject = { kind: 'lead_entry', id, contact_id }
 *   - contacto detail header: subject = { kind: 'contact', id, contact_id }
 *
 * On submit it POSTs /api/crm/referrals with referral_type='internal',
 * which both records the audit row in leads_referrals AND performs the
 * underlying hand-off (transfer ownership / set commission slice).
 *
 * The recipient is picked from the active consultor list. Pct defaults to
 * the agency-wide setting (25 unless overridden in temp_agency_settings).
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Send, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUser } from '@/hooks/use-user'

const DEFAULT_PCT = 25

export type ReferralSubject =
  | { kind: 'negocio'; id: string; contact_id: string; label?: string }
  | { kind: 'lead_entry'; id: string; contact_id: string; label?: string }
  | { kind: 'contact'; id: string; contact_id: string; label?: string }

interface ConsultantOption {
  id: string
  commercial_name: string | null
  profile_photo_url?: string | null
}

interface ReferenciarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject: ReferralSubject
  onSuccess?: () => void
}

const SUBJECT_LABEL: Record<ReferralSubject['kind'], string> = {
  negocio: 'negócio',
  lead_entry: 'lead',
  contact: 'contacto',
}

export function ReferenciarDialog({
  open,
  onOpenChange,
  subject,
  onSuccess,
}: ReferenciarDialogProps) {
  const { user } = useUser()
  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  const [recipientId, setRecipientId] = useState<string>('')
  const [pct, setPct] = useState<string>(String(DEFAULT_PCT))
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load active consultor list (same endpoint used by bulk actions, quick
  // actions, share-list, etc — already cached server-side).
  useEffect(() => {
    if (!open) return
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list: ConsultantOption[] = Array.isArray(d) ? d : (d.data ?? [])
        // Filter out the current user — you can't refer to yourself.
        setConsultants(list.filter((c) => c.id !== user?.id))
      })
      .catch(() => setConsultants([]))
  }, [open, user?.id])

  // Reset every time the dialog re-opens with a different subject.
  useEffect(() => {
    if (open) {
      setRecipientId('')
      setPct(String(DEFAULT_PCT))
      setNotes('')
    }
  }, [open, subject.id])

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Sessão expirou — recarrega a página')
      return
    }
    if (!recipientId) {
      toast.error('Escolhe o consultor que vai receber a referência')
      return
    }
    const pctNum = Number(pct)
    if (!Number.isFinite(pctNum) || pctNum < 1 || pctNum > 100) {
      toast.error('Percentagem inválida (1–100)')
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        contact_id: subject.contact_id,
        referral_type: 'internal',
        from_consultant_id: user.id,
        to_consultant_id: recipientId,
        referral_pct: pctNum,
        notes: notes.trim() || null,
      }
      if (subject.kind === 'negocio') body.negocio_id = subject.id
      if (subject.kind === 'lead_entry') body.entry_id = subject.id

      const res = await fetch('/api/crm/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Erro ao criar a referência',
        )
      }

      toast.success('Referência enviada')
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar a referência')
    } finally {
      setSubmitting(false)
    }
  }

  const subjectLabel = SUBJECT_LABEL[subject.kind]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Referenciar {subjectLabel}
          </DialogTitle>
          <DialogDescription>
            {subject.kind === 'negocio'
              ? 'O negócio passa para o consultor escolhido. Tu manténs a tua percentagem da comissão neste negócio e em qualquer outro que ele venha a fazer com este contacto.'
              : subject.kind === 'lead_entry'
              ? 'A lead aparece na caixa de entrada do consultor. Qualquer negócio que ele faça com este contacto te paga a tua percentagem da comissão.'
              : 'Fica registado um acordo de referência. Qualquer negócio que o consultor venha a fazer com este contacto te paga a tua percentagem da comissão.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="referral-recipient">Consultor</Label>
            <Select value={recipientId} onValueChange={setRecipientId} disabled={submitting}>
              <SelectTrigger id="referral-recipient">
                <SelectValue placeholder="Escolher consultor…" />
              </SelectTrigger>
              <SelectContent>
                {consultants.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    Sem consultores disponíveis
                  </SelectItem>
                ) : (
                  consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.commercial_name || 'Sem nome'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="referral-pct">Percentagem da comissão (%)</Label>
            <Input
              id="referral-pct"
              type="number"
              min={1}
              max={100}
              step={1}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              disabled={submitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Predefinido em 25% (mínimo 1%). Tanto tu como o consultor podem
              cancelar este acordo a qualquer altura — o cancelamento só afecta
              negócios futuros, os já registados continuam a pagar a tua percentagem.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="referral-notes">Notas (opcional)</Label>
            <Textarea
              id="referral-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              placeholder="Algum contexto que ajude o consultor que vai receber…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A enviar…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar referência
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
