'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
import {
  ArrowLeft,
  Plus,
  Trash2,
  ExternalLink,
  Briefcase,
  FileText,
  Phone,
  Mail,
  MessageCircle,
  CalendarDays,
  Zap,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { formatDate, formatCurrency, NEGOCIO_TIPOS, LEAD_ESTADOS, LEAD_TEMPERATURAS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { LeadDataCard } from '@/components/leads/lead-data-card'
import { LeadDocumentsFoldersView } from '@/components/leads/lead-documents-folders-view'
import { LeadsEntryCards } from '@/components/leads/leads-entry-cards'
import { ContactAutomationsList } from '@/components/crm/contact-automations-list'
import { CallOutcomeDialog } from '@/components/crm/call-outcome-dialog'
import { WhatsAppChatBubble } from '@/components/whatsapp/whatsapp-chat-bubble'
import { EmailChatBubble } from '@/components/email/email-chat-bubble'
import type { LeadWithAgent, LeadAttachment } from '@/types/lead'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

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
      router.push(`/dashboard/leads/${id}/negocios/${data.id}`)
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

  const TEMP_STYLES: Record<string, { emoji: string; label: string; active: string }> = {
    Frio: { emoji: '❄️', label: 'Fria', active: 'bg-blue-400/20 text-blue-300 ring-1 ring-blue-400/40' },
    Morno: { emoji: '☀️', label: 'Morna', active: 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40' },
    Quente: { emoji: '🔥', label: 'Quente', active: 'bg-red-400/20 text-red-300 ring-1 ring-red-400/40' },
  }

  return (
    <div className="space-y-6">
      {/* Hero header with contact actions, estado, temperatura */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-8 sm:px-10">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-1 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors"
            onClick={() => router.push('/dashboard/leads')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>

          {/* Top section: name + contact actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{lead.nome}</h2>
              {lead.agent?.commercial_name && (
                <p className="text-sm text-neutral-400 mt-1">Consultor: {lead.agent.commercial_name}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-neutral-500">
                {lead.origem && <span>{lead.origem}</span>}
                {lead.origem && <span className="hidden sm:inline text-neutral-700">·</span>}
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(lead.created_at)}</span>
              </div>
            </div>

            {/* Contact action buttons */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                size="sm"
                disabled={!lead.telemovel}
                onClick={() => {
                  if (!lead.telemovel) return
                  window.location.href = `tel:${lead.telemovel}`
                  setTimeout(() => setCallOutcomeOpen(true), 500)
                }}
                className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
              >
                <Phone className="mr-1.5 h-3.5 w-3.5" />
                Ligar
              </Button>
              <Button
                size="sm"
                disabled={!lead.telemovel}
                onClick={() => lead.telemovel && window.open(`https://wa.me/${lead.telemovel.replace(/\D/g, '')}`, '_blank')}
                className="rounded-full bg-emerald-500/20 backdrop-blur-sm text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
              >
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                WhatsApp
              </Button>
              <Button
                size="sm"
                disabled={!lead.email}
                onClick={() => lead.email && (window.location.href = `mailto:${lead.email}`)}
                className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Email
              </Button>
            </div>
          </div>

          {/* Bottom section: estado + temperatura */}
          <div className="flex flex-wrap items-center gap-4 mt-5 pt-5 border-t border-white/10">
            {/* Estado */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Estado</span>
              <Select value={estadoValue} onValueChange={(v) => saveSidebarField('estado', v)}>
                <SelectTrigger className="h-7 w-auto min-w-[140px] rounded-full bg-white/10 border-white/20 text-white text-xs [&>svg]:text-white/60">
                  <SelectValue />
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

            <span className="h-4 w-px bg-white/10" />

            {/* Temperatura */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Temperatura</span>
              <div className="flex gap-1">
                {LEAD_TEMPERATURAS.map((t) => {
                  const info = TEMP_STYLES[t.value]
                  const isActive = temperaturaValue === t.value
                  return (
                    <button
                      key={t.value}
                      onClick={() => saveSidebarField('temperatura', t.value)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                        isActive
                          ? (info?.active || 'bg-white/15 text-white ring-1 ring-white/30')
                          : 'bg-white/5 text-neutral-500 hover:bg-white/10 hover:text-neutral-300'
                      )}
                    >
                      <span className="text-xs">{info?.emoji}</span>
                      {info?.label || t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width main content (no sidebar) */}
      <div>
          <Tabs
            defaultValue={tabFromUrl || (pendingLeads.length > 0 ? 'leads' : 'dados')}
            onValueChange={(tab) => {
              if (tab === 'leads') loadEntries()
              if (tab === 'negocios') loadNegocios()
              if (tab === 'automatismos') loadNegocios()
              if (tab === 'historico') { loadAttachments(); loadActivities(); loadEntries() }
            }}
          >
            {/* Pill tabs */}
            <TabsList className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm mb-4 h-auto">
              {[
                { key: 'leads', label: 'Leads', count: pendingLeads.length || undefined },
                { key: 'negocios', label: 'Negócios' },
                { key: 'dados', label: 'Dados' },
                { key: 'automatismos', label: 'Automatismos' },
                { key: 'historico', label: 'Histórico' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 gap-1.5',
                    'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
                    'data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50',
                    'dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900'
                  )}
                >
                  {tab.label}
                  {'count' in tab && tab.count ? (
                    <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                      {tab.count}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {negocios.map((neg, idx) => {
                    const tipo = neg.tipo as string

                    const TIPO_TAG: Record<string, { color: string; label: string }> = {
                      'Compra':         { color: '#3b82f6', label: 'Compra' },
                      'Venda':          { color: '#10b981', label: 'Venda' },
                      'Compra e Venda': { color: '#8b5cf6', label: 'C+V' },
                      'Arrendatário':   { color: '#f59e0b', label: 'Arrendat.' },
                      'Arrendador':     { color: '#fb923c', label: 'Senhorio' },
                    }
                    const tipoTag = TIPO_TAG[tipo] || { color: '#64748b', label: tipo }

                    const TEMP_TAG: Record<string, { color: string; emoji: string; label: string }> = {
                      'Frio':   { color: '#3b82f6', emoji: '❄️', label: 'Frio' },
                      'Morno':  { color: '#f59e0b', emoji: '🌤️', label: 'Morno' },
                      'Quente': { color: '#ef4444', emoji: '🔥', label: 'Quente' },
                    }
                    const tempTag = neg.temperatura ? TEMP_TAG[neg.temperatura as string] : null

                    // Pipeline stage join (may come back as `leads_pipeline_stages` from the join)
                    const stage = (neg as any).leads_pipeline_stages || (neg as any).pipeline_stage
                    const stageName = (stage?.name as string) || (neg.estado as string) || 'Contactado'
                    const stageColor = (stage?.color as string) || '#64748b'

                    return (
                      <div
                        key={neg.id as string}
                        onClick={() => router.push(`/dashboard/leads/${id}/negocios/${neg.id}`)}
                        className={cn(
                          'group relative rounded-2xl border-2 border-border bg-card cursor-pointer p-5',
                          'transition-all duration-300 hover:shadow-md hover:border-foreground/20',
                          'animate-in fade-in slide-in-from-bottom-2',
                        )}
                        style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
                      >
                        {/* Top: tipo + temperatura + estado + delete */}
                        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1"
                              style={{
                                backgroundColor: `${tipoTag.color}26`,
                                color: tipoTag.color,
                                ['--tw-ring-color' as any]: `${tipoTag.color}55`,
                              }}
                            >
                              <Briefcase className="h-3 w-3" />
                              {tipoTag.label}
                            </span>
                            {tempTag && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1"
                                style={{
                                  backgroundColor: `${tempTag.color}26`,
                                  color: tempTag.color,
                                  ['--tw-ring-color' as any]: `${tempTag.color}55`,
                                }}
                              >
                                <span aria-hidden className="text-xs leading-none">{tempTag.emoji}</span>
                                {tempTag.label}
                              </span>
                            )}
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1"
                              style={{
                                backgroundColor: `${stageColor}26`,
                                color: stageColor,
                                ['--tw-ring-color' as any]: `${stageColor}55`,
                              }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor }} />
                              {stageName}
                            </span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setNegocioToDelete(neg.id as string) }}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground/40 hover:text-destructive transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Middle: criteria pills */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {!!neg.tipo_imovel && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted/60 text-foreground px-2.5 py-1 rounded-full">
                              {neg.tipo_imovel as string}
                            </span>
                          )}
                          {!!neg.quartos_min && (
                            <span className="text-[11px] font-medium bg-muted/60 text-foreground px-2.5 py-1 rounded-full">T{neg.quartos_min as number}+</span>
                          )}
                          {!!neg.localizacao && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted/60 text-foreground px-2.5 py-1 rounded-full truncate max-w-[160px]">
                              {neg.localizacao as string}
                            </span>
                          )}
                          {!neg.tipo_imovel && !neg.quartos_min && !neg.localizacao && (
                            <span className="text-[11px] text-muted-foreground italic">Sem critérios definidos</span>
                          )}
                        </div>

                        {/* Bottom: value + date */}
                        <div className="flex items-center justify-between pt-3 border-t border-border/40">
                          <div className="flex items-center gap-2">
                            {!!neg.orcamento && (
                              <span className="text-lg font-bold text-foreground">{formatCurrency(neg.orcamento as number)}</span>
                            )}
                            {!!neg.orcamento_max && neg.orcamento_max !== neg.orcamento && (
                              <span className="text-xs text-muted-foreground">— {formatCurrency(neg.orcamento_max as number)}</span>
                            )}
                            {!!neg.preco_venda && !neg.orcamento && (
                              <span className="text-lg font-bold text-foreground">{formatCurrency(neg.preco_venda as number)}</span>
                            )}
                            {!neg.orcamento && !neg.preco_venda && (
                              <span className="text-xs text-muted-foreground italic">Sem valor</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(neg.created_at as string)}</span>
                        </div>
                      </div>
                    )
                  })}
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
                          {NEGOCIO_TIPOS.map((t) => (
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
            <TabsContent value="historico" className="mt-0 space-y-4">
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

      {/* Call outcome dialog */}
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
    </div>
  )
}
