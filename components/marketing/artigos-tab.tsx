'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  MARKETING_ORDER_STATUS, CAMPAIGN_OBJECTIVES,
  formatCurrency, formatDate,
} from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Building2, Camera, Video, Palette, Megaphone, Share2, Package, MoreHorizontal,
  Calendar, Clock, MapPin, User, Phone, Zap, Target, Check, X, Plus,
  Pencil, Trash2, Loader2, CheckCircle2, Ban, ExternalLink, FileText,
  Car, Home, Trees, Paintbrush, UserCheck, UserX, Layers, Ruler, DoorOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────

interface OrderInfo {
  id: string; status: string; property_id: string | null
  address: string | null; city: string | null; parish: string | null; postal_code: string | null
  preferred_date: string | null; preferred_time: string | null
  alternative_date: string | null; confirmed_date: string | null; confirmed_time: string | null
  created_at: string; checkout_group_id: string | null
  contact_is_agent: boolean | null; contact_name: string | null; contact_phone: string | null
  property_bundle_data: any
  agent: { id: string; commercial_name: string } | null
  property: { id: string; title: string; slug: string } | null
}

interface ProposedDate { date: string; time_slot: string }

interface ServiceItem {
  id: string; name: string; price: number; status: string; quantity: number; used_count: number
  category: string; requires_property: boolean
  confirmed_date: string | null; confirmed_time: string | null
  proposed_dates: ProposedDate[]; notes: string | null; cancelled_reason: string | null
  order: OrderInfo
}

interface MaterialItem {
  id: string; quantity: number; unit_price: number; subtotal: number; status: string; notes: string | null
  product: { id: string; name: string; category: string; thumbnail: string | null } | null
  requisition: {
    id: string; status: string; checkout_group_id: string | null; delivery_type: string | null
    created_at: string; agent: { id: string; commercial_name: string } | null
  }
}

interface CampaignItem {
  id: string; objective: string; property_id: string | null; promote_url: string | null
  target_zone: string | null; budget_type: string; budget_amount: number; duration_days: number
  total_cost: number; status: string; created_at: string
  agent: { id: string; commercial_name: string } | null
  property: { id: string; title: string; slug: string } | null
}

type SubTab = 'property' | 'services' | 'materials' | 'campaigns'

const SUBTABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'property', label: 'Imóveis', icon: Building2 },
  { key: 'services', label: 'Serviços', icon: Zap },
  { key: 'materials', label: 'Materiais', icon: Package },
  { key: 'campaigns', label: 'Campanhas', icon: Target },
]

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  photography: Camera, video: Video, design: Palette,
  physical_materials: Package, ads: Megaphone, social_media: Share2, other: MoreHorizontal,
}

const TIME_SLOTS: Record<string, string> = {
  morning: 'Manhã (9h–12h)', afternoon: 'Tarde (14h–18h)',
  late_afternoon: 'Fim de tarde (17h–20h)', flexible: 'Flexível',
}

const ITEM_STATUS: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:     { label: 'Pendente',     bg: 'bg-amber-500/10',   text: 'text-amber-600',   dot: 'bg-amber-500' },
  accepted:    { label: 'Aceite',       bg: 'bg-blue-500/10',    text: 'text-blue-600',    dot: 'bg-blue-500' },
  scheduled:   { label: 'Agendado',     bg: 'bg-indigo-500/10',  text: 'text-indigo-600',  dot: 'bg-indigo-500' },
  in_progress: { label: 'Em Progresso', bg: 'bg-purple-500/10',  text: 'text-purple-600',  dot: 'bg-purple-500' },
  completed:   { label: 'Concluído',    bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  cancelled:   { label: 'Cancelado',    bg: 'bg-red-500/10',     text: 'text-red-600',     dot: 'bg-red-500' },
  used:        { label: 'Utilizado',    bg: 'bg-slate-500/10',   text: 'text-slate-600',   dot: 'bg-slate-500' },
  available:   { label: 'Disponível',   bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = ITEM_STATUS[status] || { label: status, bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />{cfg.label}
    </span>
  )
}

function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background border px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  )
}

