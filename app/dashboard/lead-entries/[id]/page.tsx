'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Zap, Phone, Mail, ExternalLink, Check, X, Eye,
  UserCheck, Link2, AlertTriangle, Megaphone, Globe, Plus,
  Calendar, Clock, User, FileText, Hash,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { LeadEntry, LeadEntryStatus } from '@/types/lead-entry'

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', website: 'Website',
  landing_page: 'Landing Page', manual: 'Manual', voice: 'Voz',
  partner: 'Parceiro', organic: 'Organico', walk_in: 'Presencial',
  phone_call: 'Chamada', social_media: 'Redes Sociais', other: 'Outro',
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  new:        { label: 'Novo',       dot: 'bg-sky-500',     bg: 'bg-sky-500/10 text-sky-700' },
  seen:       { label: 'Visto',      dot: 'bg-yellow-500',  bg: 'bg-yellow-500/10 text-yellow-700' },
  processing: { label: 'Em Curso',   dot: 'bg-blue-500',    bg: 'bg-blue-500/10 text-blue-700' },
  converted:  { label: 'Convertido', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10 text-emerald-700' },
  discarded:  { label: 'Descartado', dot: 'bg-slate-400',   bg: 'bg-slate-500/10 text-slate-600' },
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default function LeadEntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [entry, setEntry] = useState<LeadEntry | null>(null)
  const [loading, setLoading] = useState(true)

  const loadEntry = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lead-entries/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEntry(data)
    } catch {
      toast.error('Erro ao carregar lead')
      router.push('/dashboard/lead-entries')
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { loadEntry() }, [loadEntry])

  const updateStatus = async (status: LeadEntryStatus) => {
    try {
      const res = await fetch(`/api/lead-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Lead marcado como ${STATUS_CONFIG[status]?.label || status}`)
      if (['seen', 'converted', 'discarded'].includes(status)) {
        router.push('/dashboard/lead-entries')
        return
      }
      loadEntry()
    } catch { toast.error('Erro ao actualizar lead') }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!entry) return null

  const statusInfo = STATUS_CONFIG[entry.status] || STATUS_CONFIG.new
  const isMatch = entry.match_type && entry.match_type !== 'none'
  const contactName = entry.contact?.nome || entry.raw_name || '—'
  const consultantName = entry.contact?.agent?.commercial_name || entry.assigned_consultant?.commercial_name

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-8 sm:px-10">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-1 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors"
            onClick={() => router.push('/dashboard/lead-entries')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-5 w-5 text-blue-400" />
                <p className="text-blue-400 text-xs font-medium tracking-widest uppercase">Lead</p>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{entry.raw_name || '—'}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium', statusInfo.bg)}>
                  <span className={cn('h-2 w-2 rounded-full', statusInfo.dot)} />
                  {statusInfo.label}
                </span>
                <Badge variant="outline" className="text-white/70 border-white/20 text-[11px]">
                  {SOURCE_LABELS[entry.source] || entry.source}
                </Badge>
                {entry.campaign?.name && (
                  <Badge variant="outline" className="text-white/70 border-white/20 text-[11px]">
                    <Megaphone className="h-3 w-3 mr-1" />
                    {entry.campaign.name}
                  </Badge>
                )}
              </div>
            </div>

            <div />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {entry.status === 'new' && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => updateStatus('seen')}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Marcar Visto
          </Button>
        )}
        {['new', 'seen'].includes(entry.status) && (
          <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateStatus('converted')}>
            <Check className="mr-1.5 h-3.5 w-3.5" /> Converter
          </Button>
        )}
        {!['converted', 'discarded'].includes(entry.status) && (
          <Button size="sm" variant="outline" className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => updateStatus('discarded')}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Descartar
          </Button>
        )}
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => router.push(`/dashboard/leads/${entry.contact_id}`)}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver Contacto
        </Button>
      </div>

      {/* Match banner */}
      {isMatch ? (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Link2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Contacto ja existente no sistema
              {entry.match_type === 'both' ? ' — correspondencia por telefone e email' : entry.match_type === 'phone' ? ' — correspondencia por telefone' : ' — correspondencia por email'}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
              Contacto: {contactName}
              {consultantName && ` · Consultor: ${consultantName}`}
            </p>
          </div>
          {entry.match_details?.is_duplicate_conflict && (
            <Badge variant="destructive" className="shrink-0">
              <AlertTriangle className="h-3 w-3 mr-1" /> Conflito
            </Badge>
          )}
          <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={() => router.push(`/dashboard/leads/${entry.contact_id}`)}>
            Ver Contacto
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              Novo contacto criado automaticamente
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
              {contactName}
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={() => router.push(`/dashboard/leads/${entry.contact_id}`)}>
            Ver Contacto
          </Button>
        </div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact info */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Dados do Lead
            </h3>
            <div className="divide-y">
              <InfoRow icon={User} label="Nome" value={entry.raw_name} />
              <InfoRow icon={Mail} label="Email" value={entry.raw_email} />
              <InfoRow icon={Phone} label="Telefone" value={entry.raw_phone} />
            </div>
          </div>

          {/* Notes */}
          {entry.notes && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Notas
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}

          {/* Form data (if from webhook/Meta) */}
          {entry.form_data && Object.keys(entry.form_data).length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Dados do Formulario
              </h3>
              <div className="divide-y">
                {Object.entries(entry.form_data).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 py-2.5">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{key}</p>
                      <p className="text-sm font-medium mt-0.5">{String(value ?? '—')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Meta info */}
        <div className="space-y-6">
          {/* Source & Campaign */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              Origem
            </h3>
            <div className="divide-y">
              <InfoRow icon={Globe} label="Fonte" value={SOURCE_LABELS[entry.source] || entry.source} />
              {entry.campaign && <InfoRow icon={Megaphone} label="Campanha" value={entry.campaign.name} />}
              {entry.form_url && <InfoRow icon={Globe} label="URL do Formulario" value={entry.form_url} />}
            </div>
          </div>

          {/* UTM */}
          {(entry.utm_source || entry.utm_medium || entry.utm_campaign) && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                UTM
              </h3>
              <div className="divide-y">
                <InfoRow icon={Hash} label="Source" value={entry.utm_source} />
                <InfoRow icon={Hash} label="Medium" value={entry.utm_medium} />
                <InfoRow icon={Hash} label="Campaign" value={entry.utm_campaign} />
                <InfoRow icon={Hash} label="Content" value={entry.utm_content} />
                <InfoRow icon={Hash} label="Term" value={entry.utm_term} />
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              Atribuicao
            </h3>
            <div className="divide-y">
              <InfoRow icon={UserCheck} label="Consultor Atribuido" value={entry.assigned_consultant?.commercial_name || 'Nao atribuido'} />
              <InfoRow icon={Calendar} label="Data de Entrada" value={format(new Date(entry.created_at), "d 'de' MMMM yyyy 'as' HH:mm", { locale: pt })} />
              {entry.processed_at && (
                <InfoRow icon={Clock} label="Processado em" value={format(new Date(entry.processed_at), "d 'de' MMMM yyyy 'as' HH:mm", { locale: pt })} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
