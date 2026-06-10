'use client'

/**
 * Meta — campanhas pedidas pela equipa Infinity a este parceiro.
 *
 * Cada cartão é um pedido de campanha (marketing_campaigns.partner_id = self).
 * O parceiro trabalha-o por um ciclo próprio (pedido → aceite → criada → activa
 * → terminada, + rejeitada), liga-o à campanha Meta real para ver desempenho ao
 * vivo (investimento, leads) e — ao ligá-la — passa a ser o referenciado dos
 * leads gerados. Tudo via o proxy /api/* para o ERP principal (self-scoped).
 */

import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react'
import { PageHero, EmptyState } from '@portal/components/portal/page-hero'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CAMPAIGN_OBJECTIVES } from '@/lib/constants'
import {
  Megaphone, Building2, Link2, User, Loader2, Check, X, Target, Wallet,
  CalendarDays, ExternalLink, TrendingUp,
} from 'lucide-react'

type PartnerStatus = 'pedido' | 'aceite' | 'criada' | 'activa' | 'terminada' | 'rejeitada'

interface MetaSummary {
  name: string | null
  status: string | null
  spend: number | null
  currency: string | null
  leads_count: number
  ads_count: number
}

interface Campaign {
  id: string
  agent_id: string
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
  total_cost: number
  creative_notes: string | null
  created_at: string
  agent?: { id: string; commercial_name: string } | null
  property?: { id: string; title: string; slug: string } | null
  meta?: MetaSummary | null
}

interface MetaOption {
  campaign_id: string
  name: string | null
  status: string | null
  leads_count: number
}

const TYPE_LABELS: Record<string, string> = {
  compradores: 'Compradores',
  vendedores: 'Vendedores',
  arrendatarios: 'Arrendatários',
  senhorios: 'Senhorios',
  outros: 'Outros',
}

