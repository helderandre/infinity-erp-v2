"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  Calendar,
  Check,
  ExternalLink,
  History,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Users,
  VolumeX,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useCustomEvent } from "@/hooks/use-custom-event"

const RUN_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-amber-100", text: "text-amber-800", label: "Agendado" },
  sent: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Enviado" },
  failed: { bg: "bg-red-100", text: "text-red-800", label: "Falhado" },
  skipped: { bg: "bg-slate-100", text: "text-slate-700", label: "Ignorado" },
}

interface Props {
  eventId: string | null
  isFixed: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomEventDetailDialog({ eventId, isFixed, open, onOpenChange }: Props) {
  const { event, isLoading, refetch } = useCustomEvent(open ? eventId : null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [removingLeadId, setRemovingLeadId] = useState<string | null>(null)

  async function handleRetry(runId: string) {
    setRetryingId(runId)
    try {
      const res = await fetch(`/api/automacao/runs/${runId}/retry`, { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success("Run reagendado com sucesso")
      refetch()
    } catch {
      toast.error("Erro ao reagendar run")
    } finally {
      setRetryingId(null)
    }
  }

  async function handleRemoveLead(leadId: string) {
    if (!eventId) return
    setRemovingLeadId(leadId)
    try {
      const res = await fetch(`/api/automacao/custom-events/${eventId}/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: [leadId] }),
      })
      if (!res.ok) throw new Error()
      toast.success("Contacto removido do evento")
      refetch()
    } catch {
      toast.error("Erro ao remover contacto")
    } finally {
      setRemovingLeadId(null)
    }
  }

  if (isFixed) {
    return (
      <FixedEventDetailDialog
        eventId={eventId}
        open={open}
        onOpenChange={onOpenChange}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event?.name ?? "Detalhe do Automatismo"}</DialogTitle>
        </DialogHeader>

        {isLoading || !event ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <>
            {/* Event info bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {new Date(event.event_date + "T00:00:00").toLocaleDateString("pt-PT", { day: "2-digit", month: "long" })}
                {" · "}{String(event.send_hour).padStart(2, "0")}:00
              </div>
              <Badge variant="secondary">{event.is_recurring ? "Anual" : "Única vez"}</Badge>
              <div className="flex gap-1">
                {event.channels.includes("email") && (
                  <Badge variant="outline" className="gap-0.5">
                    <Mail className="h-3 w-3" /> Email
                  </Badge>
                )}
                {event.channels.includes("whatsapp") && (
                  <Badge variant="outline" className="gap-0.5">
                    <MessageCircle className="h-3 w-3" /> WPP
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground ml-auto">
                <Users className="h-3.5 w-3.5" />
                {event.lead_count} contacto{event.lead_count !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Tabs: Contactos / Execuções */}
            <Tabs defaultValue="contactos" className="mt-2">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="contactos" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Contactos ({event.leads.length})
                </TabsTrigger>
                <TabsTrigger value="execucoes" className="gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Execuções ({event.runs.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contactos" className="mt-3">
                {event.leads.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Nenhum contacto associado</p>
                  </div>
                ) : (
                  <div className="rounded-lg border max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Telemóvel</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {event.leads.map((lead) => (
                          <TableRow key={lead.lead_id}>
                            <TableCell className="text-sm font-medium">{lead.name ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.email ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.telemovel ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {lead.status ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveLead(lead.lead_id)}
                                disabled={removingLeadId === lead.lead_id}
                                title="Remover do evento"
                              >
                                {removingLeadId === lead.lead_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="execucoes" className="mt-3">
                {event.runs.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma execução registada</p>
                  </div>
                ) : (
                  <div className="rounded-lg border max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contacto</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {event.runs.map((run) => {
                          const status = RUN_STATUS_STYLES[run.status] ?? RUN_STATUS_STYLES.pending
                          return (
                            <TableRow key={run.id}>
                              <TableCell className="text-sm font-medium">
                                {run.lead_name ?? run.lead_id?.slice(0, 8) ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {run.event_type ?? "—"}
                              </TableCell>
                              <TableCell>
                                <span className={cn("rounded-md px-2 py-0.5 text-xs", status.bg, status.text)}>
                                  {status.label}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {run.sent_at
                                  ? new Date(run.sent_at).toLocaleString("pt-PT")
                                  : run.scheduled_for
                                    ? new Date(run.scheduled_for).toLocaleString("pt-PT")
                                    : "—"}
                              </TableCell>
                              <TableCell>
                                {run.status === "failed" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleRetry(run.id)}
                                    disabled={retryingId === run.id}
                                    title="Reenviar"
                                  >
                                    {retryingId === run.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Fixed Event Detail (Aniversário, Natal, Ano Novo) ───────────────

const FIXED_EVENT_META: Record<string, { name: string; eventType: string; date: string; defaultHour: number }> = {
  "fixed-aniversario": { name: "Aniversário do Contacto", eventType: "aniversario_contacto", date: "Data de nascimento", defaultHour: 9 },
  "fixed-natal": { name: "Natal", eventType: "natal", date: "25 de Dezembro", defaultHour: 5 },
  "fixed-ano-novo": { name: "Ano Novo", eventType: "ano_novo", date: "31 de Dezembro", defaultHour: 5 },
}

interface FixedLead { id: string; name: string | null; email: string | null; telemovel: string | null; status: string | null; data_nascimento?: string | null }
interface LeadSetting { lead_id: string; send_hour: number | null; email_template_id: string | null; wpp_template_id: string | null }
interface MuteEntry { id: string; lead_id: string | null; event_type: string | null; channel: string | null }
interface TplOption { id: string; name: string; scope: string; category?: string | null }

function FixedEventDetailDialog({ eventId, open, onOpenChange }: { eventId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [leads, setLeads] = useState<FixedLead[]>([])
  const [mutes, setMutes] = useState<MuteEntry[]>([])
  const [settings, setSettings] = useState<Record<string, LeadSetting>>({})
  const [emailTemplates, setEmailTemplates] = useState<TplOption[]>([])
  const [wppTemplates, setWppTemplates] = useState<TplOption[]>([])
  const [defaultEmailTplId, setDefaultEmailTplId] = useState<string | null>(null)
  const [defaultWppTplId, setDefaultWppTplId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isEventMuted, setIsEventMuted] = useState(false)
  const [eventMuteId, setEventMuteId] = useState<string | null>(null)
  const [togglingEvent, setTogglingEvent] = useState(false)
  const [editingGlobalHour, setEditingGlobalHour] = useState(false)
  const [globalHour, setGlobalHour] = useState(9)
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [editLeadHour, setEditLeadHour] = useState(9)
  const [editingTplLeadId, setEditingTplLeadId] = useState<string | null>(null)

  const meta = eventId ? FIXED_EVENT_META[eventId] : null
  const eventName = meta?.name ?? "Automatismo"
  const eventType = meta?.eventType ?? ""
  const defaultHour = meta?.defaultHour ?? 9

  const fetchAll = useCallback(async () => {
    if (!open || !eventType) return
    setIsLoading(true)
    try {
      const [leadsRes, mutesRes, emailTplRes, wppTplRes, defaultsRes] = await Promise.all([
        fetch("/api/automacao/custom-events/eligible-leads?limit=200"),
        fetch(`/api/contact-automation-mutes?event_type=${eventType}`),
        fetch("/api/automacao/email-templates?active=true").catch(() => null),
        fetch("/api/automacao/templates-wpp?active=true").catch(() => null),
        fetch("/api/automacao/template-defaults").catch(() => null),
      ])

      const leadsData = leadsRes.ok ? await leadsRes.json() : { leads: [] }
      const mutesData = mutesRes.ok ? await mutesRes.json() : []
      const emailTplData = emailTplRes?.ok ? await emailTplRes.json() : []
      const wppTplData = wppTplRes?.ok ? await wppTplRes.json() : []
      const defaultsData = defaultsRes?.ok ? await defaultsRes.json() : {}

      setLeads(leadsData.leads ?? [])
      const allMutes: MuteEntry[] = Array.isArray(mutesData) ? mutesData : (mutesData?.mutes ?? [])
      setMutes(allMutes)
      const allEmailTpls = Array.isArray(emailTplData) ? emailTplData : (emailTplData?.templates ?? [])
      const allWppTpls = Array.isArray(wppTplData) ? wppTplData : (wppTplData?.templates ?? [])
      setEmailTemplates(allEmailTpls)
      setWppTemplates(allWppTpls)

      // Resolve default template for this event via cascade:
      // 1. consultant_template_defaults (explicit choice)
      // 2. system template (is_system=true)
      const defs: Array<{ category: string; channel: string; template_id: string }> = defaultsData?.defaults ?? []
      const emailDef = defs.find((d) => d.category === eventType && d.channel === "email")
      const wppDef = defs.find((d) => d.category === eventType && d.channel === "whatsapp")

      if (emailDef) {
        setDefaultEmailTplId(emailDef.template_id)
      } else {
        // Fallback: system template for this category
        const systemEmail = allEmailTpls.find((t: TplOption) => t.category === eventType && (t as any).is_system)
        setDefaultEmailTplId(systemEmail?.id ?? null)
      }
      if (wppDef) {
        setDefaultWppTplId(wppDef.template_id)
      } else {
        const systemWpp = allWppTpls.find((t: TplOption) => t.category === eventType && (t as any).is_system)
        setDefaultWppTplId(systemWpp?.id ?? null)
      }

      // Check global event mute (consultant-wide, all channels)
      const globalMute = allMutes.find((m) => !m.lead_id && m.event_type === eventType && !m.channel)
      setIsEventMuted(!!globalMute)
      setEventMuteId(globalMute?.id ?? null)

      // Fetch per-lead settings
      const allLeads: FixedLead[] = leadsData.leads ?? []
      const settingsMap: Record<string, LeadSetting> = {}
      await Promise.all(
        allLeads.slice(0, 50).map(async (l) => {
          try {
            const res = await fetch(`/api/leads/${l.id}/automation-settings`)
            if (res.ok) {
              const data = await res.json()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const arr = Array.isArray(data) ? data : (data.settings ?? data.data ?? [])
              const match = arr.find((s: any) => s.event_type === eventType)
              if (match) settingsMap[l.id] = match
            }
          } catch { /* ignore */ }
        }),
      )
      setSettings(settingsMap)
    } catch { setLeads([]) } finally { setIsLoading(false) }
  }, [open, eventType])

  useEffect(() => { fetchAll() }, [fetchAll])

  function isLeadMuted(leadId: string): boolean {
    return mutes.some((m) => (m.lead_id === leadId || m.lead_id === null) && (m.event_type === eventType || m.event_type === null))
  }

  const activeLeads = leads.filter((l) => !isLeadMuted(l.id))
  const mutedLeads = leads.filter((l) => isLeadMuted(l.id))

  async function toggleEventActive() {
    setTogglingEvent(true)
    try {
      if (isEventMuted && eventMuteId) {
        await fetch(`/api/contact-automation-mutes?id=${eventMuteId}`, { method: "DELETE" })
        toast.success("Automatismo activado")
      } else {
        await fetch("/api/contact-automation-mutes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: eventType, lead_id: null, channel: null }),
        })
        toast.success("Automatismo desactivado")
      }
      void fetchAll()
    } catch { toast.error("Erro ao alterar estado") } finally { setTogglingEvent(false) }
  }

  async function handleMute(leadId: string) {
    setBusyId(leadId)
    try {
      const res = await fetch("/api/contact-automation-mutes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: leadId, event_type: eventType }) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Erro")
      }
      toast.success("Contacto removido")
      await fetchAll()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover contacto") } finally { setBusyId(null) }
  }

  async function handleUnmute(leadId: string) {
    const mute = mutes.find((m) => m.lead_id === leadId && (m.event_type === eventType || m.event_type === null))
    if (!mute) return
    setBusyId(leadId)
    try {
      await fetch(`/api/contact-automation-mutes?id=${mute.id}`, { method: "DELETE" })
      toast.success("Contacto adicionado")
      void fetchAll()
    } catch { toast.error("Erro ao adicionar contacto") } finally { setBusyId(null) }
  }

  async function handleSaveLeadSetting(leadId: string, data: { send_hour?: number; email_template_id?: string | null; wpp_template_id?: string | null }) {
    setBusyId(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}/automation-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, ...data }),
      })
      if (!res.ok) throw new Error()
      toast.success("Configuração actualizada")
      void fetchAll()
    } catch { toast.error("Erro ao actualizar") } finally { setBusyId(null) }
  }

  async function handleRemoveLeadOverride(leadId: string) {
    setBusyId(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}/automation-settings?event_type=${eventType}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Override removido — usa template geral")
      void fetchAll()
    } catch { toast.error("Erro ao remover override") } finally { setBusyId(null) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        {/* Header: name + date/hour (editable) + toggle */}
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {eventName}
                <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                  · {meta?.date} ·{" "}
                  {editingGlobalHour ? (
                    <span className="inline-flex items-center gap-1">
                      <select
                        title="Hora global"
                        className="h-6 w-[68px] rounded border text-xs px-1 bg-transparent"
                        value={globalHour}
                        onChange={(e) => setGlobalHour(parseInt(e.target.value))}
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                        ))}
                      </select>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingGlobalHour(false); toast.success(`Hora global: ${String(globalHour).padStart(2, "0")}:00`) }}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingGlobalHour(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </span>
                  ) : (
                    <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => { setGlobalHour(defaultHour); setEditingGlobalHour(true) }}>
                      {String(defaultHour).padStart(2, "0")}:00
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {togglingEvent ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Switch checked={!isEventMuted} onCheckedChange={toggleEventActive} />
              )}
              <span className="text-xs text-muted-foreground">
                {isEventMuted ? "Desactivado" : "Activo"}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Info bar: channels + template link */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-4 py-2.5">
          <Badge variant="secondary">Anual</Badge>
          <Badge variant="outline" className="gap-0.5"><Mail className="h-3 w-3" /> Email</Badge>
          <Badge variant="outline" className="gap-0.5"><MessageCircle className="h-3 w-3" /> WPP</Badge>
          <Link href="/dashboard/automacao/templates-wpp" className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Ver templates
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2 mt-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <Tabs defaultValue="activos" className="mt-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="activos" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Activos ({activeLeads.length})</TabsTrigger>
              <TabsTrigger value="excluidos" className="gap-1.5"><VolumeX className="h-3.5 w-3.5" /> Excluídos ({mutedLeads.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="activos" className="mt-3">
              {activeLeads.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum contacto activo neste automatismo</p>
                </div>
              ) : (
                <div className="rounded-lg border max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Dia e Hora</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead className="w-20 text-right">Acções</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeLeads.map((lead) => {
                        const s = settings[lead.id]
                        const hour = s?.send_hour ?? defaultHour
                        const hasTplOverride = !!s
                        const isEditingThis = editingLeadId === lead.id

                        // Build date display with actual date
                        let dateDisplay = ""
                        if (eventType === "aniversario_contacto") {
                          if (lead.data_nascimento) {
                            const d = new Date(lead.data_nascimento + "T00:00:00")
                            dateDisplay = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
                          } else {
                            dateDisplay = "Sem data"
                          }
                        } else if (eventType === "natal") {
                          dateDisplay = "25/12"
                        } else {
                          dateDisplay = "31/12"
                        }

                        return (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{lead.name ?? "—"}</p>
                              {lead.email && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{lead.email}</span>
                                </p>
                              )}
                              {lead.telemovel && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{lead.telemovel}</span>
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground">{dateDisplay} ·</span>
                                  <Select value={String(editLeadHour)} onValueChange={(v) => setEditLeadHour(parseInt(v))}>
                                    <SelectTrigger className="h-7 w-[80px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: 24 }, (_, h) => (
                                        <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <span className="text-xs">
                                  {dateDisplay} · {String(hour).padStart(2, "0")}:00
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditingThis ? (() => {
                                const filteredEmail = emailTemplates.filter((t) => t.category === eventType)
                                const filteredWpp = wppTemplates.filter((t) => t.category === eventType)
                                return (
                                  <div className="flex flex-col gap-1.5">
                                    {filteredEmail.length > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <Select
                                          value={s?.email_template_id ?? "none"}
                                          onValueChange={(v) => handleSaveLeadSetting(lead.id, { email_template_id: v === "none" ? null : v })}
                                          disabled={busyId === lead.id}
                                        >
                                          <SelectTrigger className="h-7 flex-1 max-w-[160px] text-[11px]">
                                            <SelectValue placeholder="Padrão" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">
                                              Padrão{defaultEmailTplId ? ` (${emailTemplates.find((t) => t.id === defaultEmailTplId)?.name ?? "..."})` : ""}
                                            </SelectItem>
                                            {filteredEmail.map((t) => (
                                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                    {filteredWpp.length > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <MessageCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <Select
                                          value={s?.wpp_template_id ?? "none"}
                                          onValueChange={(v) => handleSaveLeadSetting(lead.id, { wpp_template_id: v === "none" ? null : v })}
                                          disabled={busyId === lead.id}
                                        >
                                          <SelectTrigger className="h-7 flex-1 max-w-[160px] text-[11px]">
                                            <SelectValue placeholder="Padrão" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">
                                              Padrão{defaultWppTplId ? ` (${wppTemplates.find((t) => t.id === defaultWppTplId)?.name ?? "..."})` : ""}
                                            </SelectItem>
                                            {filteredWpp.map((t) => (
                                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                    {filteredEmail.length === 0 && filteredWpp.length === 0 && (
                                      <span className="text-[10px] text-muted-foreground">Sem templates para este automatismo</span>
                                    )}
                                    <div className="flex items-center gap-2 pt-1">
                                      <Button
                                        size="sm"
                                        className="h-7 rounded-full text-xs"
                                        disabled={busyId === lead.id}
                                        onClick={() => {
                                          handleSaveLeadSetting(lead.id, { send_hour: editLeadHour })
                                          setEditingLeadId(null)
                                        }}
                                      >
                                        {busyId === lead.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                        Guardar
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 rounded-full text-xs"
                                        onClick={() => setEditingLeadId(null)}
                                      >
                                        Cancelar
                                      </Button>
                                      <Link
                                        href={`/dashboard/templates-email/novo?scope=consultant&category=${eventType}`}
                                        className="text-[10px] text-primary hover:underline ml-auto"
                                      >
                                        + Novo template
                                      </Link>
                                    </div>
                                  </div>
                                )
                              })() : (
                                <TemplateNameDisplay
                                  emailTemplateId={s?.email_template_id ?? null}
                                  wppTemplateId={s?.wpp_template_id ?? null}
                                  defaultEmailTplId={defaultEmailTplId}
                                  defaultWppTplId={defaultWppTplId}
                                  emailTemplates={emailTemplates}
                                  wppTemplates={wppTemplates}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busyId === lead.id}>
                                      {busyId === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem onClick={() => { setEditLeadHour(hour); setEditingLeadId(lead.id); setEditingTplLeadId(null) }}>
                                      <Pencil className="h-3.5 w-3.5 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleMute(lead.id)}>
                                      <X className="h-3.5 w-3.5 mr-2" />
                                      Remover
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="excluidos" className="mt-3">
              {mutedLeads.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <VolumeX className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum contacto excluído</p>
                  <p className="text-xs mt-1">Todos os seus contactos recebem este automatismo.</p>
                </div>
              ) : (
                <div className="rounded-lg border max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telemóvel</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mutedLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="text-sm font-medium">{lead.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.email ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.telemovel ?? "—"}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" className="h-7 rounded-full text-xs" onClick={() => handleUnmute(lead.id)} disabled={busyId === lead.id}>
                              {busyId === lead.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                              Adicionar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Helper: show template name or "Geral" ───────────────────────────

function TemplateNameDisplay({
  emailTemplateId,
  wppTemplateId,
  defaultEmailTplId,
  defaultWppTplId,
  emailTemplates,
  wppTemplates,
}: {
  emailTemplateId: string | null
  wppTemplateId: string | null
  defaultEmailTplId: string | null
  defaultWppTplId: string | null
  emailTemplates: TplOption[]
  wppTemplates: TplOption[]
}) {
  // Cascade: lead-specific → consultant default → system
  const resolvedEmailId = emailTemplateId ?? defaultEmailTplId
  const resolvedWppId = wppTemplateId ?? defaultWppTplId
  const emailTpl = resolvedEmailId ? emailTemplates.find((t) => t.id === resolvedEmailId) : null
  const wppTpl = resolvedWppId ? wppTemplates.find((t) => t.id === resolvedWppId) : null
  const isEmailCustom = !!emailTemplateId
  const isWppCustom = !!wppTemplateId

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className={cn("text-[11px] truncate max-w-[130px]", isEmailCustom && "font-medium")} title={emailTpl?.name ?? "Sem template"}>
          {emailTpl?.name ?? "Sem template"}
        </span>
        {isEmailCustom && <span className="text-[9px] text-primary">●</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <MessageCircle className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className={cn("text-[11px] truncate max-w-[130px]", isWppCustom && "font-medium")} title={wppTpl?.name ?? "Sem template"}>
          {wppTpl?.name ?? "Sem template"}
        </span>
        {isWppCustom && <span className="text-[9px] text-primary">●</span>}
      </div>
    </div>
  )
}
