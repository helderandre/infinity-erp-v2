'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  AlertTriangle, Users, Clock, Inbox, RefreshCw, ArrowRight,
  Loader2, UserX, Shield, Plus, Search, Filter, ChevronLeft, ChevronRight,
  Upload, Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LeadEntryDialog } from '@/components/leads/lead-entry-dialog'
import { BulkImportEntriesDialog } from '@/components/leads/bulk-import-entries-dialog'
import { AssignmentRulesManager } from '@/components/crm/assignment-rules-manager'
import { SlaConfigsManager } from '@/components/crm/sla-configs-manager'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ContactActionButtons } from '@/components/crm/contact-action-buttons'

// ============================================================================
// Types
// ============================================================================

interface AgentMetrics {
  id: string
  name: string
  active_leads: number
  sla: { pending: number; on_time: number; warning: number; breached: number; completed: number }
  active_negocios: number
}

interface OverdueEntry {
  id: string
  contact_id: string
  source: string
  sector: string | null
  priority: string
  status: string
  sla_deadline: string
  sla_status: string
  created_at: string
  assigned_agent_id: string | null
  leads: { nome: string; email: string | null; telemovel: string | null }
}

interface GestoraData {
  agents: AgentMetrics[]
  overdue_entries: OverdueEntry[]
  unassigned_entries: OverdueEntry[]
  summary: {
    total_overdue: number
    total_unassigned: number
    total_new_today: number
    total_agents: number
  }
}

// ============================================================================
// Constants
// ============================================================================

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', website: 'Website',
  landing_page: 'Landing Page', partner: 'Parceiro', organic: 'Orgânico',
  walk_in: 'Walk-in', phone_call: 'Chamada', social_media: 'Redes Sociais', other: 'Outro',
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa',
}

// ============================================================================
// Page
// ============================================================================

export default function GestoraPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GestoraContent />
    </Suspense>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

