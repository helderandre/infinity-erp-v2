// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Inbox, ChevronRight, Megaphone, Plus, SlidersHorizontal, Send, Undo2,
} from 'lucide-react'
import { LeadEntryDetailView } from '@/components/leads/lead-entry-sheet'
import { LeadEntryDialog } from '@/components/leads/lead-entry-dialog'
import { QualifyEntryDialog } from '@/components/crm/qualify-entry-dialog'
import type { LeadEntry } from '@/types/lead-entry'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'

// A referral row is "active" (still in effect) when it hasn't been
// cancelled / rejected / closed-out. The lead-entries inbox surfaces
// active inbound referrals as a badge so the recipient knows the entry
// came from another consultor — and can bounce it back via "Devolver".
const ACTIVE_REFERRAL_STATUSES = new Set(['pending', 'accepted'])

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  website: 'Website',
  landing_page: 'Landing Page',
  partner: 'Parceiro',
  organic: 'Orgânico',
  walk_in: 'Presencial',
  phone_call: 'Chamada',
  social_media: 'Redes Sociais',
  manual: 'Manual',
  voice: 'Voz',
  other: 'Outro',
}

const STATUS_PRIMARY: { value: string; label: string }[] = [
  { value: 'new',  label: 'Novos' },
  { value: 'seen', label: 'Vistos' },
]

const STATUS_SECONDARY: { value: string; label: string }[] = [
  { value: 'processing', label: 'Em curso' },
  { value: 'converted',  label: 'Convertidos' },
  { value: 'discarded',  label: 'Descartados' },
  { value: 'all',        label: 'Todos' },
]

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  [...STATUS_PRIMARY, ...STATUS_SECONDARY].map((s) => [s.value, s.label]),
)

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',          label: 'Todas as origens' },
  { value: 'meta_ads',     label: 'Meta Ads' },
  { value: 'google_ads',   label: 'Google Ads' },
  { value: 'website',      label: 'Website' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'partner',      label: 'Parceiro' },
  { value: 'organic',      label: 'Orgânico' },
  { value: 'walk_in',      label: 'Presencial' },
  { value: 'phone_call',   label: 'Chamada' },
  { value: 'social_media', label: 'Redes Sociais' },
  { value: 'manual',       label: 'Manual' },
  { value: 'other',        label: 'Outro' },
]

interface MyLeadsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Reserved for future per-consultant filtering — currently unused. */
  consultantId?: string | null
  /**
   * Fired whenever an entry is qualified into a negócio or a brand-new entry
   * is created. The CRM page uses this to silently refresh the kanban so the
   * new card appears immediately.
   */
  onNegocioCreated?: () => void
}

