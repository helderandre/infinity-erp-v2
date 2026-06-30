'use client'

/**
 * BulkReferralDialog — refer several rows (oportunidades OR lead entries) to
 * one consultor in a single action, keeping the current user as the referrer.
 *
 * Mirrors the picker/results shape of <BulkPipelineActionDialog> but posts to
 * /api/crm/referrals/bulk:
 *   • kind='negocio' → flips each deal's owner + records the referrer slice
 *     (referrer_consultant_id + %); the deals show in the caller's
 *     Referências kanban.
 *   • kind='entry'   → flips each lead entry's owner to the recipient; the
 *     leads show in the caller's Referências "por qualificar" sheet and any
 *     future deal the recipient makes with that contacto inherits the slice.
 *
 * Distinct from "Reatribuir consultor" (a plain owner change that keeps NO
 * commission reference).
 */

import { useEffect, useState, useCallback } from 'react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Loader2, Send, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { invalidateAfterReferral } from '@/lib/crm/invalidator'

const DEFAULT_PCT = 25

interface ConsultorOption {
  id: string
  commercial_name: string
  profile_photo_url?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Selected row ids — négocio ids (kind='negocio') or lead-entry ids (kind='entry'). */
  ids: string[]
  /** Which surface the ids come from. Drives the request shape + copy. */
  kind?: 'negocio' | 'entry'
  /** Refreshes the board + clears selection once the referral returns ok. */
  onDone?: () => void
}

const NOUN: Record<'negocio' | 'entry', { sing: string; plur: string; title: string }> = {
  negocio: { sing: 'negócio', plur: 'negócios', title: 'Referenciar negócios' },
  entry: { sing: 'lead', plur: 'leads', title: 'Referenciar leads' },
}

export function BulkReferralDialog({ open, onOpenChange, ids, kind = 'negocio', onDone }: Props) {
  const { user } = useUser()
  const noun = NOUN[kind]
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<
    { id: string; ok: boolean; error?: string }[] | null
  >(null)

  const [recipientId, setRecipientId] = useState('')
  const [pct, setPct] = useState(String(DEFAULT_PCT))
  const [notes, setNotes] = useState('')

  // Lazy-load active consultores, minus the current user (can't refer to self).
  const [consultors, setConsultors] = useState<ConsultorOption[] | null>(null)
  useEffect(() => {
    if (!open || consultors !== null) return
    let cancelled = false
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return
        const arr = Array.isArray(json) ? json : json.data ?? []
        setConsultors(
          arr
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((u: any) => ({
              id: u.id,
              commercial_name: u.commercial_name ?? u.email ?? '—',
              profile_photo_url:
                u.dev_consultant_profiles?.profile_photo_url ??
                u.profile_photo_url ?? null,
            }))
            .filter((c: ConsultorOption) => c.id !== user?.id),
        )
      })
      .catch(() => { if (!cancelled) setConsultors([]) })
    return () => { cancelled = true }
  }, [open, consultors, user?.id])

  // Reset when the dialog closes.
  useEffect(() => {
    if (!open) {
      setResults(null)
      setSubmitting(false)
      setRecipientId('')
      setPct(String(DEFAULT_PCT))
      setNotes('')
    }
  }, [open])

  const pctNum = Number(pct)
  const pctValid = Number.isFinite(pctNum) && pctNum >= 1 && pctNum <= 100
  const canSubmit = !submitting && !!recipientId && pctValid

  const handleSubmit = useCallback(async () => {
    if (!recipientId) {
      toast.error('Escolhe o consultor que vai receber a referência')
      return
    }
    if (!pctValid) {
      toast.error('Percentagem inválida (1–100)')
      return
    }
    setSubmitting(true)
    setResults(null)
    try {
      const res = await fetch('/api/crm/referrals/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(kind === 'entry' ? { entry_ids: ids } : { negocio_ids: ids }),
          to_consultant_id: recipientId,
          referral_pct: pctNum,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error ?? 'Falha ao enviar as referências')
        return
      }
      const list = (json.results ?? []) as { id: string; ok: boolean; error?: string }[]
      setResults(list)
      const okCount = list.filter((r) => r.ok).length
      const failCount = list.length - okCount
      if (failCount === 0) {
        toast.success(
          `${okCount} ${okCount === 1 ? `${noun.sing} referenciado` : `${noun.plur} referenciados`}`,
        )
      } else {
        toast.warning(`${okCount} referenciado(s), ${failCount} falhou`)
      }
      // Drop the referred deals from the caller's pipeline + repopulate the
      // Referências view.
      invalidateAfterReferral()
      onDone?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }, [recipientId, pctValid, pctNum, ids, kind, noun, notes, onDone])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Send className="h-5 w-5" />
            {noun.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {ids.length} {ids.length === 1 ? noun.sing : noun.plur} · passam para o
            consultor escolhido e o dono atual de cada um mantém a percentagem da comissão (e em negócios
            futuros que o novo consultor faça com esses contactos).
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-referral-recipient">Consultor</Label>
            {consultors === null ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                A carregar consultores…
              </p>
            ) : consultors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Sem consultores disponíveis.
              </p>
            ) : (
              <Select value={recipientId} onValueChange={setRecipientId} disabled={submitting}>
                <SelectTrigger id="bulk-referral-recipient" className="h-10">
                  <SelectValue placeholder="Escolher consultor…" />
                </SelectTrigger>
                <SelectContent className="max-h-[260px]">
                  {consultors.map((c) => {
                    const initials = c.commercial_name
                      .split(' ')
                      .map((p) => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            {c.profile_photo_url && (
                              <AvatarImage src={c.profile_photo_url} alt={c.commercial_name} />
                            )}
                            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                          </Avatar>
                          {c.commercial_name}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-referral-pct">Percentagem da comissão (%)</Label>
            <Input
              id="bulk-referral-pct"
              type="number"
              min={1}
              max={100}
              step={1}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              disabled={submitting}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Aplica-se a todos os negócios selecionados. Predefinido em 25% (mínimo 1%).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-referral-notes">Notas (opcional)</Label>
            <Textarea
              id="bulk-referral-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              placeholder="Algum contexto que ajude o consultor que vai receber…"
            />
          </div>

          {results && (
            <div className="space-y-1.5 pt-1 max-h-[180px] overflow-y-auto">
              {results.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]',
                    r.ok
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-700 dark:text-red-400',
                  )}
                >
                  {r.ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  <span className="font-mono text-[10px] opacity-80">
                    {r.id.slice(0, 8)}
                  </span>
                  <span className="truncate">{r.ok ? 'referenciado' : r.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {results ? 'Fechar' : 'Cancelar'}
          </Button>
          {!results && (
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar referências
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
