'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Calendar, Plus, Inbox, FileText, BarChart3, User, Briefcase, Loader2,
  Check, X as XIcon, Globe, StickyNote, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { PropertyFichasTab } from './property-fichas-tab'
import { BookingLinkDialog } from '@/components/booking/booking-link-dialog'
import { CalendarCog } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VisitRow = any

interface PropertyVisitasTabProps {
  propertyId: string
  propertySlug: string | null
  consultantId: string | null
  listingPrice: number | null
  visits: VisitRow[]
  visitsLoading: boolean
  onNewVisitClick: () => void
  onVisitsChange: () => void
}

type SubTab = 'pedidos' | 'visitas' | 'fichas' | 'analise' | 'recomendacoes'

const VISIT_STATUS: Record<string, { label: string; color: string }> = {
  proposal: { label: 'Pedido', color: 'bg-amber-500/15 text-amber-700' },
  scheduled: { label: 'Agendada', color: 'bg-blue-500/15 text-blue-700' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-500/15 text-emerald-700' },
  completed: { label: 'Realizada', color: 'bg-slate-500/15 text-slate-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/15 text-red-700' },
  no_show: { label: 'Não compareceu', color: 'bg-amber-500/15 text-amber-700' },
  rejected: { label: 'Rejeitada', color: 'bg-red-500/15 text-red-700' },
}

function formatDate(dateISO: string | null) {
  if (!dateISO) return '—'
  try {
    return new Date(dateISO + 'T00:00:00').toLocaleDateString('pt-PT', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return dateISO }
}

export function PropertyVisitasTab({
  propertyId, propertySlug, consultantId, listingPrice,
  visits, visitsLoading, onNewVisitClick, onVisitsChange,
}: PropertyVisitasTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('pedidos')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [rejectVisitId, setRejectVisitId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [recomendacoesEnabled, setRecomendacoesEnabled] = useState(false)

  const { pedidos, historico } = useMemo(() => {
    const pedidos = visits.filter((v) => v.status === 'proposal')
    const historico = visits.filter((v) => v.status !== 'proposal')
    return { pedidos, historico }
  }, [visits])

  const handleAccept = async (visitId: string) => {
    setAcceptingId(visitId)
    try {
      const res = await fetch(`/api/visits/${visitId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'confirm' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao aceitar')
        return
      }
      toast.success('Pedido aceite — visita agendada')
      onVisitsChange()
    } catch {
      toast.error('Erro ao aceitar')
    } finally {
      setAcceptingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectVisitId || !rejectReason.trim()) return
    setRejecting(true)
    try {
      const res = await fetch(`/api/visits/${rejectVisitId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'reject', reason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao rejeitar')
        return
      }
      toast.success('Pedido rejeitado')
      setRejectVisitId(null)
      setRejectReason('')
      onVisitsChange()
    } catch {
      toast.error('Erro ao rejeitar')
    } finally {
      setRejecting(false)
    }
  }

  const tabs: { key: SubTab; label: string; icon: typeof Calendar; badge?: number }[] = [
    { key: 'pedidos', label: 'Pedidos', icon: Inbox, badge: pedidos.length },
    { key: 'visitas', label: 'Visitas', icon: Calendar, badge: historico.length },
    { key: 'fichas', label: 'Fichas', icon: FileText },
    { key: 'analise', label: 'Análise', icon: BarChart3 },
    ...(recomendacoesEnabled ? [{ key: 'recomendacoes' as SubTab, label: 'Recomendações IA', icon: Sparkles }] : []),
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Sub-tabs + Availability action */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
                  subTab === t.key
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <Badge variant="secondary" className="text-[9px] rounded-full px-1.5 ml-0.5">
                    {t.badge}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>

        <BookingLinkDialog
          propertyId={propertyId}
          propertySlug={propertySlug}
          consultantId={consultantId}
          trigger={
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <CalendarCog className="h-3.5 w-3.5" />
              Editar disponibilidade
            </Button>
          }
        />
      </div>

      {/* ═══ Pedidos ═══ */}
      {subTab === 'pedidos' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {visitsLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : pedidos.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center">
              <Inbox className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sem pedidos pendentes.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Pedidos chegam via link público ou por propostas entre consultores.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map((v) => {
                const isPublic = v.booking_source === 'public'
                const isBusy = acceptingId === v.id
                return (
                  <div key={v.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">
                            {v.client_name || v.lead?.nome || 'Sem nome'}
                          </span>
                          {isPublic && (
                            <Badge variant="secondary" className="text-[9px] rounded-full gap-1">
                              <Globe className="h-2.5 w-2.5" /> Público
                            </Badge>
                          )}
                          <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-700">
                            Pendente
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(v.visit_date)}
                          </span>
                          {v.visit_time && (
                            <span>{v.visit_time.slice(0, 5)}</span>
                          )}
                        </div>
                        {(v.client_email || v.client_phone) && (
                          <div className="text-[11px] text-muted-foreground/80">
                            {v.client_email}
                            {v.client_email && v.client_phone && ' · '}
                            {v.client_phone}
                          </div>
                        )}
                        {v.notes && (
                          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground pt-1 border-t mt-2">
                            <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{v.notes}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleAccept(v.id)}
                          disabled={isBusy}
                          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectVisitId(v.id); setRejectReason('') }}
                          disabled={isBusy}
                          className="h-8 gap-1.5"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Visitas ═══ */}
      {subTab === 'visitas' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {visitsLoading ? '...' : `${historico.length} visita${historico.length !== 1 ? 's' : ''}`}
            </p>
            <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={onNewVisitClick}>
              <Plus className="h-3 w-3" /> Agendar Visita
            </Button>
          </div>
          {visitsLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : historico.length > 0 ? (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="divide-y">
                {historico.map((v) => {
                  const st = VISIT_STATUS[v.status] || { label: v.status, color: 'bg-muted text-muted-foreground' }
                  return (
                    <div key={v.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{formatDate(v.visit_date)}</span>
                          {v.visit_time && <span className="text-xs text-muted-foreground">{v.visit_time.slice(0, 5)}</span>}
                          <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5', st.color)}>{st.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {(v.client_name || v.lead?.nome || v.lead?.name) && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {v.client_name || v.lead?.nome || v.lead?.name}
                            </span>
                          )}
                          {v.consultant?.commercial_name && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {v.consultant.commercial_name}
                            </span>
                          )}
                        </div>
                      </div>
                      {v.feedback_rating && (
                        <div className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                          {v.feedback_rating}/5
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sem visitas registadas.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Fichas ═══ */}
      {subTab === 'fichas' && (
        <div className="animate-in fade-in duration-200">
          <PropertyFichasTab
            propertyId={propertyId}
            propertySlug={propertySlug}
            listingPrice={listingPrice}
            forcedSubTabs={['fichas']}
          />
        </div>
      )}

      {/* ═══ Análise ═══ */}
      {subTab === 'analise' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              onClick={() => {
                setRecomendacoesEnabled(true)
                setSubTab('recomendacoes')
              }}
              className="h-8 gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {recomendacoesEnabled ? 'Ver Recomendações IA' : 'Gerar Recomendações IA'}
            </Button>
          </div>
          <PropertyFichasTab
            propertyId={propertyId}
            propertySlug={propertySlug}
            listingPrice={listingPrice}
            forcedSubTabs={['dashboard']}
          />
        </div>
      )}

      {/* ═══ Recomendações IA ═══ */}
      {subTab === 'recomendacoes' && (
        <div className="animate-in fade-in duration-200">
          <PropertyFichasTab
            propertyId={propertyId}
            propertySlug={propertySlug}
            listingPrice={listingPrice}
            forcedSubTabs={['recomendacoes']}
          />
        </div>
      )}

      {/* Reject reason dialog */}
      <Dialog open={!!rejectVisitId} onOpenChange={(o) => !o && setRejectVisitId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar pedido de visita</DialogTitle>
            <DialogDescription>
              Indica o motivo — será enviado por email ao prospect.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex: Horário indisponível, proposta duplicada..."
            rows={3}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectVisitId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejecting}
              className="gap-1.5"
            >
              {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XIcon className="h-3.5 w-3.5" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
