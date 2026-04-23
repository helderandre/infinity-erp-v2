"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Repeat,
  Search,
  VolumeX,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { SectionCard } from "../automation-detail-sheet/section-card"
import { InlineTemplateEditorDialog } from "../inline-template-editor-dialog"

/**
 * Detalhe para eventos fixos (Aniversário, Natal, Ano Novo).
 *
 * Migrado para `<Sheet>` partilhando a mesma linguagem visual do
 * `<AutomationDetailSheet>` (backdrop blur, SectionCards, pill-tabs, footer).
 * A lógica de dados mantém-se: usa os endpoints legados de mutes +
 * automation-settings + template-defaults (nada a ver com custom-events).
 */

const FIXED_EVENT_META: Record<
  string,
  { name: string; eventType: string; date: string; defaultHour: number }
> = {
  "fixed-aniversario": { name: "Aniversário do Contacto", eventType: "aniversario_contacto", date: "Data de nascimento", defaultHour: 9 },
  "fixed-natal": { name: "Natal", eventType: "natal", date: "25 de Dezembro", defaultHour: 5 },
  "fixed-ano-novo": { name: "Ano Novo", eventType: "ano_novo", date: "31 de Dezembro", defaultHour: 5 },
}

interface FixedLead {
  id: string
  name: string | null
  email: string | null
  telemovel: string | null
  status: string | null
  data_nascimento?: string | null
}

interface LeadSetting {
  lead_id: string
  send_hour: number | null
  email_template_id: string | null
  wpp_template_id: string | null
}

interface MuteEntry {
  id: string
  lead_id: string | null
  event_type: string | null
  channel: string | null
}

interface TplOption {
  id: string
  name: string
  scope: string
  category?: string | null
  subject?: string | null
}

interface Props {
  eventId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SubTab = "included" | "excluded"
type MainTab = "info" | "contacts" | "templates"

const TAB_TRIGGER_CLASS =
  "rounded-full text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-colors flex items-center justify-center px-3"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

export function FixedEventDetailDialog({ eventId, open, onOpenChange }: Props) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<MainTab>("info")
  const [subTab, setSubTab] = useState<SubTab>("included")
  const [search, setSearch] = useState("")

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
  const [creatingChannel, setCreatingChannel] = useState<"email" | "whatsapp" | null>(null)

  const meta = eventId ? FIXED_EVENT_META[eventId] : null
  const eventName = meta?.name ?? "Automatismo"
  const eventType = meta?.eventType ?? ""
  const defaultHour = meta?.defaultHour ?? 9

  useEffect(() => {
    if (open) {
      setTab("info")
      setSubTab("included")
      setSearch("")
    }
  }, [open, eventId])

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

      const defs: Array<{ category: string; channel: string; template_id: string }> = defaultsData?.defaults ?? []
      const emailDef = defs.find((d) => d.category === eventType && d.channel === "email")
      const wppDef = defs.find((d) => d.category === eventType && d.channel === "whatsapp")

      if (emailDef) {
        setDefaultEmailTplId(emailDef.template_id)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const systemEmail = allEmailTpls.find((t: TplOption) => t.category === eventType && (t as any).is_system)
        setDefaultEmailTplId(systemEmail?.id ?? null)
      }
      if (wppDef) {
        setDefaultWppTplId(wppDef.template_id)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const systemWpp = allWppTpls.find((t: TplOption) => t.category === eventType && (t as any).is_system)
        setDefaultWppTplId(systemWpp?.id ?? null)
      }

