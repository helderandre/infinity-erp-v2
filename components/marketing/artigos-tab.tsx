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
  Truck, PackageCheck, Square, CheckSquare, ArrowRight, ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  supplier_order_id: string | null; supplier_order_ref: string | null
  product: { id: string; name: string; category: string; thumbnail: string | null; supplier_id: string | null } | null
  requisition: {
    id: string; status: string; checkout_group_id: string | null; delivery_type: string | null
    payment_method: string | null
    created_at: string; agent: { id: string; commercial_name: string } | null
  }
}

interface SupplierOrder {
  id: string; reference: string; status: string; total_cost: number
  expected_delivery_date: string | null; actual_delivery_date: string | null
  notes: string | null; created_at: string
  payment_method: string | null
  billing_entity: string | null; billing_name: string | null; billing_nif: string | null
  supplier: { id: string; name: string; email: string | null; phone: string | null } | null
  items: { id: string; product_id: string; quantity_ordered: number; quantity_received: number; unit_cost: number; subtotal: number; product: { id: string; name: string; sku: string | null; thumbnail_url?: string | null } | null; variant?: { id: string; name: string } | null }[]
  ordered_by_user: { id: string; commercial_name: string } | null
  agent: { id: string; commercial_name: string } | null
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
  // Supplier order statuses
  draft:       { label: 'Rascunho',     bg: 'bg-slate-500/10',   text: 'text-slate-600',   dot: 'bg-slate-400' },
  ordered:     { label: 'Encomendado',  bg: 'bg-blue-500/10',    text: 'text-blue-600',    dot: 'bg-blue-500' },
  in_transit:  { label: 'Em Trânsito',  bg: 'bg-amber-500/10',   text: 'text-amber-600',   dot: 'bg-amber-500' },
  at_store:    { label: 'Na Loja',      bg: 'bg-indigo-500/10',  text: 'text-indigo-600',  dot: 'bg-indigo-500' },
  delivered:   { label: 'Entregue',     bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  // Cart statuses
  cart_pending:   { label: 'Carrinho Pendente',   bg: 'bg-amber-500/10',   text: 'text-amber-600',   dot: 'bg-amber-500' },
  cart_confirmed: { label: 'Carrinho Confirmado', bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
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

  // Materials sub-subtab and selection
  const [materialSubTab, setMaterialSubTab] = useState<'produtos' | 'encomendas'>('produtos')
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set())
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([])
  const [supplierOrdersLoading, setSupplierOrdersLoading] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [bundleLoading, setBundleLoading] = useState(false)
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false)
  const [bundleForm, setBundleForm] = useState({ supplier_id: '', supplier_name: '', expected_delivery_date: '', notes: '' })
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; email: string | null; phone: string | null }[]>([])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/items')
      const d = await res.json()
      setData({ property: d.property || [], services: d.services || [], materials: d.materials || [], campaigns: d.campaigns || [] })
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  const fetchSupplierOrders = useCallback(async () => {
    setSupplierOrdersLoading(true)
    try {
      const res = await fetch('/api/encomendas/supplier-orders')
      const d = await res.json()
      setSupplierOrders(Array.isArray(d) ? d : d.data || [])
    } catch { /* */ } finally { setSupplierOrdersLoading(false) }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/encomendas/suppliers?active=true')
      const d = await res.json()
      setSuppliers(Array.isArray(d) ? d : d.data || [])
    } catch { /* */ }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (subTab === 'materials') fetchSuppliers() }, [subTab, fetchSuppliers])
  useEffect(() => { if (subTab === 'materials' && materialSubTab === 'encomendas') fetchSupplierOrders() }, [subTab, materialSubTab, fetchSupplierOrders])

  // Toggle material item selection
  const toggleMaterialSelect = useCallback((id: string) => {
    setSelectedMaterialIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const selectAllBundleable = useCallback(() => {
    const bundleable = data.materials.filter(m => !m.supplier_order_id && ['approved', 'processing', 'accepted'].includes(m.requisition.status))
    if (selectedMaterialIds.size === bundleable.length) {
      setSelectedMaterialIds(new Set())
    } else {
      setSelectedMaterialIds(new Set(bundleable.map(m => m.id)))
    }
  }, [data.materials, selectedMaterialIds.size])

  // Check if selected items are valid for bundling
  const bundleValidation = useMemo(() => {
    if (selectedMaterialIds.size === 0) return { valid: false, error: 'Seleccione items' }
    const selected = data.materials.filter(m => selectedMaterialIds.has(m.id))
    const hasFatura = selected.some(m => m.requisition.payment_method === 'fatura')
    if (hasFatura) {
      const agents = new Set(selected.map(m => m.requisition.agent?.id).filter(Boolean))
      if (agents.size > 1) return { valid: false, error: 'Fatura: apenas 1 consultor' }
    }
    return { valid: true, error: null }
  }, [selectedMaterialIds, data.materials])

  // Selected items summary for the dialog
  const selectedSummary = useMemo(() => {
    const selected = data.materials.filter(m => selectedMaterialIds.has(m.id))
    const totalQty = selected.reduce((s, m) => s + m.quantity, 0)
    const totalValue = selected.reduce((s, m) => s + Number(m.subtotal), 0)
    const agents = [...new Set(selected.map(m => m.requisition.agent?.commercial_name).filter(Boolean))]
    const paymentMethods = [...new Set(selected.map(m => m.requisition.payment_method).filter(Boolean))]
    const paymentMethod = paymentMethods.length === 1 ? paymentMethods[0] : paymentMethods.length > 1 ? 'mixed' : null
    const isFatura = paymentMethod === 'fatura'
    // For fatura: get the agent's info (single consultant)
    const agentId = isFatura ? selected[0]?.requisition.agent?.id : null
    return { count: selected.length, totalQty, totalValue, agents, items: selected, paymentMethod, isFatura, agentId }
  }, [selectedMaterialIds, data.materials])

  // Open bundle dialog
  const openBundleDialog = useCallback(() => {
    if (!bundleValidation.valid) return
    setBundleForm({ supplier_id: '', supplier_name: '', expected_delivery_date: '', notes: '' })
    setBundleDialogOpen(true)
  }, [bundleValidation.valid])

  // Create bundled supplier order
  const handleCreateBundle = useCallback(async () => {
    if (!bundleForm.supplier_id && !bundleForm.supplier_name.trim()) { toast.error('Seleccione ou escreva o nome do fornecedor'); return }
    setBundleLoading(true)
    try {
      const res = await fetch('/api/encomendas/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: [...selectedMaterialIds],
          supplier_id: bundleForm.supplier_id || null,
          supplier_name: bundleForm.supplier_id ? null : bundleForm.supplier_name.trim() || null,
          expected_delivery_date: bundleForm.expected_delivery_date || null,
          notes: bundleForm.notes || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro')
      toast.success(`Encomenda ${d.reference} criada com sucesso`)
      setSelectedMaterialIds(new Set())
      setBundleDialogOpen(false)
      fetchData()
      fetchSupplierOrders()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar encomenda')
    } finally { setBundleLoading(false) }
  }, [bundleForm, selectedMaterialIds, fetchData, fetchSupplierOrders])

  // Update supplier order status
  const handleSupplierOrderStatus = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch('/api/encomendas/supplier-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Estado actualizado')
      fetchSupplierOrders()
    } catch { toast.error('Erro ao actualizar') }
  }, [fetchSupplierOrders])

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

      {/* ─── MATERIALS SECTION (with sub-subtabs) ─── */}
      {subTab === 'materials' && (<>
        {/* Sub-subtabs: Produtos | Encomendas */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 p-0.5 rounded-full bg-muted/40 border border-border/30">
            {([['produtos', 'Produtos', Package] as const, ['encomendas', 'Encomendas', Truck] as const]).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setMaterialSubTab(key)}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all', materialSubTab === key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                <Icon className="h-3 w-3" />{label}
              </button>
            ))}
          </div>

          {/* Bundle action button */}
          {materialSubTab === 'produtos' && selectedMaterialIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selectedMaterialIds.size} seleccionado{selectedMaterialIds.size !== 1 ? 's' : ''}</span>
              {!bundleValidation.valid && <span className="text-[10px] text-red-500">{bundleValidation.error}</span>}
              <Button size="sm" className="rounded-full h-7 text-xs gap-1" disabled={!bundleValidation.valid} onClick={openBundleDialog}>
                <PackageCheck className="h-3 w-3" />
                Criar Encomenda
              </Button>
            </div>
          )}
        </div>

        {/* Produtos sub-subtab */}
        {materialSubTab === 'produtos' && (data.materials.length === 0 ? <EmptyState icon={Package} title="Sem materiais" description="Os materiais físicos comprados aparecerão aqui." /> : (
          <div className="rounded-xl border overflow-hidden">
            <Table><TableHeader><TableRow className="bg-muted/30">
              <TableHead className="w-10">
                <button onClick={selectAllBundleable} className="h-4 w-4 inline-flex items-center justify-center">
                  {selectedMaterialIds.size > 0 ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </TableHead>
              <TableHead>Produto</TableHead><TableHead>Consultor</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-center">Qtd.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead><TableHead>Carrinho</TableHead><TableHead>Encomenda</TableHead><TableHead>Data</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.materials.map(item => {
              const isSelected = selectedMaterialIds.has(item.id)
              const canSelect = !item.supplier_order_id && ['approved', 'processing', 'accepted'].includes(item.requisition.status)
              const cartStatus = ['approved', 'accepted', 'processing', 'delivered', 'completed'].includes(item.requisition.status) ? 'cart_confirmed' : 'cart_pending'
              return (
                <TableRow key={item.id} className={cn('hover:bg-muted/50', isSelected && 'bg-primary/5')}>
                  <TableCell>
                    {canSelect ? (
                      <button onClick={(e) => { e.stopPropagation(); toggleMaterialSelect(item.id) }} className="h-4 w-4 inline-flex items-center justify-center">
                        {isSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    ) : <span className="h-4 w-4" />}
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => setSelectedMaterial(item)}><div className="flex items-center gap-2"><Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm font-medium">{item.product?.name || 'Produto'}</span></div></TableCell>
                  <TableCell className="text-sm">{item.requisition.agent?.commercial_name || '—'}</TableCell>
                  <TableCell>
                    {item.requisition.payment_method ? (
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium',
                        item.requisition.payment_method === 'fatura' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                      )}>
                        {item.requisition.payment_method === 'fatura' ? 'Fatura' : 'Conta Corrente'}
                      </span>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center"><Badge variant="secondary" className="rounded-full text-[10px]">×{item.quantity}</Badge></TableCell>
                  <TableCell className="text-right font-medium text-sm">{formatCurrency(item.subtotal)}</TableCell>
                  <TableCell><StatusBadge status={cartStatus} /></TableCell>
                  <TableCell>
                    {item.supplier_order_ref ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600">
                        <Truck className="h-2.5 w-2.5" />{item.supplier_order_ref}
                      </span>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(item.requisition.created_at)}</TableCell>
                </TableRow>
              )
            })}</TableBody></Table>
          </div>
        ))}

        {/* Encomendas sub-subtab */}
        {materialSubTab === 'encomendas' && (supplierOrdersLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : supplierOrders.length === 0 ? (
          <EmptyState icon={Truck} title="Sem encomendas" description="Seleccione produtos na tab anterior e crie uma encomenda ao fornecedor." />
        ) : (
          <div className="space-y-3">
            {supplierOrders.map(order => {
              const statusSteps = ['ordered', 'at_store', 'picked_up', 'completed']
              const currentStep = statusSteps.indexOf(order.status)
              const itemCount = order.items.reduce((s, i) => s + i.quantity_ordered, 0)
              const isExpanded = expandedOrderId === order.id
              const statusLabelsMap: Record<string, string> = { ordered: 'Encomendado', at_store: 'Na Loja', picked_up: 'Levantado', completed: 'Concluído', cancelled: 'Cancelado' }
              return (
                <div key={order.id} className="rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden">
                  {/* Clickable header */}
                  <button
                    type="button"
                    className="w-full p-4 text-left hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-sm">{order.reference}</span>
                        <span className="text-lg font-bold">{formatCurrency(order.total_cost)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={order.status} />
                        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {order.supplier && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-medium">{order.supplier.name}</span>
                      )}
                      {order.agent && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-white/10 px-2.5 py-0.5 text-[10px] text-muted-foreground">{order.agent.commercial_name}</span>
                      )}
                      {order.payment_method && (
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                          order.payment_method === 'fatura' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                        )}>
                          {order.payment_method === 'fatura' ? 'Fatura' : 'Conta Corrente'}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-white/10 px-2.5 py-0.5 text-[10px] text-muted-foreground">
                        {itemCount} artigo{itemCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      {statusSteps.map((_, idx) => (
                        <div key={idx} className={cn('h-1 flex-1 rounded-full', idx <= currentStep ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-white/10')} />
                      ))}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                      {/* Items */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Artigos</p>
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Package className="h-3 w-3 text-muted-foreground" />
                              <span>{item.product?.name || 'Produto'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>×{item.quantity_ordered}</span>
                              <span className="font-medium text-foreground">{formatCurrency(item.subtotal)}</span>
                              {item.quantity_received > 0 && <span className="text-emerald-600">({item.quantity_received} recebido{item.quantity_received !== 1 ? 's' : ''})</span>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Info */}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {order.expected_delivery_date && <span>Entrega prevista: {formatDate(order.expected_delivery_date)}</span>}
                        {order.notes && <span>Notas: {order.notes}</span>}
                        <span>Criado: {formatDate(order.created_at)}</span>
                      </div>

                      {/* Status actions — inline buttons instead of dropdown */}
                      <div className="flex items-center gap-2 pt-1">
                        {order.status === 'ordered' && (
                          <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => handleSupplierOrderStatus(order.id, 'at_store')}>
                            <Home className="h-3 w-3" />Chegou à Loja
                          </Button>
                        )}
                        {order.status === 'at_store' && (
                          <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => handleSupplierOrderStatus(order.id, 'picked_up')}>
                            <PackageCheck className="h-3 w-3" />Consultor Levantou
                          </Button>
                        )}
                        {order.status === 'picked_up' && (
                          <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => handleSupplierOrderStatus(order.id, 'completed')}>
                            <CheckCircle2 className="h-3 w-3" />Concluído
                          </Button>
                        )}
                        {!['completed', 'cancelled', 'picked_up'].includes(order.status) && (
                          <Button size="sm" variant="outline" className="rounded-full gap-1.5 text-xs text-red-600" onClick={() => handleSupplierOrderStatus(order.id, 'cancelled')}>
                            <Ban className="h-3 w-3" />Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </>)}

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

      {/* ═══════ BUNDLE DIALOG ═══════ */}
      <Dialog open={bundleDialogOpen} onOpenChange={setBundleDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Criar Encomenda ao Fornecedor
            </DialogTitle>
            <DialogDescription>
              Agrupe {selectedSummary.count} produto{selectedSummary.count !== 1 ? 's' : ''} numa encomenda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="rounded-xl bg-muted/30 border p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Items seleccionados</span>
                <span className="font-bold">{selectedSummary.count} ({selectedSummary.totalQty} un.)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-bold">{formatCurrency(selectedSummary.totalValue)}</span>
              </div>
              {selectedSummary.agents.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Consultor{selectedSummary.agents.length !== 1 ? 'es' : ''}</span>
                  <span className="text-xs">{selectedSummary.agents.join(', ')}</span>
                </div>
              )}
              {/* Items list */}
              <Separator />
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedSummary.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span>{item.product?.name || 'Produto'}</span>
                    <span className="text-muted-foreground">×{item.quantity} · {formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment info */}
            {selectedSummary.paymentMethod && (
              <div className="rounded-xl border p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                    selectedSummary.isFatura ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                  )}>
                    {selectedSummary.isFatura ? 'Fatura' : 'Conta Corrente'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedSummary.isFatura
                      ? 'Dados de facturação do consultor'
                      : 'Facturação em nome da empresa'}
                  </span>
                </div>
                {selectedSummary.isFatura ? (
                  <div className="text-xs text-muted-foreground space-y-0.5 pl-1">
                    <p className="font-medium text-foreground">{selectedSummary.agents[0] || '—'}</p>
                    <p>Os dados de facturação serão obtidos do perfil do consultor.</p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground space-y-0.5 pl-1">
                    <p className="font-medium text-foreground">LECOQUIMMO – Mediação Imobiliária, Unipessoal, Lda</p>
                    <p>NIF: 514828528</p>
                    <p>Av. da Liberdade, n.º 129-B, 1250-140 Lisboa</p>
                  </div>
                )}
              </div>
            )}

            {/* Supplier selection — select from list or type free text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Fornecedor *</Label>
              <div className="space-y-2">
                <Select
                  value={bundleForm.supplier_id}
                  onValueChange={(v) => {
                    const supplier = suppliers.find(s => s.id === v)
                    setBundleForm(f => ({ ...f, supplier_id: v, supplier_name: supplier?.name || '' }))
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Seleccionar fornecedor..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] text-muted-foreground">ou</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <Input
                  className="rounded-xl"
                  placeholder="Escrever nome do fornecedor..."
                  value={bundleForm.supplier_id ? '' : bundleForm.supplier_name}
                  onChange={(e) => setBundleForm(f => ({ ...f, supplier_id: '', supplier_name: e.target.value }))}
                />
              </div>
            </div>

            {/* Expected delivery date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data prevista de entrega</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={bundleForm.expected_delivery_date}
                onChange={(e) => setBundleForm(f => ({ ...f, expected_delivery_date: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notas</Label>
              <Textarea
                className="rounded-xl resize-none"
                rows={2}
                placeholder="Observações para o fornecedor..."
                value={bundleForm.notes}
                onChange={(e) => setBundleForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setBundleDialogOpen(false)}>Cancelar</Button>
            <Button className="rounded-full gap-1.5" disabled={(!bundleForm.supplier_id && !bundleForm.supplier_name.trim()) || bundleLoading} onClick={handleCreateBundle}>
              {bundleLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
              Criar Encomenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
