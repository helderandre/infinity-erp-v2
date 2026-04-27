'use client'

/**
 * Lists lead-entries the current user has referred to other consultores
 * but that haven't been qualified yet (status='pending'). Mirrors the UX
 * of MyLeadsSheet (the pill-and-list pattern) but the source is
 * leads_referrals filtered to entry_id IS NOT NULL + from_consultant_id=me.
 *
 * Each row shows the contact name, recipient consultor, time-ago, and a
 * "Cancelar" action that goes through the existing DELETE handler — only
 * shown when the 5h cancellation window is still open.
 */

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Inbox, Send, Undo2, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { useIsMobile } from '@/hooks/use-mobile'

interface PendingReferral {
  id: string
  status: string
  created_at: string
  entry_id: string | null
  to_consultant_id: string | null
  from_consultant_id: string | null
  contact?: { id: string; nome: string | null } | null
  to_user?: { id: string; commercial_name: string | null } | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  consultantId: string
  /** Bumped after a successful cancel so the parent can refresh its count. */
  onChange?: () => void
}

export function ReferenciadasPendingSheet({ open, onOpenChange, consultantId, onChange }: Props) {
  const isMobile = useIsMobile()
  const [referrals, setReferrals] = useState<PendingReferral[]>([])
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const fetchReferrals = useCallback(async () => {
    if (!consultantId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from_consultant_id: consultantId,
        status: 'pending',
        per_page: '50',
      })
      const res = await fetch(`/api/crm/referrals?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar referências')
      const json = await res.json()
      const list: PendingReferral[] = (json.data ?? []).filter(
        (r: PendingReferral) => !!r.entry_id,
      )
      setReferrals(list)
    } catch {
      setReferrals([])
    } finally {
      setLoading(false)
    }
  }, [consultantId])

  useEffect(() => {
    if (open) fetchReferrals()
  }, [open, fetchReferrals])

  const handleCancel = useCallback(async (id: string) => {
    if (cancelling) return
    setCancelling(id)
    try {
      const res = await fetch(`/api/crm/referrals/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao cancelar')
      toast.success('Referência cancelada — a lead voltou para ti')
      fetchReferrals()
      onChange?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar a referência')
    } finally {
      setCancelling(null)
    }
  }, [cancelling, fetchReferrals, onChange])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Referências por qualificar</SheetTitle>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        {/* Header */}
        <div className="px-6 pt-8 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                Referências
              </p>
              <h2 className="font-semibold text-[22px] leading-tight tracking-tight mt-0.5">
                {loading
                  ? 'A carregar...'
                  : referrals.length === 1
                  ? '1 por qualificar'
                  : `${referrals.length} por qualificar`}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                Leads que enviaste a outros consultores e ainda não foram qualificadas.
              </p>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {loading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          ) : referrals.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">Sem referências por qualificar</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Quando referenciares uma lead a outro consultor, ela aparece aqui até ser qualificada.
              </p>
            </div>
          ) : (
            referrals.map((r) => {
              const contactName = r.contact?.nome || 'Sem nome'
              const recipientName = r.to_user?.commercial_name || 'Consultor'
              const timeAgo = formatDistanceToNow(new Date(r.created_at), {
                addSuffix: true,
                locale: pt,
              })
              const isCancelling = cancelling === r.id
              return (
                <div
                  key={r.id}
                  className={cn(
                    'rounded-xl border border-sky-300/60 dark:border-sky-700/60 bg-sky-50/40 dark:bg-sky-950/20',
                    'p-3 flex items-start gap-3',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{contactName}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-foreground/80 inline-flex items-center gap-1.5 truncate">
                      <Send className="h-2.5 w-2.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="truncate">Para {recipientName}</span>
                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                      <span className="text-muted-foreground truncate">aguarda qualificação</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancel(r.id)}
                    disabled={isCancelling}
                    title="Cancelar a referência (não afecta negócios já registados)"
                    className={cn(
                      'shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                      'bg-muted/60 text-foreground/80 hover:bg-muted hover:text-foreground',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                    )}
                  >
                    <Undo2 className="h-3 w-3" />
                    {isCancelling ? 'A cancelar…' : 'Cancelar'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
