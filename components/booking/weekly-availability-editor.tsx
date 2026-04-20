'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Plus, Trash2, Copy, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface WeeklyRule {
  day_of_week: number
  start_time: string
  end_time: string
  active?: boolean
  note?: string | null
}

interface WeeklyAvailabilityEditorProps {
  rules: WeeklyRule[]
  onChange: (rules: WeeklyRule[]) => void
  showNotes?: boolean
  disabled?: boolean
}

const DAY_LABELS = [
  { key: 1, label: 'Segunda', short: 'Seg' },
  { key: 2, label: 'Terça', short: 'Ter' },
  { key: 3, label: 'Quarta', short: 'Qua' },
  { key: 4, label: 'Quinta', short: 'Qui' },
  { key: 5, label: 'Sexta', short: 'Sex' },
  { key: 6, label: 'Sábado', short: 'Sáb' },
  { key: 0, label: 'Domingo', short: 'Dom' },
]

const WEEKDAYS = [1, 2, 3, 4, 5]

const HHMM = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t)

export function WeeklyAvailabilityEditor({
  rules,
  onChange,
  showNotes = false,
  disabled = false,
}: WeeklyAvailabilityEditorProps) {
  const rulesByDay = useMemo(() => {
    const map = new Map<number, WeeklyRule[]>()
    for (const r of rules) {
      const list = map.get(r.day_of_week) ?? []
      list.push(r)
      map.set(r.day_of_week, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time))
    }
    return map
  }, [rules])

  const updateRule = useCallback(
    (day: number, index: number, patch: Partial<WeeklyRule>) => {
      const dayRules = rulesByDay.get(day) ?? []
      const targetIndex = rules.findIndex(
        (r) =>
          r.day_of_week === day &&
          r.start_time === dayRules[index].start_time &&
          r.end_time === dayRules[index].end_time,
      )
      if (targetIndex === -1) return
      const next = [...rules]
      next[targetIndex] = { ...next[targetIndex], ...patch }
      onChange(next)
    },
    [rules, rulesByDay, onChange],
  )

  const addRule = useCallback(
    (day: number) => {
      const dayRules = rulesByDay.get(day) ?? []
      const newRule: WeeklyRule = dayRules.length > 0
        ? {
            day_of_week: day,
            start_time: HHMM(dayRules[dayRules.length - 1].end_time),
            end_time: '18:00',
            active: true,
          }
        : {
            day_of_week: day,
            start_time: '09:00',
            end_time: '18:00',
            active: true,
          }
      onChange([...rules, newRule])
    },
    [rules, rulesByDay, onChange],
  )

  const removeRule = useCallback(
    (day: number, index: number) => {
      const dayRules = rulesByDay.get(day) ?? []
      const target = dayRules[index]
      if (!target) return
      onChange(
        rules.filter(
          (r) =>
            !(
              r.day_of_week === day &&
              r.start_time === target.start_time &&
              r.end_time === target.end_time
            ),
        ),
      )
    },
    [rules, rulesByDay, onChange],
  )

  const copyMondayToWeekdays = useCallback(() => {
    const mondayRules = rulesByDay.get(1) ?? []
    if (mondayRules.length === 0) return
    const keepOtherDays = rules.filter((r) => !WEEKDAYS.includes(r.day_of_week))
    const replicated: WeeklyRule[] = []
    for (const d of WEEKDAYS) {
      for (const r of mondayRules) {
        replicated.push({ ...r, day_of_week: d })
      }
    }
    onChange([...keepOtherDays, ...replicated])
  }, [rules, rulesByDay, onChange])

  const mondayHasRules = (rulesByDay.get(1) ?? []).length > 0

  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const runAi = useCallback(async () => {
    if (!aiText.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/booking/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao interpretar')
        return
      }
      const newRules: WeeklyRule[] = (data.rules ?? []).map((r: WeeklyRule) => ({
        ...r,
        active: true,
      }))
      if (newRules.length === 0) {
        toast.warning('A IA não encontrou horários no texto')
        return
      }
      onChange(newRules)
      toast.success(`${newRules.length} regra${newRules.length > 1 ? 's' : ''} interpretada${newRules.length > 1 ? 's' : ''}`)
      setAiOpen(false)
      setAiText('')
    } catch {
      toast.error('Erro ao interpretar texto')
    } finally {
      setAiLoading(false)
    }
  }, [aiText, onChange])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold">Horários por dia</h4>
        <div className="flex items-center gap-2">
          {mondayHasRules && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyMondayToWeekdays}
              className="h-7 text-[11px] gap-1"
              title="Copia os horários de segunda-feira para ter-sex"
            >
              <Copy className="h-3 w-3" /> Copiar Seg → dias úteis
            </Button>
          )}
          {!disabled && (
            <Popover open={aiOpen} onOpenChange={setAiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1 border-primary/30"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  Gerar com IA
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">Descreve os teus horários</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  A IA interpreta e preenche a grelha automaticamente. Isto substitui os horários actuais.
                </p>
                <Textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      runAi()
                    }
                  }}
                  placeholder="Ex: Seg a sex das 9 às 18, pausa de almoço 13-14. Sábado só de manhã."
                  rows={4}
                  className="text-xs resize-none"
                  autoFocus
                  disabled={aiLoading}
                  maxLength={500}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground">⌘+Enter</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={runAi}
                    disabled={!aiText.trim() || aiLoading}
                    className="h-7 text-[11px] gap-1 bg-neutral-900 text-white hover:bg-neutral-800"
                  >
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {aiLoading ? 'A interpretar...' : 'Interpretar'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="rounded-xl border divide-y">
        {DAY_LABELS.map(({ key, label }) => {
          const dayRules = rulesByDay.get(key) ?? []
          const isEmpty = dayRules.length === 0

          return (
            <div key={key} className={cn('p-3 space-y-2', isEmpty && 'bg-muted/10')}>
              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-xs font-medium',
                  isEmpty ? 'text-muted-foreground' : 'text-foreground',
                )}>
                  {label}
                  {isEmpty && <span className="ml-2 text-[10px] text-muted-foreground/70">Indisponível</span>}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addRule(key)}
                  disabled={disabled}
                  className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>

              {dayRules.length > 0 && (
                <div className="space-y-2">
                  {dayRules.map((rule, idx) => (
                    <div key={`${key}-${idx}`} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={HHMM(rule.start_time)}
                        onChange={(e) => updateRule(key, idx, { start_time: e.target.value })}
                        disabled={disabled}
                        className="h-8 w-28 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={HHMM(rule.end_time)}
                        onChange={(e) => updateRule(key, idx, { end_time: e.target.value })}
                        disabled={disabled}
                        className="h-8 w-28 text-xs"
                      />
                      {showNotes && (
                        <Input
                          type="text"
                          value={rule.note ?? ''}
                          onChange={(e) => updateRule(key, idx, { note: e.target.value || null })}
                          disabled={disabled}
                          placeholder="Nota opcional"
                          className="h-8 flex-1 text-xs"
                          maxLength={200}
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRule(key, idx)}
                        disabled={disabled}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
