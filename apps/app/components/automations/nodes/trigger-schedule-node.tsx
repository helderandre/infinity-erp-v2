"use client"

import { memo, useState, useCallback, useEffect } from "react"
import type { NodeProps } from "@xyflow/react"
import { Clock, Calendar } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import { useReactFlow } from "@xyflow/react"
import type { TriggerScheduleNodeData } from "@/lib/types/automation-flow"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

// ── Types ──

type ScheduleMode = "daily" | "weekly" | "monthly" | "advanced"

interface ScheduleConfig {
  mode: ScheduleMode
  hour: number
  minute: number
  weekdaysOnly?: boolean
  weekdays?: number[]
  dayOfMonth?: number
  rawCron?: string
  timezone?: string
}

// ── Conversion: visual config -> cron ──

function scheduleToCron(config: ScheduleConfig): string {
  const mm = config.minute
  const hh = config.hour
  switch (config.mode) {
    case "daily":
      return config.weekdaysOnly
        ? `${mm} ${hh} * * 1-5`
        : `${mm} ${hh} * * *`
    case "weekly": {
      const days = (config.weekdays || [1, 2, 3, 4, 5]).sort().join(",")
      return `${mm} ${hh} * * ${days}`
    }
    case "monthly":
      return `${mm} ${hh} ${config.dayOfMonth || 1} * *`
    case "advanced":
      return config.rawCron || "0 9 * * *"
  }
}

// ── Conversion: cron -> visual config ──

function cronToSchedule(cron: string): ScheduleConfig {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) {
    return { mode: "advanced", hour: 9, minute: 0, rawCron: cron }
  }
  const [minStr, hourStr, dom, , dow] = parts
  const minute = parseInt(minStr) || 0
  const hour = parseInt(hourStr) || 0

  // Check if minute/hour are simple numbers
  const simpleTime = /^\d+$/.test(minStr) && /^\d+$/.test(hourStr)
  if (!simpleTime) {
    return { mode: "advanced", hour: 9, minute: 0, rawCron: cron }
  }

  // Monthly: specific day of month, any day of week
  if (dom !== "*" && dow === "*") {
    return { mode: "monthly", hour, minute, dayOfMonth: parseInt(dom) || 1 }
  }

  // Daily: every day or weekdays only
  if (dom === "*" && (dow === "*" || dow === "1-5")) {
    return { mode: "daily", hour, minute, weekdaysOnly: dow === "1-5" }
  }

  // Weekly: specific days of week
  if (dom === "*" && dow !== "*") {
    const weekdays = dow.split(",").map((d) => parseInt(d)).filter((n) => !isNaN(n))
    if (weekdays.length > 0) {
      return { mode: "weekly", hour, minute, weekdays }
    }
  }

  return { mode: "advanced", hour, minute: 0, rawCron: cron }
}

// ── Human-readable description ──

function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return "Expressao invalida"
  const [min, hour, dom, , dow] = parts

  if (expression.trim() === "* * * * *") return "A cada minuto"
  if (min === "0" && hour === "0" && dow === "*") return "Todos os dias a meia-noite"
  if (min.startsWith("*/")) return `A cada ${min.slice(2)} minutos`
  if (hour.startsWith("*/")) return `A cada ${hour.slice(2)} horas`

  const hh = hour.padStart(2, "0")
  const mm = (min || "0").padStart(2, "0")

  // Monthly
  if (dom !== "*" && dow === "*") {
    return `Dia ${dom} de cada mes as ${hh}:${mm}`
  }

  // Weekly with specific days
  if (dom === "*" && dow !== "*" && dow !== "1-5") {
    const dayNames: Record<string, string> = {
      "0": "Dom", "1": "Seg", "2": "Ter", "3": "Qua",
      "4": "Qui", "5": "Sex", "6": "Sab",
    }
    const days = dow.split(",").map((d) => dayNames[d] || d).join(", ")
    return `${days} as ${hh}:${mm}`
  }

  if (hour !== "*" && min !== "*" && dow === "1-5")
    return `Seg a Sex as ${hh}:${mm}`
  if (hour !== "*" && min !== "*" && dow === "*")
    return `Todos os dias as ${hh}:${mm}`

  return `Cron: ${expression}`
}

// ── Weekday labels ──

const WEEKDAY_LABELS: { value: number; short: string }[] = [
  { value: 1, short: "Seg" },
  { value: 2, short: "Ter" },
  { value: 3, short: "Qua" },
  { value: 4, short: "Qui" },
  { value: 5, short: "Sex" },
  { value: 6, short: "Sab" },
  { value: 0, short: "Dom" },
]

// ── Hour/Minute options ──

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

// ── Component ──

function TriggerScheduleNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerScheduleNodeData & { scheduleConfig?: ScheduleConfig }
  const { updateNodeData } = useReactFlow()

  const [config, setConfig] = useState<ScheduleConfig>(() => {
    if (nodeData.scheduleConfig) return nodeData.scheduleConfig
    if (nodeData.cronExpression) return cronToSchedule(nodeData.cronExpression)
    return { mode: "daily", hour: 9, minute: 0, weekdaysOnly: true }
  })

  // Sync config -> node data
  const syncToNode = useCallback(
    (newConfig: ScheduleConfig) => {
      setConfig(newConfig)
      const cronExpression = scheduleToCron(newConfig)
      updateNodeData(id, {
        ...nodeData,
        cronExpression,
        timezone: newConfig.timezone || nodeData.timezone || "Europe/Lisbon",
        scheduleConfig: newConfig,
      })
    },
    [id, nodeData, updateNodeData]
  )

  // Initialize cron on mount if empty
  useEffect(() => {
    if (!nodeData.cronExpression) {
      const cronExpression = scheduleToCron(config)
      updateNodeData(id, {
        ...nodeData,
        cronExpression,
        timezone: config.timezone || "Europe/Lisbon",
        scheduleConfig: config,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateField = <K extends keyof ScheduleConfig>(field: K, value: ScheduleConfig[K]) => {
    syncToNode({ ...config, [field]: value })
  }

  const toggleWeekday = (day: number) => {
    const current = config.weekdays || [1, 2, 3, 4, 5]
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day]
    if (next.length === 0) return // at least 1 day
    syncToNode({ ...config, weekdays: next })
  }

  const cronExpr = nodeData.cronExpression || scheduleToCron(config)

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_schedule"
      selected={selected}
      icon={<Clock />}
      title={nodeData.label || "Agendamento"}
      showTargetHandle={false}
    >
      <div className="space-y-2.5">
        {/* Mode selector */}
        <div className="space-y-1">
          <Label className="text-[10px] font-medium text-muted-foreground">Repetir</Label>
          <ToggleGroup
            type="single"
            value={config.mode}
            onValueChange={(v) => {
              if (!v) return
              const mode = v as ScheduleMode
              const base = { ...config, mode }
              if (mode === "weekly" && !config.weekdays) {
                base.weekdays = [1, 2, 3, 4, 5]
              }
              if (mode === "monthly" && !config.dayOfMonth) {
                base.dayOfMonth = 1
              }
              syncToNode(base)
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <ToggleGroupItem value="daily" className="flex-1 text-[10px] h-6 px-1">
              Diario
            </ToggleGroupItem>
            <ToggleGroupItem value="weekly" className="flex-1 text-[10px] h-6 px-1">
              Semanal
            </ToggleGroupItem>
            <ToggleGroupItem value="monthly" className="flex-1 text-[10px] h-6 px-1">
              Mensal
            </ToggleGroupItem>
            <ToggleGroupItem value="advanced" className="flex-1 text-[10px] h-6 px-1">
              Cron
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Time selector (shared by daily/weekly/monthly) */}
        {config.mode !== "advanced" && (
          <div className="space-y-1">
            <Label className="text-[10px] font-medium text-muted-foreground">
              {config.mode === "monthly" ? `Dia ${config.dayOfMonth || 1} de cada mes as` : "As"}
            </Label>
            <div className="flex items-center gap-1">
              {/* Day of month (only for monthly) */}
              {config.mode === "monthly" && (
                <>
                  <Select
                    value={String(config.dayOfMonth || 1)}
                    onValueChange={(v) => updateField("dayOfMonth", parseInt(v))}
                  >
                    <SelectTrigger className="h-6 w-14 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)} className="text-xs">
                          Dia {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground">as</span>
                </>
              )}
              <Select
                value={String(config.hour)}
                onValueChange={(v) => updateField("hour", parseInt(v))}
              >
                <SelectTrigger className="h-6 w-14 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)} className="text-xs">
                      {String(h).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] font-bold">:</span>
              <Select
                value={String(config.minute)}
                onValueChange={(v) => updateField("minute", parseInt(v))}
              >
                <SelectTrigger className="h-6 w-14 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={String(m)} className="text-xs">
                      {String(m).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Daily: weekdays only toggle */}
        {config.mode === "daily" && (
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`${id}-weekdays`}
              checked={config.weekdaysOnly ?? false}
              onCheckedChange={(checked) => updateField("weekdaysOnly", !!checked)}
              className="h-3.5 w-3.5"
            />
            <label htmlFor={`${id}-weekdays`} className="text-[10px] cursor-pointer">
              Apenas dias uteis (Seg-Sex)
            </label>
          </div>
        )}

        {/* Weekly: day checkboxes */}
        {config.mode === "weekly" && (
          <div className="space-y-1">
            <Label className="text-[10px] font-medium text-muted-foreground">Dias</Label>
            <div className="flex flex-wrap gap-1">
              {WEEKDAY_LABELS.map(({ value, short }) => {
                const active = (config.weekdays || [1, 2, 3, 4, 5]).includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleWeekday(value)}
                    className={`h-6 w-8 rounded text-[10px] font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Advanced: raw cron input */}
        {config.mode === "advanced" && (
          <div className="space-y-1">
            <Label className="text-[10px] font-medium text-muted-foreground">
              Expressao cron
            </Label>
            <Input
              value={config.rawCron || ""}
              onChange={(e) => updateField("rawCron", e.target.value)}
              placeholder="0 9 * * 1-5"
              className="h-6 text-[11px] font-mono"
            />
          </div>
        )}

        {/* Timezone */}
        <div className="space-y-1">
          <Label className="text-[10px] font-medium text-muted-foreground">Fuso horário</Label>
          <Select
            value={config.timezone || nodeData.timezone || "Europe/Lisbon"}
            onValueChange={(v) => updateField("timezone", v)}
          >
            <SelectTrigger className="h-6 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Europe/Lisbon" className="text-xs">Europe/Lisbon</SelectItem>
              <SelectItem value="Europe/London" className="text-xs">Europe/London</SelectItem>
              <SelectItem value="UTC" className="text-xs">UTC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Description preview */}
        <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/30">
          <Calendar className="w-3 h-3 text-muted-foreground/70 shrink-0" />
          <p className="text-[10px] font-medium text-foreground/80 truncate">
            {describeCron(cronExpr)}
          </p>
        </div>
      </div>
    </NodeWrapper>
  )
}

export const TriggerScheduleNode = memo(TriggerScheduleNodeInner)
