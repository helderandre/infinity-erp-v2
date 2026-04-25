'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Inbox, Users, Mail, Phone, Cake } from 'lucide-react'
import type { LeadEntry } from '@/types/lead-entry'
import { cn } from '@/lib/utils'
import { LeadEntrySheet } from '@/components/leads/lead-entry-sheet'
import {
  BirthdaysSheet,
  useUpcomingBirthdays,
  BIRTHDAY_NOTIFY_DAYS,
} from './birthdays-sheet'

interface ContactosCardProps {
  userId: string
  fillViewport?: boolean
}

interface LeadRow {
  id: string
  nome: string
  email: string | null
  telemovel: string | null
  estado: string | null
  temperatura: string | null
}

export function ContactosCard({ userId, fillViewport }: ContactosCardProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<LeadEntry[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [birthdaysOpen, setBirthdaysOpen] = useState(false)

  // Preload birthdays so the card preview has data without waiting for user tap
  const { upcoming: birthdays, loading: birthdaysLoading } =
    useUpcomingBirthdays(userId, true)

  const load = useCallback(async () => {
    try {
      const [entriesRes, leadsRes] = await Promise.all([
        fetch(`/api/lead-entries?status=new&consultant_id=${userId}&limit=20`),
        fetch(`/api/leads?agent_id=${userId}&limit=20`),
      ])
      const entriesJson = entriesRes.ok
        ? await entriesRes.json()
        : { data: [], total: 0 }
      const leadsJson = leadsRes.ok
        ? await leadsRes.json()
        : { data: [], total: 0 }
      setEntries(entriesJson.data || [])
      setEntriesTotal(entriesJson.total || 0)
      setLeads(leadsJson.data || [])
      setLeadsTotal(leadsJson.total || 0)
    } catch {
      // ignore, empty state will render
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  const handleQualify = (entry: LeadEntry) => {
    const contactId = entry.contact?.id || entry.contact_id
    if (contactId) {
      router.push(`/dashboard/leads/${contactId}`)
    } else {
      router.push('/dashboard/leads')
    }
  }

  return (
    <Card
      className={cn(
        'rounded-2xl border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] p-4 gap-3',
        fillViewport && 'h-[calc(100dvh-11rem)] min-h-[30rem]',
      )}
    >
      <Tabs defaultValue="entries" className="flex flex-col flex-1 min-h-0">
        <TabsList className="bg-transparent p-0 h-auto justify-start gap-1.5 rounded-none">
          <TabsTrigger
            value="entries"
            className={cn(
              'gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-background/60 text-foreground/80 border-border/40 hover:bg-muted/60',
              'data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground data-[state=active]:shadow-none',
              '[&[data-state=active]_.count]:bg-white/20 [&[data-state=active]_.count]:text-white',
            )}
          >
            <Inbox className="h-3.5 w-3.5" />
            Por qualificar
            {entriesTotal > 0 && (
              <span className="count ml-1 tabular-nums text-[10px] rounded-full px-1.5 py-0.5 bg-muted/60 text-muted-foreground">
                {entriesTotal}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="leads"
            className={cn(
              'gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-background/60 text-foreground/80 border-border/40 hover:bg-muted/60',
              'data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground data-[state=active]:shadow-none',
              '[&[data-state=active]_.count]:bg-white/20 [&[data-state=active]_.count]:text-white',
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Contactos
            {leadsTotal > 0 && (
              <span className="count ml-1 tabular-nums text-[10px] rounded-full px-1.5 py-0.5 bg-muted/60 text-muted-foreground">
                {leadsTotal}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="entries"
          className="mt-3 flex-1 min-h-0 flex flex-col"
        >
          {loading ? (
            <ListSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Inbox}
              message="Sem leads por qualificar"
              href="/dashboard/leads"
              cta="Abrir inbox de leads"
            />
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 divide-y divide-border/40">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} onOpen={setOpenEntryId} />
                ))}
              </div>
              <FooterLink
                href="/dashboard/leads"
                label={`Ver todos (${entriesTotal})`}
              />
            </>
          )}
        </TabsContent>

        <TabsContent
          value="leads"
          className="mt-3 flex-1 min-h-0 flex flex-col gap-2"
        >
          <BirthdaysPreviewCard
            loading={birthdaysLoading}
            birthdays={birthdays}
            onOpen={() => setBirthdaysOpen(true)}
          />
          {loading ? (
            <ListSkeleton />
          ) : leads.length === 0 ? (
            <EmptyState
              icon={Users}
              message="Sem contactos atribuídos"
              href="/dashboard/leads"
              cta="Abrir contactos"
            />
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 divide-y divide-border/40">
                {leads.map((l) => (
                  <LeadRowItem key={l.id} lead={l} />
                ))}
              </div>
              <FooterLink
                href="/dashboard/leads"
                label={`Ver todos (${leadsTotal})`}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
      <LeadEntrySheet
        entryId={openEntryId}
        open={openEntryId !== null}
        onOpenChange={(o) => !o && setOpenEntryId(null)}
        onQualify={handleQualify}
        onStatusChange={() => void load()}
      />
      <BirthdaysSheet
        userId={userId}
        open={birthdaysOpen}
        onOpenChange={setBirthdaysOpen}
      />
    </Card>
  )
}

function BirthdaysPreviewCard({
  loading,
  birthdays,
  onOpen,
}: {
  loading: boolean
  birthdays: ReturnType<typeof useUpcomingBirthdays>['upcoming']
  onOpen: () => void
}) {
  if (loading) {
    return <Skeleton className="h-[70px] w-full rounded-2xl" />
  }
  const count = birthdays.length
  const next = birthdays[0]
  const isNotify =
    next != null && next.daysUntil <= BIRTHDAY_NOTIFY_DAYS
  const preview =
    next == null
      ? 'Sem aniversários nos próximos dias'
      : next.daysUntil === 0
      ? `${next.nome} faz anos hoje`
      : next.daysUntil === 1
      ? `${next.nome} faz anos amanhã`
      : `${next.nome} · em ${next.daysUntil} dias`

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full text-left flex items-center gap-3 rounded-2xl border p-3 transition-colors',
        isNotify
          ? 'bg-pink-50/40 dark:bg-pink-500/[0.06] border-pink-200/40 dark:border-pink-400/15 hover:bg-pink-50/70 dark:hover:bg-pink-500/10'
          : 'bg-background/60 border-border/40 hover:bg-muted/40',
      )}
    >
      <div
        className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
          isNotify
            ? 'bg-pink-400/80 text-white'
            : 'bg-muted/60 text-muted-foreground',
        )}
      >
        <Cake className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">Aniversários</p>
          {count > 0 && (
            <span
              className={cn(
                'tabular-nums text-[10px] font-semibold rounded-full px-1.5 py-0.5',
                isNotify
                  ? 'bg-pink-400/80 text-white'
                  : 'bg-muted/60 text-muted-foreground',
              )}
            >
              {count}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {preview}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
    </button>
  )
}

function EntryRow({
  entry,
  onOpen,
}: {
  entry: LeadEntry
  onOpen: (id: string) => void
}) {
  const name =
    entry.contact?.nome || entry.raw_name || entry.raw_email || 'Novo contacto'
  const subtitle = entry.contact?.email || entry.raw_email || entry.raw_phone
  const source = entry.source.replace(/_/g, ' ')

  return (
    <button
      type="button"
      onClick={() => onOpen(entry.id)}
      className="w-full text-left flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/40 transition-colors"
    >
      <div className="h-8 w-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
        <Inbox className="h-3.5 w-3.5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground truncate">
            {subtitle}
          </p>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0 capitalize">
        {source}
      </span>
    </button>
  )
}

function LeadRowItem({ lead }: { lead: LeadRow }) {
  const hasContact = lead.email || lead.telemovel
  const ContactIcon = lead.email ? Mail : Phone
  return (
    <Link
      href={`/dashboard/leads/${lead.id}`}
      className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/40 transition-colors"
    >
      <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{lead.nome}</p>
        {hasContact && (
          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
            <ContactIcon className="h-3 w-3 shrink-0" />
            {lead.email || lead.telemovel}
          </p>
        )}
      </div>
      {lead.temperatura && (
        <Badge
          variant="outline"
          className="text-[10px] h-5 px-1.5 shrink-0 capitalize"
        >
          {lead.temperatura}
        </Badge>
      )}
    </Link>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  message,
  href,
  cta,
}: {
  icon: React.ElementType
  message: string
  href: string
  cta: string
}) {
  return (
    <div className="flex flex-col items-center py-8 text-muted-foreground">
      <Icon className="h-8 w-8 mb-2 opacity-40" />
      <p className="text-sm mb-3">{message}</p>
      <Link
        href={href}
        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
      >
        {cta}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </Link>
  )
}
