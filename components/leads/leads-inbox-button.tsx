'use client'

/**
 * Leads-to-qualify inbox — a topbar button (next to the voice-assistant mic)
 * that surfaces the consultor's incoming leads still awaiting triage.
 *
 * The button carries a count badge with the number of leads in the "Novo"
 * lifecycle bucket (status `new` + `seen`, mirroring the Leads kanban's first
 * column). Clicking it opens a glassmorphic Sheet listing those leads; each row
 * opens the shared <LeadEntrySheet> for the full detail, and "Qualificar"
 * spawns the opportunity via <QualifyEntryDialog>.
 *
 * Rendered in app/dashboard/layout.tsx on both desktop and mobile. On mobile it
 * replaces the mic button (voice is reachable via the global triple-tap).
 */

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ContactRound, Phone, Mail, Clock, Gift, Loader2, Inbox } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ENTRY_SOURCE_LABELS } from '@/lib/constants-leads-crm'
import { subscribe } from '@/lib/crm/invalidator'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { LeadEntrySheet } from '@/components/leads/lead-entry-sheet'
import { QualifyEntryDialog } from '@/components/crm/qualify-entry-dialog'

// "Novo" bucket = the Leads kanban's first column.
const NOVO_STATUSES = 'new,seen'

interface InboxEntry {
  id: string
  status: string
  source: string
  created_at: string
  has_referral?: boolean
  contact?: { id: string; nome: string | null; telemovel: string | null; email: string | null } | null
  campaign?: { id: string; name: string | null } | null
}

export function LeadsInboxButton() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<InboxEntry[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [qualifyEntry, setQualifyEntry] = useState<any | null>(null)

  // O sheet do topo é para quem trabalha leads PRÓPRIOS: consultores + a
  // Gestora de Leads (que também é consultora). Fica escondido para gestão
  // pura (Broker/CEO, admin, Office Manager, Team Leader, Gestor Processual) —
  // essa vê tudo na página de Leads, não tria aqui. A Gestora de Leads gere o
  // pool por atribuir noutra página; aqui só vê os SEUS leads.
  const { user } = useUser()
  const roleNames = user?.role_names ?? []
  const isGestoraLeads = roleNames.some((r) => r?.toLowerCase() === 'gestora de leads')
  const showInbox = !isManagementRole(roleNames) || isGestoraLeads

  const fetchEntries = useCallback(async () => {
    try {
      // scope=inbox → só os MEUS leads atribuídos. O pool por atribuir não
      // aparece aqui (vive na página da Gestora de Leads).
      const res = await fetch(`/api/lead-entries?status=${NOVO_STATUSES}&scope=inbox&limit=100`)
      const json = await res.json()
      setEntries(Array.isArray(json.data) ? json.data : [])
      setCount(typeof json.total === 'number' ? json.total : (json.data?.length ?? 0))
    } catch {
      // silencioso — o badge fica com o último valor conhecido
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial count + refetch whenever a lead entry changes anywhere in the app
  // (qualify, referral, status move) via the shared CRM invalidator. Skip
  // entirely for management — the button is not rendered for them.
  useEffect(() => {
    if (!showInbox) return
    fetchEntries()
    return subscribe('lead-entries', fetchEntries)
  }, [fetchEntries, showInbox])

  // Refresh the list each time the sheet opens.
  useEffect(() => {
    if (open && showInbox) fetchEntries()
  }, [open, fetchEntries, showInbox])

  // Deep-link: uma push de "nova lead" abre a app em ?openLeads=1 — abrimos o
  // sheet e limpamos o param para não reabrir em refresh/back.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (!showInbox) return
    if (searchParams.get('openLeads') !== '1') return
    setOpen(true)
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.delete('openLeads')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, showInbox, pathname, router])

  // Hidden for pure management (they triage nothing here).
  if (!showInbox) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/70 hover:bg-zinc-900/85 text-white backdrop-blur-md border border-white/10 transition-colors"
        title="Leads por qualificar"
      >
        <ContactRound className="size-4" />
        <span className="sr-only">Leads por qualificar</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[440px] bg-background/85 backdrop-blur-2xl rounded-l-3xl flex flex-col gap-0 p-0"
        >
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2">
              <ContactRound className="h-5 w-5 text-sky-500" />
              Leads por qualificar
              {count > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500/15 px-1.5 text-xs font-bold tabular-nums text-sky-600">
                  {count}
                </span>
              )}
            </SheetTitle>
            <SheetDescription>
              Leads novos à espera de triagem. Qualifica para criar uma oportunidade.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="text-muted-foreground flex items-center gap-2 py-16 justify-center text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> A carregar leads…
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Inbox className="text-muted-foreground/40 h-10 w-10" />
                <p className="text-sm font-medium">Tudo em dia!</p>
                <p className="text-muted-foreground text-xs">
                  Não tens leads por qualificar de momento.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <InboxRow
                    key={e.id}
                    entry={e}
                    onOpen={() => setSelectedEntryId(e.id)}
                    onQualify={() => setQualifyEntry(e)}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Full lead detail — shared with the Oportunidades / Leads kanban pages */}
      <LeadEntrySheet
        entryId={selectedEntryId}
        open={!!selectedEntryId}
        onOpenChange={(o) => !o && setSelectedEntryId(null)}
        onQualify={(entry) => {
          setSelectedEntryId(null)
          setQualifyEntry(entry)
        }}
        onStatusChange={fetchEntries}
      />

      {/* Qualify → creates the opportunity and removes the lead from the inbox */}
      <QualifyEntryDialog
        open={!!qualifyEntry}
        onOpenChange={(o) => !o && setQualifyEntry(null)}
        entry={qualifyEntry}
        onQualified={() => {
          setQualifyEntry(null)
          fetchEntries()
        }}
      />
    </>
  )
}

function InboxRow({
  entry,
  onOpen,
  onQualify,
}: {
  entry: InboxEntry
  onOpen: () => void
  onQualify: () => void
}) {
  const name = entry.contact?.nome ?? 'Sem nome'
  const sourceLabel =
    ENTRY_SOURCE_LABELS[entry.source as keyof typeof ENTRY_SOURCE_LABELS] ?? entry.source
  return (
    <div className="group bg-card relative overflow-hidden rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md">
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-sky-500" />
      <button onClick={onOpen} className="block w-full pl-1.5 text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-1 text-sm font-medium hover:underline">{name}</span>
          {entry.has_referral && <Gift className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
            {sourceLabel}
          </span>
          {entry.campaign?.name && (
            <span className="text-muted-foreground line-clamp-1 text-[10px]">{entry.campaign.name}</span>
          )}
        </div>
        <div className="text-muted-foreground mt-1.5 flex flex-col gap-0.5 text-[11px]">
          {entry.contact?.telemovel && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {entry.contact.telemovel}
            </span>
          )}
          {entry.contact?.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="line-clamp-1">{entry.contact.email}</span>
            </span>
          )}
        </div>
        <div className="text-muted-foreground/70 mt-1 flex items-center gap-1 text-[10px]">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(entry.created_at), { locale: pt, addSuffix: true })}
        </div>
      </button>
      <Button
        size="sm"
        variant="outline"
        className="ml-1.5 mt-2 h-7 text-[11px]"
        onClick={onQualify}
      >
        Qualificar
      </Button>
    </div>
  )
}