      const globalMute = allMutes.find((m) => !m.lead_id && m.event_type === eventType && !m.channel)
      setIsEventMuted(!!globalMute)
      setEventMuteId(globalMute?.id ?? null)

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const match = arr.find((s: any) => s.event_type === eventType && !s.custom_event_id)
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
    return mutes.some(
      (m) =>
        (m.lead_id === leadId || m.lead_id === null) &&
        (m.event_type === eventType || m.event_type === null),
    )
  }

  const activeLeads = leads.filter((l) => !isLeadMuted(l.id))
  const mutedLeads = leads.filter((l) => isLeadMuted(l.id))

  const currentList = subTab === "included" ? activeLeads : mutedLeads
  const filteredList = currentList.filter((l) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (l.name ?? "").toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.telemovel ?? "").toLowerCase().includes(q)
    )
  })

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
    } catch {
      toast.error("Erro ao alterar estado")
    } finally {
      setTogglingEvent(false)
    }
  }

  async function handleMute(leadId: string) {
    setBusyId(leadId)
    try {
      const res = await fetch("/api/contact-automation-mutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, event_type: eventType }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Erro")
      }
      toast.success("Contacto removido")
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover contacto")
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnmute(leadId: string) {
    const mute = mutes.find((m) => m.lead_id === leadId && (m.event_type === eventType || m.event_type === null))
    if (!mute) return
    setBusyId(leadId)
    try {
      await fetch(`/api/contact-automation-mutes?id=${mute.id}`, { method: "DELETE" })
      toast.success("Contacto adicionado")
      void fetchAll()
    } catch {
      toast.error("Erro ao adicionar contacto")
    } finally {
      setBusyId(null)
    }
  }

  async function handleSaveLeadSetting(
    leadId: string,
    data: { send_hour?: number; email_template_id?: string | null; wpp_template_id?: string | null },
  ) {
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
    } catch {
      toast.error("Erro ao actualizar")
    } finally {
      setBusyId(null)
    }
  }

  async function makeDefaultTemplate(channel: "email" | "whatsapp", templateId: string) {
    setBusyId(templateId)
    try {
      const res = await fetch("/api/automacao/template-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: eventType, channel, template_id: templateId }),
      })
      if (!res.ok) throw new Error()
      toast.success("Template definido como padrão")
      void fetchAll()
    } catch {
      toast.error("Erro ao definir padrão")
    } finally {
      setBusyId(null)
    }
  }

  const filteredEmailTpls = emailTemplates.filter((t) => t.category === eventType)
  const filteredWppTpls = wppTemplates.filter((t) => t.category === eventType)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl",
          "bg-background/90 supports-[backdrop-filter]:bg-background/90 backdrop-blur-2xl",
          isMobile
            ? "data-[side=bottom]:h-[85dvh] rounded-t-3xl"
            : "w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl",
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        {/* Header */}
        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-0">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
              {eventName}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Detalhe do automatismo fixo, com estado, contactos e templates.
            </SheetDescription>
          </SheetHeader>

          <div
            className={cn(
              "mt-3 flex items-center gap-2",
              isMobile && "overflow-x-auto",
            )}
          >
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-2 py-0.5 text-xs shrink-0">
              <Calendar className="h-3 w-3" />
              <span>
                {meta?.date} · {pad(defaultHour)}:00
              </span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/60 px-2 py-0.5 text-xs shrink-0">
              <Repeat className="h-3 w-3" />
              <span>Anual</span>
            </div>
            <Badge variant="outline" className="gap-1 shrink-0">
              <Mail className="h-3 w-3" /> Email
            </Badge>
            <Badge variant="outline" className="gap-1 shrink-0">
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 px-6">
          <div className="grid w-full grid-cols-3 h-9 p-0.5 rounded-full bg-muted/50 border border-border/30">
            <button type="button" onClick={() => setTab("info")} className={cn(TAB_TRIGGER_CLASS, tab === "info" && "bg-background shadow-sm text-foreground")}>
              Informação
            </button>
            <button type="button" onClick={() => setTab("contacts")} className={cn(TAB_TRIGGER_CLASS, tab === "contacts" && "bg-background shadow-sm text-foreground")}>
              {isMobile ? "Contactos" : "Quem recebe"}
            </button>
            <button type="button" onClick={() => setTab("templates")} className={cn(TAB_TRIGGER_CLASS, tab === "templates" && "bg-background shadow-sm text-foreground")}>
              Templates
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-40" />
            </div>
          ) : tab === "info" ? (
            <div className="space-y-4">
              <SectionCard title="Estado">
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                    !isEventMuted
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                      : "border-border/40 bg-muted/40",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{!isEventMuted ? "Activo" : "Desactivado"}</p>
                    <p className="text-xs text-muted-foreground">
                      {!isEventMuted
                        ? "Vai enviar mensagens conforme agendado."
                        : "Não envia mensagens enquanto estiver desactivado."}
                    </p>
                  </div>
                  {togglingEvent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Switch checked={!isEventMuted} onCheckedChange={toggleEventActive} />
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Detalhes">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Data do evento</p>
                    <p className="text-sm">{meta?.date}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Hora global</p>
                    {editingGlobalHour ? (
                      <div className="flex items-center gap-1.5">
                        <Select value={String(globalHour)} onValueChange={(v) => setGlobalHour(parseInt(v))}>
                          <SelectTrigger className="h-8 w-[90px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, h) => (
                              <SelectItem key={h} value={String(h)}>{pad(h)}:00</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingGlobalHour(false)
                            toast.success(`Hora global: ${pad(globalHour)}:00`)
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingGlobalHour(false)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="group inline-flex items-center gap-1.5 text-sm hover:text-foreground transition-colors"
                        onClick={() => {
                          setGlobalHour(defaultHour)
                          setEditingGlobalHour(true)
                        }}
                      >
                        {pad(defaultHour)}:00
                        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : tab === "contacts" ? (
            <div className="flex flex-col gap-4">
              <SectionCard title="Filtros">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <SubTabButton
                      active={subTab === "included"}
                      label={`A receber (${activeLeads.length})`}
                      onClick={() => setSubTab("included")}
                    />
                    <SubTabButton
                      active={subTab === "excluded"}
                      label={`Não vai receber (${mutedLeads.length})`}
                      onClick={() => setSubTab("excluded")}
                    />
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Pesquisar por nome, email ou telemóvel"
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title={subTab === "included" ? "A receber" : "Não vai receber"}>
                <div className="space-y-2 min-h-[100px]">
                  {filteredList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                      {subTab === "included"
                        ? activeLeads.length === 0
                          ? "Ninguém vai receber este automatismo."
                          : "Sem resultados."
                        : mutedLeads.length === 0
                          ? "Ninguém foi removido. Todos os seus contactos recebem."
                          : "Sem resultados."}
                    </div>
                  ) : subTab === "included" ? (
                    filteredList.map((lead) => {
                      const s = settings[lead.id]
                      const hour = s?.send_hour ?? defaultHour
                      const isEditingThis = editingLeadId === lead.id

                      let dateDisplay = ""
                      if (eventType === "aniversario_contacto") {
                        if (lead.data_nascimento) {
                          const d = new Date(lead.data_nascimento + "T00:00:00")
                          dateDisplay = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
                        } else {
                          dateDisplay = "Sem data"
                        }
                      } else if (eventType === "natal") {
                        dateDisplay = "25/12"
                      } else {
                        dateDisplay = "31/12"
                      }

                      return (
                        <IncludedLeadCard
                          key={lead.id}
                          lead={lead}
                          hour={hour}
                          dateDisplay={dateDisplay}
                          setting={s}
                          isEditing={isEditingThis}
                          editLeadHour={editLeadHour}
                          setEditLeadHour={setEditLeadHour}
                          onStartEdit={() => {
                            setEditLeadHour(hour)
                            setEditingLeadId(lead.id)
                          }}
                          onCancelEdit={() => setEditingLeadId(null)}
                          onSaveHour={() => {
                            handleSaveLeadSetting(lead.id, { send_hour: editLeadHour })
                            setEditingLeadId(null)
                          }}
                          onChangeEmailTpl={(v) =>
                            handleSaveLeadSetting(lead.id, { email_template_id: v === "none" ? null : v })
                          }
                          onChangeWppTpl={(v) =>
                            handleSaveLeadSetting(lead.id, { wpp_template_id: v === "none" ? null : v })
                          }
                          onRemove={() => handleMute(lead.id)}
                          busy={busyId === lead.id}
                          eventType={eventType}
                          emailTemplates={filteredEmailTpls}
                          wppTemplates={filteredWppTpls}
                          defaultEmailTplId={defaultEmailTplId}
                          defaultWppTplId={defaultWppTplId}
                        />
                      )
                    })
                  ) : (
                    filteredList.map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-3"
                      >
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-medium truncate">{lead.name ?? "—"}</p>
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
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full text-xs"
                          onClick={() => handleUnmute(lead.id)}
                          disabled={busyId === lead.id}
                        >
                          {busyId === lead.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Plus className="h-3 w-3 mr-1" />
                          )}
                          Adicionar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          ) : (
            <div className="space-y-4">
              <SectionCard
                title="Templates de email"
                action={
                  <button
                    type="button"
                    onClick={() => setCreatingChannel("email")}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3 w-3" /> Novo template
                  </button>
                }
              >
                <div className="space-y-2">
                  {filteredEmailTpls.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem templates para este automatismo.</p>
                  ) : (
                    filteredEmailTpls.map((tpl) => (
                      <TplCard
                        key={tpl.id}
                        name={tpl.name}
                        subtitle={tpl.subject ?? undefined}
                        isDefault={tpl.id === defaultEmailTplId}
                        busy={busyId === tpl.id}
                        editHref={`/dashboard/templates-email/${tpl.id}`}
                        onMakeDefault={() => makeDefaultTemplate("email", tpl.id)}
                      />
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Templates de WhatsApp"
                titleClassName="text-emerald-600"
                action={
                  <button
                    type="button"
                    onClick={() => setCreatingChannel("whatsapp")}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3 w-3" /> Novo template
                  </button>
                }
              >
                <div className="space-y-2">
                  {filteredWppTpls.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem templates para este automatismo.</p>
                  ) : (
                    filteredWppTpls.map((tpl) => (
                      <TplCard
                        key={tpl.id}
                        name={tpl.name}
                        isDefault={tpl.id === defaultWppTplId}
                        busy={busyId === tpl.id}
                        editHref="/dashboard/automacao/templates-wpp"
                        onMakeDefault={() => makeDefaultTemplate("whatsapp", tpl.id)}
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>

        <InlineTemplateEditorDialog
          channel={creatingChannel ?? "email"}
          scope="consultant"
          category={eventType}
          open={creatingChannel !== null}
          onOpenChange={(o) => !o && setCreatingChannel(null)}
          onCreated={() => {
            void fetchAll()
          }}
        />
      </SheetContent>
    </Sheet>
  )
}

function SubTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
      )}
    >
      {label}
    </button>
  )
}

function TplCard({
  name,
  subtitle,
  isDefault,
  busy,
  editHref,
  onMakeDefault,
}: {
  name: string
  subtitle?: string
  isDefault: boolean
  busy: boolean
  editHref: string
  onMakeDefault: () => void
}) {
  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        isDefault ? "border-primary/40 bg-primary/5" : "border-border/40 bg-background/60",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{name}</p>
          {isDefault && (
            <Badge variant="default" className="h-5 text-[10px]">Padrão</Badge>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isDefault && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full text-xs"
            onClick={onMakeDefault}
            disabled={busy}
          >
            <Check className="h-3 w-3 mr-1" />
            Tornar padrão
          </Button>
        )}
        <Link
          href={editHref}
          target="_blank"
          className="inline-flex items-center h-7 px-2 rounded-full text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </article>
  )
}

function IncludedLeadCard({
  lead,
  hour,
  dateDisplay,
  setting,
  isEditing,
  editLeadHour,
  setEditLeadHour,
  onStartEdit,
  onCancelEdit,
  onSaveHour,
  onChangeEmailTpl,
  onChangeWppTpl,
  onRemove,
  busy,
  eventType,
  emailTemplates,
  wppTemplates,
  defaultEmailTplId,
  defaultWppTplId,
}: {
  lead: FixedLead
  hour: number
  dateDisplay: string
  setting: LeadSetting | undefined
  isEditing: boolean
  editLeadHour: number
  setEditLeadHour: (h: number) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveHour: () => void
  onChangeEmailTpl: (v: string) => void
  onChangeWppTpl: (v: string) => void
  onRemove: () => void
  busy: boolean
  eventType: string
  emailTemplates: TplOption[]
  wppTemplates: TplOption[]
  defaultEmailTplId: string | null
  defaultWppTplId: string | null
}) {
  const defaultEmailName = defaultEmailTplId
    ? emailTemplates.find((t) => t.id === defaultEmailTplId)?.name
    : undefined
  const defaultWppName = defaultWppTplId
    ? wppTemplates.find((t) => t.id === defaultWppTplId)?.name
    : undefined

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-3">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium truncate">{lead.name ?? "—"}</p>
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

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{dateDisplay} ·</span>
              <Select value={String(editLeadHour)} onValueChange={(v) => setEditLeadHour(parseInt(v))}>
                <SelectTrigger className="h-7 w-[88px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>{pad(h)}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {emailTemplates.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <Select
                  value={setting?.email_template_id ?? "none"}
                  onValueChange={onChangeEmailTpl}
                  disabled={busy}
                >
                  <SelectTrigger className="h-7 flex-1 max-w-[220px] text-[11px]">
                    <SelectValue placeholder="Padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Padrão{defaultEmailName ? ` (${defaultEmailName})` : ""}
                    </SelectItem>
                    {emailTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {wppTemplates.length > 0 && (
              <div className="flex items-center gap-1.5">
                <MessageCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                <Select
                  value={setting?.wpp_template_id ?? "none"}
                  onValueChange={onChangeWppTpl}
                  disabled={busy}
                >
                  <SelectTrigger className="h-7 flex-1 max-w-[220px] text-[11px]">
                    <SelectValue placeholder="Padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Padrão{defaultWppName ? ` (${defaultWppName})` : ""}
                    </SelectItem>
                    {wppTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" className="h-7 rounded-full text-xs" disabled={busy} onClick={onSaveHour}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Guardar
              </Button>
              <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={onCancelEdit}>
                Cancelar
              </Button>
              <Link
                href={`/dashboard/templates-email/novo?scope=consultant&category=${eventType}`}
                target="_blank"
                className="text-[10px] text-primary hover:underline ml-auto"
              >
                + Novo template
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px] gap-0.5 py-0 px-1.5">
              {dateDisplay} · {pad(hour)}:00
            </Badge>
            {setting?.email_template_id && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 py-0 px-1.5">
                <Mail className="h-2.5 w-2.5" /> Email personalizado
              </Badge>
            )}
            {setting?.wpp_template_id && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 py-0 px-1.5">
                <MessageCircle className="h-2.5 w-2.5" /> WhatsApp personalizado
              </Badge>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onStartEdit}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onRemove}
            >
              <VolumeX className="h-3.5 w-3.5 mr-2" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
