"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getAgents,
  getCalendarEntries,
  upsertCalendarEntry,
  deleteCalendarEntry,
} from "@/app/dashboard/marketing/redes-sociais/actions"
import type {
  MarketingContentCalendar,
  SocialPlatform,
  ContentType,
  CalendarStatus,
} from "@/types/marketing-social"
import {
  SOCIAL_PLATFORMS,
  CONTENT_TYPES,
  CALENDAR_STATUS,
} from "@/types/marketing-social"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Instagram,
  Facebook,
  Linkedin,
  Loader2,
  CalendarDays,
} from "lucide-react"

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

const MONTHS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const STATUS_DOT_COLORS: Record<CalendarStatus, string> = {
  draft: "bg-slate-400",
  scheduled: "bg-blue-500",
  published: "bg-emerald-500",
  cancelled: "bg-red-400",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function getPlatformIcon(platform: SocialPlatform) {
  switch (platform) {
    case "instagram":
      return <Instagram className="h-3 w-3" />
    case "facebook":
      return <Facebook className="h-3 w-3" />
    case "linkedin":
      return <Linkedin className="h-3 w-3" />
    default:
      return <Calendar className="h-3 w-3" />
  }
}

interface CalendarDay {
  date: Date
  day: number
  isCurrentMonth: boolean
  dateStr: string // YYYY-MM-DD
}

function buildCalendarGrid(year: number, month: number): CalendarDay[][] {
  const firstDay = new Date(year, month, 1)
  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: CalendarDay[] = []

  // Previous month padding
  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const date = new Date(year, month - 1, d)
    cells.push({
      date,
      day: d,
      isCurrentMonth: false,
      dateStr: formatDateStr(date),
    })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({
      date,
      day: d,
      isCurrentMonth: true,
      dateStr: formatDateStr(date),
    })
  }

  // Next month padding to fill last row
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d)
      cells.push({
        date,
        day: d,
        isCurrentMonth: false,
        dateStr: formatDateStr(date),
      })
    }
  }

  // Split into weeks
  const weeks: CalendarDay[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

function formatDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function isToday(dateStr: string) {
  return dateStr === formatDateStr(new Date())
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Agent = {
  id: string
  commercial_name: string
  professional_email: string
  is_active: boolean
}

type FormData = {
  id?: string
  agent_id: string
  platform: SocialPlatform
  content_type: ContentType
  title: string
  description: string
  scheduled_date: string
  scheduled_time: string
  status: CalendarStatus
  property_id: string
  post_url: string
}

const EMPTY_FORM: FormData = {
  agent_id: "",
  platform: "instagram",
  content_type: "post",
  title: "",
  description: "",
  scheduled_date: "",
  scheduled_time: "",
  status: "draft",
  property_id: "",
  post_url: "",
}

// ─── Entry Pill ──────────────────────────────────────────────────────────────

function EntryPill({
  entry,
  onClick,
}: {
  entry: MarketingContentCalendar
  onClick: () => void
}) {
  const statusInfo = CALENDAR_STATUS[entry.status]
  const initials = entry.agent?.commercial_name
    ? getInitials(entry.agent.commercial_name)
    : "?"

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "group flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-all hover:opacity-80",
        statusInfo.color
      )}
    >
      <span className="shrink-0 text-[10px] font-semibold opacity-70">
        {initials}
      </span>
      <span className="shrink-0 opacity-60">{getPlatformIcon(entry.platform)}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{entry.title}</span>
    </button>
  )
}

// ─── Day Cell ────────────────────────────────────────────────────────────────

