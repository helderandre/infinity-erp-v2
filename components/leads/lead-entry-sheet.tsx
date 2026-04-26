// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Phone, Mail, MessageSquare, ArrowRight, X,
  Megaphone, Calendar, User, FileText, Hash,
  History, Sparkles, Copy, Check, ShoppingCart, Store, Key, Building2,
  Handshake, Percent, UserCheck,
} from 'lucide-react'

// Inline WhatsApp brand glyph (Lucide doesn't ship one)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { LeadEntry } from '@/types/lead-entry'
import { CallOutcomeModal } from '@/components/crm/call-outcome-modal'
import { PropertyDetailSheet } from '@/components/properties/property-detail-sheet'
import { useIsMobile } from '@/hooks/use-mobile'

const SOURCE_CONFIG: Record<string, { label: string; class: string }> = {
  meta_ads:     { label: 'Meta Ads',      class: 'bg-blue-500/10 text-blue-600' },
  google_ads:   { label: 'Google Ads',    class: 'bg-red-500/10 text-red-600' },
  website:      { label: 'Website',       class: 'bg-emerald-500/10 text-emerald-600' },
  landing_page: { label: 'Landing Page',  class: 'bg-indigo-500/10 text-indigo-600' },
  partner:      { label: 'Parceiro',      class: 'bg-amber-500/10 text-amber-600' },
  organic:      { label: 'Orgânico',      class: 'bg-green-500/10 text-green-600' },
  walk_in:      { label: 'Presencial',    class: 'bg-orange-500/10 text-orange-600' },
  phone_call:   { label: 'Chamada',       class: 'bg-cyan-500/10 text-cyan-600' },
  social_media: { label: 'Redes Sociais', class: 'bg-pink-500/10 text-pink-600' },
  manual:       { label: 'Manual',        class: 'bg-gray-500/10 text-gray-600' },
  voice:        { label: 'Voz',           class: 'bg-purple-500/10 text-purple-600' },
  other:        { label: 'Outro',         class: 'bg-gray-500/10 text-gray-600' },
}

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  new:        { label: 'Novo',       dot: 'bg-sky-500' },
  seen:       { label: 'Visto',      dot: 'bg-yellow-500' },
  processing: { label: 'Em Curso',   dot: 'bg-blue-500' },
  converted:  { label: 'Convertido', dot: 'bg-emerald-500' },
  discarded:  { label: 'Descartado', dot: 'bg-slate-400' },
}

const SECTOR_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  real_estate_buy:      { label: 'Comprador',    icon: ShoppingCart },
  real_estate_sell:     { label: 'Vendedor',     icon: Store },
  real_estate_rent:     { label: 'Arrendatário', icon: Key },
  real_estate_landlord: { label: 'Senhorio',   icon: Building2 },
}

interface LeadEntrySheetProps {
  entryId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onQualify: (entry: LeadEntry) => void
  onStatusChange: () => void
}

export function LeadEntrySheet({ entryId, open, onOpenChange, onQualify, onStatusChange }: LeadEntrySheetProps) {
  const isMobile = useIsMobile()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Detalhe do Lead</SheetTitle>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-10" />
        )}
        <LeadEntryDetailView
          entryId={entryId}
          isOpen={open}
          onClose={() => onOpenChange(false)}
          onQualify={onQualify}
          onStatusChange={onStatusChange}
        />
      </SheetContent>
    </Sheet>
  )
}

interface LeadEntryDetailViewProps {
  entryId: string | null
  isOpen: boolean
  onClose: () => void
  onQualify: (entry: LeadEntry) => void
  onStatusChange: () => void
  /** Optional back button rendered above the dark header (for embedded usage) */
  onBack?: () => void
}

