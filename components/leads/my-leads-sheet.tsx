// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Inbox, ChevronRight, Megaphone } from 'lucide-react'
import { LeadEntryDetailView } from '@/components/leads/lead-entry-sheet'
import { QualifyEntryDialog } from '@/components/crm/qualify-entry-dialog'
import type { LeadEntry } from '@/types/lead-entry'

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

interface MyLeadsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Reserved for future per-consultant filtering — currently unused. */
  consultantId?: string | null
}

export function MyLeadsSheet({ open, onOpenChange }: MyLeadsSheetProps) {
  const [entries, setEntries] = useState<LeadEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [qualifyEntry, setQualifyEntry] = useState<LeadEntry | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: 'new',
        limit: '100',
      })
      const res = await fetch(`/api/lead-entries?${params}`)
      if (res.ok) {
        const json = await res.json()
        setEntries(json.data || [])
      }
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setSelectedEntryId(null)
      fetchEntries()
    }
  }, [open, fetchEntries])

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[480px] p-0 flex flex-col gap-0 overflow-hidden">
          <VisuallyHidden>
            <SheetTitle>Os meus leads</SheetTitle>
          </VisuallyHidden>
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
                onSelect={(id) => setSelectedEntryId(id)}
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
        }}
      />
    </>
  )
}

function ListView({
  loading,
  entries,
  onSelect,
}: {
  loading: boolean
  entries: LeadEntry[]
  onSelect: (id: string) => void
}) {
  return (
    <>
      {/* Dark header */}
      <div className="bg-neutral-900 px-6 pt-6 pb-5 shrink-0">
        <p className="text-white/40 text-[10px] font-medium tracking-widest uppercase">Leads por contactar</p>
        <h2 className="text-white font-bold text-xl tracking-tight mt-0.5">
          {loading ? 'A carregar...' : `${entries.length} lead${entries.length === 1 ? '' : 's'} novo${entries.length === 1 ? '' : 's'}`}
        </h2>
        <p className="text-white/50 text-xs mt-1">
          Clica num lead para o contactar e adicionar ao pipeline.
        </p>
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
            <p className="text-sm font-medium">Sem leads novos</p>
            <p className="text-xs text-muted-foreground mt-1">Quando entrarem leads novos atribuídos a ti, aparecem aqui.</p>
          </div>
        ) : (
          entries.map((entry: any) => {
            const name = entry.raw_name || entry.contact?.nome || 'Sem nome'
            const phone = entry.raw_phone || entry.contact?.telemovel
            const email = entry.raw_email || entry.contact?.email
            const sourceLabel = SOURCE_LABELS[entry.source] || entry.source
            const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: pt })
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelect(entry.id)}
                className={cn(
                  'w-full text-left rounded-xl border border-border/40 bg-card/60 hover:bg-card hover:shadow-md',
                  'p-3 transition-all flex items-start gap-3'
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
                  </div>
                  {(phone || email) && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                      {[phone, email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />
              </button>
            )
          })
        )}
      </div>
    </>
  )
}
