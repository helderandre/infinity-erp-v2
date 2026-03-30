'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LeadFilters } from '@/components/leads/lead-filters'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LeadForm } from '@/components/leads/lead-form'
import {
  Users, Plus, MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight,
  Phone, Mail, Zap, LayoutGrid, List, Download,
} from 'lucide-react'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate } from '@/lib/constants'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { LeadWithAgent } from '@/types/lead'

const PAGE_SIZE = 20

export default function LeadsPage() {
  return (
    <Suspense fallback={<LeadsPageSkeleton />}>
      <LeadsPageContent />
    </Suspense>
  )
}

function LeadsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

const TEMP_DISPLAY: Record<string, { emoji: string; label: string; class: string }> = {
  Quente: { emoji: '🔥', label: 'Quente', class: 'bg-red-500/10 text-red-600' },
  Morno: { emoji: '☀️', label: 'Morna', class: 'bg-amber-500/10 text-amber-600' },
  Frio: { emoji: '❄️', label: 'Fria', class: 'bg-blue-500/10 text-blue-600' },
}

const ESTADO_COLORS: Record<string, string> = {
  'Lead': 'bg-blue-500',
  'Contactado': 'bg-sky-500',
  'Qualificado': 'bg-indigo-500',
  'Potencial Cliente': 'bg-amber-500',
  'Cliente Activo': 'bg-emerald-500',
  '1 Negocio Fechado': 'bg-teal-500',
  'Cliente Recorrente': 'bg-purple-500',
  'Cliente Premium': 'bg-gradient-to-r from-neutral-300 to-neutral-400',
  'Perdido': 'bg-red-500',
  'Inactivo': 'bg-slate-400',
}

const QUALIF_TAGS: { tipo: string; label: string; class: string }[] = [
  { tipo: 'Compra', label: 'QC', class: 'bg-blue-500/10 text-blue-600' },
  { tipo: 'Venda', label: 'QV', class: 'bg-emerald-500/10 text-emerald-600' },
  { tipo: 'Arrendatário', label: 'QA-P', class: 'bg-violet-500/10 text-violet-600' },
  { tipo: 'Arrendador', label: 'QA-A', class: 'bg-amber-500/10 text-amber-600' },
]

function LeadsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [leads, setLeads] = useState<LeadWithAgent[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')

  const [search, setSearch] = useState(searchParams.get('nome') || '')
  const [estado, setEstado] = useState(searchParams.get('estado') || 'all')
  const [temperatura, setTemperatura] = useState(searchParams.get('temperatura') || 'all')
  const [origem, setOrigem] = useState(searchParams.get('origem') || 'all')
  const [agentId, setAgentId] = useState(searchParams.get('agent_id') || 'all')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 0)

  const debouncedSearch = useDebounce(search, 300)

  const hasActiveFilters =
    debouncedSearch !== '' || estado !== 'all' || temperatura !== 'all' || origem !== 'all' || agentId !== 'all'

  const loadLeads = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('nome', debouncedSearch)
      if (estado !== 'all') params.set('estado', estado)
      if (temperatura !== 'all') params.set('temperatura', temperatura)
      if (origem !== 'all') params.set('origem', origem)
      if (agentId !== 'all') params.set('agent_id', agentId)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(page * PAGE_SIZE))

      const res = await fetch(`/api/leads?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLeads(data.data || [])
      setTotal(data.total || 0)
    } catch {
      setLeads([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, estado, temperatura, origem, agentId, page])

  const loadConsultants = useCallback(async () => {
    try {
      const res = await fetch('/api/users/consultants')
      if (res.ok) {
        const data = await res.json()
        setConsultants((data || []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          commercial_name: c.commercial_name as string,
        })))
      }
    } catch {}
  }, [])

  useEffect(() => { loadLeads() }, [loadLeads])
  useEffect(() => { loadConsultants() }, [loadConsultants])
  useEffect(() => { setPage(0) }, [debouncedSearch, estado, temperatura, origem, agentId])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/leads/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Contacto eliminado com sucesso')
      loadLeads()
    } catch {
      toast.error('Erro ao eliminar contacto')
    } finally {
      setDeleteId(null)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setEstado('all')
    setTemperatura('all')
    setOrigem('all')
    setAgentId('all')
    setPage(0)
  }

  const getInitials = (name: string) => name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  const isPremium = (estado: string | null) => estado === 'Cliente Premium'

  const renderEstadoBadge = (estado: string | null) => {
    if (!estado) return null
    if (isPremium(estado)) {
      return (
        <span className="badge-premium inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-600 dark:via-neutral-500 dark:to-neutral-600 text-neutral-700 dark:text-neutral-200 shadow-sm ring-1 ring-neutral-300/50 dark:ring-neutral-500/50">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-neutral-400 to-neutral-500" />
          {estado}
        </span>
      )
    }
    const dotColor = ESTADO_COLORS[estado] || 'bg-slate-400'
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-[10px] font-medium shrink-0">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
        {estado}
      </span>
    )
  }

  const getQualifTags = (lead: any) => {
    const negocios = lead.negocios as { id: string; tipo: string }[] | null
    if (!negocios?.length) return null
    const tipos = new Set(negocios.flatMap((n) => n.tipo === 'Compra e Venda' ? ['Compra', 'Venda'] : [n.tipo]))
    return QUALIF_TAGS.filter((t) => tipos.has(t.tipo))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Contactos</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            {total} contacto{total !== 1 ? 's' : ''} no sistema
          </p>
        </div>
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => setShowNewDialog(true)}
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Novo Contacto</span>
          </Button>
        </div>
      </div>

      {/* Filters + View toggle */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <LeadFilters
            search={search}
            onSearchChange={setSearch}
            estado={estado}
            onEstadoChange={setEstado}
            temperatura={temperatura}
            onTemperaturaChange={setTemperatura}
            origem={origem}
            onOrigemChange={setOrigem}
            consultants={consultants}
            agentId={agentId}
            onAgentChange={setAgentId}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-muted/30 backdrop-blur-sm p-1 shrink-0">
          <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-full transition-colors', viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode('table')} className={cn('p-1.5 rounded-full transition-colors', viewMode === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Nenhum contacto encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {hasActiveFilters ? 'Tente ajustar os critérios de pesquisa.' : 'Comece por criar o seu primeiro contacto.'}
          </p>
          {!hasActiveFilters && (
            <Button size="sm" className="mt-4 rounded-full" onClick={() => setShowNewDialog(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo Contacto
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead, idx) => {
            const name = lead.nome || '—'
            const phone = lead.telemovel || lead.telefone
            const tempInfo = TEMP_DISPLAY[lead.temperatura as string]
            const qualifs = getQualifTags(lead)

            return (
              <div
                key={lead.id}
                onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                className="group rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:bg-card/80 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
              >
                {/* Top: avatar + name + estado */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-neutral-100 dark:bg-neutral-800">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {lead.agent?.commercial_name || 'Sem consultor'}
                    </p>
                  </div>
                  {renderEstadoBadge(lead.estado)}
                </div>

                {/* Contact info pills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {phone && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full">
                      <Phone className="h-2.5 w-2.5" />{phone}
                    </span>
                  )}
                  {lead.email && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                      <Mail className="h-2.5 w-2.5 shrink-0" />{lead.email}
                    </span>
                  )}
                </div>

                {/* Tags row: temperatura + qualifications + origem */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tempInfo && (
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', tempInfo.class)}>
                      {tempInfo.emoji} {tempInfo.label}
                    </span>
                  )}
                  {qualifs?.map((t) => (
                    <span key={t.label} className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', t.class)}>
                      {t.label}
                    </span>
                  ))}
                  {lead.origem && (
                    <span className="inline-flex items-center rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {lead.origem}
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/30">
                  <span>{format(new Date(lead.created_at), 'd MMM yyyy', { locale: pt })}</span>
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-1 rounded-full hover:bg-muted/60 transition-colors">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/leads/${lead.id}`) }}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(lead.id) }}>
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Table view */
        <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Contacto</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Temp.</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Qualif.</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Origem</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Consultor</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const phone = lead.telemovel || lead.telefone
                const tempInfo = TEMP_DISPLAY[lead.temperatura as string]
                const qualifs = getQualifTags(lead)
                return (
                  <tr
                    key={lead.id}
                    className="border-b border-border/20 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{lead.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div className="flex items-center gap-2">
                        {phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
                        {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {renderEstadoBadge(lead.estado)}
                    </td>
                    <td className="px-4 py-3">
                      {tempInfo ? (
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', tempInfo.class)}>
                          {tempInfo.emoji} {tempInfo.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {qualifs?.map((t) => (
                          <span key={t.label} className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold', t.class)}>
                            {t.label}
                          </span>
                        )) || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.origem || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.agent?.commercial_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(lead.created_at)}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 rounded-full hover:bg-muted/60 transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/leads/${lead.id}`) }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(lead.id) }}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-full">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page + 1} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-full">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* New Lead Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo Contacto</DialogTitle>
          </DialogHeader>
          <LeadForm
            consultants={consultants}
            onSuccess={(id) => {
              setShowNewDialog(false)
              router.push(`/dashboard/leads/${id}`)
            }}
            onCancel={() => setShowNewDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este contacto? Esta accao e irreversivel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/leads"
        title="Leads"
      />
    </div>
  )
}
