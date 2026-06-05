// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserCheck, Search, X, LayoutGrid, List, ChevronLeft, ChevronRight,
  CalendarDays, Building2, MapPin, Star, Euro, Home, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NEGOCIO_ESTADO_COLORS, VISIT_STATUS_COLORS } from '@/lib/constants'
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

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

export default function AcompanhamentosPage() {
  const router = useRouter()
  const [negocios, setNegocios] = useState<NegocioAcomp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Em Acompanhamento')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
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
      // Filter negocios where tipo includes Compra and estado matches
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
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900 h-32 flex items-center px-8">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-white">Acompanhamentos</h1>
          <p className="text-sm text-neutral-400 mt-1">Negócios de compra em acompanhamento activo</p>
        </div>
      </div>

      {/* Tabs: Acompanhamentos + Visitas */}
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

            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-full bg-muted/30 p-1">
              <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-full transition-colors', viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('table')} className={cn('p-1.5 rounded-full transition-colors', viewMode === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          ) : negocios.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><UserCheck className="h-8 w-8 text-muted-foreground/30" /></div>
              <h3 className="text-lg font-medium">Nenhum acompanhamento encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">Inicie um acompanhamento a partir de um negócio de compra no detalhe do lead.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {negocios.map((n, idx) => {
                const clientName = n.lead?.nome || n.lead?.full_name || '—'
                const initials = clientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                const statusStyle = NEGOCIO_ESTADO_COLORS[n.estado as keyof typeof NEGOCIO_ESTADO_COLORS]
                const budget = n.orcamento ? (n.orcamento_max ? `${(n.orcamento/1000).toFixed(0)}k—${(n.orcamento_max/1000).toFixed(0)}k€` : `até ${(n.orcamento/1000).toFixed(0)}k€`) : '—'

                return (
                  <div
                    key={n.id}
                    onClick={() => navigateToNegocio(n)}
                    className="group rounded-2xl border bg-card/50 backdrop-blur-sm p-5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:bg-card/80 animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}
                  >
                    {/* Top */}
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="text-xs font-bold bg-neutral-100 dark:bg-neutral-800">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{clientName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{n.lead?.agent?.commercial_name || 'Sem consultor'}</p>
                      </div>
                      {statusStyle && (
                        <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', statusStyle.bg, statusStyle.text)}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot} mr-1`} />
                          {statusStyle.label}
                        </Badge>
                      )}
                    </div>

                    {/* Criteria pills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {n.tipo_imovel && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full">
                          <Home className="h-2.5 w-2.5" />{n.tipo_imovel}
                        </span>
                      )}
                      {n.quartos_min && <span className="text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full">T{n.quartos_min}+</span>}
                      {n.localizacao && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />{n.localizacao}
                        </span>
                      )}
                    </div>

                    {/* Budget + Credit */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Euro className="h-3 w-3" />{budget}</span>
                      {n.credito_pre_aprovado && <Badge variant="secondary" className="text-[9px] rounded-full bg-emerald-500/10 text-emerald-600">Pré-aprovado</Badge>}
                      {!n.credito_pre_aprovado && n.financiamento_necessario && <Badge variant="secondary" className="text-[9px] rounded-full bg-amber-500/10 text-amber-600">Financiamento</Badge>}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t text-[11px] text-muted-foreground">
                      <span>{format(new Date(n.created_at), 'd MMM yyyy', { locale: pt })}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                )
              })}
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