export function MyLeadsSheet({ open, onOpenChange, onNegocioCreated }: MyLeadsSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const [entries, setEntries] = useState<LeadEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('new')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [qualifyEntry, setQualifyEntry] = useState<LeadEntry | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [bouncing, setBouncing] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      const res = await fetch(`/api/lead-entries?${params}`)
      if (res.ok) {
        const json = await res.json()
        setEntries(json.data || [])
        setTotal(json.total || (json.data || []).length)
      }
    } catch {
      setEntries([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, sourceFilter])

  useEffect(() => {
    if (open) {
      setSelectedEntryId(null)
      fetchEntries()
    }
  }, [open, fetchEntries])

  // Bounce-back — recipient returns the referral to the sender. Calls the
  // DELETE handler which reverses the leads_entries assignment + cleans
  // leads.referred_by_consultant_id and marks the audit row 'cancelled'.
  const handleBounceBack = useCallback(async (referralId: string) => {
    if (bouncing) return
    setBouncing(referralId)
    try {
      const res = await fetch(`/api/crm/referrals/${referralId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao devolver a referência')
      toast.success('Referência devolvida ao consultor que enviou')
      fetchEntries()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao devolver a referência')
    } finally {
      setBouncing(null)
    }
  }, [bouncing, fetchEntries])

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col gap-0 overflow-hidden border-border/40 shadow-2xl',
            'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
          )}
        >
          <VisuallyHidden>
            <SheetTitle>Os meus leads</SheetTitle>
          </VisuallyHidden>
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
          )}
          <div className="relative flex-1 flex flex-col min-h-0">
            {selectedEntryId ? (
              <LeadEntryDetailView
                entryId={selectedEntryId}
                isOpen={open}
                onClose={() => onOpenChange(false)}
                onBack={() => setSelectedEntryId(null)}
                onQualify={(e) => setQualifyEntry(e)}
                onStatusChange={fetchEntries}
              />
            ) : (
              <ListView
                loading={loading}
                entries={entries}
                total={total}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                sourceFilter={sourceFilter}
                setSourceFilter={setSourceFilter}
                onSelect={(id) => setSelectedEntryId(id)}
                onCreate={() => setShowNewDialog(true)}
                currentUserId={user?.id ?? null}
                bouncingReferralId={bouncing}
                onBounceBack={handleBounceBack}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <QualifyEntryDialog
        open={!!qualifyEntry}
        onOpenChange={(o) => { if (!o) setQualifyEntry(null) }}
        entry={qualifyEntry}
        onQualified={() => {
          setQualifyEntry(null)
          setSelectedEntryId(null)
          fetchEntries()
          onNegocioCreated?.()
        }}
      />

      <LeadEntryDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onComplete={() => {
          setShowNewDialog(false)
          fetchEntries()
          onNegocioCreated?.()
        }}
        realEstateOnly
      />
    </>
  )
}

function ListView({
  loading,
  entries,
  total,
  statusFilter,
  setStatusFilter,
  sourceFilter,
  setSourceFilter,
  onSelect,
  onCreate,
  currentUserId,
  bouncingReferralId,
  onBounceBack,
}: {
  loading: boolean
  entries: LeadEntry[]
  total: number
  statusFilter: string
  setStatusFilter: (v: string) => void
  sourceFilter: string
  setSourceFilter: (v: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
  currentUserId: string | null
  bouncingReferralId: string | null
  onBounceBack: (referralId: string) => void | Promise<void>
}) {
  return (
    <>
      {/* Header */}
      <div className="px-6 pt-8 pb-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">Leads</p>
            <h2 className="font-semibold text-[22px] leading-tight tracking-tight mt-0.5">
              {loading ? 'A carregar...' : `${total} ${statusFilter === 'new' ? 'por contactar' : 'no total'}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo lead
          </button>
        </div>

        {/* Filter row: Novos / Vistos pills + filter popover (other statuses + source) */}
        <div className="mt-4 flex items-center gap-1.5">
          {STATUS_PRIMARY.map((tab) => {
            const isActive = statusFilter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium transition-colors border',
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background/60 text-foreground/80 border-border/40 hover:bg-muted/60',
                )}
              >
                {tab.label}
              </button>
            )
          })}

          {/* Other-status / source filter popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors border',
                  STATUS_SECONDARY.some((s) => s.value === statusFilter) || sourceFilter !== 'all'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background/60 text-foreground/80 border-border/40 hover:bg-muted/60',
                )}
                aria-label="Filtros"
              >
                <SlidersHorizontal className="h-3 w-3" />
                {STATUS_SECONDARY.some((s) => s.value === statusFilter)
                  ? STATUS_LABELS[statusFilter]
                  : 'Filtros'}
                {(STATUS_SECONDARY.some((s) => s.value === statusFilter) || sourceFilter !== 'all') && (
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3 space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estado</p>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-full rounded-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...STATUS_PRIMARY, ...STATUS_SECONDARY].map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Origem</p>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="h-9 w-full rounded-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(sourceFilter !== 'all' || STATUS_SECONDARY.some((s) => s.value === statusFilter)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSourceFilter('all'); setStatusFilter('new') }}
                  className="rounded-full text-xs w-full h-8 text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </>
        ) : entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">Sem leads {statusFilter !== 'all' ? STATUS_LABELS[statusFilter]?.toLowerCase() : ''}</p>
            <p className="text-xs text-muted-foreground mt-1">Ajusta os filtros ou cria um novo lead.</p>
          </div>
        ) : (
          entries.map((entry: any) => {
            const name = entry.raw_name || entry.contact?.nome || 'Sem nome'
            const phone = entry.raw_phone || entry.contact?.telemovel
            const email = entry.raw_email || entry.contact?.email
            const sourceLabel = SOURCE_LABELS[entry.source] || entry.source
            const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: pt })

            // Active inbound referral (someone referred this entry to me).
            // The embedded query returns every referral for this entry — pick
            // the one that's still active and aimed at the current user.
            const activeReferral = (entry.referrals ?? []).find(
              (r: any) =>
                ACTIVE_REFERRAL_STATUSES.has(r.status) &&
                r.to_consultant_id === currentUserId,
            )
            const referrerName = activeReferral?.referrer?.commercial_name ?? null
            const isBouncing = activeReferral && bouncingReferralId === activeReferral.id

            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(entry.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(entry.id)
                  }
                }}
                className={cn(
                  'w-full text-left rounded-xl border border-border/40 bg-card/60 hover:bg-card hover:shadow-md',
                  'p-3 transition-all flex items-start gap-3 cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  activeReferral && 'border-sky-300/60 dark:border-sky-700/60',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {sourceLabel}
                    </span>
                    {entry.campaign?.name && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground truncate max-w-[160px]">
                        <Megaphone className="h-2.5 w-2.5" />
                        {entry.campaign.name}
                      </span>
                    )}
                    {referrerName && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-[10px] font-medium truncate max-w-[200px]">
                        <Send className="h-2.5 w-2.5" />
                        Referenciado por {referrerName}
                      </span>
                    )}
                  </div>
                  {(phone || email) && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                      {[phone, email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                {activeReferral ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onBounceBack(activeReferral.id)
                    }}
                    disabled={isBouncing}
                    title="Devolver a referência ao consultor que a enviou"
                    className={cn(
                      'shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                      'bg-muted/60 text-foreground/80 hover:bg-muted hover:text-foreground',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                    )}
                  >
                    <Undo2 className="h-3 w-3" />
                    {isBouncing ? 'A devolver…' : 'Devolver'}
                  </button>
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