function FormBoolBadge({ value, label }: { value: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5',
      value ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'
    )}>
      {value ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export function ArtigosTab() {
  const [subTab, setSubTab] = useState<SubTab>('property')
  const [data, setData] = useState<{ property: ServiceItem[]; services: ServiceItem[]; materials: MaterialItem[]; campaigns: CampaignItem[] }>({ property: [], services: [], materials: [], campaigns: [] })
  const [loading, setLoading] = useState(true)

  const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null)
  const [sheetTab, setSheetTab] = useState<'resumo' | 'formulario'>('resumo')
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [confirmDateDialog, setConfirmDateDialog] = useState<{ item: ServiceItem; date: ProposedDate } | null>(null)
  const [cancelDialog, setCancelDialog] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/items')
      const d = await res.json()
      setData({ property: d.property || [], services: d.services || [], materials: d.materials || [], campaigns: d.campaigns || [] })
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset status filter when changing sub-tab
  const handleSubTabChange = useCallback((tab: SubTab) => {
    setSubTab(tab)
    setStatusFilter('all')
  }, [])

  // Get current items list for the active sub-tab
  const currentItems = useMemo(() => {
    if (subTab === 'property') return data.property
    if (subTab === 'services') return data.services
    return []
  }, [subTab, data])

  // Compute status counts for current sub-tab
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: currentItems.length }
    for (const item of currentItems) {
      const s = item.status || 'unknown'
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [currentItems])

  // Filter items by status
  const filteredProperty = useMemo(() => statusFilter === 'all' ? data.property : data.property.filter(i => i.status === statusFilter), [data.property, statusFilter])
  const filteredServices = useMemo(() => statusFilter === 'all' ? data.services : data.services.filter(i => i.status === statusFilter), [data.services, statusFilter])

  const counts = useMemo(() => ({
    property: data.property.length, services: data.services.length,
    materials: data.materials.length, campaigns: data.campaigns.length,
  }), [data])

  async function updateItem(id: string, action: string, extra?: Record<string, unknown>) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/marketing/items/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Item actualizado')
      await fetchData()
      setSelectedItem(null)
    } catch (e: any) { toast.error(e.message || 'Erro') } finally { setActionLoading(false) }
  }

  async function deleteItem(id: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/marketing/items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Item eliminado')
      await fetchData(); setSelectedItem(null); setDeleteDialog(null)
    } catch (e: any) { toast.error(e.message || 'Erro') } finally { setActionLoading(false) }
  }

  async function handleConfirmDate() {
    if (!confirmDateDialog) return
    await updateItem(confirmDateDialog.item.id, 'confirm_date', {
      confirmed_date: confirmDateDialog.date.date,
      confirmed_time: confirmDateDialog.date.time_slot,
    })
    setConfirmDateDialog(null)
  }

  async function handleCancel() {
    if (!cancelDialog) return
    await updateItem(cancelDialog, 'cancel', { reason: cancelReason })
    setCancelDialog(null); setCancelReason('')
  }

  if (loading) return (
    <div className="space-y-3">
      <div className="flex gap-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}</div>
      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 border border-border/30 w-fit overflow-x-auto">
        {SUBTABS.map(st => {
          const Icon = st.icon; const count = counts[st.key]
          return (
            <button key={st.key} onClick={() => handleSubTabChange(st.key)}
              className={cn('inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200',
                subTab === st.key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}>
              <Icon className="h-3.5 w-3.5" />{st.label}
              {count > 0 && <span className={cn('ml-0.5 text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center', subTab === st.key ? 'bg-white/20' : 'bg-muted')}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ─── STATUS FILTER TABS ─── */}
      {(subTab === 'property' || subTab === 'services') && currentItems.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {['all', ...Object.keys(ITEM_STATUS)].filter(s => s === 'all' || (statusCounts[s] || 0) > 0).map(status => {
            const cfg = status === 'all' ? null : ITEM_STATUS[status]
            const count = statusCounts[status] || 0
            const isActive = statusFilter === status
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all border',
                  isActive
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm dark:bg-white dark:text-neutral-900 dark:border-white'
                    : 'text-muted-foreground border-border/50 hover:bg-muted/50'
                )}
              >
                {cfg && <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />}
                {status === 'all' ? 'Todos' : cfg?.label || status}
                <span className={cn('text-[10px] rounded-full px-1 min-w-[16px] text-center', isActive ? 'bg-white/20 dark:bg-neutral-900/20' : 'bg-muted')}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ─── PROPERTY TABLE ─── */}
      {subTab === 'property' && (data.property.length === 0 ? <EmptyState icon={Building2} title="Sem artigos de imóvel" description="Os serviços de imóvel comprados aparecerão aqui." /> : filteredProperty.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Sem artigos com este estado.</div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table><TableHeader><TableRow className="bg-muted/30">
            <TableHead>Serviço</TableHead><TableHead>Consultor</TableHead><TableHead>Imóvel / Morada</TableHead>
            <TableHead>Data Confirmada</TableHead><TableHead className="text-right">Preço</TableHead><TableHead>Estado</TableHead>
          </TableRow></TableHeader>
          <TableBody>{filteredProperty.map(item => {
            const CatIcon = CATEGORY_ICONS[item.category] || MoreHorizontal
            const address = item.order.property?.title || item.order.address || '—'
            const proposed = Array.isArray(item.proposed_dates) ? item.proposed_dates.length : 0
            return (
              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedItem(item); setSheetTab('resumo') }}>
                <TableCell><div className="flex items-center gap-2"><CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm font-medium">{item.name}</span></div></TableCell>
                <TableCell className="text-sm">{item.order.agent?.commercial_name || '—'}</TableCell>
                <TableCell><span className="text-sm truncate max-w-[200px] block">{address}</span></TableCell>
                <TableCell>{item.confirmed_date ? (
                  <span className="inline-flex items-center gap-1 text-xs"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{formatDate(item.confirmed_date)}{item.confirmed_time && <span className="text-muted-foreground">· {TIME_SLOTS[item.confirmed_time] || item.confirmed_time}</span>}</span>
                ) : proposed > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Clock className="h-3 w-3" />{proposed} data{proposed !== 1 ? 's' : ''} proposta{proposed !== 1 ? 's' : ''}</span>
                ) : <span className="text-xs text-muted-foreground">Sem datas</span>}</TableCell>
                <TableCell className="text-right font-medium text-sm">{formatCurrency(item.price)}</TableCell>
                <TableCell><StatusBadge status={item.status} /></TableCell>
              </TableRow>
            )
          })}</TableBody></Table>
        </div>
      ))}

      {/* ─── SERVICES TABLE ─── */}
      {subTab === 'services' && (data.services.length === 0 ? <EmptyState icon={Zap} title="Sem serviços gerais" description="Serviços como redes sociais, design, etc. aparecerão aqui." /> : filteredServices.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Sem serviços com este estado.</div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table><TableHeader><TableRow className="bg-muted/30">
            <TableHead>Serviço</TableHead><TableHead>Consultor</TableHead><TableHead className="text-right">Preço</TableHead>
            <TableHead>Data Compra</TableHead><TableHead>Estado</TableHead>
          </TableRow></TableHeader>
          <TableBody>{filteredServices.map(item => {
            const CatIcon = CATEGORY_ICONS[item.category] || MoreHorizontal
            return (
              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedItem(item); setSheetTab('resumo') }}>
                <TableCell><div className="flex items-center gap-2"><CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm font-medium">{item.name}</span></div></TableCell>
                <TableCell className="text-sm">{item.order.agent?.commercial_name || '—'}</TableCell>
                <TableCell className="text-right font-medium text-sm">{formatCurrency(item.price)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(item.order.created_at)}</TableCell>
                <TableCell><StatusBadge status={item.status} /></TableCell>
              </TableRow>
            )
          })}</TableBody></Table>
        </div>
      ))}

      {/* ─── MATERIALS TABLE ─── */}
      {subTab === 'materials' && (data.materials.length === 0 ? <EmptyState icon={Package} title="Sem materiais" description="Os materiais físicos comprados aparecerão aqui." /> : (
        <div className="rounded-xl border overflow-hidden">
          <Table><TableHeader><TableRow className="bg-muted/30">
            <TableHead>Produto</TableHead><TableHead>Consultor</TableHead><TableHead className="text-center">Qtd.</TableHead>
            <TableHead className="text-right">Subtotal</TableHead><TableHead>Estado</TableHead><TableHead>Data</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.materials.map(item => (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedMaterial(item)}>
              <TableCell><div className="flex items-center gap-2"><Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm font-medium">{item.product?.name || 'Produto'}</span></div></TableCell>
              <TableCell className="text-sm">{item.requisition.agent?.commercial_name || '—'}</TableCell>
              <TableCell className="text-center"><Badge variant="secondary" className="rounded-full text-[10px]">×{item.quantity}</Badge></TableCell>
              <TableCell className="text-right font-medium text-sm">{formatCurrency(item.subtotal)}</TableCell>
              <TableCell><StatusBadge status={item.requisition.status} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(item.requisition.created_at)}</TableCell>
            </TableRow>
          ))}</TableBody></Table>
        </div>
      ))}

      {/* ─── CAMPAIGNS TABLE ─── */}
      {subTab === 'campaigns' && (data.campaigns.length === 0 ? <EmptyState icon={Target} title="Sem campanhas" description="As campanhas aparecerão aqui." /> : (
        <div className="rounded-xl border overflow-hidden">
          <Table><TableHeader><TableRow className="bg-muted/30">
            <TableHead>Objectivo</TableHead><TableHead>Consultor</TableHead><TableHead>Imóvel / URL</TableHead>
            <TableHead>Duração</TableHead><TableHead className="text-right">Investimento</TableHead><TableHead>Estado</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.campaigns.map(item => {
            const objLabel = CAMPAIGN_OBJECTIVES[item.objective as keyof typeof CAMPAIGN_OBJECTIVES] || item.objective
            return (
              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCampaign(item)}>
                <TableCell><div className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm font-medium">{objLabel}</span></div></TableCell>
                <TableCell className="text-sm">{item.agent?.commercial_name || '—'}</TableCell>
                <TableCell><span className="text-sm truncate max-w-[180px] block">{item.property?.title || item.promote_url || '—'}</span></TableCell>
                <TableCell className="text-sm">{item.duration_days} dias</TableCell>
                <TableCell className="text-right font-medium text-sm">{formatCurrency(item.total_cost)}</TableCell>
                <TableCell><StatusBadge status={item.status} /></TableCell>
              </TableRow>
            )
          })}</TableBody></Table>
        </div>
      ))}

      {/* ═══════ ITEM DETAIL SHEET ═══════ */}
      <Sheet open={!!selectedItem} onOpenChange={(o) => { if (!o) setSelectedItem(null) }}>
        <SheetContent className="sm:max-w-md overflow-y-auto p-0">
          {selectedItem && (() => {
            const item = selectedItem
            const CatIcon = CATEGORY_ICONS[item.category] || MoreHorizontal
            const proposedDates: ProposedDate[] = Array.isArray(item.proposed_dates) ? item.proposed_dates : []
            const isProperty = item.requires_property
            const bundle = item.order.property_bundle_data as Record<string, any> | null
            const fullAddress = [bundle?.address || item.order.address, item.order.parish || bundle?.parish, item.order.city || bundle?.city, item.order.postal_code || bundle?.postal_code].filter(Boolean).join(', ')
            const mapsQuery = encodeURIComponent(fullAddress)
            const availability = bundle?.availability as { will_be_present?: boolean; replacement_name?: string; replacement_phone?: string; preferred_dates?: any[]; notes?: string } | undefined

            return (
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 px-6 pt-8 pb-4 text-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center"><CatIcon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg leading-tight truncate">{item.name}</h3>
                      <p className="text-neutral-400 text-sm mt-0.5">{item.order.agent?.commercial_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <StatusBadge status={item.status} />
                    <span className="text-neutral-400 text-xs">{formatDate(item.order.created_at)}</span>
                    <span className="ml-auto text-xl font-bold">{formatCurrency(item.price)}</span>
                  </div>
                  {/* Tab switcher */}
                  {isProperty && bundle && (
                    <div className="flex gap-1 mt-4 p-0.5 rounded-full bg-white/10">
                      {([['resumo', 'Resumo'], ['formulario', 'Formulário']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setSheetTab(key)}
                          className={cn('flex-1 text-xs font-medium py-1.5 rounded-full transition-all',
                            sheetTab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-white'
                          )}>{label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── TAB: Resumo ─── */}
                {sheetTab === 'resumo' && (
                  <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
                    {/* Property card with location + maps link */}
                    {isProperty && (
                      <div className="rounded-xl bg-muted/40 p-4">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Imóvel</p>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">{item.order.property?.title || bundle?.address || item.order.address || '—'}</span>
                        </div>
                        {fullAddress && (
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" /><span className="flex-1">{fullAddress}</span>
                          </div>
                        )}
                        {fullAddress && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Abrir no Google Maps
                          </a>
                        )}
                      </div>
                    )}

                    {item.confirmed_date && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 dark:bg-emerald-500/5 dark:border-emerald-500/20">
                        <p className="text-[9px] uppercase tracking-wider text-emerald-700 font-medium mb-2 dark:text-emerald-400">Data Confirmada</p>
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />{formatDate(item.confirmed_date)}
                          {item.confirmed_time && <span>· {TIME_SLOTS[item.confirmed_time] || item.confirmed_time}</span>}
                        </div>
                      </div>
                    )}

                    {isProperty && proposedDates.length > 0 && !item.confirmed_date && (
                      <div className="rounded-xl bg-muted/40 p-4">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Datas Propostas</p>
                        <div className="space-y-2">
                          {proposedDates.map((pd, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium flex-1">
                                {formatDate(pd.date)}
                                <span className="text-muted-foreground ml-1.5">· {TIME_SLOTS[pd.time_slot] || pd.time_slot}</span>
                              </span>
                              <Button size="sm" className="h-7 rounded-full text-xs gap-1"
                                onClick={(e) => { e.stopPropagation(); setConfirmDateDialog({ item, date: pd }) }}>
                                <Check className="h-3 w-3" />Confirmar
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isProperty && proposedDates.length === 0 && !item.confirmed_date && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 dark:bg-amber-500/5 dark:border-amber-500/20">
                        <p className="text-sm text-amber-700 dark:text-amber-400">O consultor ainda não propôs datas para este serviço.</p>
                      </div>
                    )}

                    {isProperty && (item.order.contact_name || item.order.contact_is_agent) && (
                      <div className="rounded-xl bg-muted/40 p-4">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Contacto no local</p>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{item.order.contact_is_agent ? item.order.agent?.commercial_name : item.order.contact_name || '—'}</span>
                        </div>
                        {item.order.contact_phone && <div className="flex items-center gap-2 text-sm mt-1"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{item.order.contact_phone}</span></div>}
                      </div>
                    )}

                    {item.notes && <div className="rounded-xl bg-muted/40 p-4"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Notas</p><p className="text-sm">{item.notes}</p></div>}
                    {item.cancelled_reason && <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:bg-red-500/5 dark:border-red-500/20"><p className="text-[9px] uppercase tracking-wider text-red-600 font-medium mb-2">Motivo de Cancelamento</p><p className="text-sm text-red-700 dark:text-red-400">{item.cancelled_reason}</p></div>}
                  </div>
                )}

                {/* ─── TAB: Formulário ─── */}
                {sheetTab === 'formulario' && bundle && (
                  <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
                    {/* Localização */}
                    <div className="rounded-xl bg-muted/40 p-4 space-y-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5"><MapPin className="h-3 w-3" />Localização</p>
                      <div className="space-y-1.5 text-sm">
                        {bundle.address && <div className="flex items-start gap-2"><Home className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" /><span>{bundle.address}</span></div>}
                        {(bundle.city || bundle.parish) && <div className="flex items-center gap-2 text-muted-foreground"><span>{[bundle.parish, bundle.city, bundle.postal_code].filter(Boolean).join(' · ')}</span></div>}
                        {bundle.floor_door && <div className="flex items-center gap-2"><DoorOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span>Piso/Porta: {bundle.floor_door}</span></div>}
                        {bundle.access_instructions && <div className="flex items-start gap-2 text-muted-foreground text-xs italic"><span>{bundle.access_instructions}</span></div>}
                      </div>
                      {fullAddress && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 rounded-full px-3 py-1.5 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver no Google Maps
                        </a>
                      )}
                    </div>

                    {/* Características do Imóvel */}
                    <div className="rounded-xl bg-muted/40 p-4 space-y-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5"><Building2 className="h-3 w-3" />Características do Imóvel</p>
                      <div className="grid grid-cols-2 gap-2">
                        {bundle.property_type && <FormField label="Tipo" value={bundle.property_type} />}
                        {bundle.typology && <FormField label="Tipologia" value={bundle.typology} />}
                        {bundle.area_m2 && <FormField label="Área" value={`${bundle.area_m2} m²`} />}
                        {bundle.number_of_divisions && <FormField label="Divisões" value={String(bundle.number_of_divisions)} />}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <FormBoolBadge value={bundle.has_exteriors} label="Exteriores" />
                        <FormBoolBadge value={bundle.has_facades} label="Fachadas" />
                        <FormBoolBadge value={bundle.is_occupied} label="Ocupado" />
                        <FormBoolBadge value={bundle.is_staged} label="Home Staging" />
                        <FormBoolBadge value={bundle.parking_available} label="Estacionamento" />
                      </div>
                    </div>

                    {/* Disponibilidade */}
                    {availability && (
                      <div className="rounded-xl bg-muted/40 p-4 space-y-2.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5"><Calendar className="h-3 w-3" />Disponibilidade</p>
                        <div className="flex items-center gap-2 text-sm">
                          {availability.will_be_present ? (
                            <><UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" /><span>Consultor estará presente</span></>
                          ) : (
                            <><UserX className="h-3.5 w-3.5 text-amber-600 shrink-0" /><span>Substituído por {availability.replacement_name || '—'}</span></>
                          )}
                        </div>
                        {!availability.will_be_present && availability.replacement_phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{availability.replacement_phone}</span></div>
                        )}
                        {proposedDates.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-[10px] text-muted-foreground font-medium">Datas solicitadas:</p>
                            {proposedDates.map((pd, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs bg-background rounded-lg border px-2.5 py-1.5">
                                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-medium">{formatDate(pd.date)}</span>
                                <span className="text-muted-foreground">· {TIME_SLOTS[pd.time_slot] || pd.time_slot}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {availability.notes && (
                          <div className="text-xs text-muted-foreground italic pt-1">{availability.notes}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!['completed', 'cancelled'].includes(item.status) && (
                  <div className="border-t px-6 py-3 flex items-center gap-2 shrink-0 bg-background">
                    {item.status === 'pending' && <Button size="sm" className="rounded-full gap-1 text-xs" onClick={() => updateItem(item.id, 'accept')} disabled={actionLoading}><CheckCircle2 className="h-3 w-3" />Aceitar</Button>}
                    {item.status === 'scheduled' && <Button size="sm" className="rounded-full gap-1 text-xs" onClick={() => updateItem(item.id, 'start')} disabled={actionLoading}><Zap className="h-3 w-3" />Iniciar</Button>}
                    {item.status === 'in_progress' && <Button size="sm" className="rounded-full gap-1 text-xs" onClick={() => updateItem(item.id, 'complete')} disabled={actionLoading}><CheckCircle2 className="h-3 w-3" />Concluir</Button>}
                    <Button variant="ghost" size="sm" className="rounded-full gap-1 text-xs text-destructive hover:text-destructive" onClick={() => { setCancelDialog(item.id); setCancelReason('') }}><Ban className="h-3 w-3" />Cancelar</Button>
                    <Button variant="ghost" size="sm" className="rounded-full gap-1 text-xs text-destructive hover:text-destructive ml-auto" onClick={() => setDeleteDialog(item.id)}><Trash2 className="h-3 w-3" />Eliminar</Button>
                  </div>
                )}
              </div>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* ═══════ MATERIAL SHEET ═══════ */}
      <Sheet open={!!selectedMaterial} onOpenChange={(o) => !o && setSelectedMaterial(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto p-0">
          {selectedMaterial && <div className="flex flex-col">
            <div className="bg-gradient-to-br from-orange-900/80 to-neutral-800 px-6 pt-8 pb-6 text-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center"><Package className="h-5 w-5" /></div>
                <div><h3 className="font-bold text-lg">{selectedMaterial.product?.name || 'Produto'}</h3><p className="text-neutral-400 text-sm mt-0.5">{selectedMaterial.requisition.agent?.commercial_name}</p></div>
              </div>
              <div className="flex items-center gap-2 mt-4"><StatusBadge status={selectedMaterial.requisition.status} /><span className="ml-auto text-xl font-bold">{formatCurrency(selectedMaterial.subtotal)}</span></div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[{ l: 'Qtd.', v: String(selectedMaterial.quantity) }, { l: 'P. Unit.', v: formatCurrency(selectedMaterial.unit_price) }, { l: 'Entrega', v: selectedMaterial.requisition.delivery_type === 'pickup' ? 'Levant.' : 'Entrega' }].map(x => (
                  <div key={x.l} className="rounded-xl bg-muted/40 p-3 text-center"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{x.l}</p><p className="text-sm font-bold mt-1">{x.v}</p></div>
                ))}
              </div>
              {selectedMaterial.notes && <div className="rounded-xl bg-muted/40 p-4"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Notas</p><p className="text-sm">{selectedMaterial.notes}</p></div>}
            </div>
          </div>}
        </SheetContent>
      </Sheet>

      {/* ═══════ CAMPAIGN SHEET ═══════ */}
      <Sheet open={!!selectedCampaign} onOpenChange={(o) => !o && setSelectedCampaign(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto p-0">
          {selectedCampaign && <div className="flex flex-col">
            <div className="bg-gradient-to-br from-[#1877F2]/80 to-neutral-800 px-6 pt-8 pb-6 text-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center"><Target className="h-5 w-5" /></div>
                <div><h3 className="font-bold text-lg">{CAMPAIGN_OBJECTIVES[selectedCampaign.objective as keyof typeof CAMPAIGN_OBJECTIVES] || selectedCampaign.objective}</h3><p className="text-neutral-400 text-sm mt-0.5">{selectedCampaign.agent?.commercial_name}</p></div>
              </div>
              <div className="flex items-center gap-2 mt-4"><StatusBadge status={selectedCampaign.status} /><span className="ml-auto text-xl font-bold">{formatCurrency(selectedCampaign.total_cost)}</span></div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[{ l: 'Orçamento', v: formatCurrency(selectedCampaign.budget_amount) + (selectedCampaign.budget_type === 'daily' ? '/dia' : '') }, { l: 'Duração', v: selectedCampaign.duration_days + 'd' }, { l: 'Total', v: formatCurrency(selectedCampaign.total_cost) }].map(x => (
                  <div key={x.l} className="rounded-xl bg-muted/40 p-3 text-center"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{x.l}</p><p className="text-sm font-bold mt-1">{x.v}</p></div>
                ))}
              </div>
              {(selectedCampaign.property || selectedCampaign.promote_url) && <div className="rounded-xl bg-muted/40 p-4"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{selectedCampaign.property ? 'Imóvel' : 'URL'}</p><span className="text-sm font-medium">{selectedCampaign.property?.title || selectedCampaign.promote_url}</span></div>}
            </div>
          </div>}
        </SheetContent>
      </Sheet>

      {/* ═══════ CONFIRM DATE DIALOG ═══════ */}
      <Dialog open={!!confirmDateDialog} onOpenChange={(o) => !o && setConfirmDateDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Confirmar Data</DialogTitle>
            <DialogDescription>
              Confirmar agendamento para <strong>{confirmDateDialog && formatDate(confirmDateDialog.date.date)}</strong>
              {confirmDateDialog?.date.time_slot && <> · {TIME_SLOTS[confirmDateDialog.date.time_slot] || confirmDateDialog.date.time_slot}</>}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setConfirmDateDialog(null)}>Cancelar</Button>
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmDate} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ CANCEL DIALOG ═══════ */}
      <Dialog open={!!cancelDialog} onOpenChange={(o) => { if (!o) { setCancelDialog(null); setCancelReason('') } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Cancelar Item</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Motivo (opcional)</Label><Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="Motivo..." className="rounded-xl" /></div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setCancelDialog(null)}>Voltar</Button>
            <Button className="rounded-full bg-destructive text-destructive-foreground" onClick={handleCancel} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cancelar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ DELETE DIALOG ═══════ */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Eliminar Item</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza? Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDialog && deleteItem(deleteDialog)} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
