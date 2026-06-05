'use client'

/**
 * Gestão de Leads — management sheet (replaces the standalone /dashboard/crm/gestora
 * page). Opened from a settings button on the Leads page, gated by the
 * `leads_management` permission.
 *
 * Design mirrors the lead detail sheets (LeadEntrySheet): right/bottom side,
 * translucent blurred background, rounded edge, mobile grabber.
 *
 * Layout:
 *   • Title "Gestão de Leads" centered at the top.
 *   • Top-right: two buttons (Regras / SLA) that each open a smaller nested sheet.
 *   • Three tabs, in order: Por atribuir · Em atraso · Consultor.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Target, Clock, Inbox, AlertTriangle, Users, ChevronLeft,
  Loader2, Phone, Mail, ArrowRight, Eye, Sparkles, Check, X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { AssignmentRulesManager } from '@/components/crm/assignment-rules-manager'
import { SlaConfigsManager } from '@/components/crm/sla-configs-manager'
import {
  GestoraFilters, EMPTY_GESTORA_FILTERS, type GestoraFiltersValue,
} from '@/components/crm/gestora-filters'
import { LeadEntrySheet } from '@/components/leads/lead-entry-sheet'
import { PhaseTabs, type PhaseTab } from '@/components/leads/phase-tabs'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentMetrics {
  id: string
  name: string
  active_leads: number
  sla: { pending: number; on_time: number; warning: number; breached: number; completed: number }
  active_negocios: number
}

interface GestoraEntry {
  id: string
  contact_id: string
  source: string
  sector: string | null
  priority: string
  status: string
  sla_deadline: string | null
  sla_status: string
  created_at: string
  assigned_agent_id?: string | null
  leads: { nome: string; email: string | null; telemovel: string | null }
}

interface GestoraData {
  agents: AgentMetrics[]
  overdue_entries: GestoraEntry[]
  unassigned_entries: GestoraEntry[]
  summary: { total_overdue: number; total_unassigned: number; total_new_today: number; total_agents: number }
}

interface ConsultantOption {
  id: string
  commercial_name: string
  photo: string | null
}

type Tab = 'por_atribuir' | 'overdue' | 'consultor'

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', website: 'Website',
  landing_page: 'Landing Page', partner: 'Parceiro', organic: 'Orgânico',
  walk_in: 'Presencial', phone_call: 'Chamada', social_media: 'Redes Sociais',
  manual: 'Manual', other: 'Outro',
}

// Lead-entry pipeline phases (mirror leads-kanban COLUMNS).
const PHASES: { key: string; label: string; statuses: string[]; color: string; Icon: PhaseTab['Icon'] }[] = [
  { key: 'novo', label: 'Novo', statuses: ['new', 'seen'], color: '#3b82f6', Icon: Sparkles },
  { key: 'contactado', label: 'Contactado', statuses: ['processing'], color: '#f59e0b', Icon: Phone },
  { key: 'qualificado', label: 'Qualificado', statuses: ['converted'], color: '#10b981', Icon: Check },
  { key: 'perdido', label: 'Perdido', statuses: ['discarded'], color: '#ef4444', Icon: X },
]

// ─── Overdue severity ───────────────────────────────────────────────────────

function overdueDays(deadline: string | null): number {
  if (!deadline) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(deadline).getTime()) / 86_400_000))
}

function severity(entry: GestoraEntry): {
  border: string; badge: string; dot: string; label: string
} {
  const days = overdueDays(entry.sla_deadline)
  const breached = entry.sla_status === 'breached'
  const label = entry.sla_deadline
    ? days >= 1
      ? `${days} ${days === 1 ? 'dia' : 'dias'} em atraso`
      : `${formatDistanceToNow(new Date(entry.sla_deadline), { locale: pt })} em atraso`
    : 'Sem SLA'
  if (breached && days >= 7) {
    return { border: 'border-red-300 dark:border-red-800', badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', dot: 'bg-red-600', label }
  }
  if (breached && days >= 3) {
    return { border: 'border-orange-300 dark:border-orange-800', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', dot: 'bg-orange-500', label }
  }
  if (breached) {
    return { border: 'border-amber-300 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', dot: 'bg-amber-500', label }
  }
  return { border: 'border-yellow-200 dark:border-yellow-900', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300', dot: 'bg-yellow-500', label }
}

// ─── Main sheet ─────────────────────────────────────────────────────────────

export function GestaoLeadsSheet({
  open,
  onOpenChange,
  initialTab = 'por_atribuir',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: Tab
}) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [data, setData] = useState<GestoraData | null>(null)
  const [loading, setLoading] = useState(false)
  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  const [rulesOpen, setRulesOpen] = useState(false)
  const [slaOpen, setSlaOpen] = useState(false)
  // Consultant drill-down (Consultor tab).
  const [selectedAgent, setSelectedAgent] = useState<ConsultantOption | null>(null)
  // Filters (reused from the old gestora page — includes the search bar).
  const [filters, setFilters] = useState<GestoraFiltersValue>(EMPTY_GESTORA_FILTERS)
  // Multi-select + bulk (re)assign.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkTarget, setBulkTarget] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  // Lead detail (info) sheet.
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null)

  useEffect(() => { if (open) setTab(initialTab) }, [open, initialTab])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.agentId) params.set('agent_id', filters.agentId)
      if (filters.sector) params.set('sector', filters.sector)
      if (filters.q) params.set('q', filters.q)
      if (filters.source) params.set('source', filters.source)
      if (filters.campaignId) params.set('campaign_id', filters.campaignId)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      if (filters.overdueBucket) params.set('overdue_bucket', filters.overdueBucket)
      const res = await fetch(`/api/crm/gestora/overview?${params}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchConsultants = useCallback(async () => {
    try {
      const res = await fetch('/api/users/consultants')
      if (!res.ok) return
      const rows = await res.json()
      setConsultants(
        (rows || []).map((c: Record<string, any>) => {
          const p = c.dev_consultant_profiles
          const photo = Array.isArray(p) ? p[0]?.profile_photo_url : p?.profile_photo_url
          return { id: c.id, commercial_name: c.commercial_name, photo: photo ?? null }
        }),
      )
    } catch {}
  }, [])

  useEffect(() => {
    if (open) fetchConsultants()
  }, [open, fetchConsultants])

  // Refetch when the sheet opens or filters change.
  useEffect(() => {
    if (open) fetchData()
  }, [open, fetchData])

  // Reset transient UI when the sheet opens.
  useEffect(() => {
    if (open) { setSelectedAgent(null); setSelectedIds(new Set()) }
  }, [open])

  // Clear selection when switching tab/filters (entries shown change).
  useEffect(() => { setSelectedIds(new Set()) }, [tab, filters])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const visibleEntries = tab === 'overdue'
    ? data?.overdue_entries ?? []
    : tab === 'por_atribuir'
      ? data?.unassigned_entries ?? []
      : []

  const allSelected = visibleEntries.length > 0 && visibleEntries.every((e) => selectedIds.has(e.id))
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (visibleEntries.length > 0 && visibleEntries.every((e) => prev.has(e.id))) return new Set()
      return new Set(visibleEntries.map((e) => e.id))
    })
  }, [visibleEntries])

  const bulkReassign = useCallback(async () => {
    if (!bulkTarget || selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/crm/gestora/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_ids: Array.from(selectedIds), target_agent_id: bulkTarget }),
      })
      if (!res.ok) throw new Error()
      const { reassigned } = await res.json().catch(() => ({ reassigned: selectedIds.size }))
      const n = reassigned ?? selectedIds.size
      toast.success(`${n} lead${n === 1 ? '' : 's'} atribuída${n === 1 ? '' : 's'}`)
      setSelectedIds(new Set())
      setBulkTarget('')
      fetchData()
    } catch {
      toast.error('Erro ao atribuir leads')
    } finally {
      setBulkBusy(false)
    }
  }, [bulkTarget, selectedIds, fetchData])

  const agentName = useCallback(
    (id: string | null | undefined) => data?.agents.find((a) => a.id === id)?.name ?? null,
    [data],
  )

  const tabs: { key: Tab; label: string; Icon: typeof Inbox; count: number | null }[] = [
    { key: 'por_atribuir', label: 'Por atribuir', Icon: Inbox, count: data?.summary.total_unassigned ?? null },
    { key: 'overdue', label: 'Em atraso', Icon: AlertTriangle, count: data?.summary.total_overdue ?? null },
    { key: 'consultor', label: 'Consultor', Icon: Users, count: data?.summary.total_agents ?? null },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[560px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Gestão de Leads</SheetTitle>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-10" />
        )}

        {/* Header — config buttons top-right (on their own line, with right
            padding so they clear the close cross), then a centered title. */}
        <div className="relative px-5 pt-5 pb-3 border-b border-border/40">
          <div className="flex items-center justify-end gap-1.5 pr-9">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 hover:bg-muted px-2.5 py-1 text-[11px] font-medium transition-colors"
            >
              <Target className="h-3 w-3" />
              Regras
            </button>
            <button
              type="button"
              onClick={() => setSlaOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 hover:bg-muted px-2.5 py-1 text-[11px] font-medium transition-colors"
            >
              <Clock className="h-3 w-3" />
              SLA
            </button>
          </div>
          <h2 className="mt-3 text-center text-base font-bold tracking-tight">Gestão de Leads</h2>

          {/* Tab pill picker */}
          <div className="mt-3 flex items-center justify-center gap-0.5 px-1 py-0.5 rounded-full bg-muted/50 border border-border/40 w-fit mx-auto">
            {tabs.map(({ key, label, Icon, count }) => {
              const isActive = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setTab(key); setSelectedAgent(null) }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  {count != null && count > 0 && (
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums',
                      isActive ? 'bg-muted text-foreground' : 'bg-foreground/10 text-muted-foreground',
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Search · Filtros · Seleccionar tudo — one line, on the two
            entry-list tabs only. */}
        {(tab === 'por_atribuir' || tab === 'overdue') && (
          <div className="px-4 pt-3 pb-2 border-b border-border/40 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <GestoraFilters
                value={filters}
                onChange={setFilters}
                agents={data?.agents.map((a) => ({ id: a.id, name: a.name })) ?? []}
                showAgent={tab === 'overdue'}
                showOverdueBucket={tab === 'overdue'}
              />
            </div>
            {visibleEntries.length > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer shrink-0 whitespace-nowrap">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                <span className="hidden sm:inline">Seleccionar tudo</span>
                <span className="sm:hidden">Tudo</span>
                <span className="tabular-nums">({visibleEntries.length})</span>
              </label>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : tab === 'por_atribuir' ? (
            <PorAtribuirTab
              entries={data?.unassigned_entries ?? []}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
              onOpenDetail={setDetailEntryId}
            />
          ) : tab === 'overdue' ? (
            <OverdueTab
              entries={data?.overdue_entries ?? []}
              agentName={agentName}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
              onOpenDetail={setDetailEntryId}
            />
          ) : selectedAgent ? (
            <ConsultantDetail
              agent={selectedAgent}
              onBack={() => setSelectedAgent(null)}
            />
          ) : (
            <ConsultantList
              consultants={consultants}
              agents={data?.agents ?? []}
              onSelect={setSelectedAgent}
            />
          )}
        </div>

        {/* Bulk (re)assign bar — sticky footer when something is selected. */}
        {selectedIds.size > 0 && (tab === 'por_atribuir' || tab === 'overdue') && (
          <div className="border-t border-border/40 bg-background/90 backdrop-blur-sm p-3 flex items-center gap-2">
            <span className="text-xs font-medium tabular-nums shrink-0">{selectedIds.size} sel.</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
            <Select value={bulkTarget} onValueChange={setBulkTarget}>
              <SelectTrigger className="h-8 flex-1 rounded-full text-xs">
                <SelectValue placeholder={tab === 'overdue' ? 'Reatribuir a…' : 'Atribuir a…'} />
              </SelectTrigger>
              <SelectContent>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="rounded-full shrink-0" onClick={bulkReassign} disabled={!bulkTarget || bulkBusy}>
              {bulkBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {tab === 'overdue' ? 'Reatribuir' : 'Atribuir'}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full shrink-0" onClick={() => setSelectedIds(new Set())}>
              ✕
            </Button>
          </div>
        )}
      </SheetContent>

      {/* Regras — nested smaller sheet */}
      <Sheet open={rulesOpen} onOpenChange={setRulesOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col gap-0 overflow-hidden border-border/40 shadow-2xl',
            'bg-background/90 supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
          )}
        >
          <SheetTitle className="px-5 pt-6 pb-3 border-b border-border/40 flex items-center gap-2 text-base">
            <Target className="h-4 w-4" /> Regras de Atribuição
          </SheetTitle>
          <div className="flex-1 overflow-y-auto p-4">
            <AssignmentRulesManager />
          </div>
        </SheetContent>
      </Sheet>

      {/* SLA — nested smaller sheet */}
      <Sheet open={slaOpen} onOpenChange={setSlaOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col gap-0 overflow-hidden border-border/40 shadow-2xl',
            'bg-background/90 supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
          )}
        >
          <SheetTitle className="px-5 pt-6 pb-3 border-b border-border/40 flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Configuração de SLA
          </SheetTitle>
          <div className="flex-1 overflow-y-auto p-4">
            <SlaConfigsManager />
          </div>
        </SheetContent>
      </Sheet>

      {/* Lead info — reuses the standard lead detail sheet. */}
      <LeadEntrySheet
        entryId={detailEntryId}
        open={!!detailEntryId}
        onOpenChange={(o) => !o && setDetailEntryId(null)}
        onQualify={() => setDetailEntryId(null)}
        onStatusChange={fetchData}
      />
    </Sheet>
  )
}

// ─── Por atribuir ───────────────────────────────────────────────────────────

function PorAtribuirTab({
  entries, selectedIds, onToggle, onOpenDetail,
}: {
  entries: GestoraEntry[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onOpenDetail: (id: string) => void
}) {
  if (entries.length === 0) {
    return <EmptyState Icon={Inbox} title="Sem leads por atribuir" hint="Todas as leads já têm consultor." />
  }
  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const sel = selectedIds.has(e.id)
        return (
          <label
            key={e.id}
            className={cn(
              'flex items-start gap-3 rounded-2xl border bg-card/50 backdrop-blur-sm p-3 cursor-pointer transition-colors',
              sel && 'border-primary/40 bg-primary/5',
            )}
          >
            <Checkbox checked={sel} onCheckedChange={() => onToggle(e.id)} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium truncate">{e.leads?.nome || 'Sem nome'}</p>
                <span className="inline-flex items-center text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full shrink-0">
                  {SOURCE_LABELS[e.source] ?? e.source}
                </span>
              </div>
              <ContactLine entry={e} />
            </div>
            <InfoButton onClick={() => onOpenDetail(e.id)} />
          </label>
        )
      })}
    </div>
  )
}

