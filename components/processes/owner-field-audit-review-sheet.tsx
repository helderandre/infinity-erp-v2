'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, ArrowRight, UserPen, Clock } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { cn, formatDateTime } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

import type { PendingFieldAudit } from '@/lib/acquisitions/cmi-requirements'

const FIELD_LABELS: Record<string, string> = {
  naturality: 'Naturalidade',
  address: 'Morada',
  marital_status: 'Estado civil',
  marital_regime: 'Regime de casamento',
  legal_rep_naturality: 'Naturalidade (Rep. legal)',
  legal_rep_address: 'Morada (Rep. legal)',
  legal_rep_marital_status: 'Estado civil (Rep. legal)',
}

const VIA_LABELS: Record<string, string> = {
  owner_app: 'via app do cliente',
  owner_angariacao_checklist: 'via app do cliente',
  owner_smart_batch_upload: 'via app do cliente',
  erp: 'via ERP',
  unknown: 'origem desconhecida',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  audit: PendingFieldAudit | null
  ownerName?: string | null
  onUpdate?: () => void
}

export function OwnerFieldAuditReviewSheet({
  open,
  onOpenChange,
  audit,
  ownerName,
  onUpdate,
}: Props) {
  const isMobile = useIsMobile()
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)

  async function callReview(action: 'approve' | 'reject') {
    if (!audit) return
    setPending(action)
    try {
      const res = await fetch(`/api/owner-field-audits/${audit.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error ?? 'Erro a actualizar')
        return
      }
      toast.success(
        action === 'approve'
          ? 'Alteração aprovada.'
          : 'Alteração rejeitada — valor anterior restaurado.'
      )
      onUpdate?.()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro de rede')
    } finally {
      setPending(null)
    }
  }

  const fieldLabel = audit ? FIELD_LABELS[audit.field_name] ?? audit.field_name : ''
  const viaLabel = audit ? VIA_LABELS[audit.edited_via] ?? audit.edited_via : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[70dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl'
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10 flex items-center gap-2">
                  <UserPen className="h-5 w-5 text-amber-600 shrink-0" />
                  Rever alteração de campo
                </SheetTitle>
                <SheetDescription className="text-xs mt-1 leading-relaxed">
                  {fieldLabel}
                  {ownerName && (
                    <>
                      <br />
                      Editado por <span className="font-medium text-foreground">{ownerName}</span>
                      {audit?.created_at && <> em {formatDateTime(audit.created_at)}</>}
                    </>
                  )}
                  {viaLabel && (
                    <>
                      {' · '}
                      <span className="text-muted-foreground">{viaLabel}</span>
                    </>
                  )}
                </SheetDescription>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 backdrop-blur-sm border-sky-300/70 bg-sky-50/60 text-sky-700 dark:border-sky-700/60 dark:bg-sky-950/30 dark:text-sky-400"
              >
                <Clock className="h-3 w-3 mr-1" />
                Aguarda revisão
              </Badge>
            </div>
          </SheetHeader>
        </div>

        {/* Diff body */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {audit && (
            <>
              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Valor anterior
                </div>
                <div className="rounded-xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-4">
                  <p className={cn(
                    'text-sm whitespace-pre-wrap break-words',
                    !audit.old_value && 'text-muted-foreground italic'
                  )}>
                    {audit.old_value || '(vazio)'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center text-muted-foreground">
                <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-0" />
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Novo valor
                </div>
                <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/60 supports-[backdrop-filter]:bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30 backdrop-blur-sm p-4">
                  <p className={cn(
                    'text-sm font-medium whitespace-pre-wrap break-words',
                    !audit.new_value && 'text-muted-foreground italic'
                  )}>
                    {audit.new_value || '(vazio)'}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Aprovar mantém o novo valor. Rejeitar restaura o valor anterior em {fieldLabel.toLowerCase()}.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 bg-background/60 supports-[backdrop-filter]:bg-background/40 backdrop-blur-xl border-t border-border/40">
          <div className="flex items-center gap-2">
            <Button
              className="rounded-full flex-1 shadow-sm"
              onClick={() => callReview('approve')}
              disabled={pending !== null}
            >
              {pending === 'approve' ? (
                <Spinner variant="infinite" size={14} className="mr-1.5" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
              )}
              Aprovar alteração
            </Button>
            <Button
              variant="outline"
              className="rounded-full text-red-600 border-red-300/70 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm hover:text-red-700 hover:border-red-400 dark:border-red-800/60 dark:hover:border-red-700"
              onClick={() => callReview('reject')}
              disabled={pending !== null}
            >
              {pending === 'reject' ? (
                <Spinner variant="infinite" size={14} className="mr-1.5" />
              ) : (
                <XCircle className="mr-1.5 h-4 w-4" />
              )}
              Rejeitar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