const STATUS_META: Record<PartnerStatus, { label: string; dot: string; chip: string }> = {
  pedido: { label: 'Pedido', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  aceite: { label: 'Aceite', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' },
  criada: { label: 'Criada', dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700' },
  activa: { label: 'Activa', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  terminada: { label: 'Terminada', dot: 'bg-neutral-400', chip: 'bg-neutral-100 text-neutral-600' },
  rejeitada: { label: 'Rejeitada', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700' },
}

const BOARD_COLUMNS: PartnerStatus[] = ['pedido', 'aceite', 'criada', 'activa', 'terminada']

const eur = (v: number | null | undefined, currency = 'EUR') =>
  v == null ? '—' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(v)

type Tab = 'pedidos' | 'campanhas'

export default function MetaPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [tab, setTab] = useState<Tab>('pedidos')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/campaigns', { cache: 'no-store' })
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : data?.data ?? [])
    } catch {
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Keep the open sheet in sync with refreshed data.
  useEffect(() => {
    if (!selected) return
    const fresh = campaigns.find((c) => c.id === selected.id)
    if (fresh && fresh !== selected) setSelected(fresh)
  }, [campaigns, selected])

  const kpis = useMemo(() => {
    const active = campaigns.filter((c) => c.partner_status === 'activa').length
    const leads = campaigns.reduce((n, c) => n + (c.meta?.leads_count ?? 0), 0)
    return [
      { label: 'Pedidos', value: campaigns.length },
      { label: 'Activas', value: active },
      { label: 'Leads gerados', value: leads },
    ]
  }, [campaigns])

  const byStatus = useMemo(() => {
    const map: Record<PartnerStatus, Campaign[]> = {
      pedido: [], aceite: [], criada: [], activa: [], terminada: [], rejeitada: [],
    }
    for (const c of campaigns) (map[c.partner_status] ??= []).push(c)
    return map
  }, [campaigns])

  // Campanhas reais — pedidos já ligados a uma campanha Meta.
  const linked = useMemo(() => campaigns.filter((c) => c.meta_campaign_id), [campaigns])

  return (
    <div className="space-y-6">
      <PageHero title="Meta" subtitle="Pedidos de campanha e desempenho" kpis={kpis} />

      {/* Tabs Pedidos / Campanhas */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full bg-neutral-100 p-1">
          {([
            { key: 'pedidos', label: 'Pedidos', count: campaigns.length },
            { key: 'campanhas', label: 'Campanhas', count: linked.length },
          ] as { key: Tab; label: string; count: number }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${tab === t.key ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-200/70 text-neutral-500'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : tab === 'pedidos' ? (
        campaigns.length === 0 ? (
          <EmptyState
            title="Sem pedidos de campanha"
            hint="Os pedidos de campanha que a equipa Infinity lhe envia aparecem aqui, com estado, investimento e leads gerados."
          />
        ) : (
          <>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {BOARD_COLUMNS.map((status) => {
                const items = byStatus[status]
                return (
                  <div key={status} className="w-[280px] flex-shrink-0">
                    <div className="mb-3 flex items-center gap-2 px-1">
                      <span className={`h-2 w-2 rounded-full ${STATUS_META[status].dot}`} />
                      <span className="text-sm font-semibold text-neutral-700">{STATUS_META[status].label}</span>
                      <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {items.map((c) => (
                        <CampaignCard key={c.id} campaign={c} onClick={() => setSelected(c)} />
                      ))}
                      {items.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400">
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
                  <span className="text-sm font-semibold text-neutral-700">Rejeitadas</span>
                  <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                    {byStatus.rejeitada.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {byStatus.rejeitada.map((c) => (
                    <CampaignCard key={c.id} campaign={c} onClick={() => setSelected(c)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )
      ) : linked.length === 0 ? (
        <EmptyState
          title="Sem campanhas ligadas"
          hint="Quando ligar um pedido a uma campanha Meta, ela aparece aqui com o desempenho ao vivo (investimento e leads)."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {linked.map((c) => (
            <CampaignDataCard key={c.id} campaign={c} onClick={() => setSelected(c)} />
          ))}
        </div>
      )}

      <CampaignDetailSheet
        campaign={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onChanged={load}
      />
    </div>
  )
}

function CampaignCard({ campaign: c, onClick }: { campaign: Campaign; onClick: () => void }) {
  const objective = CAMPAIGN_OBJECTIVES[c.objective] ?? c.objective
  const type = c.campaign_type ? TYPE_LABELS[c.campaign_type] ?? c.campaign_type : null
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-900">{objective}</span>
        {type && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">{type}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <User className="h-3.5 w-3.5" />
        <span className="truncate">{c.agent?.commercial_name ?? '—'}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
        {c.property ? <Building2 className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        <span className="truncate">{c.property?.title ?? c.promote_url ?? '—'}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2">
        <span className="text-xs font-medium text-neutral-700">{eur(c.total_cost)}</span>
        {c.meta ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <TrendingUp className="h-3 w-3" />
            {c.meta.leads_count} leads
          </span>
        ) : (
          <span className="text-[11px] text-neutral-400">{c.duration_days}d</span>
        )}
      </div>
    </button>
  )
}

function CampaignDataCard({ campaign: c, onClick }: { campaign: Campaign; onClick: () => void }) {
  const objective = CAMPAIGN_OBJECTIVES[c.objective] ?? c.objective
  const title = c.meta?.name || objective
  const metaStatus = c.meta?.status
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col rounded-2xl border border-black/5 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900 line-clamp-2">{title}</h3>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_META[c.partner_status].chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.partner_status].dot}`} />
          {STATUS_META[c.partner_status].label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-neutral-50 px-2 py-2.5">
          <p className="text-sm font-bold text-neutral-900">{eur(c.meta?.spend ?? null, c.meta?.currency ?? 'EUR')}</p>
          <p className="text-[10px] uppercase tracking-wider text-neutral-400">Investimento</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-2 py-2.5">
          <p className="text-sm font-bold text-emerald-700">{c.meta?.leads_count ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-emerald-600/70">Leads</p>
        </div>
        <div className="rounded-xl bg-neutral-50 px-2 py-2.5">
          <p className="text-sm font-bold text-neutral-900">{c.meta?.ads_count ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-neutral-400">Anúncios</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5 truncate">
          <User className="h-3.5 w-3.5 shrink-0" />
          {c.agent?.commercial_name ?? '—'}
        </span>
        {metaStatus && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-500">
            {metaStatus}
          </span>
        )}
      </div>
    </button>
  )
}

function CampaignDetailSheet({
  campaign,
  onOpenChange,
  onChanged,
}: {
  campaign: Campaign | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [linking, setLinking] = useState(false)
  const [metaOptions, setMetaOptions] = useState<MetaOption[]>([])
  const [chosenMeta, setChosenMeta] = useState('')
  const [referralPct, setReferralPct] = useState('')

  // Reset transient UI whenever a different campaign opens.
  useEffect(() => {
    setRejecting(false)
    setReason('')
    setLinking(false)
    setChosenMeta('')
    setReferralPct('')
  }, [campaign?.id])

  // Lazy-load Meta campaign options once the link UI is opened.
  useEffect(() => {
    if (!linking || metaOptions.length > 0) return
    fetch('/api/marketing/meta-campaign-options')
      .then((r) => r.json())
      .then((d) => setMetaOptions(Array.isArray(d) ? d : []))
      .catch(() => setMetaOptions([]))
  }, [linking, metaOptions.length])

  if (!campaign) return <Sheet open={false} onOpenChange={onOpenChange}><SheetContent /></Sheet>

  const c = campaign
  const objective = CAMPAIGN_OBJECTIVES[c.objective] ?? c.objective
  const type = c.campaign_type ? TYPE_LABELS[c.campaign_type] ?? c.campaign_type : null

  async function setStatus(partner_status: PartnerStatus, rejectReason?: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/marketing/campaigns/${c.id}/partner-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_status, reason: rejectReason ?? null }),
      })
      if (!res.ok) throw new Error()
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function linkMeta() {
    if (!chosenMeta.trim()) return
    setBusy(true)
    try {
      const pct = referralPct.trim() === '' ? null : Number(referralPct)
      const res = await fetch(`/api/marketing/campaigns/${c.id}/link-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta_campaign_id: chosenMeta.trim(), referral_pct: pct }),
      })
      if (!res.ok) throw new Error()
      setLinking(false)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!campaign} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[460px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            {objective}
          </SheetTitle>
          <SheetDescription>
            Pedido de {c.agent?.commercial_name ?? '—'} · {type ?? 'Campanha'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-5 px-4 pb-8">
          {/* Estado actual */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STATUS_META[c.partner_status].chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.partner_status].dot}`} />
              {STATUS_META[c.partner_status].label}
            </span>
          </div>

          {c.partner_status === 'rejeitada' && c.partner_rejection_reason && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{c.partner_rejection_reason}</p>
          )}

          {/* Live Meta data */}
          {c.meta && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" /> Desempenho Meta
              </div>
              {c.meta.name && <p className="mb-2 text-sm font-medium text-neutral-800">{c.meta.name}</p>}
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Investimento" value={eur(c.meta.spend, c.meta.currency ?? 'EUR')} />
                <Stat label="Leads" value={c.meta.leads_count} />
                <Stat label="Anúncios" value={c.meta.ads_count} />
              </div>
            </div>
          )}

          {/* Detalhes do pedido */}
          <div className="space-y-2.5">
            <Detail icon={Target} label="Objectivo & tipo" value={`${objective}${type ? ` · ${type}` : ''}`} />
            <Detail
              icon={c.property ? Building2 : Link2}
              label={c.property ? 'Imóvel' : 'Link'}
              value={c.property?.title ?? c.promote_url ?? '—'}
            />
            <Detail icon={Wallet} label="Orçamento" value={`${eur(c.budget_amount)} ${c.budget_type === 'daily' ? '/dia' : 'total'} · ${c.duration_days} dias`} />
            <Detail icon={Wallet} label="Total estimado" value={eur(c.total_cost)} />
            {c.target_zone && <Detail icon={Target} label="Zona-alvo" value={c.target_zone} />}
            {(c.target_age_min || c.target_age_max) && (
              <Detail icon={Target} label="Idades" value={`${c.target_age_min ?? 18}–${c.target_age_max ?? 65}`} />
            )}
            {c.target_interests && <Detail icon={Target} label="Interesses" value={c.target_interests} />}
            <Detail icon={CalendarDays} label="Pedido em" value={new Date(c.created_at).toLocaleDateString('pt-PT')} />
          </div>

          {c.creative_notes && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">Notas criativas</p>
              <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{c.creative_notes}</p>
            </div>
          )}

          {/* Ligar campanha Meta */}
          {c.partner_status !== 'rejeitada' && (
            <div className="rounded-2xl border border-black/5 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Campanha Meta {c.meta_campaign_id ? '(ligada)' : ''}
              </p>
              {c.meta_campaign_id && !linking ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-neutral-600">{c.meta_campaign_id}</span>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setLinking(true)} disabled={busy}>
                    Alterar
                  </Button>
                </div>
              ) : linking ? (
                <div className="space-y-2">
                  <Select value={chosenMeta} onValueChange={setChosenMeta}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Escolher campanha Meta" />
                    </SelectTrigger>
                    <SelectContent>
                      {metaOptions.map((o) => (
                        <SelectItem key={o.campaign_id} value={o.campaign_id}>
                          {o.name || o.campaign_id} {o.status ? `· ${o.status}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="% comissão do referenciado (opcional)"
                    value={referralPct}
                    onChange={(e) => setReferralPct(e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-neutral-400">
                    Ao ligar, fica como referenciado dos leads gerados por esta campanha.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 rounded-full" onClick={linkMeta} disabled={busy || !chosenMeta}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ligar'}
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setLinking(false)} disabled={busy}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => setLinking(true)} disabled={busy}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ligar campanha Meta
                </Button>
              )}
            </div>
          )}

          {/* Acções de ciclo */}
          {rejecting ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Motivo da rejeição..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[72px] rounded-xl"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 rounded-full"
                  onClick={() => setStatus('rejeitada', reason)}
                  disabled={busy || reason.trim().length < 3}
                >
                  Confirmar rejeição
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setRejecting(false)} disabled={busy}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {c.partner_status === 'pedido' && (
                <Button size="sm" className="rounded-full" onClick={() => setStatus('aceite')} disabled={busy}>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Aceitar
                </Button>
              )}
              {c.partner_status === 'criada' && (
                <Button size="sm" className="rounded-full" onClick={() => setStatus('activa')} disabled={busy}>
                  Marcar como activa
                </Button>
              )}
              {c.partner_status === 'activa' && (
                <Button size="sm" className="rounded-full" onClick={() => setStatus('terminada')} disabled={busy}>
                  Marcar como terminada
                </Button>
              )}
              {c.partner_status !== 'terminada' && c.partner_status !== 'rejeitada' && (
                <Button size="sm" variant="outline" className="rounded-full text-red-600 hover:text-red-700" onClick={() => setRejecting(true)} disabled={busy}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Rejeitar
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Detail({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{label}</p>
        <p className="text-sm text-neutral-700">{value}</p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white px-2 py-2">
      <p className="text-sm font-bold text-neutral-900">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-neutral-400">{label}</p>
    </div>
  )
}