export function LeadEntryDetailView({ entryId, isOpen, onClose, onQualify, onStatusChange, onBack }: LeadEntryDetailViewProps) {
  const [entry, setEntry] = useState<LeadEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [contactHistory, setContactHistory] = useState<any[] | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [contactMethod, setContactMethod] = useState<'phone' | 'email' | 'whatsapp'>('phone')
  const [propertySheetId, setPropertySheetId] = useState<string | null>(null)

  const triggerContact = useCallback((method: 'phone' | 'email' | 'whatsapp', value: string) => {
    setContactMethod(method)
    if (method === 'phone') {
      window.open(`tel:${value}`, '_self')
    } else if (method === 'email') {
      window.open(`mailto:${value}`, '_self')
    } else if (method === 'whatsapp') {
      const cleaned = value.replace(/[^0-9+]/g, '')
      window.open(`https://wa.me/${cleaned}`, '_blank')
    }
    setTimeout(() => setOutcomeOpen(true), 500)
  }, [])

  const loadEntry = useCallback(async () => {
    if (!entryId) return
    setLoading(true)
    setContactHistory(null)
    try {
      const res = await fetch(`/api/lead-entries/${entryId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEntry(data)

      const contactId = data.contact?.id || data.contact_id
      if (contactId) {
        const histRes = await fetch(`/api/lead-entries?contact_id=${contactId}&limit=50`)
        if (histRes.ok) {
          const histData = await histRes.json()
          const others = (histData.data || []).filter((e: any) => e.id !== entryId)
          setContactHistory(others.length > 0 ? others : null)
        }
      }
    } catch {
      toast.error('Erro ao carregar lead')
    } finally { setLoading(false) }
  }, [entryId])

  useEffect(() => {
    if (isOpen && entryId) loadEntry()
    if (!isOpen) { setEntry(null); setContactHistory(null) }
  }, [isOpen, entryId, loadEntry])

  const updateStatus = async (status: string) => {
    if (!entryId) return
    try {
      const res = await fetch(`/api/lead-entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Lead marcado como ${STATUS_CONFIG[status]?.label || status}`)
      onStatusChange()
      if (status === 'discarded') onClose()
      else loadEntry()
    } catch { toast.error('Erro ao actualizar lead') }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success(`${label} copiado`)
    setTimeout(() => setCopied(null), 2000)
  }

  const phone = entry?.raw_phone || entry?.contact?.telemovel
  const email = entry?.raw_email || entry?.contact?.email
  const name = entry?.raw_name || entry?.contact?.nome || '—'
  const srcInfo = entry ? SOURCE_CONFIG[entry.source] || SOURCE_CONFIG.other : null
  const statusInfo = entry ? STATUS_CONFIG[entry.status] || STATUS_CONFIG.new : null
  const consultant = entry?.assigned_consultant?.commercial_name || entry?.contact?.agent?.commercial_name
  const timeAgo = entry ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: pt }) : ''
  const isActionable = entry && !['converted', 'discarded'].includes(entry.status)
  const sectorInfo = entry?.sector ? SECTOR_LABELS[entry.sector] : null

  return (
    <>
      {loading ? (
        <div className="p-6 space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : !entry ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Lead não encontrado
        </div>
      ) : (
        <>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur-md border border-border/40 px-3 py-1 text-[11px] font-medium hover:bg-background transition-colors"
            >
              ← Voltar
            </button>
          )}
          <div className="px-6 pt-8 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">Lead</p>
                  <h2 className="font-semibold text-[22px] leading-tight tracking-tight truncate mt-0.5">{name}</h2>
                </div>
                {statusInfo && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shrink-0">
                    <span className={cn('h-1.5 w-1.5 rounded-full', statusInfo.dot)} />
                    {statusInfo.label}
                  </span>
                )}
              </div>

              {/* Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {sectorInfo && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold">
                    <sectorInfo.icon className="h-3 w-3" />
                    {sectorInfo.label}
                  </span>
                )}
                {srcInfo && (
                  <span className="inline-flex items-center rounded-full bg-muted/60 border border-border/40 text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
                    {srcInfo.label}
                  </span>
                )}
                {entry.campaign?.name && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border/40 text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
                    <Megaphone className="h-2.5 w-2.5" />
                    {entry.campaign.name}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/60">{timeAgo}</span>
              </div>
            </div>

            {/* ─── Quick actions (icon-only, shadowed pills, centered) ─── */}
            <div className="px-6 py-4 border-b border-border/40">
              <div className="flex items-center justify-center gap-3">
                <TooltipProvider delayDuration={200}>
                  {phone && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => triggerContact('phone', phone)}
                            aria-label="Ligar"
                            className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-background border border-border/40 shadow-sm hover:shadow-md hover:bg-muted/50 transition-all"
                          >
                            <Phone className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Ligar — {phone}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => triggerContact('whatsapp', phone)}
                            aria-label="WhatsApp"
                            className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-background border border-border/40 shadow-sm hover:shadow-md hover:bg-muted/50 transition-all"
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Abrir no WhatsApp</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`sms:${phone}`}
                            aria-label="SMS"
                            className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-background border border-border/40 shadow-sm hover:shadow-md hover:bg-muted/50 transition-all"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>Enviar SMS</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  {email && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => triggerContact('email', email)}
                          aria-label="Email"
                          className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-background border border-border/40 shadow-sm hover:shadow-md hover:bg-muted/50 transition-all"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Email — {email}</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            </div>

            {/* ─── Scrollable content ─── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Contact history */}
              {contactHistory && contactHistory.length > 0 && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Apareceu {contactHistory.length + 1}x no sistema
                    </p>
                  </div>
                  <div className="space-y-1 ml-5">
                    {contactHistory.map((h: any) => {
                      const hSrc = SOURCE_CONFIG[h.source] || SOURCE_CONFIG.other
                      return (
                        <div key={h.id} className="flex items-center gap-1.5">
                          <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium', hSrc.class)}>
                            {hSrc.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(h.created_at), 'MMM yyyy', { locale: pt })}</span>
                          {h.status === 'discarded' && <span className="text-[10px] text-slate-400 italic">descartado</span>}
                          {h.status === 'converted' && <span className="text-[10px] text-emerald-500 italic">convertido</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Message */}
              {entry.notes && (
                <div className="rounded-xl border bg-card/50 p-4">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Mensagem</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{entry.notes}</p>
                </div>
              )}

              {/* Contact details table */}
              <div className="rounded-xl border overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Dados do contacto</p>
                </div>
                <div className="divide-y divide-border/50">
                  {phone && (
                    <div className="flex items-center justify-between px-4 py-3 group">
                      <div className="flex items-center gap-3">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Telefone</p>
                          <p className="text-sm font-medium">{phone}</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(phone, 'Telefone') }} className="p-1.5 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                        {copied === 'Telefone' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </div>
                  )}
                  {email && (
                    <div className="flex items-center justify-between px-4 py-3 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground">Email</p>
                          <p className="text-sm font-medium truncate">{email}</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(email, 'Email') }} className="p-1.5 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                        {copied === 'Email' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </div>
                  )}
                  {sectorInfo && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <sectorInfo.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Tipo de lead</p>
                        <p className="text-sm font-medium">{sectorInfo.label}</p>
                      </div>
                    </div>
                  )}
                  {consultant && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Consultor atribuído</p>
                        <p className="text-sm font-medium">{consultant}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Data de entrada</p>
                      <p className="text-sm font-medium">{format(new Date(entry.created_at), "d MMM yyyy · HH:mm", { locale: pt })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Referral info table */}
              {entry.has_referral && (
                <div className="rounded-xl border overflow-hidden">
                  <div className="px-4 py-2.5 border-b bg-muted/20">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Referenciação</p>
                  </div>
                  <div className="divide-y divide-border/50">
                    {entry.referral_pct && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Percent className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Percentagem</p>
                          <p className="text-sm font-medium">{entry.referral_pct}%</p>
                        </div>
                      </div>
                    )}
                    {entry.referral_consultant_id && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Referenciado por (interno)</p>
                          <p className="text-sm font-medium">{entry.referral_consultant?.commercial_name || entry.referral_consultant_id}</p>
                        </div>
                      </div>
                    )}
                    {entry.referral_external_name && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Handshake className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Referenciado por (externo)</p>
                          <p className="text-sm font-medium">{entry.referral_external_name}</p>
                          {entry.referral_external_agency && <p className="text-xs text-muted-foreground">{entry.referral_external_agency}</p>}
                        </div>
                      </div>
                    )}
                    {(entry.referral_external_phone || entry.referral_external_email) && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Contacto referenciador</p>
                          <p className="text-sm font-medium">
                            {[entry.referral_external_phone, entry.referral_external_email].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Form data */}
              {entry.form_data && Object.keys(entry.form_data).length > 0 && (() => {
                // Consolidamos property_id/property_slug numa linha única
                // "Imóvel" com link para a sheet do imóvel — escondemos os
                // campos brutos para não duplicar informação.
                const propertyId = typeof entry.form_data.property_id === 'string' ? entry.form_data.property_id : null
                const propertySlug = typeof entry.form_data.property_slug === 'string' ? entry.form_data.property_slug : null
                const propertyTitle = typeof entry.form_data.property_title === 'string' ? entry.form_data.property_title : null
                const propertyExternalRef = typeof entry.form_data.property_external_ref === 'string' ? entry.form_data.property_external_ref : null
                const HIDDEN_KEYS = new Set(['property_id', 'property_slug'])
                const visibleEntries = Object.entries(entry.form_data).filter(([k]) => !HIDDEN_KEYS.has(k))
                if (!propertyId && visibleEntries.length === 0) return null
                return (
                  <div className="rounded-xl border overflow-hidden">
                    <div className="px-4 py-2.5 border-b bg-muted/20">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Dados do formulário</p>
                    </div>
                    <div className="divide-y divide-border/50">
                      {propertyId && (
                        <button
                          type="button"
                          onClick={() => setPropertySheetId(propertyId)}
                          className="w-full text-left flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group focus-visible:outline-none focus-visible:bg-muted/30"
                        >
                          <span className="text-[10px] text-muted-foreground uppercase shrink-0">Imóvel</span>
                          <span className="flex items-center gap-1.5 text-xs font-medium text-primary text-right truncate">
                            <span className="truncate">{propertyTitle || propertySlug || propertyExternalRef || propertyId}</span>
                            <svg className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </span>
                        </button>
                      )}
                      {visibleEntries.map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-[10px] text-muted-foreground uppercase">{key}</span>
                          <span className="text-xs font-medium text-foreground/80">{String(value ?? '—')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* UTM */}
              {(entry.utm_source || entry.utm_medium || entry.utm_campaign) && (
                <div className="rounded-xl border overflow-hidden">
                  <div className="px-4 py-2.5 border-b bg-muted/20">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">UTM</p>
                  </div>
                  <div className="divide-y divide-border/50">
                    {[
                      { label: 'Source', value: entry.utm_source },
                      { label: 'Medium', value: entry.utm_medium },
                      { label: 'Campaign', value: entry.utm_campaign },
                      { label: 'Content', value: entry.utm_content },
                      { label: 'Term', value: entry.utm_term },
                    ].filter(r => r.value).map(r => (
                      <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-[10px] text-muted-foreground uppercase">{r.label}</span>
                        <span className="text-xs font-medium text-foreground/80">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Bottom bar ─── */}
            {isActionable && (
              <div className="shrink-0 px-6 py-4 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md flex items-center gap-3">
                <button
                  onClick={() => updateStatus('discarded')}
                  className="px-4 py-2 rounded-full text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Descartar
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => { onQualify(entry); onClose() }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all duration-200"
                >
                  Qualificar
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
        </>
      )}
      {entry?.contact?.id && (
        <CallOutcomeModal
          open={outcomeOpen}
          onOpenChange={setOutcomeOpen}
          contactId={entry.contact.id}
          contactName={entry.raw_name || entry.contact?.nome}
          contactMethod={contactMethod}
        />
      )}
      <PropertyDetailSheet
        propertyId={propertySheetId}
        open={propertySheetId !== null}
        onOpenChange={(o) => { if (!o) setPropertySheetId(null) }}
      />
    </>
  )
}
