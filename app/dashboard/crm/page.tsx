// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanBoard } from '@/components/crm/kanban-board'
import { NegocioDetailSheet } from '@/components/crm/negocio-detail-sheet'
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
  ChevronDown,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SlidersHorizontal } from 'lucide-react'
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
import { MyLeadsSheet } from '@/components/leads/my-leads-sheet'
import { NewNegocioDialog } from '@/components/crm/new-negocio-dialog'
import { useUser } from '@/hooks/use-user'
import { useIsMobile } from '@/hooks/use-mobile'
import { Inbox, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

const PIPELINE_TYPES: PipelineType[] = ['comprador', 'vendedor', 'arrendatario', 'arrendador']

const PIPELINE_TYPE_LABELS_PLURAL: Record<PipelineType, string> = {
  comprador: 'Compradores',
  vendedor: 'Vendedores',
  arrendatario: 'Arrendatários',
  arrendador: 'Senhorios',
}

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
  possible_commission: number
  forecast_commission: number
}

function SummaryBar({ pipelineType, inHero = false }: { pipelineType: PipelineType; inHero?: boolean }) {
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
    { icon: Briefcase, label: 'Negócios activos', mobileLabel: 'Negócios', value: loading ? null : String(data?.negocios ?? 0) },
    { icon: Euro, label: 'Comissão possível', mobileLabel: 'Possível', value: loading ? null : formatEUR(data?.possible_commission ?? 0) },
    { icon: TrendingUp, label: 'Comissão prevista', mobileLabel: 'Previsão', value: loading ? null : formatEUR(data?.forecast_commission ?? 0) },
  ]

  if (inHero) {
    // Dark-on-dark variant for inside the black hero card.
    // Mobile: stacked label-on-top / value-on-bottom (no icon).
    // Desktop: icon + label on the left, value on the right, single row.
    return (
      <div className="inline-flex items-stretch rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
        {stats.map(({ icon: Icon, label, mobileLabel, value }, idx) => (
          <div
            key={label}
            className={cn(
              'flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 px-4 py-2 min-w-[78px] md:min-w-0',
              idx > 0 && 'border-l border-white/10',
            )}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="hidden md:block h-3 w-3 text-white/50" />
              <span className="text-[8px] md:text-[10px] uppercase tracking-wider font-medium text-white/50 whitespace-nowrap leading-none">
                <span className="md:hidden">{mobileLabel}</span>
                <span className="hidden md:inline">{label}</span>
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-3.5 w-10 bg-white/10" />
            ) : (
              <span className="text-sm font-bold text-white tabular-nums whitespace-nowrap leading-tight">{value}</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {stats.map(({ icon: Icon, label, mobileLabel, value }) => (
        <div key={label} className="flex items-center gap-1 md:gap-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/30 shadow-sm px-2.5 md:px-3.5 py-1.5">
          <div className="hidden md:flex p-1 rounded-full bg-muted/60">
            <Icon className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            <span className="md:hidden">{mobileLabel}</span>
            <span className="hidden md:inline">{label}</span>
          </span>
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
  stages,
  onStageChange,
  onOpenNegocio,
}: {
  pipelineType: PipelineType
  filters: CrmFilters
  stages: PipelineStageOption[]
  onStageChange: (stageId: string | null) => void
  onOpenNegocio: (id: string) => void
}) {
  const [negocios, setNegocios] = useState<NegocioRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
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

  // Counts per stage — usados pelo selector mobile no topo. Refetch quando
  // muda o pipeline ou quando alguma operação (criar/eliminar) é provável.
  // Para já refetch apenas em mudança de pipeline + reset de página.
  useEffect(() => {
    let cancelled = false
    async function loadCounts() {
      try {
        const res = await fetch(`/api/crm/kanban/${pipelineType}`)
        if (!res.ok) return
        const json = await res.json()
        const cols: Array<{ stage: { id: string }; items: any[] }> = json?.columns || []
        const map: Record<string, number> = {}
        for (const c of cols) {
          if (c?.stage?.id) map[c.stage.id] = (c.items || []).length
        }
        if (!cancelled) setStageCounts(map)
      } catch {
        /* silent */
      }
    }
    loadCounts()
    return () => { cancelled = true }
  }, [pipelineType, page])

  const totalPages = Math.ceil(total / limit)

  const navigateToNegocio = (n: NegocioRow) => {
    onOpenNegocio(n.id)
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
        <>
          {/* ── Desktop: full table ── */}
          <div className="hidden md:block rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
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

          {/* ── Mobile: stage selector + card list ── */}
          <div className="md:hidden space-y-2">
            <MobileStageSelector
              stages={stages}
              counts={stageCounts}
              activeStageId={filters.pipelineStageId || null}
              onChange={onStageChange}
            />
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
                  : null
              return (
                <div
                  key={n.id}
                  onClick={() => navigateToNegocio(n)}
                  className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-sm shadow-sm p-3 cursor-pointer transition-all hover:shadow-md hover:bg-card"
                >
                  {/* Top: name + obs */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold truncate flex-1 min-w-0 flex items-center gap-1">
                      {clientName}
                      {tempEmoji && <span aria-hidden className="text-sm">{tempEmoji}</span>}
                    </p>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ObservationsCell
                        observacoes={n.observacoes}
                        onSave={(next) => handleSaveObservations(n.id, next)}
                      />
                    </div>
                  </div>

                  {/* Tags row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: `${stageColor}26`, color: stageColor }}
                    >
                      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: stageColor }} />
                      {stageName}
                    </span>
                    {tempBadge && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: `${tempBadge.color}26`, color: tempBadge.color }}
                      >
                        {tempBadge.label}
                      </span>
                    )}
                    {budget && (
                      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
                        {budget}
                      </span>
                    )}
                  </div>

                  {/* Footer: search criteria · location · consultant · date */}
                  <div className="mt-2 pt-2 border-t border-border/30 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                    <span className="truncate min-w-0">
                      {[
                        [n.tipo_imovel, n.quartos_min ? `T${n.quartos_min}` : null].filter(Boolean).join(' · '),
                        n.localizacao,
                        n.lead?.agent?.commercial_name,
                      ].filter(Boolean).join(' · ') || '—'}
                    </span>
                    <span className="shrink-0">{format(new Date(n.created_at), 'd MMM', { locale: pt })}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
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

// ─── Mobile stage selector ────────────────────────────────────────────────

function MobileStageSelector({
  stages,
  counts,
  activeStageId,
  onChange,
}: {
  stages: PipelineStageOption[]
  counts: Record<string, number>
  activeStageId: string | null
  onChange: (stageId: string | null) => void
}) {
  const active = activeStageId ? stages.find((s) => s.id === activeStageId) : null
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0)
  const activeCount = active ? counts[active.id] ?? 0 : totalAll
  const activeName = active?.name || 'Todas as fases'
  const activeColor = active?.color || '#94a3b8'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 rounded-2xl bg-card/80 supports-[backdrop-filter]:bg-card/60 backdrop-blur-md border border-border/40 shadow-sm px-4 py-3 hover:bg-card transition-colors"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: activeColor }} />
            <span className="text-sm font-semibold truncate">{activeName}</span>
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-muted text-[11px] font-semibold text-foreground/80 tabular-nums">
              {activeCount}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1.5 max-h-[60vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
            activeStageId === null ? 'bg-muted font-medium' : 'hover:bg-muted/60',
          )}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/40" />
            <span className="truncate">Todas as fases</span>
          </span>
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-muted text-[11px] font-semibold tabular-nums text-foreground/70">
            {totalAll}
          </span>
        </button>
        {stages.map((s) => {
          const count = counts[s.id] ?? 0
          const isActive = activeStageId === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={cn(
                'w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-muted font-medium' : 'hover:bg-muted/60',
              )}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color || '#94a3b8' }} />
                <span className="truncate">{s.name}</span>
              </span>
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums',
                  count > 0
                    ? 'bg-foreground/[0.08] text-foreground/80'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
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
  const { user } = useUser()
  const isMobile = useIsMobile()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<PipelineType>('comprador')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [exportOpen, setExportOpen] = useState(false)
  const [myLeadsOpen, setMyLeadsOpen] = useState(false)
  const [newNegocioOpen, setNewNegocioOpen] = useState(false)
  const [myLeadsCount, setMyLeadsCount] = useState<number | null>(null)
  const [detailNegocioId, setDetailNegocioId] = useState<string | null>(null)
  // Bumped whenever a lead is qualified / added — KanbanBoard listens for the
  // change and silently re-fetches so the new card appears in place.
  const [kanbanRefreshKey, setKanbanRefreshKey] = useState(0)
  const [pipelineCounts, setPipelineCounts] = useState<Record<PipelineType, number | null>>({
    comprador: null,
    vendedor: null,
    arrendatario: null,
    arrendador: null,
  })

  // Sync ?negocio=<id> with the detail sheet so deep links open directly.
  const negocioParam = searchParams.get('negocio')
  useEffect(() => {
    if (negocioParam && negocioParam !== detailNegocioId) {
      setDetailNegocioId(negocioParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioParam])

  const openNegocioSheet = useCallback(
    (id: string) => {
      setDetailNegocioId(id)
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('negocio', id)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      setDetailNegocioId(null)
      if (negocioParam) {
        const params = new URLSearchParams(searchParams?.toString() ?? '')
        params.delete('negocio')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      }
    },
    [router, pathname, searchParams, negocioParam],
  )

  // Fetch the total count of negocios per pipeline (for tab badges)
  useEffect(() => {
    let cancelled = false
    Promise.all(
      PIPELINE_TYPES.map((pt) =>
        fetch(`/api/crm/negocios?pipeline_type=${pt}&per_page=1&page=1`)
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => [pt, typeof json?.total === 'number' ? json.total : 0] as const)
          .catch(() => [pt, 0] as const)
      )
    ).then((entries) => {
      if (cancelled) return
      const next: Record<PipelineType, number | null> = {
        comprador: 0, vendedor: 0, arrendatario: 0, arrendador: 0,
      }
      for (const [pt, count] of entries) next[pt] = count
      setPipelineCounts(next)
    })
    return () => { cancelled = true }
  }, [])

  // Fetch the count of pending lead-entries (status=new — need to be contacted)
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ status: 'new', limit: '1' })
    fetch(`/api/lead-entries?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const count = typeof json?.total === 'number'
          ? json.total
          : (json?.data?.length ?? 0)
        setMyLeadsCount(count)
      })
      .catch(() => !cancelled && setMyLeadsCount(0))
    return () => { cancelled = true }
  }, [myLeadsOpen])

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

  // Filter row JSX — extracted so we can render it once. Lives outside the
  // hero on desktop (top-right of the kanban) and outside on mobile too.
  const filterRow = (
    <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap sm:flex-nowrap sm:justify-end">
      {/* Search */}
      <div className="relative flex-1 min-w-[140px] sm:flex-initial sm:w-[200px] lg:w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome..."
          className="pl-8 pr-7 rounded-full h-8 text-xs bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm focus-visible:ring-1 focus-visible:ring-border focus-visible:border-border"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        {filters.search && (
          <button onClick={() => setFilters((f) => ({ ...f, search: '' }))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Filters popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="relative shrink-0 inline-flex items-center justify-center sm:gap-1.5 h-8 w-8 sm:w-auto sm:px-3 rounded-full bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm text-xs text-muted-foreground hover:bg-card transition-colors"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && (
              <span className="absolute sm:static -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-background sm:ring-0" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3 space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estado</p>
            <Select
              value={filters.pipelineStageId || 'all'}
              onValueChange={(v) => setFilters((f) => ({ ...f, pipelineStageId: v === 'all' ? '' : v }))}
            >
              <SelectTrigger className="h-9 w-full rounded-full text-xs">
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
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Temperatura</p>
            <Select
              value={filters.temperatura || 'all'}
              onValueChange={(v) => setFilters((f) => ({ ...f, temperatura: v === 'all' ? '' : v }))}
            >
              <SelectTrigger className="h-9 w-full rounded-full text-xs">
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer temperatura</SelectItem>
                <SelectItem value="Frio">❄️ Frio</SelectItem>
                <SelectItem value="Morno">🌤️ Morno</SelectItem>
                <SelectItem value="Quente">🔥 Quente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Consultor</p>
            <Select
              value={filters.consultantId || 'all'}
              onValueChange={(v) => setFilters((f) => ({ ...f, consultantId: v === 'all' ? '' : v }))}
            >
              <SelectTrigger className="h-9 w-full rounded-full text-xs">
                <SelectValue placeholder="Consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="rounded-full text-xs w-full h-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar filtros
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* View mode toggle */}
      <div className="inline-flex shrink-0 items-center gap-0.5 p-0.5 rounded-full bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm">
        <button
          onClick={() => setViewMode('kanban')}
          aria-label="Kanban"
          className={cn(
            'inline-flex items-center justify-center sm:gap-1 h-7 w-7 sm:w-auto sm:px-2.5 rounded-full text-[11px] font-medium transition-colors duration-300',
            viewMode === 'kanban'
              ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
              : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <KanbanIcon className="h-3 w-3" />
          <span className="hidden sm:inline">Kanban</span>
        </button>
        <button
          onClick={() => setViewMode('list')}
          aria-label="Lista"
          className={cn(
            'inline-flex items-center justify-center sm:gap-1 h-7 w-7 sm:w-auto sm:px-2.5 rounded-full text-[11px] font-medium transition-colors duration-300',
            viewMode === 'list'
              ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
              : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <List className="h-3 w-3" />
          <span className="hidden sm:inline">Lista</span>
        </button>
      </div>

      {/* + Novo Negócio */}
      <button
        type="button"
        onClick={() => setNewNegocioOpen(true)}
        className="shrink-0 inline-flex items-center justify-center gap-1 h-8 px-2.5 sm:px-3 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[11px] font-semibold shadow-md ring-1 ring-black/5 hover:bg-neutral-800 dark:hover:bg-white/90 transition-colors"
        aria-label="Novo Negócio"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span className="hidden sm:inline">Novo</span>
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Hero — title + pipeline tabs inside */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 pt-8 pb-5 sm:px-10 sm:pt-10 sm:pb-6">
          <div className="flex items-center gap-2 mb-2">
            <KanbanIcon className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">CRM</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Pipeline</h2>
            {myLeadsCount !== null && (
              <button
                type="button"
                onClick={() => setMyLeadsOpen(true)}
                className="relative inline-flex items-center gap-1.5 rounded-full bg-white text-neutral-900 px-3.5 py-1.5 text-xs font-semibold shadow-md ring-1 ring-black/5 hover:bg-white/90 transition-colors"
              >
                <Inbox className="h-3.5 w-3.5" />
                Tens {myLeadsCount} lead{myLeadsCount === 1 ? '' : 's'}
                {myLeadsCount > 0 ? (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-900 animate-pulse"
                    aria-label={`${myLeadsCount} leads para qualificar`}
                  />
                ) : (
                  <span
                    className="absolute -top-1 -right-1 inline-flex items-center justify-center h-[16px] w-[16px] rounded-full bg-amber-400 text-neutral-900 ring-2 ring-neutral-900"
                    aria-label="Adicionar lead"
                  >
                    <Plus className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Pipeline type tabs (inside the hero) — pluralised, with count badges.
              Mobile: centred, compact; every tab shows icon + count; only the active tab shows the label. */}
          <div className="mt-4 flex sm:inline-flex items-center justify-center gap-0.5 sm:gap-1 px-1 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 w-fit mx-auto sm:mx-0">
            {PIPELINE_TYPES.map((type) => {
              const Icon = PIPELINE_ICONS[type]
              const isActive = activeTab === type
              const count = pipelineCounts[type]
              const label = PIPELINE_TYPE_LABELS_PLURAL[type]
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  title={label}
                  className={cn(
                    'inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-300',
                    isActive
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {/* Label: hidden on mobile for inactive tabs */}
                  <span className={cn(isActive ? 'inline' : 'hidden sm:inline')}>
                    {label}
                  </span>
                  {count !== null && (
                    <span
                      className={cn(
                        'inline-flex items-center justify-center min-w-[16px] sm:min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums',
                        isActive
                          ? 'bg-neutral-900/10 text-neutral-900'
                          : 'bg-white/15 text-white/80'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Data points only — filter row moved out of the hero. */}
          <div className="mt-4 flex justify-center lg:justify-start">
            <SummaryBar pipelineType={activeTab} inHero />
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

      {/* Active pipeline title (desktop only) + filter row — outside the hero. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="hidden md:block text-2xl font-bold tracking-tight">
          {PIPELINE_TYPE_LABELS_PLURAL[activeTab]}
        </h2>
        {filterRow}
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          pipelineType={activeTab}
          filters={filters}
          onCardClick={(n) => openNegocioSheet(n.id)}
          refreshKey={kanbanRefreshKey}
        />
      ) : (
        <NegociosListView
          pipelineType={activeTab}
          filters={filters}
          stages={stages}
          onStageChange={(stageId) =>
            setFilters((f) => ({ ...f, pipelineStageId: stageId || '' }))
          }
          onOpenNegocio={openNegocioSheet}
        />
      )}

      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/negocios"
        title="Negócios"
      />

      <MyLeadsSheet
        open={myLeadsOpen}
        onOpenChange={setMyLeadsOpen}
        consultantId={user?.id ?? null}
        onNegocioCreated={() => setKanbanRefreshKey((k) => k + 1)}
      />

      <NewNegocioDialog
        open={newNegocioOpen}
        onOpenChange={setNewNegocioOpen}
        onCreated={(id) => {
          setKanbanRefreshKey((k) => k + 1)
          if (id) openNegocioSheet(id)
        }}
      />

      <NegocioDetailSheet
        negocioId={detailNegocioId}
        open={!!detailNegocioId}
        onOpenChange={handleSheetOpenChange}
      />
    </div>
  )
}
