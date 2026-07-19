'use client'

/**
 * Sheet lateral que lista as leads de um estado TERMINAL — Qualificadas
 * (status='converted') ou Perdidas (status='discarded') — em cards.
 *
 * Aberto ao clicar no contador "Qualificados"/"Perdidos" do topo da pipeline
 * de Leads (/dashboard/crm/leads). Respeita o mesmo âmbito da vista actual:
 *   • minhas        → leads atribuídas ao consultor (scope default)
 *   • referenciadas → leads que o consultor referenciou (scope=referred)
 *
 * Clicar num card abre o detalhe (<LeadEntrySheet>) por cima.
 */

import { useCallback, useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CheckCircle2, XCircle, MapPin, ChevronRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { LeadEntrySheet } from '@/components/leads/lead-entry-sheet'

export type OutcomeStage = 'qualificado' | 'perdido'

const STAGE_META: Record<
  OutcomeStage,
  { status: string; title: string; Icon: typeof CheckCircle2; accent: string }
> = {
  qualificado: { status: 'converted', title: 'Leads Qualificadas', Icon: CheckCircle2, accent: 'text-emerald-600' },
  perdido: { status: 'discarded', title: 'Leads Perdidas', Icon: XCircle, accent: 'text-red-500' },
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Entry = any

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  stage: OutcomeStage
  scope: 'minhas' | 'referenciadas'
}

export function LeadsOutcomeSheet({ open, onOpenChange, stage, scope }: Props) {
  const isMobile = useIsMobile()
  const meta = STAGE_META[stage]
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: meta.status, limit: '100' })
      if (scope === 'referenciadas') params.set('scope', 'referred')
      const res = await fetch(`/api/lead-entries?${params.toString()}`)
      if (!res.ok) { setEntries([]); return }
      const json = await res.json()
      setEntries(Array.isArray(json?.data) ? json.data : [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [meta.status, scope])

  useEffect(() => {
    if (open) fetchEntries()
  }, [open, fetchEntries])

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 gap-0 bg-background/85 backdrop-blur-2xl',
            isMobile ? 'h-[85dvh] rounded-t-3xl' : 'w-full sm:max-w-[480px] sm:rounded-l-3xl',
          )}
        >
          <SheetHeader className="px-5 py-4 border-b border-border/60">
            <SheetTitle className="flex items-center gap-2 text-base">
              <meta.Icon className={cn('h-4 w-4', meta.accent)} />
              {meta.title}
              {!loading && (
                <span className="ml-1 text-xs font-medium text-muted-foreground tabular-nums">
                  {entries.length}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto px-4 py-4 space-y-2" style={{ maxHeight: isMobile ? '75dvh' : 'calc(100dvh - 64px)' }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <meta.Icon className={cn('h-8 w-8 mb-3 opacity-40', meta.accent)} />
                <p className="text-sm">Sem leads {stage === 'qualificado' ? 'qualificadas' : 'perdidas'}.</p>
              </div>
            ) : (
              entries.map((entry) => {
                const name = entry.contact?.nome || entry.raw_name || 'Lead sem nome'
                const consultant = entry.assigned_consultant
                const propRef = entry.property?.external_ref
                return (
                  <button
                    key={entry.id}
                    onClick={() => setDetailId(entry.id)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                        {entry.source && <span>{SOURCE_LABELS[entry.source] || entry.source}</span>}
                        {entry.campaign?.name && <span className="truncate">· {entry.campaign.name}</span>}
                        {propRef && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" /> {propRef}
                          </span>
                        )}
                        {entry.created_at && (
                          <span>· {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: pt })}</span>
                        )}
                      </div>
                      {scope === 'referenciadas' && consultant && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={consultant.profile?.profile_photo_url ?? undefined} />
                            <AvatarFallback className="text-[8px]">{initials(consultant.commercial_name || '?')}</AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground truncate">{consultant.commercial_name}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
                  </button>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <LeadEntrySheet
        entryId={detailId}
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null) }}
        onQualify={() => {}}
        onStatusChange={fetchEntries}
      />
    </>
  )
}