// ─── Em atraso ──────────────────────────────────────────────────────────────

function OverdueTab({
  entries, agentName, selectedIds, onToggle, onOpenDetail,
}: {
  entries: GestoraEntry[]
  agentName: (id: string | null | undefined) => string | null
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onOpenDetail: (id: string) => void
}) {
  if (entries.length === 0) {
    return <EmptyState Icon={AlertTriangle} title="Sem leads em atraso" hint="Todos os consultores estão a cumprir os SLAs." />
  }
  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const sev = severity(e)
        const current = agentName(e.assigned_agent_id)
        const sel = selectedIds.has(e.id)
        return (
          <label
            key={e.id}
            className={cn(
              'flex items-start gap-3 rounded-2xl border bg-card/50 backdrop-blur-sm p-3 cursor-pointer transition-colors',
              sev.border,
              sel && 'ring-1 ring-primary/40',
            )}
          >
            <Checkbox checked={sel} onCheckedChange={() => onToggle(e.id)} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium truncate">{e.leads?.nome || 'Sem nome'}</p>
                <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0', sev.badge)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', sev.dot)} />
                  {sev.label}
                </span>
              </div>
              <ContactLine entry={e} />
              {current && <p className="text-[11px] text-muted-foreground mt-0.5">Atribuída a {current}</p>}
            </div>
            <InfoButton onClick={() => onOpenDetail(e.id)} />
          </label>
        )
      })}
    </div>
  )
}

