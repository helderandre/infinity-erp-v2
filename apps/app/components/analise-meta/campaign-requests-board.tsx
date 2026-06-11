'use client'

/**
 * Pipeline de pedidos de campanha Meta — vista de acompanhamento do lado ERP.
 *
 * Espelha o kanban do portal de parceiros (pedido → aceite → criada → activa →
 * terminada, + rejeitadas), mas em modo leitura: as transições de estado são
 * feitas pelo parceiro no portal. Aqui a equipa acompanha onde cada pedido
 * está, quem o tem em mãos e — quando ligado a uma campanha Meta real — o
 * desempenho ao vivo (investimento, leads, anúncios).
 *
 * Dados: GET /api/marketing/campaigns (gestão vê tudo; consultor vê os seus).
 */

import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react'
import {
  Building2, CalendarDays, Handshake, Link2, Loader2, Megaphone, RefreshCw,
  Target, TrendingUp, User, Wallet,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { CAMPAIGN_OBJECTIVES } from '@/lib/constants'

type PartnerStatus = 'pedido' | 'aceite' | 'criada' | 'activa' | 'terminada' | 'rejeitada'

interface MetaSummary {
  name: string | null
  status: string | null
  spend: number | null
  currency: string | null
  leads_count: number
  ads_count: number
}

interface CampaignRequest {
  id: string
  partner_status: PartnerStatus
  meta_campaign_id: string | null
  partner_rejection_reason: string | null
  objective: string
  campaign_type: string | null
  property_id: string | null
  promote_url: string | null
  target_zone: string | null
  target_age_min: number | null
  target_age_max: number | null
  target_interests: string | null
  budget_type: 'daily' | 'total'
  budget_amount: number
  duration_days: number
  start_date: string | null
  end_date: string | null
  total_cost: number
  creative_notes: string | null
  created_at: string
  agent?: { id: string; commercial_name: string } | null
  partner?: { id: string; commercial_name: string } | null
  property?: { id: string; title: string; slug: string } | null
  meta?: MetaSummary | null
}

const TYPE_LABELS: Record<string, string> = {
  compradores: 'Compradores',
  vendedores: 'Vendedores',
  arrendatarios: 'Arrendatários',
  senhorios: 'Senhorios',
  outros: 'Outros',
}

const STATUS_META: Record<PartnerStatus, { label: string; dot: string; chip: string }> = {
  pedido: { label: 'Pedido', dot: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-600' },
  aceite: { label: 'Aceite', dot: 'bg-sky-500', chip: 'bg-sky-500/10 text-sky-600' },
  criada: { label: 'Criada', dot: 'bg-violet-500', chip: 'bg-violet-500/10 text-violet-600' },
  activa: { label: 'Activa', dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-600' },
  terminada: { label: 'Terminada', dot: 'bg-slate-400', chip: 'bg-slate-500/10 text-slate-500' },
  rejeitada: { label: 'Rejeitada', dot: 'bg-red-500', chip: 'bg-red-500/10 text-red-600' },
}

const BOARD_COLUMNS: PartnerStatus[] = ['pedido', 'aceite', 'criada', 'activa', 'terminada']

const eur = (v: number | null | undefined, currency = 'EUR') =>
  v == null ? '—' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(v)

export function CampaignRequestsBoard() {
  const [requests, setRequests] = useState<CampaignRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<CampaignRequest | null>(null)

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/marketing/campaigns', { cache: 'no-store' })
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byStatus = useMemo(() => {
    const map: Record<PartnerStatus, CampaignRequest[]> = {
      pedido: [], aceite: [], criada: [], activa: [], terminada: [], rejeitada: [],
    }
    for (const r of requests) (map[r.partner_status] ??= []).push(r)
    return map
  }, [requests])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          A pipeline é trabalhada pelo parceiro no portal — aqui acompanhas o estado de cada pedido.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <p className="text-muted-foreground text-xs tabular-nums">
            {requests.length} pedido{requests.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="border-border/40 bg-card/40 flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-16 text-center">
          <Megaphone className="text-muted-foreground/50 h-8 w-8" />
          <p className="text-sm font-medium">Sem pedidos de campanha</p>
          <p className="text-muted-foreground max-w-sm text-xs">
            Os pedidos de campanha enviados aos parceiros de marketing aparecem aqui, com o estado da pipeline, investimento e leads gerados.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {BOARD_COLUMNS.map((status) => {
              const items = byStatus[status]
              return (
                <div key={status} className="w-[280px] flex-shrink-0">
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <span className={`h-2 w-2 rounded-full ${STATUS_META[status].dot}`} />
                    <span className="text-sm font-semibold">{STATUS_META[status].label}</span>
                    <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {items.map((r) => (
                      <RequestCard key={r.id} request={r} onClick={() => setSelected(r)} />
                    ))}
                    {items.length === 0 && (
                      <div className="border-border/40 text-muted-foreground/60 rounded-2xl border border-dashed px-3 py-6 text-center text-xs">
                        Vazio
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {byStatus.rejeitada.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-sm font-semibold">Rejeitadas</span>
                <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                  {byStatus.rejeitada.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byStatus.rejeitada.map((r) => (
                  <RequestCard key={r.id} request={r} onClick={() => setSelected(r)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <RequestDetailSheet request={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  )
}

function RequestCard({ request: r, onClick }: { request: CampaignRequest; onClick: () => void }) {
  const objective = CAMPAIGN_OBJECTIVES[r.objective] ?? r.objective
  const type = r.campaign_type ? TYPE_LABELS[r.campaign_type] ?? r.campaign_type : null
  return (
    <button
      onClick={onClick}
      className="border-border/40 bg-card/60 w-full rounded-2xl border p-4 text-left shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{objective}</span>
        {type && (
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
            {type}
          </span>
        )}
      </div>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Handshake className="h-3.5 w-3.5" />
        <span className="truncate">{r.partner?.commercial_name ?? 'Sem parceiro'}</span>
      </div>
      <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
        <User className="h-3.5 w-3.5" />
        <span className="truncate">{r.agent?.commercial_name ?? '—'}</span>
      </div>
      <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
        {r.property ? <Building2 className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        <span className="truncate">{r.property?.title ?? r.promote_url ?? '—'}</span>
      </div>
      <div className="border-border/30 mt-3 flex items-center justify-between border-t pt-2">
        <span className="text-xs font-medium">{eur(r.total_cost)}</span>
        {r.meta ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <TrendingUp className="h-3 w-3" />
            {r.meta.leads_count} leads
          </span>
        ) : (
          <span className="text-muted-foreground/60 text-[11px]">{r.duration_days}d</span>
        )}
      </div>
    </button>
  )
}

function RequestDetailSheet({
  request,
  onOpenChange,
}: {
  request: CampaignRequest | null
  onOpenChange: (open: boolean) => void
}) {
  if (!request) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent />
      </Sheet>
    )
  }

  const r = request
  const objective = CAMPAIGN_OBJECTIVES[r.objective] ?? r.objective
  const type = r.campaign_type ? TYPE_LABELS[r.campaign_type] ?? r.campaign_type : null
  const st = STATUS_META[r.partner_status]

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[460px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            {objective}
          </SheetTitle>
          <SheetDescription>
            Pedido de {r.agent?.commercial_name ?? '—'} · {type ?? 'Campanha'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-5 px-4 pb-8">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${st.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            {r.meta_campaign_id && (
              <span className="text-muted-foreground truncate font-mono text-[11px]">
                {r.meta_campaign_id}
              </span>
            )}
          </div>

          {r.partner_status === 'rejeitada' && r.partner_rejection_reason && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">
              {r.partner_rejection_reason}
            </p>
          )}

          {r.meta && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5" /> Desempenho Meta
              </div>
              {r.meta.name && <p className="mb-2 text-sm font-medium">{r.meta.name}</p>}
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Investimento" value={eur(r.meta.spend, r.meta.currency ?? 'EUR')} />
                <Stat label="Leads" value={r.meta.leads_count} />
                <Stat label="Anúncios" value={r.meta.ads_count} />
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <Detail icon={Handshake} label="Parceiro" value={r.partner?.commercial_name ?? 'Sem parceiro atribuído'} />
            <Detail icon={Target} label="Objectivo & tipo" value={`${objective}${type ? ` · ${type}` : ''}`} />
            <Detail
              icon={r.property ? Building2 : Link2}
              label={r.property ? 'Imóvel' : 'Link'}
              value={r.property?.title ?? r.promote_url ?? '—'}
            />
            <Detail
              icon={Wallet}
              label="Orçamento"
              value={`${eur(r.budget_amount)} ${r.budget_type === 'daily' ? '/dia' : 'total'} · ${r.duration_days} dias`}
            />
            {r.start_date && r.end_date && (
              <Detail
                icon={CalendarDays}
                label="Período"
                value={`${new Date(r.start_date).toLocaleDateString('pt-PT')} – ${new Date(r.end_date).toLocaleDateString('pt-PT')}`}
              />
            )}
            <Detail icon={Wallet} label="Total estimado" value={eur(r.total_cost)} />
            {r.target_zone && <Detail icon={Target} label="Zona-alvo" value={r.target_zone} />}
            {(r.target_age_min || r.target_age_max) && (
              <Detail icon={Target} label="Idades" value={`${r.target_age_min ?? 18}–${r.target_age_max ?? 65}`} />
            )}
            {r.target_interests && <Detail icon={Target} label="Interesses" value={r.target_interests} />}
            <Detail icon={CalendarDays} label="Pedido em" value={new Date(r.created_at).toLocaleDateString('pt-PT')} />
          </div>

          {r.creative_notes && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
                Notas criativas
              </p>
              <p className="bg-muted/50 rounded-xl px-3 py-2 text-sm">{r.creative_notes}</p>
            </div>
          )}

          <p className="text-muted-foreground/70 text-[11px]">
            O estado deste pedido é actualizado pelo parceiro no portal de parceiros.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Detail({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-background/60 rounded-xl px-2 py-2">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</p>
    </div>
  )
}
