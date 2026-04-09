// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanBoard } from '@/components/crm/kanban-board'
import {
  ShoppingCart,
  Store,
  Key,
  Building2,
  TrendingUp,
  Briefcase,
  Euro,
  Kanban as KanbanIcon,
  Download,
  List,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  PIPELINE_TYPE_LABELS,
} from '@/lib/constants-leads-crm'
import type { PipelineType } from '@/types/leads-crm'
import { ObservationsButton } from '@/components/crm/observations-dialog'
import { temperaturaEmoji, type Temperatura } from '@/components/negocios/temperatura-selector'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

const PIPELINE_TYPES: PipelineType[] = ['comprador', 'vendedor', 'arrendatario', 'arrendador']

const PIPELINE_ICONS: Record<PipelineType, React.ElementType> = {
  comprador: ShoppingCart,
  vendedor: Store,
  arrendatario: Key,
  arrendador: Building2,
}

const formatEUR = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value)

// ─── Summary bar ──────────────────────────────────────────────────────────────

interface SummaryData {
  negocios: number
  expected_value: number
  weighted_value: number
  expected_commission: number
  weighted_commission: number
}

function SummaryBar({ pipelineType }: { pipelineType: PipelineType }) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/crm/kanban/${pipelineType}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.totals) setData(json.totals)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [pipelineType])

  const stats = [
    { icon: Briefcase, label: 'Negócios activos', value: loading ? null : String(data?.negocios ?? 0) },
    { icon: Euro, label: 'Comissão prevista', value: loading ? null : formatEUR(data?.expected_commission ?? 0) },
    { icon: TrendingUp, label: 'Comissão ponderada', value: loading ? null : formatEUR(data?.weighted_commission ?? 0) },
  ]

  return (
    <div className="flex items-center gap-2">
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/30 shadow-sm px-3.5 py-1.5">
          <div className="p-1 rounded-full bg-muted/60">
            <Icon className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
          {loading ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="text-xs font-bold whitespace-nowrap">{value}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Pipeline List View ──────────────────────────────────────────────────────

interface NegocioRow {
  id: string
  lead_id: string
  tipo: string
  estado: string
  pipeline_stage_id: string | null
  temperatura: Temperatura | null
  observacoes: string | null
  orcamento: number | null
  orcamento_max: number | null
  preco_venda: number | null
  localizacao: string | null
  tipo_imovel: string | null
  quartos_min: number | null
  created_at: string
  leads_pipeline_stages?: {
    id: string
    name: string
    color: string | null
  } | null
  lead?: {
    id: string
    nome: string
    full_name: string | null
    telemovel: string | null
    email: string | null
    agent_id: string | null
    agent?: { id: string; commercial_name: string } | null
  } | null
}

const TEMP_BADGE_LIST: Record<string, { color: string; label: string }> = {
  'Frio':   { color: '#3b82f6', label: 'Frio' },
  'Morno':  { color: '#f59e0b', label: 'Morno' },
  'Quente': { color: '#ef4444', label: 'Quente' },
}

interface PipelineStageOption {
  id: string
  name: string
  color: string | null
  order_index: number
}

interface ConsultantOption {
  id: string
  commercial_name: string
}

interface CrmFilters {
  search: string
  pipelineStageId: string
  temperatura: string
  consultantId: string
}

function NegociosListView({
  pipelineType,
  filters,
}: {
  pipelineType: PipelineType
  filters: CrmFilters
}) {
  const router = useRouter()
  const [negocios, setNegocios] = useState<NegocioRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 30

  // Reset to first page when pipeline type or any filter changes
  useEffect(() => { setPage(1) }, [pipelineType, filters.search, filters.pipelineStageId, filters.temperatura, filters.consultantId])

  const fetchNegocios = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(limit),
        pipeline_type: pipelineType,
      })
      if (filters.search) params.set('search', filters.search)
      if (filters.pipelineStageId) params.set('pipeline_stage_id', filters.pipelineStageId)
      if (filters.temperatura) params.set('temperatura', filters.temperatura)
      if (filters.consultantId) params.set('assigned_consultant_id', filters.consultantId)

      const res = await fetch(`/api/crm/negocios?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setNegocios(json.data || [])
        setTotal(json.total || (json.data || []).length)
      }
    } catch { setNegocios([]) }
    finally { setIsLoading(false) }
  }, [page, pipelineType, filters.search, filters.pipelineStageId, filters.temperatura, filters.consultantId])

  useEffect(() => { fetchNegocios() }, [fetchNegocios])

  const totalPages = Math.ceil(total / limit)

  const navigateToNegocio = (n: NegocioRow) => {
    router.push(`/dashboard/leads/${n.lead_id}/negocios/${n.id}`)
  }

  const handleSaveObservations = useCallback(async (negocioId: string, next: string | null) => {
    const res = await fetch(`/api/negocios/${negocioId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observacoes: next }),
    })
    if (!res.ok) throw new Error('Failed to save')
    setNegocios((prev) => prev.map((n) => (n.id === negocioId ? { ...n, observacoes: next } : n)))
  }, [])

  return (
    <div className="space-y-4">
      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : negocios.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><Briefcase className="h-8 w-8 text-muted-foreground/30" /></div>
          <h3 className="text-lg font-medium">Nenhum negócio neste pipeline</h3>
          <p className="text-sm text-muted-foreground mt-1">Os negócios criados aparecerão aqui.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Procura</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead className="text-center">Obs.</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {negocios.map((n) => {
                const clientName = n.lead?.nome || n.lead?.full_name || '—'
                const tempBadge = n.temperatura ? TEMP_BADGE_LIST[n.temperatura] : null
                const tempEmoji = temperaturaEmoji(n.temperatura)
                const stage = n.leads_pipeline_stages
                const stageName = stage?.name || n.estado || '—'
                const stageColor = stage?.color || '#64748b'
                const budget = n.orcamento
                  ? `${(n.orcamento / 1000).toFixed(0)}k€`
                  : n.preco_venda
                    ? `${(n.preco_venda / 1000).toFixed(0)}k€`
                    : '—'
                return (
                  <TableRow
                    key={n.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigateToNegocio(n)}
                  >
                    <TableCell className="font-medium">{clientName}</TableCell>
                    <TableCell>
                      {tempBadge ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: `${tempBadge.color}26`, color: tempBadge.color }}
                        >
                          {tempEmoji && <span aria-hidden>{tempEmoji}</span>}
                          {tempBadge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: `${stageColor}26`, color: stageColor }}
                      >
                        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: stageColor }} />
                        {stageName}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{[n.tipo_imovel, n.quartos_min ? `T${n.quartos_min}` : null].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell className="text-sm tabular-nums">{budget}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{n.localizacao || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{n.lead?.agent?.commercial_name || '—'}</TableCell>
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ObservationsCell
                        observacoes={n.observacoes}
                        onSave={(next) => handleSaveObservations(n.id, next)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(n.created_at), 'd MMM', { locale: pt })}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-full"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  )
}

// ─── Observations cell ───────────────────────────────────────────────────────

function ObservationsCell({
  observacoes,
  onSave,
}: {
  observacoes: string | null
  onSave: (next: string | null) => Promise<void>
}) {
  // The ObservationsButton already shows a clickable chip with count badge.
  // We re-use it but render only the icon variant via a thin wrapper here.
  // If there are no observations, render a faded chat icon (still clickable to add).
  return (
    <div className="inline-flex items-center justify-center">
      <ObservationsCellInner observacoes={observacoes} onSave={onSave} />
    </div>
  )
}

function ObservationsCellInner({
  observacoes,
  onSave,
}: {
  observacoes: string | null
  onSave: (next: string | null) => Promise<void>
}) {
  // Reuse the existing ObservationsButton (white pill with count) — but in the
  // table cell context. The count badge already conveys whether there are obs.
  return <ObservationsButton observacoes={observacoes} onSave={onSave} />
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<PipelineType>('comprador')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [exportOpen, setExportOpen] = useState(false)

  // Shared filters across kanban + list
  const [filters, setFilters] = useState<CrmFilters>({
    search: '',
    pipelineStageId: '',
    temperatura: '',
    consultantId: '',
  })

  // Stage list for the active pipeline + consultants list
  const [stages, setStages] = useState<PipelineStageOption[]>([])
  const [consultants, setConsultants] = useState<ConsultantOption[]>([])

  // Reset stage filter when pipeline tab changes (stage ids are pipeline-scoped)
  useEffect(() => {
    setFilters((f) => ({ ...f, pipelineStageId: '' }))
  }, [activeTab])

  // Load stages for the active pipeline
  useEffect(() => {
    let cancelled = false
    fetch(`/api/crm/pipeline-stages?pipeline_type=${activeTab}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PipelineStageOption[]) => {
        if (!cancelled) setStages((data || []).sort((a, b) => a.order_index - b.order_index))
      })
      .catch(() => !cancelled && setStages([]))
    return () => { cancelled = true }
  }, [activeTab])

  // Load consultants once
  useEffect(() => {
    let cancelled = false
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ConsultantOption[]) => {
        if (!cancelled) setConsultants(data || [])
      })
      .catch(() => !cancelled && setConsultants([]))
    return () => { cancelled = true }
  }, [])

  const hasActiveFilters = !!(filters.search || filters.pipelineStageId || filters.temperatura || filters.consultantId)
  const clearFilters = () => setFilters({ search: '', pipelineStageId: '', temperatura: '', consultantId: '' })

  return (
    <div className="space-y-6">
      {/* Hero — title + pipeline tabs inside */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-8 sm:px-10 sm:py-10">
          <div className="flex items-center gap-2 mb-2">
            <KanbanIcon className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">CRM</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Pipeline</h2>

          {/* Pipeline type tabs (inside the hero) */}
          <div className="mt-5 inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
            {PIPELINE_TYPES.map((type) => {
              const Icon = PIPELINE_ICONS[type]
              const isActive = activeTab === type
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-300',
                    isActive
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {PIPELINE_TYPE_LABELS[type]}
                </button>
              )
            })}
          </div>
        </div>
        <Button
          size="sm"
          className="absolute top-6 right-6 z-20 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
      </div>

      {/* Below the card: predicted commissions (left) + filters/view-toggle (right) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SummaryBar pipelineType={activeTab} />

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome..."
              className="pl-9 rounded-full h-9"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            {filters.search && (
              <button onClick={() => setFilters((f) => ({ ...f, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Estado / pipeline stage */}
          <Select
            value={filters.pipelineStageId || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, pipelineStageId: v === 'all' ? '' : v }))}
          >
            <SelectTrigger className="h-9 w-auto min-w-[150px] rounded-full text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || '#94a3b8' }} />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Temperatura */}
          <Select
            value={filters.temperatura || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, temperatura: v === 'all' ? '' : v }))}
          >
            <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-full text-xs">
              <SelectValue placeholder="Temperatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer temperatura</SelectItem>
              <SelectItem value="Frio">❄️ Frio</SelectItem>
              <SelectItem value="Morno">🌤️ Morno</SelectItem>
              <SelectItem value="Quente">🔥 Quente</SelectItem>
            </SelectContent>
          </Select>

          {/* Consultor */}
          <Select
            value={filters.consultantId || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, consultantId: v === 'all' ? '' : v }))}
          >
            <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-full text-xs">
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {consultants.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="rounded-full text-xs h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}

          {/* View mode toggle */}
          <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm ml-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                viewMode === 'kanban'
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <KanbanIcon className="h-3.5 w-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                viewMode === 'list'
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <KanbanBoard pipelineType={activeTab} filters={filters} />
      ) : (
        <NegociosListView pipelineType={activeTab} filters={filters} />
      )}

      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/negocios"
        title="Negócios"
      />
    </div>
  )
}