function GestoraContent() {
  const [data, setData] = useState<GestoraData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const [reassignTarget, setReassignTarget] = useState<string>('')
  const [isReassigning, setIsReassigning] = useState(false)
  const [agentFilter, setAgentFilter] = useState<string>('')
  const [sectorFilter, setSectorFilter] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'distribution' | 'overdue' | 'unassigned'>('distribution')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showRulesDialog, setShowRulesDialog] = useState(false)
  const [showSlaDialog, setShowSlaDialog] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (agentFilter) params.set('agent_id', agentFilter)
      if (sectorFilter) params.set('sector', sectorFilter)
      const url = `/api/crm/gestora/overview?${params}`
      const res = await fetch(url)
      if (res.ok) setData(await res.json())
    } finally {
      setIsLoading(false)
    }
  }, [agentFilter, sectorFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSelectEntry = (entryId: string, checked: boolean) => {
    setSelectedEntries(prev => {
      const next = new Set(prev)
      if (checked) next.add(entryId)
      else next.delete(entryId)
      return next
    })
  }

  const handleSelectAll = (entries: OverdueEntry[], checked: boolean) => {
    setSelectedEntries(prev => {
      const next = new Set(prev)
      entries.forEach(e => checked ? next.add(e.id) : next.delete(e.id))
      return next
    })
  }

  const handleReassign = async () => {
    if (!reassignTarget || selectedEntries.size === 0) return
    setIsReassigning(true)
    try {
      const res = await fetch('/api/crm/gestora/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_ids: Array.from(selectedEntries),
          target_agent_id: reassignTarget,
        }),
      })
      if (!res.ok) throw new Error()
      const { reassigned } = await res.json()
      toast.success(`${reassigned} lead${reassigned > 1 ? 's' : ''} reatribuída${reassigned > 1 ? 's' : ''}`)
      setSelectedEntries(new Set())
      setReassignTarget('')
      fetchData()
    } catch {
      toast.error('Erro ao reatribuir leads')
    } finally {
      setIsReassigning(false)
    }
  }

  const handlePullOverdue = async (agentId: string) => {
    setIsReassigning(true)
    try {
      const res = await fetch('/api/crm/gestora/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, target_agent_id: null }),
      })
      if (!res.ok) throw new Error()
      const { reassigned } = await res.json()
      toast.success(`${reassigned} lead${reassigned > 1 ? 's' : ''} devolvida${reassigned > 1 ? 's' : ''} ao pool`)
      fetchData()
    } catch {
      toast.error('Erro ao devolver leads')
    } finally {
      setIsReassigning(false)
    }
  }

  const summary = data?.summary
  const activeEntries = activeTab === 'overdue' ? data?.overdue_entries : data?.unassigned_entries

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Gestão de Leads</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Monitorize SLAs, reatribua leads e garanta que nenhum contacto fica sem resposta.
          </p>
        </div>
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => setShowNewDialog(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova Lead
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchData}
            disabled={isLoading}
            className="rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
        <div className="absolute bottom-6 right-6 z-20 flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowRulesDialog(true)}
            className="rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20"
          >
            <Target className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Regras de Atribuição</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSlaDialog(true)}
            className="rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20"
          >
            <Clock className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Config. SLA</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Em atraso', value: summary?.total_overdue ?? 0, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' },
          { label: 'Sem atribuição', value: summary?.total_unassigned ?? 0, icon: Inbox, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' },
          { label: 'Novas hoje', value: summary?.total_new_today ?? 0, icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' },
          { label: 'Consultores', value: summary?.total_agents ?? 0, icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 transition-all hover:shadow-sm">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl", bg)}>
                <Icon className={cn("h-5 w-5", color)} />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold truncate">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3 Tabs: Distribuição / Em Atraso / Pool */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm overflow-x-auto scrollbar-none max-w-full">
          <button
            onClick={() => { setActiveTab('distribution'); setSelectedEntries(new Set()) }}
            className={cn(
              'inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors duration-300 shrink-0',
              activeTab === 'distribution'
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Distribuição
          </button>
          <button
            onClick={() => { setActiveTab('overdue'); setSelectedEntries(new Set()) }}
            className={cn(
              'inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors duration-300 shrink-0',
              activeTab === 'overdue'
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Em Atraso
            {(summary?.total_overdue ?? 0) > 0 && (
              <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                {summary?.total_overdue}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('unassigned'); setSelectedEntries(new Set()) }}
            className={cn(
              'inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors duration-300 shrink-0',
              activeTab === 'unassigned'
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <Inbox className="h-3.5 w-3.5" />
            Pool
            {(summary?.total_unassigned ?? 0) > 0 && (
              <span className="ml-1 text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                {summary?.total_unassigned}
              </span>
            )}
          </button>
        </div>

        {activeTab !== 'distribution' && (
          <>
            <Select value={sectorFilter || 'all'} onValueChange={v => setSectorFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[160px] h-8 rounded-full text-xs">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sectores</SelectItem>
                <SelectItem value="real_estate_buy">Compra</SelectItem>
                <SelectItem value="real_estate_sell">Venda</SelectItem>
                <SelectItem value="real_estate_rent">Arrendamento</SelectItem>
                <SelectItem value="recruitment">Recrutamento</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              {(activeEntries?.length ?? 0) > 0 && (
                <Checkbox
                  checked={activeEntries?.every(e => selectedEntries.has(e.id))}
                  onCheckedChange={(checked) => handleSelectAll(activeEntries ?? [], !!checked)}
                />
              )}
              <span className="text-xs text-muted-foreground">Seleccionar tudo</span>
            </div>
          </>
        )}
      </div>

      {/* Tab: Distribuição — Agent Workload */}
      {activeTab === 'distribution' && (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Carga por Consultor
            </h3>
            {agentFilter && (
              <Button variant="ghost" size="sm" className="text-xs rounded-full h-7" onClick={() => setAgentFilter('')}>
                Limpar filtro
              </Button>
            )}
          </div>
          <div className="divide-y">
            {data?.agents.map(agent => {
              const totalSla = agent.sla.warning + agent.sla.breached
              const isFiltered = agentFilter === agent.id
              return (
                <div
                  key={agent.id}
                  className={cn(
                    "flex items-center gap-4 px-5 py-3.5 transition-colors",
                    isFiltered && "bg-primary/5",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{agent.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 dark:bg-muted/30 px-2 py-0.5 rounded-full">
                        {agent.active_leads} leads
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 dark:bg-muted/30 px-2 py-0.5 rounded-full">
                        {agent.active_negocios} negócios
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {agent.sla.breached > 0 && (
                      <Badge variant="destructive" className="text-[9px] rounded-full px-2">
                        {agent.sla.breached} atraso
                      </Badge>
                    )}
                    {agent.sla.warning > 0 && (
                      <Badge variant="outline" className="text-[9px] rounded-full px-2 border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700">
                        {agent.sla.warning} aviso
                      </Badge>
                    )}
                    {totalSla === 0 && (
                      <Badge variant="outline" className="text-[9px] rounded-full px-2 border-green-300 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-400 dark:border-green-700">
                        Em dia
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs rounded-full h-7"
                      onClick={() => { setAgentFilter(isFiltered ? '' : agent.id); setActiveTab('overdue') }}
                    >
                      Ver leads
                    </Button>
                    {totalSla > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-full h-7 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                        onClick={() => handlePullOverdue(agent.id)}
                        disabled={isReassigning}
                      >
                        <UserX className="h-3 w-3 mr-1" />
                        Devolver {totalSla}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            {(!data?.agents || data.agents.length === 0) && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum consultor activo
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Reassignment Bar */}
      {selectedEntries.size > 0 && (
        <div className="sticky bottom-4 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="rounded-2xl border border-primary/30 bg-card shadow-xl p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4">
            <Badge variant="secondary" className="rounded-full text-xs shrink-0">
              {selectedEntries.size} sel.
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
            <Select value={reassignTarget} onValueChange={setReassignTarget}>
              <SelectTrigger className="w-full sm:w-56 rounded-full h-8 text-xs">
                <SelectValue placeholder="Atribuir a..." />
              </SelectTrigger>
              <SelectContent>
                {data?.agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                className="rounded-full flex-1 sm:flex-none"
                onClick={handleReassign}
                disabled={!reassignTarget || isReassigning}
              >
                {isReassigning && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                <span className="sm:hidden">OK</span>
                <span className="hidden sm:inline">Reatribuir</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => setSelectedEntries(new Set())}
              >
                <span className="sm:hidden">✕</span>
                <span className="hidden sm:inline">Cancelar</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Em Atraso / Pool — Entries List */}
      {activeTab === 'distribution' ? null : isLoading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : (activeEntries?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            {activeTab === 'overdue' ? (
              <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
            ) : (
              <Inbox className="h-8 w-8 text-muted-foreground/30" />
            )}
          </div>
          <h3 className="text-lg font-medium">
            {activeTab === 'overdue' ? 'Sem leads em atraso' : 'Pool vazio'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {activeTab === 'overdue'
              ? 'Todos os consultores estão a cumprir os SLAs.'
              : 'Todas as leads estão atribuídas a consultores.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeEntries?.map((entry, idx) => {
            const agent = data?.agents.find(a => a.id === entry.assigned_agent_id)
            const isOverdue = entry.sla_deadline && new Date(entry.sla_deadline) < new Date()
            const isSelected = selectedEntries.has(entry.id)

            return (
              <div
                key={entry.id}
                className={cn(
                  "group rounded-2xl border bg-card/50 backdrop-blur-sm p-4 transition-all hover:shadow-sm animate-in fade-in slide-in-from-bottom-2",
                  isSelected && "bg-primary/5 border-primary/30",
                  entry.sla_status === 'breached' && !isSelected && "border-red-200 dark:border-red-900",
                )}
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectEntry(entry.id, !!checked)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{entry.leads?.nome}</p>
                      <Badge variant="outline" className={cn("text-[9px] rounded-full px-2", PRIORITY_COLORS[entry.priority])}>
                        {PRIORITY_LABELS[entry.priority] ?? entry.priority}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 dark:bg-muted/30 px-2 py-0.5 rounded-full">
                        {SOURCE_LABELS[entry.source] ?? entry.source}
                      </span>
                      {entry.sector && (
                        <span className="inline-flex items-center text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                          {entry.sector.replace('real_estate_', '').replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {entry.leads?.telemovel && (
                        <span className="text-[11px] text-muted-foreground">{entry.leads.telemovel}</span>
                      )}
                      {entry.leads?.email && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{entry.leads.email}</span>
                      )}
                      {agent && (
                        <span className="text-[11px] text-muted-foreground">→ {agent.name}</span>
                      )}
                      {!agent && activeTab === 'unassigned' && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">Sem consultor</span>
                      )}
                    </div>
                  </div>

                  <ContactActionButtons
                    contactId={entry.contact_id}
                    phone={entry.leads?.telemovel}
                    email={entry.leads?.email}
                    name={entry.leads?.nome}
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />

                  <div className="text-right shrink-0">
                    {entry.sla_deadline ? (
                      <Badge
                        variant={entry.sla_status === 'breached' ? 'destructive' : 'outline'}
                        className={cn(
                          "text-[9px] rounded-full px-2",
                          entry.sla_status === 'warning' && 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700'
                        )}
                      >
                        {isOverdue
                          ? `Atraso ${formatDistanceToNow(new Date(entry.sla_deadline), { locale: pt })}`
                          : `${formatDistanceToNow(new Date(entry.sla_deadline), { locale: pt, addSuffix: true })}`
                        }
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] rounded-full px-2">Sem SLA</Badge>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: pt })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Lead Entry Dialog (unified com quick action) */}
      <LeadEntryDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onComplete={() => fetchData()}
      />

      {/* CSV Bulk Import — gestora is the leads (entries) management page,
          so this importer creates leads_entries (+ a contact per row). */}
      <BulkImportEntriesDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onComplete={() => fetchData()}
      />

      {/* Assignment Rules */}
      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Regras de Atribuição
            </DialogTitle>
          </DialogHeader>
          <AssignmentRulesManager />
        </DialogContent>
      </Dialog>

      {/* SLA Configs */}
      <Dialog open={showSlaDialog} onOpenChange={setShowSlaDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Configuração de SLA
            </DialogTitle>
          </DialogHeader>
          <SlaConfigsManager />
        </DialogContent>
      </Dialog>
    </div>
  )
}
