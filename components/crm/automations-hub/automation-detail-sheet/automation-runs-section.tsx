"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  RotateCw,
  SkipForward,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AUTOMATION_SHEET_COPY } from "@/lib/constants-automations"
import type { CustomEventRun } from "@/types/custom-event"

interface Props {
  runs: CustomEventRun[]
  eventDate: string
  onRefetch: () => void
  /** Hint inicial do filtro (usado apenas no mount; mudanças locais ignoram-no). */
  initialFilter?: "all" | "failed"
}

type RunStatus = "pending" | "sent" | "failed" | "skipped"

function formatDatePt(date: Date) {
  return date.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })
}

function formatTimePt(date: Date) {
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
}

function groupRunsByDay(runs: CustomEventRun[]): Array<{ key: string; label: string; runs: CustomEventRun[] }> {
  const copy = AUTOMATION_SHEET_COPY.runsSection
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const buckets = new Map<string, { label: string; runs: CustomEventRun[] }>()

  for (const run of runs) {
    const base = run.sent_at ?? run.scheduled_for
    if (!base) continue
    const d = new Date(base)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const key = day.toISOString().slice(0, 10)

    let label = formatDatePt(day)
    if (day.getTime() === today.getTime()) label = copy.groupToday
    else if (day.getTime() === yesterday.getTime()) label = copy.groupYesterday

    const bucket = buckets.get(key) ?? { label, runs: [] }
    bucket.runs.push(run)
    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, value]) => ({ key, ...value }))
}

export function AutomationRunsSection({ runs, eventDate, onRefetch, initialFilter }: Props) {
  const copy = AUTOMATION_SHEET_COPY.runsSection
  const [onlyFailed, setOnlyFailed] = useState(initialFilter === "failed")

  const filtered = useMemo(() => {
    if (!onlyFailed) return runs
    return runs.filter((r) => r.status === "failed")
  }, [runs, onlyFailed])

  const groups = useMemo(() => groupRunsByDay(filtered), [filtered])

  if (runs.length === 0) {
    let nextDate = eventDate
    try {
      nextDate = new Date(eventDate + "T00:00:00").toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "long",
      })
    } catch { /* keep raw */ }
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 py-10 text-center text-sm text-muted-foreground">
        {copy.emptyAllWithDate(nextDate)}
      </div>
    )
  }

  const failedCount = runs.filter((r) => r.status === "failed").length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FilterChip
          active={!onlyFailed}
          label={copy.filterAll}
          count={runs.length}
          onClick={() => setOnlyFailed(false)}
        />
        <FilterChip
          active={onlyFailed}
          label={copy.filterFailed}
          count={failedCount}
          onClick={() => setOnlyFailed(true)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 py-10 text-center text-sm text-muted-foreground">
          {copy.emptyFailed}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key} className="space-y-2">
              <h4 className="sticky top-0 z-10 bg-background/80 backdrop-blur py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h4>
              {group.runs.map((run) => (
                <RunCard key={run.id} run={run} onRetryDone={onRefetch} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/50 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full text-[10px] px-1",
          active ? "bg-primary-foreground/20" : "bg-muted",
        )}
      >
        {count}
      </span>
    </button>
  )
}

const STATUS_META: Record<
  RunStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  sent: {
    label: AUTOMATION_SHEET_COPY.runsSection.statusSent,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  pending: {
    label: AUTOMATION_SHEET_COPY.runsSection.statusPending,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Icon: Clock,
  },
  failed: {
    label: AUTOMATION_SHEET_COPY.runsSection.statusFailed,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    Icon: AlertCircle,
  },
  skipped: {
    label: AUTOMATION_SHEET_COPY.runsSection.statusSkipped,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    Icon: SkipForward,
  },
}

function RunCard({ run, onRetryDone }: { run: CustomEventRun; onRetryDone: () => void }) {
  const copy = AUTOMATION_SHEET_COPY.runsSection
  const [expanded, setExpanded] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const status = (run.status as RunStatus) ?? "pending"
  const meta = STATUS_META[status] ?? STATUS_META.pending
  const when = run.sent_at ?? run.scheduled_for
  const whenDate = when ? new Date(when) : null
  const whenStr = whenDate ? `${formatTimePt(whenDate)}` : "—"

  const channelInfo = guessChannel(run)

  async function retry() {
    setRetrying(true)
    try {
      const res = await fetch(`/api/automacao/runs/${run.id}/retry`, { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success(copy.retryToast)
      onRetryDone()
    } catch {
      toast.error(copy.retryError)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <article className="rounded-xl border border-border/40 bg-background/60 px-3 py-2.5">
      <div className="flex items-start gap-3">
        {channelInfo.Icon && <channelInfo.Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {run.lead_id ? (
              <Link
                href={`/dashboard/leads/${run.lead_id}`}
                className="text-sm font-medium hover:underline"
              >
                {run.lead_name ?? "Sem nome"}
              </Link>
            ) : (
              <span className="text-sm font-medium">{run.lead_name ?? "—"}</span>
            )}
            <Badge variant="secondary" className={cn("text-[10px] gap-0.5", meta.className)}>
              <meta.Icon className="h-2.5 w-2.5" />
              {meta.label}
            </Badge>
            <span className="text-[11px] text-muted-foreground ml-auto">{whenStr}</span>
          </div>
          {(status === "failed" || status === "skipped") && (run.error || run.skip_reason) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
            >
              {expanded ? copy.collapseError : copy.expandError}
              {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            </button>
          )}
          {expanded && (
            <div className="mt-1 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              {run.error && <p className="font-mono text-xs">{run.error}</p>}
              {run.skip_reason && <p>Motivo: {run.skip_reason}</p>}
            </div>
          )}
        </div>
        {status === "failed" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full text-xs"
            onClick={retry}
            disabled={retrying}
          >
            {retrying ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RotateCw className="h-3 w-3 mr-1" />
            )}
            {copy.retryButton}
          </Button>
        )}
      </div>
    </article>
  )
}

function guessChannel(run: CustomEventRun): { Icon?: typeof Mail } {
  const k = (run.kind ?? "").toLowerCase()
  if (k.includes("whats") || k.includes("wpp")) return { Icon: MessageCircle }
  if (k.includes("mail") || k.includes("smtp")) return { Icon: Mail }
  return {}
}
