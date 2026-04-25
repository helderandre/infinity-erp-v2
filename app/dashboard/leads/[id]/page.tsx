'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import { NegocioDetailSheet } from '@/components/crm/negocio-detail-sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Plus,
  ExternalLink,
  Briefcase,
  FileText,
  Phone,
  Mail,
  MessageCircle,
  CalendarDays,
  Zap,
  Database,
  Workflow,
  Clock,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { formatDate, formatCurrency, NEGOCIO_TIPOS_PICKER, LEAD_ESTADOS, LEAD_TEMPERATURAS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { LeadDataCard } from '@/components/leads/lead-data-card'
import { LeadDocumentsFoldersView } from '@/components/leads/lead-documents-folders-view'
import { LeadsEntryCards } from '@/components/leads/leads-entry-cards'
import { NegocioListItem, type NegocioListItemData } from '@/components/negocios/negocio-list-item'
import { ContactAutomationsList } from '@/components/crm/contact-automations-list'
import { CallOutcomeDialog } from '@/components/crm/call-outcome-dialog'
import { WhatsAppChatBubble } from '@/components/whatsapp/whatsapp-chat-bubble'
import { EmailChatBubble } from '@/components/email/email-chat-bubble'
import type { LeadWithAgent, LeadAttachment } from '@/types/lead'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const negocioFromUrl = searchParams.get('negocio')

  // Sheet do negócio — substitui a página dedicada antiga.
  const [openNegocioId, setOpenNegocioId] = useState<string | null>(negocioFromUrl)
  useEffect(() => {
    setOpenNegocioId(negocioFromUrl)
  }, [negocioFromUrl])
  const updateNegocioInUrl = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next) params.set('negocio', next)
      else params.delete('negocio')
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [pathname, searchParams, router],
  )
  const openNegocioSheet = useCallback(
    (negocioId: string) => {
      setOpenNegocioId(negocioId)
      updateNegocioInUrl(negocioId)
    },
    [updateNegocioInUrl],
  )

  const [lead, setLead] = useState<LeadWithAgent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [negocios, setNegocios] = useState<Record<string, unknown>[]>([])
  const [negociosLoading, setNegociosLoading] = useState(false)
  const [newNegocioOpen, setNewNegocioOpen] = useState(false)
  const [negocioToDelete, setNegocioToDelete] = useState<string | null>(null)
  const [deletingNegocio, setDeletingNegocio] = useState(false)
  const [newNegocioTipo, setNewNegocioTipo] = useState('')
  const [creatingNegocio, setCreatingNegocio] = useState(false)
  const [attachments, setAttachments] = useState<LeadAttachment[]>([])
  const [cpLoading, setCpLoading] = useState(false)
  const [nipcLoading, setNipcLoading] = useState(false)
  const [callOutcomeOpen, setCallOutcomeOpen] = useState(false)
  const [pendingLeads, setPendingLeads] = useState<{ id: string; source: string; raw_name: string; created_at: string; match_type: string | null }[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [historicoSubtab, setHistoricoSubtab] = useState<'actividades' | 'entradas' | 'anexos'>('actividades')

  const loadLead = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLead(data)
      setForm(data)
    } catch {
      toast.error('Erro ao carregar contacto')
      router.push('/dashboard/leads')
    } finally {
      setIsLoading(false)
    }
  }, [id, router])

  const loadPendingLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/lead-entries?status=new&limit=10`)
      if (res.ok) {
        const data = await res.json()
        // Filter entries that match this contact
        const matching = (data.data || []).filter((e: any) => e.contact_id === id)
        setPendingLeads(matching)
      }
    } catch { /* */ }
  }, [id])

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}/activities`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data.data || [])
      }
    } catch { /* */ }
    finally { setActivitiesLoading(false) }
  }, [id])

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}/entries`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.data || [])
      }
    } catch { /* */ }
    finally { setEntriesLoading(false) }
  }, [id])

  const loadNegocios = useCallback(async () => {
    setNegociosLoading(true)
    try {
      const res = await fetch(`/api/negocios?lead_id=${id}`)
      if (res.ok) { const data = await res.json(); setNegocios(data.data || []) }
    } catch {} finally { setNegociosLoading(false) }
  }, [id])

  const loadAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${id}/attachments`)
      if (res.ok) {
        const data = await res.json()
        // New shape: { folders: [{ files: [...] }] }. Flatten so the pill
        // counter keeps showing the total file count.
        const folders = Array.isArray(data?.folders) ? data.folders : []
        const flat = folders.flatMap((f: { files: LeadAttachment[] }) => f.files ?? [])
        setAttachments(flat)
      }
    } catch {}
  }, [id])

  useEffect(() => { loadLead(); loadPendingLeads(); loadEntries() }, [loadLead, loadPendingLeads, loadEntries])

  const updateField = (field: string, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }))

  const saveFields = async (fields: string[]) => {
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {}
      for (const f of fields) body[f] = form[f] ?? null
      const res = await fetch(`/api/leads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro ao guardar') }
      toast.success('Contacto actualizado com sucesso')
      setLead((prev) => (prev ? { ...prev, ...body } : prev))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao guardar')
    } finally { setIsSaving(false) }
  }

  const saveSidebarField = async (field: string, value: string) => {
    updateField(field, value)
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) })
      if (!res.ok) throw new Error()
      setLead((prev) => (prev ? { ...prev, [field]: value } : prev))
      toast.success('Actualizado')
    } catch { toast.error('Erro ao guardar') }
  }

  const handlePostalCodeLookup = async () => {
    const cp = form.codigo_postal as string
    if (!cp || cp.length < 7) return
    setCpLoading(true)
    try {
      const res = await fetch(`/api/postal-code/${cp}`)
      if (res.ok) {
        const data = await res.json()
        if (data.Distrito) updateField('distrito', data.Distrito)
        if (data.Concelho) updateField('concelho', data.Concelho)
        if (data.Freguesia) updateField('freguesia', data.Freguesia)
        if (data.Localidade) updateField('localidade', data.Localidade)
        toast.success('Morada auto-preenchida')
      } else { toast.error('Codigo postal nao encontrado') }
    } catch { toast.error('Erro ao consultar codigo postal') }
    finally { setCpLoading(false) }
  }

  const handleNipcLookup = async () => {
    const nipc = form.nipc as string
    if (!nipc || nipc.replace(/\D/g, '').length !== 9) return
    setNipcLoading(true)
    try {
      const res = await fetch(`/api/nipc/${nipc}`)
      if (res.ok) {
        const data = await res.json()
        if (data.nome) updateField('empresa', data.nome)
        if (data.morada) updateField('morada_empresa', data.morada)
        if (data.telefone) updateField('telefone_empresa', data.telefone)
        if (data.email) updateField('email_empresa', data.email)
        if (data.website) updateField('website_empresa', data.website)
        toast.success('Dados da empresa auto-preenchidos')
      } else { const err = await res.json(); toast.error(err.error || 'NIPC nao encontrado') }
    } catch { toast.error('Erro ao consultar NIPC') }
    finally { setNipcLoading(false) }
  }

  const handleDocumentAnalysisApply = (fields: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== undefined) updateField(key, value)
    }
  }

  const handleCreateNegocio = async () => {
    if (!newNegocioTipo) return
    setCreatingNegocio(true)
    try {
      const res = await fetch('/api/negocios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id, tipo: newNegocioTipo }) })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success('Negocio criado com sucesso')
      setNewNegocioOpen(false)
      setNewNegocioTipo('')
      loadNegocios()
      openNegocioSheet(data.id)
    } catch { toast.error('Erro ao criar negocio') }
    finally { setCreatingNegocio(false) }
  }

  const handleDeleteNegocio = async () => {
    if (!negocioToDelete) return
    setDeletingNegocio(true)
    try {
      const res = await fetch(`/api/negocios/${negocioToDelete}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Negocio eliminado')
      setNegocioToDelete(null)
      loadNegocios()
    } catch { toast.error('Erro ao eliminar negocio') }
    finally { setDeletingNegocio(false) }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52 w-full rounded-xl" />
        <div className="flex gap-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-20 rounded-full" />)}</div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (!lead) return null

  const estadoValue = (form.estado as string) || ''
  const temperaturaValue = (form.temperatura as string) || ''

  const ESTADO_COLORS: Record<string, string> = {
    'Lead': 'bg-blue-500', 'Contactado': 'bg-sky-500', 'Qualificado': 'bg-indigo-500',
    'Potencial Cliente': 'bg-amber-500', 'Cliente Activo': 'bg-emerald-500',
    '1 Negocio Fechado': 'bg-teal-500', 'Cliente Recorrente': 'bg-purple-500',
    'Cliente Premium': 'bg-gradient-to-r from-neutral-300 to-neutral-400',
    'Perdido': 'bg-red-500', 'Inactivo': 'bg-slate-400',
  }

  const TEMP_STYLES: Record<string, { emoji: string; label: string; active: string; accent: string }> = {
    Frio:   { emoji: '❄️', label: 'Fria',   active: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30',    accent: 'bg-blue-500' },
    Morno:  { emoji: '☀️', label: 'Morna',  active: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30', accent: 'bg-amber-500' },
    Quente: { emoji: '🔥', label: 'Quente', active: 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30',        accent: 'bg-red-500' },
  }
  const accentBar = TEMP_STYLES[temperaturaValue]?.accent ?? 'bg-muted-foreground/30'

  return (
    <>
    <div
      className={cn(
        // Mobile: horizontal snap carousel, one card at a time.
        'flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2 h-[calc(100svh-8rem)]',
        // Desktop: one continuous rounded shell, natural height.
        'lg:overflow-x-visible lg:snap-none lg:gap-0 lg:mx-0 lg:px-0 lg:pb-0 lg:h-auto',
        'lg:rounded-3xl lg:overflow-hidden lg:border lg:border-border/40 lg:shadow-sm lg:bg-card',
      )}
    >
      {/* ─── LEFT: profile sidebar / Card 1 in mobile carousel ─── */}
      <aside
        className={cn(
          'relative',
          // Mobile: carousel card — full-width snap, scrolls internally
          'w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] shrink-0 snap-center h-full overflow-y-auto',
          'rounded-3xl border border-border/40 bg-card shadow-sm',
          // Desktop: merged into the outer card
          'lg:w-[320px] lg:h-auto lg:overflow-hidden',
          'lg:rounded-none lg:border-0 lg:shadow-none lg:border-r lg:border-border/40',
        )}
      >
        <div className="relative px-5 py-5 sm:px-6 sm:py-6 space-y-5">
          {/* Voltar */}
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/dashboard/leads')}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Voltar
          </Button>

          {/* Identity — centered avatar + name + subtitle + estado badge */}
          <div className="flex flex-col items-center text-center gap-1.5 pt-2">
            {/* Initials circle (no photo for leads) */}
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-2xl font-semibold text-muted-foreground">
              {(lead.nome || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
            </div>
            <h2 className="mt-1 text-xl sm:text-[22px] font-semibold tracking-tight text-foreground break-words max-w-full px-2">
              {lead.nome}
            </h2>
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              {lead.origem && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  <span>{lead.origem}</span>
                  <span className="text-muted-foreground/40">·</span>
                </>
              )}
              <CalendarDays className="h-3 w-3" />
              <span>{formatDate(lead.created_at)}</span>
            </p>
            {estadoValue && (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium">
                {estadoValue === 'Cliente Premium' ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-neutral-300 to-neutral-500" />
                ) : (
                  <span className={cn('h-1.5 w-1.5 rounded-full', ESTADO_COLORS[estadoValue] || 'bg-slate-400')} />
                )}
                {estadoValue}
              </span>
            )}
          </div>

          {/* Contact action buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={!lead.telemovel}
              onClick={() => {
                if (!lead.telemovel) return
                window.location.href = `tel:${lead.telemovel}`
                setTimeout(() => setCallOutcomeOpen(true), 500)
              }}
              className="rounded-full border-border/60 h-8 text-[11px] px-2"
            >
              <Phone className="mr-1 h-3 w-3" />
              Ligar
            </Button>
            <Button
              size="sm"
              disabled={!lead.telemovel}
              onClick={() => lead.telemovel && window.open(`https://wa.me/${lead.telemovel.replace(/\D/g, '')}`, '_blank')}
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-none h-8 text-[11px] px-2"
            >
              <MessageCircle className="mr-1 h-3 w-3" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!lead.email}
              onClick={() => lead.email && (window.location.href = `mailto:${lead.email}`)}
              className="rounded-full border-border/60 h-8 text-[11px] px-2"
            >
              <Mail className="mr-1 h-3 w-3" />
              Email
            </Button>
          </div>

          {/* Contact details card */}
          {(lead.email || lead.telemovel || lead.agent?.commercial_name) && (
            <div className="rounded-2xl border border-border/40 bg-muted/30 p-3 space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground/80">Contacto</p>
              {lead.telemovel && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-[11px] text-muted-foreground">Telemóvel</span>
                  <a href={`tel:${lead.telemovel}`} className="font-medium text-foreground truncate hover:text-primary transition-colors">
                    {lead.telemovel}
                  </a>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-[11px] text-muted-foreground">Email</span>
                  <a href={`mailto:${lead.email}`} className="font-medium text-foreground truncate max-w-[180px] hover:text-primary transition-colors">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.agent?.commercial_name && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-[11px] text-muted-foreground">Consultor</span>
                  <span className="font-medium text-foreground truncate">{lead.agent.commercial_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Estado (editable) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground/80">Estado</p>
            <Select value={estadoValue} onValueChange={(v) => saveSidebarField('estado', v)}>
              <SelectTrigger className="w-full rounded-xl text-xs h-9">
                <SelectValue placeholder="Sem estado" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    <div className="flex items-center gap-2">
                      {e === 'Cliente Premium' ? (
                        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-neutral-300 to-neutral-500" />
                      ) : (
                        <span className={cn('h-2 w-2 rounded-full', ESTADO_COLORS[e] || 'bg-slate-400')} />
                      )}
                      {e}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperatura */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground/80">Temperatura</p>
            <div className="grid grid-cols-3 gap-1">
              {LEAD_TEMPERATURAS.map((t) => {
                const info = TEMP_STYLES[t.value]
                const isActive = temperaturaValue === t.value
                return (
                  <button
                    key={t.value}
                    onClick={() => saveSidebarField('temperatura', t.value)}
                    className={cn(
                      'flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-medium transition-all border',
                      isActive
                        ? (info?.active ?? 'bg-muted text-foreground border-border/60')
                        : 'border-border/40 bg-background text-muted-foreground hover:text-foreground hover:border-border/70',
                    )}
                  >
                    <span className="text-xs">{info?.emoji}</span>
                    {info?.label || t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Observações — notas livres persistentes sobre o contacto,
              save-on-blur via o mesmo saveSidebarField dos outros campos. */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground/80">Observações</p>
            <Textarea
              value={(form.observacoes as string) ?? ''}
              onChange={(e) => updateField('observacoes', e.target.value)}
              onBlur={(e) => {
                const next = e.target.value
                if (next !== (lead?.observacoes ?? '')) {
                  saveSidebarField('observacoes', next)
                }
              }}
              placeholder="Notas pessoais sobre este contacto…"
              rows={4}
              className="text-xs resize-none"
            />
          </div>
        </div>
      </aside>

      {/* ─── RIGHT: tabs + content / Card 2 in mobile carousel ─── */}
      <div
        className={cn(
          // Mobile: second carousel card — own styling, scrolls internally
          'w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] shrink-0 snap-center h-full overflow-y-auto',
          'rounded-3xl border border-border/40 bg-card shadow-sm p-5',
          // Desktop: merges into the outer card
          'lg:w-auto lg:flex-1 lg:min-w-0 lg:h-auto lg:overflow-visible',
          'lg:rounded-none lg:border-0 lg:shadow-none lg:p-6',
        )}
      >
          <Tabs
            defaultValue={tabFromUrl || (pendingLeads.length > 0 ? 'leads' : 'dados')}
            onValueChange={(tab) => {
              if (tab === 'leads') loadEntries()
              if (tab === 'negocios') loadNegocios()
              if (tab === 'automatismos') loadNegocios()
              if (tab === 'historico') { loadAttachments(); loadActivities(); loadEntries() }
            }}
          >
            {/* Pill tabs — responsive: icon-only on narrow containers,
                active-only label at md, all labels at lg (container queries). */}
            <div className="@container mb-4">
              <TabsList className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 border border-border/30 shadow-sm h-auto w-auto max-w-full overflow-x-auto scrollbar-hide">
                {[
                  { key: 'leads', label: 'Leads', icon: Zap, count: pendingLeads.length || undefined },
                  { key: 'negocios', label: 'Negócios', icon: Briefcase },
                  { key: 'dados', label: 'Dados', icon: Database },
                  { key: 'automatismos', label: 'Automatismos', icon: Workflow },
                  { key: 'historico', label: 'Histórico', icon: Clock },
                ].map((tab) => {
                  const Icon = tab.icon
                  return (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className={cn(
                        'group inline-flex items-center justify-center shrink-0 gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-300',
                        'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
                        'data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50',
                        'dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {/* Label: always visible for the active tab; others reveal at @lg. */}
                      <span
                        className={cn(
                          'hidden truncate',
                          'group-data-[state=active]:inline',
                          '@lg:inline',
                        )}
                      >
                        {tab.label}
                      </span>
                      {'count' in tab && tab.count ? (
                        <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                          {tab.count}
                        </span>
                      ) : null}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </div>

            {/* Leads Tab */}
            <TabsContent value="leads" className="mt-0 space-y-4">
              <LeadsEntryCards
                entries={entries}
                loading={entriesLoading}
                contactId={id}
                onQualified={() => { loadEntries(); loadNegocios(); loadPendingLeads() }}
              />
            </TabsContent>

            {/* Dados Tab */}
            <TabsContent value="dados" className="mt-0">
              <LeadDataCard
                lead={lead}
                form={form}
                onFieldChange={updateField}
                onSave={saveFields}
                isSaving={isSaving}
                attachments={attachments}
                onDeleteAttachment={(attId) => setDeleteAttachmentId(attId)}
                onDocumentAnalysisApply={handleDocumentAnalysisApply}
                cpLoading={cpLoading}
                onPostalCodeLookup={handlePostalCodeLookup}
                nipcLoading={nipcLoading}
                onNipcLookup={handleNipcLookup}
              />
            </TabsContent>

            {/* Negocios Tab */}
            <TabsContent value="negocios" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Negocios</h3>
                <Button size="sm" onClick={() => setNewNegocioOpen(true)} className="rounded-full">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Novo Negocio
                </Button>
              </div>

              {negociosLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
                </div>
              ) : negocios.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <Briefcase className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground text-sm">Nenhum negocio associado</p>
                  <Button size="sm" className="mt-3 rounded-full" onClick={() => setNewNegocioOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar Negocio
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {negocios.map((neg, idx) => (
                    <div
                      key={neg.id as string}
                      className="animate-in fade-in slide-in-from-bottom-1"
                      style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}
                    >
                      <NegocioListItem
                        negocio={neg as unknown as NegocioListItemData}
                        onSelect={() => openNegocioSheet(neg.id as string)}
                        onDelete={() => setNegocioToDelete(neg.id as string)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* New negocio dialog */}
              <Dialog open={newNegocioOpen} onOpenChange={setNewNegocioOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Novo Negocio</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tipo de Negocio *</Label>
                      <Select value={newNegocioTipo} onValueChange={setNewNegocioTipo}>
                        <SelectTrigger className="rounded-full">
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {NEGOCIO_TIPOS_PICKER.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewNegocioOpen(false)} className="rounded-full">Cancelar</Button>
                    <Button onClick={handleCreateNegocio} disabled={!newNegocioTipo || creatingNegocio} className="rounded-full">
                      {creatingNegocio && <Spinner variant="infinite" size={16} className="mr-2" />}
                      Criar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete negocio confirmation */}
              <AlertDialog open={!!negocioToDelete} onOpenChange={(open) => !open && setNegocioToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar Negocio</AlertDialogTitle>
                    <AlertDialogDescription>Tem a certeza de que pretende eliminar este negocio? Esta accao e irreversivel.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteNegocio} disabled={deletingNegocio} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deletingNegocio ? 'A eliminar...' : 'Eliminar'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>

            {/* Automatismos Tab */}
            <TabsContent value="automatismos" className="mt-0">
              <ContactAutomationsList
                contactId={id}
                contactBirthday={(lead?.data_nascimento as string | null | undefined) ?? null}
                hasDeals={negocios.length > 0}
              />
            </TabsContent>

            {/* Historico Tab */}
            <TabsContent value="historico" className="mt-0 space-y-4" data-no-long-press>
              {/* Subtabs */}
              <div className="flex items-center gap-1 rounded-full bg-muted/40 p-1 w-fit border border-border/30">
                {([
                  { key: 'actividades' as const, label: 'Actividades', count: activities.length },
                  { key: 'entradas' as const, label: 'Entradas', count: entries.length },
                  { key: 'anexos' as const, label: 'Anexos', count: attachments.length },
                ]).map((sub) => (
                  <button
                    key={sub.key}
                    onClick={() => setHistoricoSubtab(sub.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                      historicoSubtab === sub.key
                        ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {sub.label}
                    {sub.count > 0 && (
                      <span className={cn(
                        'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center',
                        historicoSubtab === sub.key
                          ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {sub.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Actividades subtab */}
              {historicoSubtab === 'actividades' && (
                <div className="space-y-2">
                  {activitiesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                        <CalendarDays className="h-7 w-7 text-muted-foreground/30" />
                      </div>
                      <p className="text-muted-foreground text-sm">Sem actividades registadas</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">Chamadas, visitas, emails e outras interacções aparecerão aqui</p>
                    </div>
                  ) : (
                    activities.map((act) => {
                      const typeIcons: Record<string, typeof Phone> = { call: Phone, email: Mail, whatsapp: MessageCircle, sms: MessageCircle, visit: CalendarDays, note: FileText, stage_change: Zap, assignment: Briefcase }
                      const TypeIcon = typeIcons[act.activity_type] || Zap
                      const typeLabels: Record<string, string> = { call: 'Chamada', email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS', visit: 'Visita', note: 'Nota', stage_change: 'Mudança de fase', assignment: 'Atribuição', system: 'Sistema', lifecycle_change: 'Ciclo de vida' }
                      return (
                        <div key={act.id} className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm px-4 py-3 flex items-start gap-3 transition-all hover:bg-card/80">
                          <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', act.direction === 'outbound' ? 'bg-blue-500/10 text-blue-600' : act.direction === 'inbound' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                            <TypeIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{typeLabels[act.activity_type] || act.activity_type}</span>
                              {act.direction && (
                                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', act.direction === 'outbound' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600')}>
                                  {act.direction === 'outbound' ? 'Enviado' : 'Recebido'}
                                </span>
                              )}
                            </div>
                            {act.subject && <p className="text-sm text-foreground mt-0.5">{act.subject}</p>}
                            {act.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{act.description}</p>}
                            <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(act.created_at)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Entradas subtab — inbound leads from forms/campaigns */}
              {historicoSubtab === 'entradas' && (
                <div className="space-y-2">
                  {entriesLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
                    </div>
                  ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                        <ExternalLink className="h-7 w-7 text-muted-foreground/30" />
                      </div>
                      <p className="text-muted-foreground text-sm">Sem entradas registadas</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">Formulários, campanhas e outros pontos de entrada aparecerão aqui</p>
                    </div>
                  ) : (
                    entries.map((entry) => {
                      const sourceLabels: Record<string, string> = { meta_ads: 'Meta Ads', google_ads: 'Google Ads', website: 'Website', landing_page: 'Landing Page', partner: 'Parceiro', organic: 'Orgânico', walk_in: 'Walk-in', phone_call: 'Chamada', social_media: 'Redes Sociais', other: 'Outro' }
                      const sourceColors: Record<string, string> = { meta_ads: 'bg-blue-500/10 text-blue-600', google_ads: 'bg-red-500/10 text-red-600', website: 'bg-emerald-500/10 text-emerald-600', landing_page: 'bg-purple-500/10 text-purple-600', partner: 'bg-amber-500/10 text-amber-600' }
                      return (
                        <div key={entry.id} className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm px-4 py-3 flex items-start gap-3 transition-all hover:bg-card/80">
                          <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', sourceColors[entry.source] || 'bg-muted text-muted-foreground')}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{sourceLabels[entry.source] || entry.source}</span>
                              {entry.status && (
                                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', entry.status === 'new' ? 'bg-sky-500/10 text-sky-600' : entry.status === 'processed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                                  {entry.status === 'new' ? 'Novo' : entry.status === 'processed' ? 'Processado' : entry.status}
                                </span>
                              )}
                            </div>
                            {entry.raw_name && <p className="text-xs text-muted-foreground mt-0.5">{entry.raw_name} {entry.raw_email ? `· ${entry.raw_email}` : ''} {entry.raw_phone ? `· ${entry.raw_phone}` : ''}</p>}
                            {entry.form_url && <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{entry.form_url}</p>}
                            {entry.utm_campaign && <p className="text-[10px] text-muted-foreground/60 mt-0.5">Campanha: {entry.utm_campaign}</p>}
                            {entry.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.notes}</p>}
                            <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(entry.created_at)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Anexos subtab — folder-based UI */}
              {historicoSubtab === 'anexos' && (
                <LeadDocumentsFoldersView leadId={id} />
              )}

            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Call outcome dialog, WhatsApp + email bubbles (overlays, out of flow) */}
      {lead && (
        <CallOutcomeDialog
          open={callOutcomeOpen}
          onOpenChange={setCallOutcomeOpen}
          contactId={id}
          contactName={lead.nome || ''}
          phone={lead.telemovel || ''}
          onCompleted={() => { loadLead(); loadActivities() }}
        />
      )}

      {/* WhatsApp chat bubble */}
      {lead?.telemovel && (
        <WhatsAppChatBubble
          contactPhone={lead.telemovel}
          contactName={lead.nome || 'Contacto'}
          contactLeadId={lead.id}
        />
      )}

      {/* Email chat bubble */}
      {lead?.email && (
        <EmailChatBubble
          contactEmail={lead.email}
          contactName={lead.nome || 'Contacto'}
        />
      )}

      {/* Sheet do negócio (substitui a página antiga /dashboard/leads/[id]/negocios/[id]) */}
      <NegocioDetailSheet
        negocioId={openNegocioId}
        open={!!openNegocioId}
        onOpenChange={(o) => {
          if (!o) {
            setOpenNegocioId(null)
            updateNegocioInUrl(null)
          }
        }}
      />
    </>
  )
}
