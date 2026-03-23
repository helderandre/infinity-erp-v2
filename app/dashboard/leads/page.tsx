'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { LeadFilters } from '@/components/leads/lead-filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Users, Plus, MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate, LEAD_TEMPERATURAS } from '@/lib/constants'
import { toast } from 'sonner'
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
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                {Array.from({ length: 10 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function LeadsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [leads, setLeads] = useState<LeadWithAgent[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)

  // Filtros
  const [search, setSearch] = useState(searchParams.get('nome') || '')
  const [estado, setEstado] = useState(searchParams.get('estado') || 'all')
  const [temperatura, setTemperatura] = useState(searchParams.get('temperatura') || 'all')
  const [origem, setOrigem] = useState(searchParams.get('origem') || 'all')
  const [agentId, setAgentId] = useState(searchParams.get('agent_id') || 'all')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 0)

  const debouncedSearch = useDebounce(search, 300)

  const hasActiveFilters =
    debouncedSearch !== '' ||
    estado !== 'all' ||
    temperatura !== 'all' ||
    origem !== 'all' ||
    agentId !== 'all'

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
      if (!res.ok) throw new Error('Erro ao carregar leads')

      const data = await res.json()
      setLeads(data.data || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Erro ao carregar leads:', error)
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
        setConsultants(
          (data || []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            commercial_name: c.commercial_name as string,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  useEffect(() => {
    loadConsultants()
  }, [loadConsultants])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, estado, temperatura, origem, agentId])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/leads/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar lead')
      toast.success('Lead eliminado com sucesso')
      loadLeads()
    } catch {
      toast.error('Erro ao eliminar lead')
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

  const TEMP_DISPLAY: Record<string, { emoji: string; label: string; class: string }> = {
    Quente: { emoji: '🔥', label: 'Quente', class: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
    Morno: { emoji: '☀️', label: 'Morna', class: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    Frio: { emoji: '❄️', label: 'Fria', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  }

  const ESTADO_COLORS: Record<string, string> = {
    'Novo': 'bg-sky-500',
    'Em contacto': 'bg-yellow-500',
    'Qualificado': 'bg-emerald-500',
    'Em negociação': 'bg-blue-500',
    'Convertido': 'bg-purple-500',
    'Perdido': 'bg-red-500',
    'Arquivado': 'bg-slate-400',
  }

  const getTemperaturaBadge = (temp: string | null) => {
    if (!temp) return '—'
    const info = TEMP_DISPLAY[temp]
    if (!info) return <Badge variant="secondary">{temp}</Badge>
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.class}`}>
        <span>{info.emoji}</span>
        {info.label}
      </span>
    )
  }

  const getEstadoBadge = (estado: string | null) => {
    if (!estado) return '—'
    const dotColor = ESTADO_COLORS[estado] || 'bg-slate-400'
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        {estado}
      </span>
    )
  }

  const QUALIF_TAGS: { tipo: string; label: string; class: string }[] = [
    { tipo: 'Compra', label: 'QC', class: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800' },
    { tipo: 'Venda', label: 'QV', class: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' },
    { tipo: 'Arrendatário', label: 'QA-P', class: 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800' },
    { tipo: 'Arrendador', label: 'QA-A', class: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' },
  ]

  const getQualifTags = (lead: any) => {
    const negocios = lead.negocios as { id: string; tipo: string }[] | null
    if (!negocios?.length) return null
    const tipos = new Set(negocios.flatMap((n) => {
      if (n.tipo === 'Compra e Venda') return ['Compra', 'Venda']
      return [n.tipo]
    }))
    const tags = QUALIF_TAGS.filter((t) => tipos.has(t.tipo))
    if (!tags.length) return null
    return (
      <div className="flex items-center gap-1">
        {tags.map((t) => (
          <span key={t.label} className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${t.class}`}>
            {t.label}
          </span>
        ))}
      </div>
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Gestão de leads e contactos
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lead
        </Button>
      </div>

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

      {isLoading ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telemóvel</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum lead encontrado"
          description={
            hasActiveFilters
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Comece por criar o seu primeiro lead'
          }
          action={
            !hasActiveFilters
              ? {
                  label: 'Novo Lead',
                  onClick: () => setShowNewDialog(true),
                }
              : undefined
          }
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Telemóvel</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Qualificações</TableHead>
                  <TableHead className="text-xs">Temperatura</TableHead>
                  <TableHead className="text-xs">Origem</TableHead>
                  <TableHead className="text-xs">Consultor</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                  >
                    <TableCell className="text-xs font-medium">{lead.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.email || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.telemovel || lead.telefone || '—'}
                    </TableCell>
                    <TableCell>
                      {getEstadoBadge(lead.estado)}
                    </TableCell>
                    <TableCell>{getQualifTags(lead) || '—'}</TableCell>
                    <TableCell>{getTemperaturaBadge(lead.temperatura)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.origem || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.agent?.commercial_name || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(lead.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/dashboard/leads/${lead.id}`)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteId(lead.id)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} lead{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este lead? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