function DayCell({
  cell,
  entries,
  onClickDay,
  onClickEntry,
}: {
  cell: CalendarDay
  entries: MarketingContentCalendar[]
  onClickDay: (dateStr: string) => void
  onClickEntry: (entry: MarketingContentCalendar) => void
}) {
  const today = isToday(cell.dateStr)
  const maxVisible = 3
  const visible = entries.slice(0, maxVisible)
  const overflow = entries.length - maxVisible

  return (
    <div
      onClick={() => cell.isCurrentMonth && onClickDay(cell.dateStr)}
      className={cn(
        "group relative flex min-h-[100px] flex-col border-b border-r p-1 transition-colors",
        cell.isCurrentMonth
          ? "cursor-pointer bg-background hover:bg-muted/40"
          : "cursor-default bg-muted/20",
      )}
    >
      {/* Day number */}
      <div className="mb-0.5 flex items-center justify-between">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
            !cell.isCurrentMonth && "text-muted-foreground/40",
            cell.isCurrentMonth && "text-foreground",
            today && "bg-primary text-primary-foreground font-bold"
          )}
        >
          {cell.day}
        </span>
        {cell.isCurrentMonth && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClickDay(cell.dateStr)
            }}
            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Entry pills */}
      <div className="flex flex-1 flex-col gap-0.5">
        {visible.map((entry) => (
          <EntryPill
            key={entry.id}
            entry={entry}
            onClick={() => onClickEntry(entry)}
          />
        ))}
        {overflow > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-muted-foreground hover:bg-muted"
              >
                +{overflow} mais
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                {cell.day} {MONTHS[cell.date.getMonth()]}
              </p>
              <div className="flex flex-col gap-1">
                {entries.map((entry) => (
                  <EntryPill
                    key={entry.id}
                    entry={entry}
                    onClick={() => onClickEntry(entry)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Status dots summary */}
      {entries.length > 0 && (
        <div className="mt-auto flex gap-0.5 pt-0.5">
          {entries.slice(0, 5).map((e) => (
            <span
              key={e.id}
              className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT_COLORS[e.status])}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SocialCalendarioTab() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [agentFilter, setAgentFilter] = useState<string>("all")

  const [agents, setAgents] = useState<Agent[]>([])
  const [entries, setEntries] = useState<MarketingContentCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM })

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const monthKey = getMonthKey(year, month)
    const agentId = agentFilter === "all" ? undefined : agentFilter
    const { entries: data, error } = await getCalendarEntries(monthKey, agentId)
    if (error) toast.error("Erro ao carregar calendario: " + error)
    setEntries(data)
    setLoading(false)
  }, [year, month, agentFilter])

  useEffect(() => {
    getAgents().then(({ agents: a }) => setAgents(a as Agent[]))
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // ─── Calendar grid ──────────────────────────────────────────────────────

  const weeks = useMemo(() => buildCalendarGrid(year, month), [year, month])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MarketingContentCalendar[]>()
    for (const entry of entries) {
      const key = entry.scheduled_date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }
    return map
  }, [entries])

  // ─── Navigation ─────────────────────────────────────────────────────────

  function goToPrevMonth() {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function goToToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  // ─── Form actions ──────────────────────────────────────────────────────

  function openCreateDialog(dateStr?: string) {
    setForm({
      ...EMPTY_FORM,
      scheduled_date: dateStr || formatDateStr(new Date()),
    })
    setDialogOpen(true)
  }

  function openEditDialog(entry: MarketingContentCalendar) {
    setForm({
      id: entry.id,
      agent_id: entry.agent_id,
      platform: entry.platform,
      content_type: entry.content_type,
      title: entry.title,
      description: entry.description ?? "",
      scheduled_date: entry.scheduled_date,
      scheduled_time: entry.scheduled_time ?? "",
      status: entry.status,
      property_id: entry.property_id ?? "",
      post_url: entry.post_url ?? "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.agent_id) {
      toast.error("Seleccione um consultor")
      return
    }
    if (!form.title.trim()) {
      toast.error("Preencha o titulo")
      return
    }
    if (!form.scheduled_date) {
      toast.error("Seleccione a data")
      return
    }

    setSaving(true)
    const payload: Parameters<typeof upsertCalendarEntry>[0] = {
      agent_id: form.agent_id,
      platform: form.platform,
      content_type: form.content_type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time || null,
      status: form.status,
      property_id: form.property_id || null,
      post_url: form.post_url || null,
    }
    if (form.id) payload.id = form.id

    const { success, error } = await upsertCalendarEntry(payload)
    setSaving(false)

    if (error) {
      toast.error("Erro ao guardar: " + error)
      return
    }

    toast.success(form.id ? "Entrada actualizada" : "Entrada criada")
    setDialogOpen(false)
    fetchEntries()
  }

  async function handleDelete(id: string) {
    setSaving(true)
    const { error } = await deleteCalendarEntry(id)
    setSaving(false)
    setDeleteConfirmId(null)

    if (error) {
      toast.error("Erro ao eliminar: " + error)
      return
    }

    toast.success("Entrada eliminada")
    setDialogOpen(false)
    fetchEntries()
  }

  // ─── Update form helper ────────────────────────────────────────────────

  function updateForm<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[180px] text-center text-lg font-semibold">
            {MONTHS[month]} {year}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="ml-1 text-xs">
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent filter */}
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os consultores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.commercial_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => openCreateDialog()} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {(Object.keys(CALENDAR_STATUS) as CalendarStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT_COLORS[s])} />
            {CALENDAR_STATUS[s].label}
          </span>
        ))}
        <span className="ml-auto text-muted-foreground/60">
          {entries.length} {entries.length === 1 ? "entrada" : "entradas"} este mes
        </span>
      </div>

      {/* Calendar grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Days header */}
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                className="border-r px-2 py-2 text-center text-xs font-semibold text-muted-foreground last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {loading ? (
            <div className="flex h-[400px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {week.map((cell) => (
                    <DayCell
                      key={cell.dateStr}
                      cell={cell}
                      entries={entriesByDate.get(cell.dateStr) ?? []}
                      onClickDay={(d) => openCreateDialog(d)}
                      onClickEntry={(e) => openEditDialog(e)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            Sem entradas em {MONTHS[month]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Clique num dia ou no botao "Novo" para agendar conteudo.
          </p>
        </div>
      )}

      {/* ─── Create/Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {form.id ? "Editar Entrada" : "Nova Entrada"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Agent */}
            <div className="grid gap-1.5">
              <Label>Consultor *</Label>
              <Select value={form.agent_id} onValueChange={(v) => updateForm("agent_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar consultor" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform + Content Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Plataforma</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => updateForm("platform", v as SocialPlatform)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          {getPlatformIcon(p)}
                          {SOCIAL_PLATFORMS[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo de Conteudo</Label>
                <Select
                  value={form.content_type}
                  onValueChange={(v) => updateForm("content_type", v as ContentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONTENT_TYPES) as ContentType[]).map((ct) => (
                      <SelectItem key={ct} value={ct}>
                        {CONTENT_TYPES[ct]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="grid gap-1.5">
              <Label>Titulo *</Label>
              <Input
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="Ex: Post de imovel novo"
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label>Descricao</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Detalhes do conteudo, copy, notas..."
                rows={3}
              />
            </div>

            {/* Date + Time + Status */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => updateForm("scheduled_date", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={form.scheduled_time}
                  onChange={(e) => updateForm("scheduled_time", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => updateForm("status", v as CalendarStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CALENDAR_STATUS) as CalendarStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT_COLORS[s])} />
                          {CALENDAR_STATUS[s].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Property ref + Post URL */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>ID Imovel (opcional)</Label>
                <Input
                  value={form.property_id}
                  onChange={(e) => updateForm("property_id", e.target.value)}
                  placeholder="UUID do imovel"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>URL do Post (opcional)</Label>
                <Input
                  value={form.post_url}
                  onChange={(e) => updateForm("post_url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {form.id && (
                deleteConfirmId === form.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive">Tem a certeza?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={saving}
                      onClick={() => handleDelete(form.id!)}
                    >
                      {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                      Eliminar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirmId(form.id!)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {form.id ? "Guardar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
