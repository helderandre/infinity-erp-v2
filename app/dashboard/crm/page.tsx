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
  CalendarDays,
  Clock,
  Star,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  PIPELINE_TYPE_LABELS,
  PIPELINE_TYPE_COLORS,
} from '@/lib/constants-leads-crm'
import { NEGOCIO_ESTADO_COLORS, VISIT_STATUS_COLORS } from '@/lib/constants'
import type { PipelineType } from '@/types/leads-crm'
import type { VisitWithRelations } from '@/types/visit'
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
    { icon: Briefcase, label: 'Negocios activos', value: loading ? null : String(data?.negocios ?? 0) },
    { icon: Euro, label: 'Valor total', value: loading ? null : formatEUR(data?.expected_value ?? 0) },
    { icon: TrendingUp, label: 'Valor ponderado', value: loading ? null : formatEUR(data?.weighted_value ?? 0) },
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

// ─── Acompanhamentos List View ───────────────────────────────────────────────

interface NegocioAcomp {
  id: string
  lead_id: string
  tipo: string
  estado: string
  orcamento: number | null
  orcamento_max: number | null
  localizacao: string | null
  tipo_imovel: string | null
  quartos_min: number | null
  credito_pre_aprovado: boolean | null
  financiamento_necessario: boolean | null
  created_at: string
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

function AcompanhamentosView() {
  const router = useRouter()
  const [negocios, setNegocios] = useState<NegocioAcomp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Em Acompanhamento')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Visits
  const [visits, setVisits] = useState<VisitWithRelations[]>([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(false)

  const fetchNegocios = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      params.set('tipo', 'Compra')
      if (statusFilter) params.set('estado', statusFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/negocios?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setNegocios(json.data || [])
        setTotal(json.total || (json.data || []).length)
      }
    } catch { setNegocios([]) }
    finally { setIsLoading(false) }
  }, [page, statusFilter, search])

  const fetchVisits = useCallback(async () => {
    setIsLoadingVisits(true)
    try {
      const res = await fetch('/api/visits?upcoming=true&limit=50')
      if (res.ok) { const json = await res.json(); setVisits(json.data || []) }
    } catch { setVisits([]) }
    finally { setIsLoadingVisits(false) }
  }, [])

  useEffect(() => { fetchNegocios() }, [fetchNegocios])

  const totalPages = Math.ceil(total / limit)
  const statusFilters = [
    { value: 'Em Acompanhamento', label: 'Em Acompanhamento' },
    { value: 'Proposta', label: 'Proposta' },
    { value: 'Perdido', label: 'Perdido' },
    { value: '', label: 'Todos' },
  ]