// Eye button to open the lead detail — stops the wrapping <label> from
// toggling the row's checkbox when clicked.
function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onClick() }}
      className="mt-0.5 shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      aria-label="Ver informação do lead"
      title="Ver informação do lead"
    >
      <Eye className="h-4 w-4" />
    </button>
  )
}

// ─── Consultor list ─────────────────────────────────────────────────────────

function ConsultantList({
  consultants, agents, onSelect,
}: {
  consultants: ConsultantOption[]
  agents: AgentMetrics[]
  onSelect: (c: ConsultantOption) => void
}) {
  const countById = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of agents) m[a.id] = a.active_leads
    return m
  }, [agents])
  // Leads em atraso por consultor = SLA warning + breached.
  const overdueById = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of agents) m[a.id] = (a.sla?.warning ?? 0) + (a.sla?.breached ?? 0)
    return m
  }, [agents])

  // Only show consultants that are part of the active-agents workload set,
  // sorted alphabetically (the API already returns them alphabetical).
  const list = consultants.filter((c) => agents.some((a) => a.id === c.id))

  if (list.length === 0) {
    return <EmptyState Icon={Users} title="Nenhum consultor activo" hint="" />
  }
  return (
    <div className="space-y-1.5">
      {list.map((c) => {
        const overdue = overdueById[c.id] ?? 0
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            className="w-full flex items-center gap-3 rounded-2xl border bg-card/50 backdrop-blur-sm p-3 text-left transition-colors hover:bg-muted/40"
          >
            <Avatar className="h-9 w-9 shrink-0">
              {c.photo && <AvatarImage src={c.photo} alt={c.commercial_name} />}
              <AvatarFallback className="text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800">
                {c.commercial_name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 min-w-0 text-sm font-medium truncate">{c.commercial_name}</span>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-muted/60 px-2 py-0.5 rounded-full">
                {countById[c.id] ?? 0} leads
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                overdue > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'bg-muted/60 text-muted-foreground',
              )}>
                {overdue > 0 && <AlertTriangle className="h-2.5 w-2.5" />}
                {overdue} em atraso
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Consultor detail (drill-down) ──────────────────────────────────────────

interface DetailEntry {
  id: string
  status: string
  sla_status: string
  sla_deadline: string | null
  first_contact_at: string | null
  created_at: string
  source: string
  contact?: { nome: string | null; email: string | null; telemovel: string | null } | null
}

function ConsultantDetail({
  agent, onBack,
}: {
  agent: ConsultantOption
  onBack: () => void
}) {
  const [entries, setEntries] = useState<DetailEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/lead-entries?consultant_id=${agent.id}&status=new,seen,processing,converted,discarded&limit=300`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => { if (!cancelled) setEntries(Array.isArray(j.data) ? j.data : []) })
      .catch(() => { if (!cancelled) setEntries([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [agent.id])

  // First tab = "Em atraso" (cross-cutting), followed by the pipeline phases.
  const [detailTab, setDetailTab] = useState<string>('em_atraso')

  const overdue = useMemo(
    () => entries.filter((e) => ['warning', 'breached'].includes(e.sla_status) && !e.first_contact_at),
    [entries],
  )
  const byPhase = useMemo(() => {
    const map: Record<string, DetailEntry[]> = {}
    for (const ph of PHASES) map[ph.key] = []
    for (const e of entries) {
      const ph = PHASES.find((p) => p.statuses.includes(e.status))
      if (ph) map[ph.key].push(e)
    }
    return map
  }, [entries])

  const detailTabs = useMemo(() => [
    { key: 'em_atraso', label: 'Em atraso', color: '#ef4444', Icon: AlertTriangle, items: overdue },
    ...PHASES.map((ph) => ({ key: ph.key, label: ph.label, color: ph.color, Icon: ph.Icon, items: byPhase[ph.key] ?? [] })),
  ], [overdue, byPhase])

  const active = detailTabs.find((t) => t.key === detailTab) ?? detailTabs[0]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full bg-muted/60 hover:bg-muted px-2.5 py-1 text-[11px] font-medium transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <Avatar className="h-8 w-8 shrink-0">
          {agent.photo && <AvatarImage src={agent.photo} alt={agent.commercial_name} />}
          <AvatarFallback className="text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800">
            {agent.commercial_name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="text-sm font-semibold truncate">{agent.commercial_name}</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Phase tabs — only the active tab shows its label; others are
              icon-only until selected. Only the active tab's leads render. */}
          <PhaseTabs
            className="-mx-1 px-1 pb-0.5"
            active={active.key}
            onChange={setDetailTab}
            tabs={detailTabs.map((t) => ({ key: t.key, label: t.label, color: t.color, Icon: t.Icon, count: t.items.length }))}
          />

          {/* Active tab's leads */}
          {active.items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 italic py-6 text-center">Sem leads em &laquo;{active.label}&raquo;</p>
          ) : active.key === 'em_atraso' ? (
            <div className="space-y-1.5">
              {active.items.map((e) => {
                const sev = severity(e as unknown as GestoraEntry)
                return (
                  <div key={e.id} className={cn('rounded-xl border bg-card/50 p-2.5 flex items-center justify-between gap-2', sev.border)}>
                    <span className="text-xs font-medium truncate">{e.contact?.nome || 'Sem nome'}</span>
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0', sev.badge)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', sev.dot)} />
                      {sev.label}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              {active.items.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl border bg-card/50 p-2.5"
                  style={{ boxShadow: `inset 3px 0 0 0 ${active.color}` }}
                >
                  <p className="text-xs font-medium truncate">{e.contact?.nome || 'Sem nome'}</p>
                  <DetailContactLine entry={e} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Small bits ─────────────────────────────────────────────────────────────

function ContactLine({ entry }: { entry: GestoraEntry }) {
  return (
    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
      {entry.leads?.telemovel && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{entry.leads.telemovel}</span>}
      {entry.leads?.email && <span className="inline-flex items-center gap-1 truncate max-w-[180px]"><Mail className="h-3 w-3 shrink-0" />{entry.leads.email}</span>}
    </div>
  )
}

function DetailContactLine({ entry }: { entry: DetailEntry }) {
  return (
    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
      {entry.contact?.telemovel && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{entry.contact.telemovel}</span>}
      {entry.contact?.email && <span className="inline-flex items-center gap-1 truncate max-w-[180px]"><Mail className="h-3 w-3 shrink-0" />{entry.contact.email}</span>}
    </div>
  )
}

function EmptyState({ Icon, title, hint }: { Icon: typeof Inbox; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="h-7 w-7 text-muted-foreground/30" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>}
    </div>
  )
}
