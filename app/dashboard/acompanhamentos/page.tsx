// @ts-nocheck
'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserCheck,
  Search,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Building2,
  MapPin,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAcompanhamentos } from '@/hooks/use-acompanhamentos'
import {
  ACOMPANHAMENTO_STATUS_OPTIONS,
  ACOMPANHAMENTO_STATUS_COLORS,
  VISIT_STATUS_COLORS,
} from '@/lib/constants'
import type { AcompanhamentoFilters, AcompanhamentoWithRelations } from '@/types/acompanhamento'
import type { VisitWithRelations } from '@/types/visit'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { AcompanhamentoCard } from '@/components/acompanhamentos/acompanhamento-card'
import { Calendar } from '@/components/ui/calendar'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function formatBudget(min?: number | null, max?: number | null) {
  if (!min && !max) return '—'
  const parts = []
  if (min) parts.push(`${(min / 1000).toFixed(0)}k`)
  if (max) parts.push(`${(max / 1000).toFixed(0)}k`)
  return parts.join(' – ') + ' €'
}

export default function AcompanhamentosPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [page, setPage] = useState(1)
  const [mainTab, setMainTab] = useState<'acompanhamentos' | 'visitas'>('acompanhamentos')

  // Visits across all acompanhamentos
  const [visits, setVisits] = useState<VisitWithRelations[]>([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(false)
  const [selectedVisitDate, setSelectedVisitDate] = useState<Date | undefined>(undefined)

  const activeFilters: AcompanhamentoFilters = {
    status: selectedStatus as any || undefined,
    search: searchInput || undefined,
  }

  const {
    acompanhamentos,
    isLoading,
    total,
    totalPages,
    updateAcompanhamento,
    deleteAcompanhamento,
  } = useAcompanhamentos({ filters: activeFilters, page, limit: 20 })

  // KPIs
  const kpis = useMemo(() => {
    const active = acompanhamentos.filter((a) => a.status === 'active').length
    const paused = acompanhamentos.filter((a) => a.status === 'paused').length
    const converted = acompanhamentos.filter((a) => a.status === 'converted').length
    const lost = acompanhamentos.filter((a) => a.status === 'lost').length
    return { total: acompanhamentos.length, active, paused, converted, lost }
  }, [acompanhamentos])

  const fetchVisits = useCallback(async () => {
    setIsLoadingVisits(true)
    try {
      const res = await fetch('/api/visits?upcoming=true&limit=50')
      if (!res.ok) throw new Error('Erro')
      const json = await res.json()
      setVisits(json.data || [])
    } catch {
      setVisits([])
    } finally {
      setIsLoadingVisits(false)
    }
  }, [])

  const handleView = (a: AcompanhamentoWithRelations) => {
    router.push(`/dashboard/leads/${a.lead_id}/acompanhamentos/${a.id}`)
  }

  const handlePause = async (id: string) => {
    await updateAcompanhamento(id, { status: 'paused' })
  }

  const handleResume = async (id: string) => {
    await updateAcompanhamento(id, { status: 'active' })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    await deleteAcompanhamento(deleteId)
    setDeleteId(null)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Hero */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-emerald-600/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-white/80" />
                </div>
                <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
                  Compradores
                </p>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Acompanhamentos
              </h2>
              <p className="text-neutral-400 mt-1.5 text-sm max-w-lg">
                Perfil de procura, imóveis sugeridos, crédito e propostas dos seus compradores.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => {
        setMainTab(v as any)
        if (v === 'visitas' && visits.length === 0) fetchVisits()
      }}>
        <TabsList className="bg-muted/30">
          <TabsTrigger value="acompanhamentos" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <UserCheck className="h-4 w-4" />
            Acompanhamentos
          </TabsTrigger>
          <TabsTrigger value="visitas" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CalendarDays className="h-4 w-4" />
            Visitas Agendadas
            {visits.length > 0 && (
              <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 ml-0.5">{visits.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="acompanhamentos" className="mt-4 space-y-6">

      {/* KPI Cards (mobile-friendly) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Em Acompanhamento', value: kpis.active, icon: UserCheck, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500', valueColor: 'text-blue-600' },
          { label: 'Pausados', value: kpis.paused, icon: Clock, iconBg: 'bg-slate-500/10', iconColor: 'text-slate-500', valueColor: '' },
          { label: 'Convertidos', value: kpis.converted, icon: CheckCircle2, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', valueColor: 'text-emerald-600' },
          { label: 'Perdidos', value: kpis.lost, icon: AlertTriangle, iconBg: 'bg-red-500/10', iconColor: 'text-red-500', valueColor: 'text-red-600' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-md hover:bg-card/80"
          >
            <div className="flex items-center gap-3">
              <div className={cn('rounded-xl p-2.5', kpi.iconBg)}>
                <kpi.icon className={cn('h-4 w-4', kpi.iconColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{kpi.label}</p>
                <p className={cn('text-xl font-bold tracking-tight tabular-nums', kpi.valueColor)}>{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-full bg-muted/30 border-0 focus-visible:ring-1"
            placeholder="Pesquisar por nome, zona..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
          />
          {searchInput && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setSearchInput(''); setPage(1) }}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
          <button
            onClick={() => { setSelectedStatus(null); setPage(1) }}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
              !selectedStatus
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Todos ({total})
          </button>
          {ACOMPANHAMENTO_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSelectedStatus(selectedStatus === opt.value ? null : opt.value); setPage(1) }}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                selectedStatus === opt.value
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/30 ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded-full transition-colors',
              viewMode === 'grid'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'p-1.5 rounded-full transition-colors',
              viewMode === 'table'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border overflow-hidden">
                <div className="h-1 bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden bg-card/30">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[40px]" />
                  <TableHead>Cliente</TableHead>
                  <TableHead>Procura</TableHead>
                  <TableHead>Orçamento</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : acompanhamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <UserCheck className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-medium">Nenhum acompanhamento encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            {searchInput || selectedStatus
              ? 'Tente ajustar os filtros de pesquisa.'
              : 'Os acompanhamentos são criados a partir de um negócio de compra.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {acompanhamentos.map((a, idx) => (
            <div
              key={a.id}
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
            >
              <AcompanhamentoCard
                acompanhamento={a}
                onView={handleView}
                onPause={handlePause}
                onResume={handleResume}
                onDelete={setDeleteId}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[40px]" />
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Cliente</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Procura</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Orçamento</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Zona</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Crédito</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acompanhamentos.map((a, idx) => {
                const neg = a.negocio
                const clientName = a.lead?.full_name || a.lead?.nome || 'Lead'
                const statusStyle = ACOMPANHAMENTO_STATUS_COLORS[a.status]

                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                    style={{ animationDelay: `${idx * 30}ms` }}
                    onClick={() => handleView(a)}
                  >
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px] bg-gradient-to-br from-neutral-200 to-neutral-400 text-white">
                          {getInitials(clientName)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">{clientName}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {neg?.tipo_imovel && (
                          <span className="text-xs text-muted-foreground">{neg.tipo_imovel}</span>
                        )}
                        {neg?.quartos_min && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">T{neg.quartos_min}+</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium tabular-nums">
                        {formatBudget(neg?.orcamento, neg?.orcamento_max)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground max-w-[140px] truncate block">
                        {neg?.localizacao || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {neg?.credito_pre_aprovado ? (
                        <Badge variant="secondary" className="text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 border-0">
                          Pré-aprovado
                        </Badge>
                      ) : neg?.financiamento_necessario ? (
                        <Badge variant="secondary" className="text-[10px] rounded-full bg-amber-500/10 text-amber-600 border-0">
                          Necessário
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'rounded-full text-[10px] border-0 px-2.5',
                          statusStyle.bg, statusStyle.text
                        )}
                      >
                        <span className={cn('mr-1 h-1.5 w-1.5 rounded-full inline-block', statusStyle.dot)} />
                        {statusStyle.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2.5 bg-muted/10">
              <p className="text-[11px] text-muted-foreground">
                {total} acompanhamento{total !== 1 ? 's' : ''} &middot; Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid pagination */}
      {viewMode === 'grid' && totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" className="rounded-full" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" className="rounded-full" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Seguinte
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

        </TabsContent>

        {/* Visitas Tab */}
        <TabsContent value="visitas" className="mt-4">
          {isLoadingVisits ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {selectedVisitDate
                    ? format(selectedVisitDate, "d 'de' MMMM yyyy", { locale: pt })
                    : `${visits.length} visita${visits.length !== 1 ? 's' : ''}`}
                </p>
                {selectedVisitDate && (
                  <button
                    onClick={() => setSelectedVisitDate(undefined)}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
                  >
                    Ver todas
                  </button>
                )}
              </div>

              {/* Calendar */}
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedVisitDate}
                  onSelect={(d) => setSelectedVisitDate(d || undefined)}
                  locale={pt}
                  modifiers={{
                    hasVisit: visits.map(v => new Date(v.visit_date + 'T00:00:00')),
                  }}
                  modifiersClassNames={{
                    hasVisit: 'relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-blue-500',
                  }}
                />
              </div>

              {/* Visits list */}
              {(() => {
                const filtered = selectedVisitDate
                  ? visits.filter(v => v.visit_date === format(selectedVisitDate, 'yyyy-MM-dd'))
                  : visits

                return filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-10 text-center">
                    <CalendarDays className="h-6 w-6 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {selectedVisitDate ? 'Sem visitas neste dia' : 'Nenhuma visita agendada'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((visit, idx) => {
                      const vStatus = VISIT_STATUS_COLORS[visit.status as keyof typeof VISIT_STATUS_COLORS]
                      const visitDate = new Date(`${visit.visit_date}T${visit.visit_time}`)
                      const clientName = visit.lead?.name || visit.lead?.full_name || visit.client_name || 'Cliente'

                      return (
                        <div
                          key={visit.id}
                          className="rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden flex transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2"
                          style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}
                        >
                          <div className="flex flex-col items-center justify-center w-16 shrink-0 bg-muted/30 p-2">
                            <span className="text-xl font-bold tabular-nums leading-none">
                              {format(visitDate, 'd', { locale: pt })}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {format(visitDate, 'MMM', { locale: pt })}
                            </span>
                            <span className="text-xs font-semibold mt-1 tabular-nums">
                              {visit.visit_time?.slice(0, 5)}
                            </span>
                          </div>

                          <div className="flex-1 p-3.5 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{visit.property?.title || 'Imóvel'}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {visit.property?.external_ref && `${visit.property.external_ref} · `}
                                  {visit.property?.city}
                                  {visit.property?.zone ? `, ${visit.property.zone}` : ''}
                                </p>
                              </div>
                              <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', vStatus?.bg, vStatus?.text)}>
                                {vStatus?.label}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                {clientName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {visit.duration_minutes} min
                              </span>
                              {visit.consultant?.commercial_name && (
                                <span className="text-muted-foreground/60">
                                  {visit.consultant.commercial_name}
                                </span>
                              )}
                            </div>

                            {visit.feedback_rating && (
                              <div className="flex items-center gap-1 mt-1.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`h-3 w-3 ${
                                      s <= visit.feedback_rating!
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-muted-foreground/20'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Acompanhamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este acompanhamento? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
