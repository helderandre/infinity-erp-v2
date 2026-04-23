'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Inbox, Users, Mail, Phone } from 'lucide-react'
import type { LeadEntry } from '@/types/lead-entry'
import { cn } from '@/lib/utils'

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
  const [entries, setEntries] = useState<LeadEntry[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [entriesRes, leadsRes] = await Promise.all([
          fetch(
            `/api/lead-entries?status=new&consultant_id=${userId}&limit=20`,
          ),
          fetch(`/api/leads?agent_id=${userId}&limit=20`),
        ])
        const entriesJson = entriesRes.ok
          ? await entriesRes.json()
          : { data: [], total: 0 }
        const leadsJson = leadsRes.ok
          ? await leadsRes.json()
          : { data: [], total: 0 }
        if (!cancelled) {
          setEntries(entriesJson.data || [])
          setEntriesTotal(entriesJson.total || 0)
          setLeads(leadsJson.data || [])
          setLeadsTotal(leadsJson.total || 0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <Card
      className={cn(
        'rounded-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] p-4 gap-3',
        fillViewport && 'h-[calc(100dvh-11rem)] min-h-[30rem]',
      )}
    >
      <Tabs defaultValue="entries" className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="entries" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            Por qualificar
            {entriesTotal > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 min-w-4 px-1 text-[10px] tabular-nums rounded-full"
              >
                {entriesTotal}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Contactos
            {leadsTotal > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 min-w-4 px-1 text-[10px] tabular-nums rounded-full"
              >
                {leadsTotal}
              </Badge>
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
              <div className="space-y-1 flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} />
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
          className="mt-3 flex-1 min-h-0 flex flex-col"
        >
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
              <div className="space-y-1 flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
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
    </Card>
  )
}

function EntryRow({ entry }: { entry: LeadEntry }) {
  const name =
    entry.contact?.nome || entry.raw_name || entry.raw_email || 'Novo contacto'
  const subtitle = entry.contact?.email || entry.raw_email || entry.raw_phone
  const source = entry.source.replace(/_/g, ' ')

  return (
    <Link
      href={`/dashboard/leads?entry=${entry.id}`}
      className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/40 transition-colors"
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
    </Link>
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
