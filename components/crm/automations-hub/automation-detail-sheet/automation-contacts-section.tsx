"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  UserPlus,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MultiSelectFilter, type MultiSelectOption } from "@/components/shared/multi-select-filter"
import { AUTOMATION_SHEET_COPY } from "@/lib/constants-automations"
import { LEAD_ESTADOS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { usePipelineStages } from "@/hooks/use-pipeline-stages"
import type { CustomEventDetail } from "@/types/custom-event"
import { SectionCard } from "./section-card"

interface Props {
  event: CustomEventDetail
  onRefetch: () => void
}

type SubTab = "included" | "toAdd"

interface EligibleLead {
  id: string
  // API `/eligible-leads` remapeia os campos do lead: nome→name, estado→status.
  name: string | null
  email: string | null
  telemovel: string | null
  status: string | null
}

interface OverrideSetting {
  id: string
  lead_id: string
  event_type: string
  custom_event_id: string | null
  send_hour: number | null
  email_template_id: string | null
  wpp_template_id: string | null
}

function initials(name: string | null | undefined) {
  if (!name) return "?"
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .filter(Boolean)
    .join("") || "?"
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

export function AutomationContactsSection({ event, onRefetch }: Props) {
  const copy = AUTOMATION_SHEET_COPY.contactsSection
  const subCopy = AUTOMATION_SHEET_COPY.subTabs.custom
  const [tab, setTab] = useState<SubTab>("included")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyBatch, setBusyBatch] = useState(false)

  // Por adicionar — filtros
  const { stages } = usePipelineStages()
  const [pipelineStageIds, setPipelineStageIds] = useState<string[]>([])
  const [contactEstados, setContactEstados] = useState<string[]>([])

  // Por adicionar — dados
  const [eligibleLeads, setEligibleLeads] = useState<EligibleLead[]>([])
  const [loadingEligible, setLoadingEligible] = useState(false)

  // Overrides
  const [overrides, setOverrides] = useState<Record<string, OverrideSetting | null>>({})
  const [loadingOverrides, setLoadingOverrides] = useState(false)

  // Confirm remove
  const [pendingRemove, setPendingRemove] = useState<{ leadId: string; leadName: string } | null>(null)

  const includedLeads = event.leads
  const includedIds = useMemo(
    () => new Set(includedLeads.map((l) => l.lead_id)),
    [includedLeads],
  )

  const filteredIncluded = useMemo(() => {
    if (!search.trim()) return includedLeads
    const q = search.toLowerCase()
    return includedLeads.filter(
      (l) =>
        (l.name ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.telemovel ?? "").toLowerCase().includes(q),
    )
  }, [includedLeads, search])

  const toAddLeads = useMemo(
    () => eligibleLeads.filter((l) => !includedIds.has(l.id)),
    [eligibleLeads, includedIds],
  )

  const filteredToAdd = useMemo(() => {
    if (!search.trim()) return toAddLeads
    const q = search.toLowerCase()
    return toAddLeads.filter(
      (l) =>
        (l.name ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.telemovel ?? "").toLowerCase().includes(q),
    )
  }, [toAddLeads, search])

  const fetchEligibles = useCallback(async () => {
    setLoadingEligible(true)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (pipelineStageIds.length > 0) params.set("pipeline_stage_ids", pipelineStageIds.join(","))
      if (contactEstados.length > 0) params.set("contact_estados", contactEstados.join(","))
      const res = await fetch(`/api/automacao/custom-events/eligible-leads?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEligibleLeads(data.leads ?? [])
    } catch {
      setEligibleLeads([])
    } finally {
      setLoadingEligible(false)
    }
  }, [pipelineStageIds, contactEstados])

  useEffect(() => {
    if (tab === "toAdd") void fetchEligibles()
  }, [tab, fetchEligibles])

  const fetchOverrides = useCallback(async () => {
    if (includedLeads.length === 0) return
    setLoadingOverrides(true)
    try {
      const next: Record<string, OverrideSetting | null> = {}
      await Promise.all(
        includedLeads.slice(0, 100).map(async (l) => {
          try {
            const res = await fetch(`/api/leads/${l.lead_id}/automation-settings`)
            if (!res.ok) return
            const data = await res.json()
            const rows: OverrideSetting[] = data.settings ?? []
            const match = rows.find(
              (s) => s.event_type === "custom_event" && s.custom_event_id === event.id,
            )
            next[l.lead_id] = match ?? null
          } catch {
            /* noop */
          }
        }),
      )
      setOverrides(next)
    } finally {
      setLoadingOverrides(false)
    }
  }, [includedLeads, event.id])

  useEffect(() => {
    void fetchOverrides()
  }, [fetchOverrides])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function addOne(leadId: string) {
    try {
      const res = await fetch(`/api/automacao/custom-events/${event.id}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: [leadId] }),
      })
      if (!res.ok) throw new Error()
      toast.success(copy.toastAdded(1))
      onRefetch()
    } catch {
      toast.error(copy.toastError)
    }
  }

  async function removeOne(leadId: string, leadName: string | null) {
    setPendingRemove({ leadId, leadName: leadName ?? "Este contacto" })
  }

  async function confirmRemove() {
    if (!pendingRemove) return
    const { leadId } = pendingRemove
    setPendingRemove(null)
    try {
      const res = await fetch(`/api/automacao/custom-events/${event.id}/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: [leadId] }),
      })
      if (!res.ok) throw new Error()
      toast.success(copy.toastRemoved(1))
      onRefetch()
    } catch {
      toast.error(copy.toastError)
    }
  }

  async function batchApply() {
    if (selected.size === 0) return
    setBusyBatch(true)
    try {
      const ids = Array.from(selected)
      const method = tab === "included" ? "DELETE" : "POST"
      const res = await fetch(`/api/automacao/custom-events/${event.id}/leads`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: ids }),
      })
      if (!res.ok) throw new Error()
      toast.success(
        tab === "included" ? copy.toastRemoved(ids.length) : copy.toastAdded(ids.length),
      )
      clearSelection()
      onRefetch()
      if (tab === "toAdd") void fetchEligibles()
    } catch {
      toast.error(copy.toastError)
    } finally {
      setBusyBatch(false)
    }
  }

  const estadoOptions: MultiSelectOption[] = LEAD_ESTADOS.filter((e) => e !== "Lead").map((e) => ({
    value: e,
    label: e,
  }))

  const pipelineOptions: MultiSelectOption[] = useMemo(
    () =>
      stages.map((s) => ({
        value: s.id,
        label: s.name,
        group:
          s.pipeline_type === "comprador"
            ? "Comprador"
            : s.pipeline_type === "vendedor"
              ? "Vendedor"
              : s.pipeline_type === "arrendatario"
                ? "Arrendatário"
                : "Arrendador",
      })),
    [stages],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <SectionCard title="Filtros">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <SubTabButton
              active={tab === "included"}
              label={copy.countIncludedCustom(includedLeads.length)}
              onClick={() => {
                setTab("included")
                clearSelection()
              }}
              subLabel={subCopy.included}
            />
            <SubTabButton
              active={tab === "toAdd"}
              label={subCopy.toAdd}
              onClick={() => {
                setTab("toAdd")
                clearSelection()
              }}
            />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={copy.searchPlaceholder}
              className="pl-8 h-9"
            />
          </div>

          {tab === "toAdd" && (
            <div className="flex flex-wrap gap-2">
              <MultiSelectFilter
                title="Fase do pipeline"
                options={pipelineOptions}
                selected={pipelineStageIds}
                onSelectedChange={setPipelineStageIds}
                searchable
              />
              <MultiSelectFilter
                title="Estado do contacto"
                options={estadoOptions}
                selected={contactEstados}
                onSelectedChange={setContactEstados}
              />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Lista de contactos */}
      <SectionCard
        title={tab === "included" ? "Contactos incluídos" : "Contactos por adicionar"}
      >
        <div className="space-y-2 min-h-[100px]">
          {tab === "included" ? (
          filteredIncluded.length === 0 ? (
            <EmptyState text={includedLeads.length === 0 ? copy.emptyIncludedCustom : "Sem resultados."} />
          ) : (
            filteredIncluded.map((lead) => {
              const override = overrides[lead.lead_id] ?? null
              const checked = selected.has(lead.lead_id)
              return (
                <IncludedContactCard
                  key={lead.lead_id}
                  leadId={lead.lead_id}
                  name={lead.name}
                  email={lead.email}
                  phone={lead.telemovel}
                  estado={lead.status}
                  override={override}
                  checked={checked}
                  onToggleSelect={() => toggleSelect(lead.lead_id)}
                  onRemove={() => removeOne(lead.lead_id, lead.name)}
                  eventId={event.id}
                  onOverrideChanged={fetchOverrides}
                  loadingOverride={loadingOverrides}
                />
              )
            })
          )
        ) : loadingEligible ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredToAdd.length === 0 ? (
          <EmptyState text={toAddLeads.length === 0 ? copy.emptyToAddCustom : "Sem resultados."} />
        ) : (
          filteredToAdd.map((lead) => {
            const checked = selected.has(lead.id)
            return (
              <ToAddContactCard
                key={lead.id}
                leadId={lead.id}
                name={lead.name}
                email={lead.email}
                phone={lead.telemovel}
                estado={lead.status}
                checked={checked}
                onToggleSelect={() => toggleSelect(lead.id)}
                onAdd={() => addOne(lead.id)}
              />
            )
          })
        )}
        </div>
      </SectionCard>

      {/* Batch bar flutuante */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-5 mx-auto z-50 flex w-[calc(100%-2rem)] max-w-md items-center gap-3 rounded-full border border-border/40 bg-background/95 px-4 py-2.5 shadow-2xl backdrop-blur-md supports-[backdrop-filter]:bg-background/80 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">{selected.size} seleccionados</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full text-xs"
              onClick={clearSelection}
              disabled={busyBatch}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant={tab === "included" ? "destructive" : "default"}
              className="h-8 rounded-full text-xs"
              onClick={batchApply}
              disabled={busyBatch}
            >
              {busyBatch && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              {tab === "included" ? copy.removeSelected : copy.addSelected}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmRemoveTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove && copy.confirmRemoveDescription(pendingRemove.leadName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SubTabButton({
  active,
  label,
  subLabel,
  onClick,
}: {
  active: boolean
  label: string
  subLabel?: string
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
      {subLabel && !active ? subLabel : label}
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function IncludedContactCard({
  leadId,
  name,
  email,
  phone,
  estado,
  override,
  checked,
  onToggleSelect,
  onRemove,
  eventId,
  onOverrideChanged,
  loadingOverride,
}: {
  leadId: string
  name: string | null
  email: string | null
  phone: string | null
  estado: string | null
  override: OverrideSetting | null
  checked: boolean
  onToggleSelect: () => void
  onRemove: () => void
  eventId: string
  onOverrideChanged: () => void
  loadingOverride: boolean
}) {
  const copy = AUTOMATION_SHEET_COPY.contactsSection
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-3 transition-colors",
        checked && "border-primary bg-primary/5",
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggleSelect} className="mt-1 shrink-0" />
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium truncate">{name ?? "—"}</span>
          {estado && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {estado}
            </Badge>
          )}
        </div>
        {email && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Mail className="h-2.5 w-2.5" />
            <span className="truncate">{email}</span>
          </p>
        )}
        {phone && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Phone className="h-2.5 w-2.5" />
            <span className="truncate">{phone}</span>
          </p>
        )}
        {(override?.send_hour != null || override?.email_template_id || override?.wpp_template_id) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {override?.send_hour != null && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 py-0 px-1.5">
                <Clock className="h-2.5 w-2.5" />
                {copy.pillHourOverride(`${pad(override.send_hour)}:00`)}
              </Badge>
            )}
            {override?.email_template_id && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 py-0 px-1.5">
                <Mail className="h-2.5 w-2.5" />
                {copy.pillEmailOverride}
              </Badge>
            )}
            {override?.wpp_template_id && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 py-0 px-1.5">
                <MessageCircle className="h-2.5 w-2.5" />
                {copy.pillWppOverride}
              </Badge>
            )}
          </div>
        )}
      </div>
      <ContactOverridePopover
        eventId={eventId}
        leadId={leadId}
        override={override}
        onChanged={onOverrideChanged}
        onRemove={onRemove}
        loading={loadingOverride}
      />
    </div>
  )
}

function ToAddContactCard({
  leadId: _leadId,
  name,
  email,
  phone,
  estado,
  checked,
  onToggleSelect,
  onAdd,
}: {
  leadId: string
  name: string | null
  email: string | null
  phone: string | null
  estado: string | null
  checked: boolean
  onToggleSelect: () => void
  onAdd: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-3 transition-colors",
        checked && "border-primary bg-primary/5",
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggleSelect} className="mt-1 shrink-0" />
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium truncate">{name ?? "—"}</span>
          {estado && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {estado}
            </Badge>
          )}
        </div>
        {email && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Mail className="h-2.5 w-2.5" />
            <span className="truncate">{email}</span>
          </p>
        )}
        {phone && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Phone className="h-2.5 w-2.5" />
            <span className="truncate">{phone}</span>
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={onAdd}>
        <UserPlus className="h-3 w-3 mr-1" />
        {AUTOMATION_SHEET_COPY.contactsSection.addOne}
      </Button>
    </div>
  )
}

function ContactOverridePopover({
  eventId,
  leadId,
  override,
  onChanged,
  onRemove,
  loading,
}: {
  eventId: string
  leadId: string
  override: OverrideSetting | null
  onChanged: () => void
  onRemove: () => void
  loading: boolean
}) {
  const copy = AUTOMATION_SHEET_COPY.contactsSection
  const opCopy = AUTOMATION_SHEET_COPY.overridePopover
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"hour" | "email" | "wpp" | null>(null)
  const [hourDraft, setHourDraft] = useState(9)
  const [busy, setBusy] = useState(false)

  async function saveHour(useDefault: boolean) {
    setBusy(true)
    try {
      if (useDefault) {
        // Clear send_hour override — se é o único campo, DELETE row; senão POST com send_hour=null
        const hasOthers = !!(override?.email_template_id || override?.wpp_template_id)
        if (!hasOthers && override) {
          const res = await fetch(
            `/api/leads/${leadId}/automation-settings?event_type=custom_event&custom_event_id=${eventId}`,
            { method: "DELETE" },
          )
          if (!res.ok) throw new Error()
        } else if (override) {
          const res = await fetch(`/api/leads/${leadId}/automation-settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_type: "custom_event",
              custom_event_id: eventId,
              send_hour: null,
              email_template_id: override.email_template_id,
              wpp_template_id: override.wpp_template_id,
            }),
          })
          if (!res.ok) throw new Error()
        }
      } else {
        const res = await fetch(`/api/leads/${leadId}/automation-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "custom_event",
            custom_event_id: eventId,
            send_hour: hourDraft,
            email_template_id: override?.email_template_id ?? null,
            wpp_template_id: override?.wpp_template_id ?? null,
          }),
        })
        if (!res.ok) throw new Error()
      }
      toast.success(AUTOMATION_SHEET_COPY.info.saveSuccess)
      onChanged()
      setOpen(false)
      setMode(null)
    } catch {
      toast.error(AUTOMATION_SHEET_COPY.info.saveError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setMode(null)
      }}
    >
      <PopoverTrigger asChild>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={loading}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                setMode("hour")
                setHourDraft(override?.send_hour ?? 9)
                setOpen(true)
              }}
            >
              <Clock className="h-3.5 w-3.5 mr-2" />
              {copy.menuAlterHour}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled
              className="opacity-60"
            >
              <Mail className="h-3.5 w-3.5 mr-2" />
              {copy.menuAlterEmailTemplate}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled
              className="opacity-60"
            >
              <MessageCircle className="h-3.5 w-3.5 mr-2" />
              {copy.menuAlterWppTemplate}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onRemove}
            >
              <X className="h-3.5 w-3.5 mr-2" />
              {copy.menuRemove}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PopoverTrigger>
      {mode === "hour" && (
        <PopoverContent align="end" className="w-64 space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">{opCopy.hourLabel}</p>
            <Select value={String(hourDraft)} onValueChange={(v) => setHourDraft(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {pad(h)}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="flex-1 h-8 rounded-full text-xs" onClick={() => saveHour(false)} disabled={busy}>
              {busy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {opCopy.save}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full text-xs"
              onClick={() => {
                setMode(null)
                setOpen(false)
              }}
              disabled={busy}
            >
              {opCopy.cancel}
            </Button>
          </div>
          {override?.send_hour != null && (
            <button
              type="button"
              onClick={() => saveHour(true)}
              disabled={busy}
              className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ChevronRight className="h-2.5 w-2.5" />
              {opCopy.hourRemove}
            </button>
          )}
        </PopoverContent>
      )}
    </Popover>
  )
}