  const navigateToNegocio = (n: NegocioAcomp) => {
    router.push(`/dashboard/leads/${n.lead_id}/negocios/${n.id}`)
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Acompanhamentos + Visitas */}
      <Tabs defaultValue="acompanhamentos">
        <TabsList className="bg-transparent gap-1.5 h-auto p-0 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: 'acompanhamentos', label: 'Acompanhamentos', icon: UserCheck },
            { key: 'visitas', label: 'Visitas Agendadas', icon: CalendarDays },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors shrink-0',
                  'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
                  'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
                onClick={() => { if (tab.key === 'visitas' && visits.length === 0) fetchVisits() }}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* ─── Acompanhamentos Tab ─── */}
        <TabsContent value="acompanhamentos" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, zona..."
                className="pl-9 rounded-full"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status pills */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
              {statusFilters.map((sf) => (
                <button
                  key={sf.value}
                  onClick={() => { setStatusFilter(sf.value); setPage(1) }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                    statusFilter === sf.value
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {sf.label}
                </button>
              ))}
            </div>

          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : negocios.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><UserCheck className="h-8 w-8 text-muted-foreground/30" /></div>
              <h3 className="text-lg font-medium">Nenhum acompanhamento encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">Inicie um acompanhamento a partir de um negócio de compra no detalhe do lead.</p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Procura</TableHead>
                    <TableHead>Orçamento</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Crédito</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negocios.map((n) => {
                    const clientName = n.lead?.nome || n.lead?.full_name || '—'
                    const statusStyle = NEGOCIO_ESTADO_COLORS[n.estado as keyof typeof NEGOCIO_ESTADO_COLORS]
                    const budget = n.orcamento ? `${(n.orcamento/1000).toFixed(0)}k€` : '—'
                    return (
                      <TableRow key={n.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigateToNegocio(n)}>
                        <TableCell className="font-medium">{clientName}</TableCell>
                        <TableCell className="text-sm">{[n.tipo_imovel, n.quartos_min ? `T${n.quartos_min}` : null].filter(Boolean).join(' · ') || '—'}</TableCell>
                        <TableCell className="text-sm tabular-nums">{budget}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{n.localizacao || '—'}</TableCell>
                        <TableCell>
                          {n.credito_pre_aprovado ? <Badge variant="secondary" className="text-[9px] rounded-full">Aprovado</Badge> : n.financiamento_necessario ? <Badge variant="outline" className="text-[9px] rounded-full">Necessário</Badge> : '—'}
                        </TableCell>
                        <TableCell>
                          {statusStyle && <Badge className={cn('rounded-full text-[9px] px-2 border-0', statusStyle.bg, statusStyle.text)}>{statusStyle.label}</Badge>}
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
        </TabsContent>

        {/* ─── Visitas Tab ─── */}
        <TabsContent value="visitas" className="mt-4">
          {isLoadingVisits ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-base font-medium">Sem visitas agendadas</h3>
              <p className="text-xs text-muted-foreground mt-1">As visitas agendadas nos acompanhamentos aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((visit, idx) => {
                const vStatus = VISIT_STATUS_COLORS[visit.status as keyof typeof VISIT_STATUS_COLORS]
                const visitDate = new Date(`${visit.visit_date}T${visit.visit_time}`)
                return (
                  <div key={visit.id} className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 flex gap-4 transition-all hover:shadow-sm animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}>
                    <div className="flex flex-col items-center justify-center w-14 shrink-0 rounded-lg bg-muted/40 p-2">
                      <span className="text-lg font-bold tabular-nums leading-none">{format(visitDate, 'd', { locale: pt })}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{format(visitDate, 'MMM', { locale: pt })}</span>
                      <span className="text-[11px] font-medium mt-0.5">{visit.visit_time?.slice(0, 5)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold truncate">{visit.property?.title || 'Imóvel'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {visit.lead?.name || visit.client_name || 'Cliente'}
                            {visit.property?.city && ` · ${visit.property.city}`}
                          </p>
                        </div>
                        <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', vStatus?.bg, vStatus?.text)}>{vStatus?.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {visit.duration_minutes} min
                        {visit.consultant?.commercial_name && (<><span className="text-muted-foreground/30">·</span>{visit.consultant.commercial_name}</>)}
                      </div>
                      {visit.feedback_rating && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (<Star key={s} className={`h-3 w-3 ${s <= visit.feedback_rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<PipelineType>('comprador')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <KanbanIcon className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Pipeline</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">CRM</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Gestao de negocios e pipeline de vendas, compras e arrendamentos.
          </p>
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

      {/* Tabs + Summary + View Toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Pipeline type tabs */}
        <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          {PIPELINE_TYPES.map((type) => {
            const Icon = PIPELINE_ICONS[type]
            const isActive = activeTab === type
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {PIPELINE_TYPE_LABELS[type]}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'kanban' && <SummaryBar pipelineType={activeTab} />}

          {/* View mode toggle */}
          <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors duration-300',
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
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors duration-300',
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
        <KanbanBoard pipelineType={activeTab} />
      ) : (
        <AcompanhamentosView />
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
