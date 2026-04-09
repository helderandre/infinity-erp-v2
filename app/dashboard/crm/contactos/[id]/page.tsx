'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  StickyNote,
  User,
  Building2,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  Globe,
  Link,
  Tag,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ENTRY_SOURCE_LABELS, PIPELINE_TYPE_COLORS, PIPELINE_TYPE_LABELS } from '@/lib/constants-leads-crm'
import { ActivityTimeline } from '@/components/crm/activity-timeline'
import { ContactNegociosList } from '@/components/crm/contact-negocios-list'
import { AddActivityDialog } from '@/components/crm/add-activity-dialog'
import { CallOutcomeDialog } from '@/components/crm/call-outcome-dialog'
import { ObservationsButton } from '@/components/crm/observations-dialog'
import { TemperaturaSelector, type Temperatura } from '@/components/negocios/temperatura-selector'
import type { LeadsContactWithRelations, LeadsEntryWithRelations } from '@/types/leads-crm'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground break-words">{value}</p>
      </div>
    </div>
  )
}

function InfoCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {title}
        </h3>
      </div>
      <div className="px-5 pb-4 divide-y divide-border/40">
        {children}
      </div>
    </div>
  )
}

function ContactSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44 rounded-xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  )
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [contact, setContact] = useState<LeadsContactWithRelations | null>(null)
  const [entries, setEntries] = useState<LeadsEntryWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('resumo')
  const [quickNoteOpen, setQuickNoteOpen] = useState(false)
  const [callOutcomeOpen, setCallOutcomeOpen] = useState(false)
  const [createNegocioOpen, setCreateNegocioOpen] = useState(false)

  // ── Fetch contact ──────────────────────────
  const fetchContact = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/crm/contacts/${id}`)
      if (res.status === 404) {
        toast.error('Contacto não encontrado')
        router.push('/dashboard/crm')
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      // API returns nested joins under different keys — normalise
      // Also map PT column names to their English aliases used in the UI
      setContact({
        ...data,
        // Joins
        lifecycle_stage: data.leads_contact_stages ?? data.lifecycle_stage ?? null,
        consultant: data.dev_users ?? data.consultant ?? null,
        // PT → EN aliases (keep PT names on the object too for the updated InfoRows)
        full_name: data.full_name || data.nome || '',
        phone: data.phone || data.telemovel || null,
        secondary_phone: data.secondary_phone || data.telefone_fixo || null,
        nationality: data.nationality || data.nacionalidade || null,
        date_of_birth: data.date_of_birth || data.data_nascimento || null,
        document_type: data.document_type || data.tipo_documento || null,
        document_number: data.document_number || data.numero_documento || null,
        document_expiry: data.document_expiry || data.data_validade_documento || null,
        document_country: data.document_country || data.pais_emissor || null,
        document_front_url: data.document_front_url || data.documento_identificacao_frente_url || null,
        document_back_url: data.document_back_url || data.documento_identificacao_verso_url || null,
        address: data.address || data.morada || null,
        postal_code: data.postal_code || data.codigo_postal || null,
        city: data.city || data.localidade || null,
        has_company: data.has_company ?? data.tem_empresa ?? false,
        company_name: data.company_name || data.empresa || null,
        company_nipc: data.company_nipc || data.nipc || null,
        company_email: data.company_email || data.email_empresa || null,
        company_phone: data.company_phone || data.telefone_empresa || null,
        company_address: data.company_address || data.morada_empresa || null,
        assigned_consultant_id: data.assigned_consultant_id || data.agent_id || null,
        notes: data.notes || data.observacoes || null,
        tags: data.tags || [],
      })
    } catch {
      toast.error('Erro ao carregar contacto')
    } finally {
      setIsLoading(false)
    }
  }, [id, router])

  // ── Fetch entries (lazy on tab switch) ────
  const fetchEntries = useCallback(async () => {
    if (entriesLoading) return
    setEntriesLoading(true)
    try {
      const res = await fetch(`/api/crm/contacts/${id}/entries`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEntries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data ?? []).map((e: any) => ({
          ...e,
          campaign: e.leads_campaigns ?? e.campaign ?? null,
          partner: e.leads_partners ?? e.partner ?? null,
        }))
      )
    } catch {
      setEntries([])
    } finally {
      setEntriesLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchContact()
  }, [fetchContact])

  useEffect(() => {
    if (activeTab === 'entradas') fetchEntries()
  }, [activeTab, fetchEntries])

  // ── Quick actions ──────────────────────────
  function handleCall() {
    const phone = contact?.telemovel ?? contact?.phone
    if (!phone) return toast.error('Sem número de telefone')
    window.location.href = `tel:${phone}`
    // Open outcome dialog after initiating the call
    setTimeout(() => setCallOutcomeOpen(true), 500)
  }

  function handleWhatsApp() {
    const phone = contact?.telemovel ?? contact?.phone
    if (!phone) return toast.error('Sem número de telefone')
    const digits = phone.replace(/\D/g, '')
    window.open(`https://wa.me/${digits}`, '_blank')
  }

  function handleEmail() {
    if (!contact?.email) return toast.error('Sem email')
    window.location.href = `mailto:${contact.email}`
  }

  // ── Save observações ──────────────────────
  async function handleSaveObservations(next: string | null) {
    const res = await fetch(`/api/crm/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observacoes: next }),
    })
    if (!res.ok) throw new Error('Failed to save observations')
    setContact((prev) => (prev ? { ...prev, observacoes: next, notes: next } : prev))
  }

  async function handleSaveTemperatura(next: Temperatura) {
    try {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperatura: next }),
      })
      if (!res.ok) throw new Error()
      setContact((prev) => (prev ? { ...prev, temperatura: next } : prev))
    } catch {
      toast.error('Erro ao guardar temperatura')
    }
  }

  // ── Initials ──────────────────────────────
  function getInitials(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ContactSkeleton />
      </div>
    )
  }

  if (!contact) return null

  const stageColor = contact.lifecycle_stage?.color ?? '#6b7280'
  const stageName = contact.lifecycle_stage?.name ?? 'Sem etapa'
  const consultantName = contact.consultant?.commercial_name ?? null

  return (
    <div className="space-y-6">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-8 sm:px-10">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-1 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors"
            onClick={() => router.push('/dashboard/crm/contactos')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 shrink-0 border-2 border-white/20">
                <AvatarFallback className="text-lg font-bold bg-white/10 text-white">
                  {getInitials(contact.full_name || contact.nome || '')}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">
                  {contact.full_name || contact.nome}
                </h1>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {stageName === 'Cliente Premium' ? (
                    <span className="badge-premium inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-500 dark:via-neutral-400 dark:to-neutral-500 text-neutral-700 dark:text-neutral-100 shadow-sm ring-1 ring-neutral-300/50 dark:ring-neutral-400/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-neutral-400 to-neutral-500" />
                      {stageName}
                    </span>
                  ) : (
                    <Badge
                      className="rounded-full text-[10px] px-2.5 border-0"
                      style={{ backgroundColor: `${stageColor}30`, color: stageColor }}
                    >
                      {stageName}
                    </Badge>
                  )}
                  <TemperaturaSelector
                    value={(contact.temperatura as Temperatura) || null}
                    onChange={handleSaveTemperatura}
                  />
                  <ObservationsButton
                    observacoes={contact.observacoes ?? contact.notes ?? null}
                    onSave={handleSaveObservations}
                  />
                  {contact.tags?.map((tag) => (
                    <Badge key={tag} className="rounded-full text-[10px] px-2.5 bg-white/10 text-white/80 border-0">
                      {tag}
                    </Badge>
                  ))}
                  {consultantName && (
                    <span className="text-xs text-neutral-400">
                      Consultor: {consultantName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleCall}
                disabled={!(contact.telemovel ?? contact.phone)}
                className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
              >
                <Phone className="mr-1.5 h-3.5 w-3.5" />
                Ligar
              </Button>

              <Button
                size="sm"
                onClick={handleWhatsApp}
                disabled={!(contact.telemovel ?? contact.phone)}
                className="rounded-full bg-emerald-500/20 backdrop-blur-sm text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
              >
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                WhatsApp
              </Button>

          <Button
            size="sm"
            onClick={handleEmail}
            disabled={!contact.email}
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Email
          </Button>

          <Button
            size="sm"
            onClick={() => setQuickNoteOpen(true)}
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
          >
            <StickyNote className="mr-1.5 h-3.5 w-3.5" />
            Nota
          </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm h-auto">
          {[
            { key: 'resumo', label: 'Resumo' },
            { key: 'negocios', label: 'Negocios' },
            { key: 'entradas', label: 'Entradas' },
            { key: 'timeline', label: 'Timeline' },
          ].map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
                'data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50',
                'dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900'
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Tab: Resumo ── */}
        <TabsContent value="resumo" className="mt-4 space-y-4">
          {/* Contact info */}
          <InfoCard title="Informação de Contacto">
            <InfoRow icon={Phone} label="Telefone" value={contact.telemovel ?? contact.phone} />
            <InfoRow icon={Phone} label="Telefone secundário" value={contact.telefone_fixo ?? contact.secondary_phone} />
            <InfoRow icon={Mail} label="Email" value={contact.email} />
            <InfoRow icon={CreditCard} label="NIF" value={contact.nif} />
            <InfoRow icon={Globe} label="Nacionalidade" value={contact.nacionalidade ?? contact.nationality} />
            <InfoRow
              icon={Calendar}
              label="Data de nascimento"
              value={
                (contact.data_nascimento ?? contact.date_of_birth)
                  ? format(parseISO((contact.data_nascimento ?? contact.date_of_birth)!), "d 'de' MMMM yyyy", { locale: pt })
                  : null
              }
            />
            <InfoRow
              icon={MapPin}
              label="Morada"
              value={
                [
                  contact.morada ?? contact.address,
                  contact.codigo_postal ?? contact.postal_code,
                  contact.localidade ?? contact.city,
                ]
                  .filter(Boolean)
                  .join(', ') || null
              }
            />
          </InfoCard>

          {/* Company info */}
          {(contact.tem_empresa ?? contact.has_company) && (
            <InfoCard title="Empresa">
              <InfoRow icon={Building2} label="Nome da empresa" value={contact.empresa ?? contact.company_name} />
              <InfoRow icon={CreditCard} label="NIPC" value={contact.nipc ?? contact.company_nipc} />
              <InfoRow icon={Mail} label="Email empresa" value={contact.email_empresa ?? contact.company_email} />
              <InfoRow icon={Phone} label="Telefone empresa" value={contact.telefone_empresa ?? contact.company_phone} />
              <InfoRow icon={MapPin} label="Morada empresa" value={contact.morada_empresa ?? contact.company_address} />
            </InfoCard>
          )}

          {/* Document info */}
          {((contact.tipo_documento ?? contact.document_type) || (contact.numero_documento ?? contact.document_number)) && (
            <InfoCard title="Identificação">
              <InfoRow icon={FileText} label="Tipo de documento" value={contact.tipo_documento ?? contact.document_type} />
              <InfoRow icon={FileText} label="Número do documento" value={contact.numero_documento ?? contact.document_number} />
              <InfoRow icon={Globe} label="País do documento" value={contact.pais_emissor ?? contact.document_country} />
              <InfoRow
                icon={Calendar}
                label="Validade"
                value={
                  (contact.data_validade_documento ?? contact.document_expiry)
                    ? format(parseISO((contact.data_validade_documento ?? contact.document_expiry)!), "d 'de' MMMM yyyy", { locale: pt })
                    : null
                }
              />
            </InfoCard>
          )}

        </TabsContent>

        {/* ── Tab: Negócios ── */}
        <TabsContent value="negocios" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Negócios
            </h2>
            <Button size="sm" onClick={() => setCreateNegocioOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo negócio
            </Button>
          </div>

          <ContactNegociosList
            contactId={id}
            onCreateClick={() => setCreateNegocioOpen(true)}
          />

          {/* TODO: wire up create negocio dialog when implemented */}
        </TabsContent>

        {/* ── Tab: Entradas ── */}
        <TabsContent value="entradas" className="mt-4">
          {entriesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Link className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">Sem entradas registadas</p>
              <p className="text-xs mt-1">As entradas são criadas automaticamente por webhooks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Timeline ── */}
        <TabsContent value="timeline" className="mt-4">
          <ActivityTimeline contactId={id} />
        </TabsContent>
      </Tabs>

      {/* Quick note dialog */}
      <AddActivityDialog
        contactId={id}
        open={quickNoteOpen}
        onOpenChange={setQuickNoteOpen}
        onSuccess={() => {
          if (activeTab === 'timeline') {
            // Timeline component manages its own refetch on open
          }
        }}
      />

      {/* Call outcome dialog */}
      {contact && (
        <CallOutcomeDialog
          open={callOutcomeOpen}
          onOpenChange={setCallOutcomeOpen}
          contactId={id}
          contactName={contact.full_name || contact.nome || ''}
          phone={contact.telemovel ?? contact.phone ?? ''}
          onCompleted={() => {
            fetchContact()
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Entry card (Entradas tab)
// ─────────────────────────────────────────────

function EntryCard({ entry }: { entry: LeadsEntryWithRelations }) {
  const campaignName = entry.campaign?.name ?? null
  const partnerName = entry.partner?.name ?? null

  const utms = [
    entry.utm_source && `utm_source: ${entry.utm_source}`,
    entry.utm_medium && `utm_medium: ${entry.utm_medium}`,
    entry.utm_campaign && `utm_campaign: ${entry.utm_campaign}`,
    entry.utm_content && `utm_content: ${entry.utm_content}`,
    entry.utm_term && `utm_term: ${entry.utm_term}`,
  ].filter(Boolean)

  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {ENTRY_SOURCE_LABELS[entry.source] ?? entry.source}
            </Badge>
            {campaignName && (
              <span className="text-xs text-muted-foreground">
                Campanha: <span className="font-medium text-foreground">{campaignName}</span>
              </span>
            )}
            {partnerName && (
              <span className="text-xs text-muted-foreground">
                Parceiro: <span className="font-medium text-foreground">{partnerName}</span>
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {format(parseISO(entry.created_at), "d MMM yyyy, HH:mm", { locale: pt })}
          </span>
        </div>

        {entry.form_url && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link className="h-3 w-3 shrink-0" />
            <a
              href={entry.form_url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-foreground hover:underline"
            >
              {entry.form_url}
            </a>
          </div>
        )}

        {utms.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {utms.map((utm) => (
              <span
                key={utm}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {utm}
              </span>
            ))}
          </div>
        )}

        {entry.notes && (
          <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}
