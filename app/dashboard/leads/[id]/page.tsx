'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useSmartBack } from '@/hooks/use-previous-pathname'
import { useUser } from '@/hooks/use-user'
import { NegocioDetailSheet } from '@/components/crm/negocio-detail-sheet'
import { CallContactButton } from '@/components/goals/v2/call-contact-button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  ArrowLeft,
  Plus,
  ExternalLink,
  Briefcase,
  FileText,
  Phone,
  Mail,
  CalendarDays,
  Zap,
  Clock,
  Inbox,
  IdCard,
  StickyNote,
  Pencil,
  MessageSquare,
  Smartphone,
  ChevronDown,
  CheckSquare,
  CalendarPlus,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency, NEGOCIO_TIPOS_PICKER, LEAD_ESTADOS, LEAD_TEMPERATURAS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { LeadDataSheet } from '@/components/leads/lead-data-sheet'
import { LeadDocumentsFoldersView } from '@/components/leads/lead-documents-folders-view'
import { LeadEntriesSheet } from '@/components/leads/lead-entries-sheet'
import { ObservationItem, type ObservationActivity } from '@/components/leads/observation-item'
import { ClientProfileSheet } from '@/components/leads/client-profile-sheet'
import { QuickNoteSheet } from '@/components/leads/quick-note-sheet'
import { NewNegocioSheet } from '@/components/leads/new-negocio-sheet'
import { LeadAgendaTab } from '@/components/leads/lead-agenda-tab'
import { NegocioListItem, type NegocioListItemData } from '@/components/negocios/negocio-list-item'
import { LeadAutomationsSheet } from '@/components/leads/lead-automations-sheet'
import { LeadEditSheet } from '@/components/leads/lead-edit-sheet'
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon'
import { TaskForm } from '@/components/tasks/task-form'
import { QuickEventSheet } from '@/components/leads/quick-event-sheet'
import { CallOutcomeDialog } from '@/components/crm/call-outcome-dialog'
import { ReferenciarDialog } from '@/components/crm/referenciar-dialog'
import { WhatsAppChatBubble } from '@/components/whatsapp/whatsapp-chat-bubble'
import { EmailChatBubble } from '@/components/email/email-chat-bubble'
import type { LeadWithAgent, LeadAttachment } from '@/types/lead'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const goBack = useSmartBack('/dashboard/leads')
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
  const [attachments, setAttachments] = useState<LeadAttachment[]>([])
  const [cpLoading, setCpLoading] = useState(false)
  const [nipcLoading, setNipcLoading] = useState(false)
  const [callOutcomeOpen, setCallOutcomeOpen] = useState(false)
  const [referOpen, setReferOpen] = useState(false)
  const [pendingLeads, setPendingLeads] = useState<{ id: string; source: string; raw_name: string; created_at: string; match_type: string | null }[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [historicoSubtab, setHistoricoSubtab] = useState<'atividade' | 'entradas' | 'anexos'>('atividade')
  const [dataSheetOpen, setDataSheetOpen] = useState(false)
  const [entriesSheetOpen, setEntriesSheetOpen] = useState(false)
  const [automationsSheetOpen, setAutomationsSheetOpen] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [profileInvalidateKey, setProfileInvalidateKey] = useState(0)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [quickNoteOpen, setQuickNoteOpen] = useState(false)
  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string }>>([])
  const [activeTab, setActiveTab] = useState<string>(
    // Back-compat: old URLs used `?tab=calendario` before the rename to `agenda`.
    tabFromUrl === 'calendario' ? 'agenda' : (tabFromUrl || 'negocios'),
  )

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

  useEffect(() => {
    // Activities (notas + histórico) também carregam no mount agora —
    // a Notas section vive no aside e está sempre visível.
    loadLead(); loadPendingLeads(); loadEntries(); loadNegocios(); loadActivities()
  }, [loadLead, loadPendingLeads, loadEntries, loadNegocios, loadActivities])

  // Load consultants once for the Task + Event forms
  useEffect(() => {
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setConsultants(j?.data ?? j ?? []))
      .catch(() => {})
  }, [])

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

  const handleNegocioCreated = (negocioId: string) => {
    loadNegocios()
    openNegocioSheet(negocioId)
  }

  const handleDeleteNegocio = async () => {
    if (!negocioToDelete) return
    setDeletingNegocio(true)
    try {
      const res = await fetch(`/api/negocios/${negocioToDelete}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Oportunidade eliminada')
      setNegocioToDelete(null)
      loadNegocios()
    } catch { toast.error('Erro ao eliminar oportunidade') }
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

  // Tabs list — rendered twice: above the carousel on mobile (`lg:hidden`)
  // and inside the right-pane tabs row on desktop (`hidden lg:flex`).
  const TABS_CONFIG = [
    { key: 'negocios', label: 'Oportunidades', icon: Briefcase },
    { key: 'notas', label: 'Notas', icon: StickyNote },
    { key: 'agenda', label: 'Agenda', icon: CalendarDays },
    { key: 'historico', label: 'Histórico', icon: Clock },
  ] as const

  const tabsListJsx = (
    <TabsList className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 h-auto w-auto max-w-full overflow-x-auto scrollbar-hide">
      {TABS_CONFIG.map((tab) => {
        const Icon = tab.icon
        return (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className={cn(
              'group inline-flex items-center justify-center shrink-0 gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-300',
              'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
              'data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/40',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {/* Label: mobile shows only the active tab's label; desktop (lg+) shows all. */}
            <span
              className={cn(
                'hidden truncate',
                'group-data-[state=active]:inline',
                'lg:inline',
              )}
            >
              {tab.label}
            </span>
          </TabsTrigger>
        )
      })}
    </TabsList>
  )

  // Context-action cluster (Referenciar / Dados / Leads / Automatismos / Editar).
  // Rendered twice: above the carousel on mobile (`lg:hidden`) and inside the
  // right-pane tabs row on desktop (`hidden lg:flex`).
  const contextActionsCluster = (
    <>
      <button
        type="button"
        onClick={() => setDataSheetOpen(true)}
        className="group inline-flex items-center justify-center h-9 w-9 rounded-2xl border border-border/50 bg-white/80 dark:bg-neutral-900/70 backdrop-blur-md shadow-sm transition-all hover:bg-white dark:hover:bg-neutral-900 hover:border-border/80 hover:shadow"
        title="Ver dados completos do contacto"
        aria-label="Ver dados completos"
      >
        <span className="h-7 w-7 rounded-full bg-slate-500/15 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors group-hover:bg-slate-500/25">
          <IdCard className="h-3.5 w-3.5" />
        </span>
      </button>

      <button
        type="button"
        onClick={() => setEntriesSheetOpen(true)}
        className="group relative inline-flex items-center justify-center h-9 rounded-2xl border border-border/50 bg-white/80 dark:bg-neutral-900/70 backdrop-blur-md shadow-sm transition-all hover:bg-white dark:hover:bg-neutral-900 hover:border-border/80 hover:shadow px-1"
        title="Ver vezes que mostrou interesse"
        aria-label="Leads"
      >
        <span className="h-7 w-7 rounded-full bg-blue-700/15 text-blue-700 dark:text-blue-300 flex items-center justify-center transition-colors group-hover:bg-blue-700/25">
          <Inbox className="h-3.5 w-3.5" />
        </span>
        {entries.length > 0 && (
          <span className="ml-1 mr-1.5 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-muted text-foreground/70 text-[10px] font-semibold px-1">
            {entries.length}
          </span>
        )}
        {pendingLeads.length > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background"
            aria-label={`${pendingLeads.length} novos`}
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => setAutomationsSheetOpen(true)}
        className="group inline-flex items-center justify-center h-9 w-9 rounded-2xl border border-border/50 bg-white/80 dark:bg-neutral-900/70 backdrop-blur-md shadow-sm transition-all hover:bg-white dark:hover:bg-neutral-900 hover:border-border/80 hover:shadow"
        title="Automatismos do contacto"
        aria-label="Automatismos"
      >
        <span className="h-7 w-7 rounded-full bg-amber-700/15 text-amber-700 dark:text-amber-400 flex items-center justify-center transition-colors group-hover:bg-amber-700/25">
          <Zap className="h-3.5 w-3.5" />
        </span>
      </button>

      <button
        type="button"
        onClick={() => setEditSheetOpen(true)}
        className="group inline-flex items-center justify-center h-9 w-9 rounded-2xl border border-border/50 bg-white/80 dark:bg-neutral-900/70 backdrop-blur-md shadow-sm transition-all hover:bg-white dark:hover:bg-neutral-900 hover:border-border/80 hover:shadow"
        title="Edição rápida"
        aria-label="Edição rápida"
      >
        <span className="h-7 w-7 rounded-full bg-stone-500/15 text-stone-700 dark:text-stone-300 flex items-center justify-center transition-colors group-hover:bg-stone-500/25">
          <Pencil className="h-3.5 w-3.5" />
        </span>
      </button>
    </>
  )

  return (
    <>
    <Tabs
      value={activeTab}
      onValueChange={(tab) => {
        setActiveTab(tab)
        if (tab === 'negocios') loadNegocios()
        if (tab === 'notas') loadActivities()
        if (tab === 'historico') { loadAttachments(); loadEntries(); loadActivities() }
        // Agenda → tasks subtab needs the lead's negocios to fetch their tasks
        if (tab === 'agenda') loadNegocios()
      }}
    >
    {/* Em mobile o header (Voltar + cluster) foi movido para dentro
        do aside (no topo), por cima do Card 1 — fica integrado no
        glass panel. Desktop continua a render o cluster nas tabs row. */}
    <div
      className={cn(
        // Mobile: horizontal snap carousel, one card at a time.
        'flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-2 h-[calc(100svh-9rem)]',
        // Desktop: 2 cards glassmorphic separados side-by-side com gap
        // (em vez do single unified rounded shell). Each card mantém
        // o seu próprio glass + mesh + rounded.
        'lg:overflow-x-visible lg:snap-none lg:mx-0 lg:px-0 lg:pt-0 lg:pb-0 lg:h-auto lg:gap-4 lg:items-start',
      )}
    >
      {/* ─── LEFT: profile sidebar / Card 1 in mobile carousel ─── */}
      <aside
        className={cn(
          'relative',
          // Mobile: full-width snap card no carousel
          'w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] shrink-0 snap-center h-full overflow-y-auto',
          'rounded-[2.25rem] ring-1 ring-border/30',
          // Profile pane mantém tom mais saturado em mobile para dar
          // identidade (é o "main card"). Em desktop fica mais claro
          // — o glass continua, mas com menos peso (cliente pediu).
          'bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200',
          'dark:bg-gradient-to-br dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800',
          'lg:bg-gradient-to-br lg:from-neutral-100 lg:via-neutral-50 lg:to-neutral-100',
          'lg:dark:bg-gradient-to-br lg:dark:from-neutral-900 lg:dark:via-neutral-950 lg:dark:to-neutral-900',
          // Desktop: largura fixa ~340px — compacta mas com espaço
          // suficiente para a Notas section (Card 4) que vive no
          // bottom desta aside; height natural (não estica para
          // altura do right pane).
          'lg:w-[340px] lg:h-auto lg:shrink-0 lg:overflow-hidden',
        )}
      >
        {/* Mesh blobs — 6 "ilhas" cobrindo toda a superfície
            (cantos + zona central). Visível também em desktop agora
            que a aside é uma standalone card. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.25rem] lg:opacity-50"
        >
          <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-neutral-400/35 dark:bg-neutral-700/55 blur-3xl" />
          <div className="absolute top-[15%] -right-20 h-72 w-72 rounded-full bg-neutral-300/35 dark:bg-neutral-700/45 blur-3xl" />
          <div className="absolute top-1/3 left-[20%] h-64 w-64 rounded-full bg-neutral-100/45 dark:bg-neutral-800/55 blur-3xl" />
          <div className="absolute top-[55%] right-[15%] h-64 w-64 rounded-full bg-neutral-400/35 dark:bg-neutral-700/50 blur-3xl" />
          <div className="absolute top-[70%] -left-20 h-72 w-72 rounded-full bg-neutral-200/40 dark:bg-neutral-800/55 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-neutral-400/35 dark:bg-neutral-700/55 blur-3xl" />
        </div>
        <div className="relative px-4 py-4 sm:px-5 sm:py-5 space-y-3 lg:px-6 lg:py-6 lg:space-y-5">
          {/* Top header — Voltar (left) + 4-button cluster (right).
              Voltar é uma bubble (border + bg + shadow) em todos os
              ecrãs, match com o cluster. Cluster só visível em mobile
              (em desktop é renderizado na tabs row do right pane). */}
          <div className="flex items-center lg:mb-0">
            <button
              type="button"
              onClick={goBack}
              aria-label="Voltar"
              title="Voltar"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border/50 bg-white/80 dark:bg-neutral-900/70 backdrop-blur-md shadow-sm transition-all hover:bg-white dark:hover:bg-neutral-900 hover:border-border/80 hover:shadow"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="ml-auto flex items-center gap-1.5 lg:hidden">
              {contextActionsCluster}
            </div>
          </div>

          {/* ─── Card 1: identidade + estado/temperatura ──────────────
              Mobile: frosted glass card (translúcido + backdrop-blur)
              que apanha o gradient + blobs do aside atrás, dando
              profundidade. Desktop: tudo neutralizado (sub-elementos
              do sidebar unificado). */}
          <div className="rounded-2xl bg-white/35 dark:bg-neutral-800/45 backdrop-blur-2xl border border-white/70 dark:border-white/15 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.5),0_4px_20px_-4px_rgb(0_0_0_/_0.1),0_1px_3px_-1px_rgb(0_0_0_/_0.06)] p-4 space-y-4">
          {/* Identity — name + subtitle */}
          <div className="flex flex-col items-center text-center gap-1.5 pt-2 lg:pt-0">
            <h2 className="text-xl sm:text-[22px] font-semibold tracking-tight text-foreground break-words max-w-full px-2">
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
          </div>

          {/* Estado (tag) + Temperatura (emojis) — same line, dashboard-card style */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {/* Estado as a clickable tag — uses DropdownMenu for full control */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center h-8 gap-1.5 rounded-full border border-border/50 bg-background/60 backdrop-blur-sm px-3 text-xs font-medium shadow-sm hover:bg-background/80 transition-colors cursor-pointer"
                  aria-label="Alterar estado"
                >
                  {estadoValue ? (
                    <>
                      {estadoValue === 'Cliente Premium' ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-neutral-300 to-neutral-500" />
                      ) : (
                        <span className={cn('h-1.5 w-1.5 rounded-full', ESTADO_COLORS[estadoValue] || 'bg-slate-400')} />
                      )}
                      <span>{estadoValue}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sem estado</span>
                  )}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl">
                {LEAD_ESTADOS.map((e) => (
                  <DropdownMenuItem
                    key={e}
                    onClick={() => saveSidebarField('estado', e)}
                    className="text-xs gap-2"
                  >
                    {e === 'Cliente Premium' ? (
                      <span className="h-2 w-2 rounded-full bg-gradient-to-br from-neutral-300 to-neutral-500" />
                    ) : (
                      <span className={cn('h-2 w-2 rounded-full', ESTADO_COLORS[e] || 'bg-slate-400')} />
                    )}
                    {e}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Temperatura — emoji-only on mobile, label visible on @sm+ */}
            <div className="inline-flex items-center gap-1 rounded-full bg-background/60 backdrop-blur-sm border border-border/50 p-0.5 shadow-sm">
              {LEAD_TEMPERATURAS.map((t) => {
                const info = TEMP_STYLES[t.value]
                const isActive = temperaturaValue === t.value
                return (
                  <button
                    key={t.value}
                    onClick={() => saveSidebarField('temperatura', t.value)}
                    title={info?.label || t.label}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 h-7 rounded-full text-[11px] font-medium transition-all',
                      'px-2 sm:px-2.5',
                      isActive
                        ? (info?.active ?? 'bg-muted text-foreground')
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    <span className="text-sm leading-none">{info?.emoji}</span>
                    <span className="hidden sm:inline">{info?.label || t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          </div>
          {/* ─── /Card 1 ───────────────────────────────────────────── */}

          {/* ─── Card 2: contact action buttons + quick action buttons ──
              Mobile: frosted glass. Desktop: transparente. */}
          <div className="rounded-2xl bg-white/35 dark:bg-neutral-800/45 backdrop-blur-2xl border border-white/70 dark:border-white/15 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.5),0_4px_20px_-4px_rgb(0_0_0_/_0.1),0_1px_3px_-1px_rgb(0_0_0_/_0.06)] p-3 space-y-2">
          {/* Action buttons — glass-gray container with white icon-only buttons */}
          <div className="rounded-2xl bg-muted/40 p-1.5 grid grid-cols-4 gap-1.5 lg:rounded-3xl lg:bg-muted/50 lg:supports-[backdrop-filter]:bg-muted/40 lg:backdrop-blur-md">
            {lead.telemovel ? (
              <CallContactButton
                phone={lead.telemovel}
                contactName={lead.nome || ''}
                leadId={id}
                sourceRefType="lead"
                sourceRefId={id}
                ariaLabel="Ligar"
                className="flex items-center justify-center h-11 rounded-2xl bg-background shadow-sm text-foreground transition-all hover:shadow-md"
              >
                <Phone className="h-4 w-4" />
              </CallContactButton>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center h-11 rounded-2xl bg-background shadow-sm text-foreground opacity-40 cursor-not-allowed"
                title="Sem telemóvel"
                aria-label="Ligar"
              >
                <Phone className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              disabled={!lead.telemovel}
              onClick={() => lead.telemovel && window.open(`https://wa.me/${lead.telemovel.replace(/\D/g, '')}`, '_blank')}
              className="flex items-center justify-center h-11 rounded-2xl bg-background shadow-sm text-foreground transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
              title={lead.telemovel ? 'Abrir WhatsApp' : 'Sem telemóvel'}
              aria-label="WhatsApp"
            >
              <WhatsAppIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!lead.telemovel}
              onClick={() => lead.telemovel && (window.location.href = `sms:${lead.telemovel}`)}
              className="flex items-center justify-center h-11 rounded-2xl bg-background shadow-sm text-foreground transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
              title={lead.telemovel ? `SMS para ${lead.telemovel}` : 'Sem telemóvel'}
              aria-label="Mensagem"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!lead.email}
              onClick={() => lead.email && (window.location.href = `mailto:${lead.email}`)}
              className="flex items-center justify-center h-11 rounded-2xl bg-background shadow-sm text-foreground transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
              title={lead.email ? `Email para ${lead.email}` : 'Sem email'}
              aria-label="Email"
            >
              <Mail className="h-4 w-4" />
            </button>
          </div>

          {/* Quick actions — task / event / oportunidade / nota rápida.
              Pill style matching the "Perfil do cliente" button. Palette uses
              deeper, less saturated executive tones (700-level) for a more
              professional feel. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTaskFormOpen(true)}
              className="group inline-flex items-center justify-center gap-2 h-8 rounded-full border border-teal-700/25 bg-teal-700/8 backdrop-blur-sm px-3 text-xs font-medium text-teal-800 dark:text-teal-300 hover:bg-teal-700/12 transition-colors shadow-sm"
              title="Criar tarefa para este contacto"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Tarefa
            </button>
            <button
              type="button"
              onClick={() => setEventFormOpen(true)}
              className="group inline-flex items-center justify-center gap-2 h-8 rounded-full border border-indigo-700/25 bg-indigo-700/8 backdrop-blur-sm px-3 text-xs font-medium text-indigo-800 dark:text-indigo-300 hover:bg-indigo-700/12 transition-colors shadow-sm"
              title="Criar evento (reunião, visita, follow-up)"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Evento
            </button>
            <button
              type="button"
              onClick={() => setNewNegocioOpen(true)}
              className="group inline-flex items-center justify-center gap-2 h-8 rounded-full border border-slate-600/25 bg-slate-600/8 backdrop-blur-sm px-3 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-600/12 transition-colors shadow-sm"
              title="Criar nova oportunidade"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Oportunidade
            </button>
            <button
              type="button"
              onClick={() => setQuickNoteOpen(true)}
              className="group inline-flex items-center justify-center gap-2 h-8 rounded-full border border-stone-600/25 bg-stone-600/8 backdrop-blur-sm px-3 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-600/12 transition-colors shadow-sm"
              title="Nota rápida"
            >
              <StickyNote className="h-3.5 w-3.5" />
              Nota
            </button>
          </div>

          </div>
          {/* ─── /Card 2 ───────────────────────────────────────────── */}

          {/* ─── Card 3: contact info (Telemóvel/Email/Consultor) ──── */}
          {(lead.email || lead.telemovel || lead.agent?.commercial_name) && (
            <div className="rounded-2xl bg-white/35 dark:bg-neutral-800/45 backdrop-blur-2xl border border-white/70 dark:border-white/15 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.5),0_4px_20px_-4px_rgb(0_0_0_/_0.1),0_1px_3px_-1px_rgb(0_0_0_/_0.06)] p-3 space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground/80">Contacto</p>
              {lead.telemovel && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-[11px] text-muted-foreground">Telemóvel</span>
                  <CallContactButton
                    phone={lead.telemovel}
                    contactName={lead.nome}
                    leadId={lead.id}
                    sourceRefType="lead"
                    sourceRefId={lead.id}
                    className="font-medium text-foreground truncate hover:text-primary transition-colors"
                  >
                    {lead.telemovel}
                  </CallContactButton>
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

              {/* Canal "App Mube" — gated on `has_mube_app`. SMS subiu para
                  a row de quick-actions junto a tel/WhatsApp/email. */}
              {(lead as { has_mube_app?: boolean }).has_mube_app && (
                <div className="pt-2 border-t border-border/30 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toast.info('Envio pela App em desenvolvimento')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-full bg-violet-500/10 border border-violet-500/30 text-[11px] font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-500/15 transition-colors"
                    title="Enviar via App Mube"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    App
                  </button>
                </div>
              )}

              {/* Perfil do cliente (IA) — também acessível aqui no
                  bottom de Card 3, além de viver na tab Notas. Pattern
                  pill style consistente com os outros action buttons. */}
              <div className="pt-2 border-t border-border/30 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setProfileSheetOpen(true)}
                  className="group inline-flex items-center gap-2 h-8 rounded-full border border-indigo-700/40 bg-indigo-700/15 backdrop-blur-sm px-3 text-xs font-medium text-indigo-800 dark:text-indigo-300 hover:bg-indigo-700/25 transition-colors shadow-sm"
                  title="Ver perfil IA do cliente"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Perfil do cliente
                </button>
              </div>
            </div>
          )}

          {/* Observações legadas — só visível se o campo único antigo
              ainda tem conteúdo (nova captura passou para a tab Histórico).
              Read-only com CTA para mover ao histórico. */}
          {(form.observacoes as string)?.trim() && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground/80">Observações</p>
                <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">Legado</span>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm p-3">
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {form.observacoes as string}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Use a tab <span className="font-medium">Histórico</span> para registar novas observações com data.
                </p>
              </div>
            </div>
          )}

        </div>
      </aside>

      {/* ─── RIGHT: tabs + content / Card 2 in mobile carousel ─── */}
      <div
        className={cn(
          'relative',
          // Mobile: gray glassmorphic pane (light) — mantém-se o mesh.
          'w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] shrink-0 snap-center h-full overflow-y-auto',
          'rounded-[2.25rem] ring-1 ring-border/30',
          'bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100',
          'dark:bg-gradient-to-br dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800',
          // Desktop ainda mais claro — quase white com hint de gray.
          'lg:bg-gradient-to-br lg:from-neutral-50 lg:via-white lg:to-neutral-50',
          'lg:dark:bg-gradient-to-br lg:dark:from-neutral-900 lg:dark:via-neutral-950 lg:dark:to-neutral-900',
          // Desktop: standalone card (75%), mantém glass styles. Height
          // natural — cresce com o conteúdo.
          'lg:flex-1 lg:min-w-0 lg:h-auto lg:overflow-visible',
        )}
      >
          {/* Mesh blobs — visível também em desktop. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.25rem]"
          >
            <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-neutral-400/35 dark:bg-neutral-700/55 blur-3xl" />
            <div className="absolute top-[15%] -right-20 h-72 w-72 rounded-full bg-neutral-300/35 dark:bg-neutral-700/45 blur-3xl" />
            <div className="absolute top-1/3 left-[20%] h-64 w-64 rounded-full bg-neutral-100/45 dark:bg-neutral-800/55 blur-3xl" />
            <div className="absolute top-[55%] right-[15%] h-64 w-64 rounded-full bg-neutral-400/35 dark:bg-neutral-700/50 blur-3xl" />
            <div className="absolute top-[70%] -left-20 h-72 w-72 rounded-full bg-neutral-200/40 dark:bg-neutral-800/55 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-neutral-400/35 dark:bg-neutral-700/55 blur-3xl" />
          </div>

          {/* Conteúdo (relative para ficar acima dos blobs absolutos). */}
          <div className="relative p-4 sm:p-5 lg:p-6">
          {/* Mobile: tabs row centred at the top of the right pane card */}
          <div className="lg:hidden mb-3 flex items-center justify-center">
            {tabsListJsx}
          </div>

          {/* Desktop only: tabs (left) + 5 context-action buttons (right) */}
          <div className="mb-4 hidden lg:flex items-center gap-2">
            {tabsListJsx}

            <div className="ml-auto flex items-center gap-1.5">
              {contextActionsCluster}
            </div>
          </div>

            {/* Negocios Tab */}
            <TabsContent value="negocios" className="mt-0 space-y-4">
              {/* Pill style consistente com "Nova nota" (Stone) e "Perfil
                  do cliente" (Indigo) — agora a "Nova Oportunidade" usa
                  Emerald. Centrado em todos os ecrãs. */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setNewNegocioOpen(true)}
                  className="group inline-flex items-center gap-2 h-8 rounded-full border border-emerald-700/40 bg-emerald-700/15 backdrop-blur-sm px-3 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-700/25 transition-colors shadow-sm"
                  title="Criar nova oportunidade"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova Oportunidade
                </button>
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
                  <p className="text-muted-foreground text-sm">Nenhuma oportunidade associada</p>
                  <button
                    type="button"
                    onClick={() => setNewNegocioOpen(true)}
                    className="group inline-flex items-center gap-2 h-8 mt-3 rounded-full border border-emerald-700/40 bg-emerald-700/15 backdrop-blur-sm px-3 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-700/25 transition-colors shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Criar Oportunidade
                  </button>
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

              {/* Nova Oportunidade sheet — auto-managed state */}
              <NewNegocioSheet
                open={newNegocioOpen}
                onOpenChange={setNewNegocioOpen}
                leadId={id}
                onCreated={handleNegocioCreated}
              />

              {/* Delete negocio confirmation */}
              <AlertDialog open={!!negocioToDelete} onOpenChange={(open) => !open && setNegocioToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar Oportunidade</AlertDialogTitle>
                    <AlertDialogDescription>Tem a certeza de que pretende eliminar esta oportunidade? Esta acção é irreversível.</AlertDialogDescription>
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

            {/* Notas Tab — composer + AI profile + observation timeline */}
            {/* Notas Tab — observações (activity_type='note'). */}
            <TabsContent value="notas" className="mt-0 space-y-3">
              {/* Legacy observacoes migration banner */}
              {(form.observacoes as string)?.trim() && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
                  <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Observação antiga sem data</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {form.observacoes as string}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs h-7 px-3 shrink-0"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/leads/${id}/migrate-observacoes`, { method: 'POST' })
                        if (!res.ok) throw new Error()
                        updateField('observacoes', '')
                        setLead((prev) => (prev ? { ...prev, observacoes: null } : prev))
                        loadActivities()
                        toast.success('Observação movida para o histórico')
                      } catch {
                        toast.error('Erro ao mover observação')
                      }
                    }}
                  >
                    Mover para o histórico
                  </Button>
                </div>
              )}

              {/* Top actions — Perfil IA + Nova nota lado-a-lado. */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setProfileSheetOpen(true)}
                  className="group inline-flex items-center gap-2 h-8 rounded-full border border-indigo-700/40 bg-indigo-700/15 backdrop-blur-sm px-3 text-xs font-medium text-indigo-800 dark:text-indigo-300 hover:bg-indigo-700/25 transition-colors shadow-sm"
                  title="Ver perfil IA do cliente"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Perfil do cliente
                </button>
                <button
                  type="button"
                  onClick={() => setQuickNoteOpen(true)}
                  className="group inline-flex items-center gap-2 h-8 rounded-full border border-stone-700/40 bg-stone-700/15 backdrop-blur-sm px-3 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-700/25 transition-colors shadow-sm"
                  title="Adicionar nova nota"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  Nova nota
                </button>
              </div>

              {(() => {
                const notes = activities.filter((a) => a.activity_type === 'note')
                if (activitiesLoading) {
                  return (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
                    </div>
                  )
                }
                if (notes.length === 0) return null
                return (
                  <div className="space-y-2">
                    {notes.map((act) => (
                      <ObservationItem
                        key={act.id}
                        activity={act as ObservationActivity}
                        contactId={id}
                        onChanged={() => {
                          loadActivities()
                          setProfileInvalidateKey((k) => k + 1)
                        }}
                        onNegocioClick={openNegocioSheet}
                      />
                    ))}
                  </div>
                )
              })()}
            </TabsContent>

            {/* Agenda Tab — sub-tabs: calendar (events) + tasks linked to this contact */}
            <TabsContent value="agenda" className="mt-0">
              <LeadAgendaTab
                contactId={id}
                negocioIds={(negocios as Array<{ id?: string }>).map((n) => n.id).filter((nid): nid is string => !!nid)}
                onCreateEvent={() => setEventFormOpen(true)}
                onCreateTask={() => setTaskFormOpen(true)}
              />
            </TabsContent>

            {/* Histórico Tab — passive record: entradas + anexos */}
            <TabsContent value="historico" className="mt-0 space-y-4">
              {/* Subtabs — centrado com mx-auto. */}
              <div className="flex items-center gap-1 rounded-full bg-muted/50 p-1 w-fit mx-auto border border-border/30">
                {([
                  { key: 'atividade' as const, label: 'Atividade', count: activities.length },
                  { key: 'entradas' as const, label: 'Entradas', count: entries.length },
                  { key: 'anexos' as const, label: 'Anexos', count: attachments.length },
                ]).map((sub) => (
                  <button
                    key={sub.key}
                    onClick={() => setHistoricoSubtab(sub.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                      historicoSubtab === sub.key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    )}
                  >
                    {sub.label}
                    {sub.count > 0 && (
                      <span className={cn(
                        'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center',
                        historicoSubtab === sub.key
                          ? 'bg-muted/60 text-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {sub.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Atividade subtab — chronological record of tasks, events, calls, notes, etc. */}
              {historicoSubtab === 'atividade' && (
                <div className="space-y-2">
                  {activitiesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                        <Clock className="h-7 w-7 text-muted-foreground/30" />
                      </div>
                      <p className="text-muted-foreground text-sm">Sem atividade registada</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">Tarefas, eventos, chamadas e notas aparecem aqui em ordem cronológica</p>
                    </div>
                  ) : (
                    activities.map((act) => {
                      const isCompleted = act.metadata?.is_completed === true
                      const startDate = act.metadata?.start_date ? new Date(act.metadata.start_date) : null
                      const eventInPast = startDate ? startDate.getTime() <= Date.now() : false
                      const meta = (() => {
                        switch (act.activity_type) {
                          case 'task':          return {
                            Icon: CheckSquare,
                            // Distingue "Tarefa criada" (ainda por fazer) de
                            // "Tarefa concluída" (já feita) — duas linhas
                            // diferentes no histórico.
                            label: isCompleted ? 'Tarefa concluída' : 'Tarefa criada',
                            tint: isCompleted
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-amber-500/10 text-amber-600',
                          }
                          case 'event':         return {
                            Icon: CalendarDays,
                            // "Evento agendado" enquanto a data ainda não chegou,
                            // "Evento ocorrido" depois.
                            label: eventInPast ? 'Evento ocorrido' : 'Evento agendado',
                            tint: eventInPast
                              ? 'bg-purple-500/10 text-purple-600'
                              : 'bg-violet-500/10 text-violet-600',
                          }
                          case 'note':          return { Icon: StickyNote,     label: 'Nota',       tint: 'bg-sky-500/10 text-sky-600' }
                          case 'call':          return { Icon: Phone,          label: 'Chamada',    tint: 'bg-emerald-500/10 text-emerald-600' }
                          case 'email':         return { Icon: Mail,           label: 'Email',      tint: 'bg-blue-500/10 text-blue-600' }
                          case 'whatsapp':      return { Icon: MessageSquare,  label: 'WhatsApp',   tint: 'bg-emerald-500/10 text-emerald-600' }
                          case 'sms':           return { Icon: Smartphone,     label: 'SMS',        tint: 'bg-indigo-500/10 text-indigo-600' }
                          case 'visit':         return { Icon: CalendarDays,   label: 'Visita',     tint: 'bg-purple-500/10 text-purple-600' }
                          case 'status_change': return { Icon: Sparkles,       label: 'Estado',     tint: 'bg-stone-500/10 text-stone-600' }
                          case 'assignment':    return { Icon: Sparkles,       label: 'Atribuição', tint: 'bg-stone-500/10 text-stone-600' }
                          case 'qualification': return { Icon: Sparkles,       label: 'Qualif.',    tint: 'bg-stone-500/10 text-stone-600' }
                          default:              return { Icon: Clock,          label: act.activity_type || 'Atividade', tint: 'bg-muted text-muted-foreground' }
                        }
                      })()
                      const Icon = meta.Icon
                      const dateStr = formatDate(act.occurred_at || act.created_at)
                      const author = act.created_by_user?.commercial_name
                      const isFutureEvent = act.activity_type === 'event' && act.metadata?.start_date && new Date(act.metadata.start_date).getTime() > Date.now()
                      const isOverdueTask = act.activity_type === 'task' && !act.metadata?.is_completed && act.metadata?.due_date && new Date(act.metadata.due_date).getTime() < Date.now()
                      const isCompletedTask = act.activity_type === 'task' && act.metadata?.is_completed
                      return (
                        <div
                          key={act.id}
                          className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm px-4 py-3 flex items-start gap-3 transition-all hover:bg-card/80"
                        >
                          <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.tint)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate max-w-full">
                                {act.subject || act.description || meta.label}
                              </span>
                              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0', meta.tint)}>
                                {meta.label}
                              </span>
                              {/* Concluída/Futuro já estão expressos no label
                                  principal (Tarefa concluída / Evento agendado).
                                  Só mantemos "Em atraso" porque transmite
                                  urgência que o label não cobre. */}
                              {isOverdueTask && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 shrink-0">Em atraso</span>
                              )}
                            </div>
                            {act.subject && act.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{act.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                              {dateStr}
                              {author && <span> · {author}</span>}
                              {act.metadata?.location && <span> · {act.metadata.location}</span>}
                            </p>
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
          </div> {/* close inner content wrapper of right pane */}
        </div> {/* close right pane outer wrapper */}
      </div> {/* close carousel wrapper */}
    </Tabs>

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

      {/* Refer this contacto to another consultor. Reassigns leads.agent_id
          to the recipient and flags leads.referred_by_consultant_id so the
          referrer keeps audit visibility on every future négocio. */}
      {lead && (
        <ReferenciarDialog
          open={referOpen}
          onOpenChange={setReferOpen}
          subject={{ kind: 'contact', id: lead.id, contact_id: lead.id }}
          onSuccess={() => {
            // Contact handed off — reload so the new consultor + audit flag
            // surfaces in the sidebar. The lead is no longer "mine" but the
            // referrer can still navigate back here from the Referências
            // page if they want to see the contacto's full history.
            loadLead()
          }}
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
        onChanged={() => {
          loadNegocios()
          loadLead()
        }}
      />

      {/* Dados sheet — substitui o tab "Dados" */}
      <LeadDataSheet
        open={dataSheetOpen}
        onOpenChange={setDataSheetOpen}
        lead={lead}
        form={form}
        onFieldChange={updateField}
        onSave={saveFields}
        isSaving={isSaving}
        attachments={attachments}
        onDeleteAttachment={async (attId) => {
          try {
            const res = await fetch(`/api/leads/attachments/${attId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            loadAttachments()
            toast.success('Anexo eliminado')
          } catch {
            toast.error('Erro ao eliminar anexo')
          }
        }}
        onDocumentAnalysisApply={handleDocumentAnalysisApply}
        cpLoading={cpLoading}
        onPostalCodeLookup={handlePostalCodeLookup}
        nipcLoading={nipcLoading}
        onNipcLookup={handleNipcLookup}
      />

      {/* Leads sheet — substitui o tab "Leads" */}
      <LeadEntriesSheet
        open={entriesSheetOpen}
        onOpenChange={setEntriesSheetOpen}
        contactId={id}
        entries={entries}
        loading={entriesLoading}
        pendingCount={pendingLeads.length}
        onQualified={() => { loadEntries(); loadNegocios(); loadPendingLeads() }}
        onMarkedSeen={loadPendingLeads}
      />

      {/* Automatismos sheet — substitui o tab "Automatismos" */}
      <LeadAutomationsSheet
        open={automationsSheetOpen}
        onOpenChange={setAutomationsSheetOpen}
        contactId={id}
        contactBirthday={(lead?.data_nascimento as string | null | undefined) ?? null}
        hasDeals={negocios.length > 0}
      />

      {/* Edit sheet — quick edit for basic info (name/email/phone) */}
      <LeadEditSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        lead={lead}
        onSaved={(next) => {
          // Optimistic merge to avoid an extra fetch
          setLead((prev) => (prev ? { ...prev, ...next } : prev))
          setForm((prev) => ({ ...prev, ...next }))
        }}
        onReferenciar={() => {
          setEditSheetOpen(false)
          setReferOpen(true)
        }}
      />

      {/* AI client profile sheet */}
      <ClientProfileSheet
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        contactId={id}
        invalidateKey={profileInvalidateKey}
      />

      {/* Quick action: nota rápida — composer in a sheet */}
      <QuickNoteSheet
        open={quickNoteOpen}
        onOpenChange={setQuickNoteOpen}
        contactId={id}
        onSaved={() => {
          loadActivities()
          setProfileInvalidateKey((k) => k + 1)
        }}
      />

      {/* Quick action: create task pre-linked to this contact.
          canAssignToOthers=false → tarefa fica sempre atribuída ao
          consultor que a cria (sem selector "Atribuir a"). */}
      <TaskForm
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        onSuccess={() => {
          setTaskFormOpen(false)
          toast.success('Tarefa criada')
        }}
        consultants={consultants}
        currentUserId={user?.id}
        canAssignToOthers={false}
        defaultValues={{
          entity_type: 'lead',
          entity_id: id,
          title: lead.nome ? `${lead.nome} — ` : '',
        }}
      />

      {/* Quick action: create event linked to this contact (simplified sheet) */}
      <QuickEventSheet
        open={eventFormOpen}
        onOpenChange={setEventFormOpen}
        contactId={id}
        contactName={lead.nome ?? null}
      />
    </>
  )
}
