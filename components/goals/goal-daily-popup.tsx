'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Target, Phone, MapPin, MessageSquare, RotateCcw, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { GoalStatus } from '@/types/goal'

interface DailyAction {
  key: string
  label: string
  target: number
  done: number
  status: GoalStatus
}

interface DailyGoalData {
  hasGoal: boolean
  goalId?: string
  dailyRevenue?: number
  weeklyRevenue?: number
  annualTarget?: number
  realizedToday?: number
  overallStatus?: GoalStatus
  projectionMessage?: string
  actions?: DailyAction[]
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  leads: MessageSquare,
  calls: Phone,
  visits: MapPin,
  follow_ups: RotateCcw,
}

const STATUS_STYLES: Record<GoalStatus, { dot: string; bar: string }> = {
  green: { dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  orange: { dot: 'bg-amber-500', bar: 'bg-amber-500' },
  red: { dot: 'bg-red-500', bar: 'bg-red-500' },
}

const SESSION_KEY = 'goal-daily-popup-dismissed'

export function GoalDailyPopup() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<DailyGoalData | null>(null)

  useEffect(() => {
    // Check if already dismissed today
    const dismissed = sessionStorage.getItem(SESSION_KEY)
    const today = new Date().toISOString().split('T')[0]
    if (dismissed === today) return

    // Fetch daily goals
    async function fetchDaily() {
      try {
        const res = await fetch('/api/goals/my-daily')
        if (!res.ok) return

        const json: DailyGoalData = await res.json()
        if (json.hasGoal && json.actions && json.actions.length > 0) {
          setData(json)
          // Small delay so the page loads first
          setTimeout(() => setOpen(true), 800)
        }
      } catch {
        // silently fail
      }
    }

    fetchDaily()
  }, [])

  function handleDismiss() {
    const today = new Date().toISOString().split('T')[0]
    sessionStorage.setItem(SESSION_KEY, today)
    setOpen(false)
  }

  if (!data || !data.hasGoal) return null

  const totalTarget = data.actions?.reduce((s, a) => s + a.target, 0) || 0
  const totalDone = data.actions?.reduce((s, a) => s + a.done, 0) || 0
  const allDone = totalDone >= totalTarget && totalTarget > 0

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent className="sm:max-w-md overflow-hidden rounded-2xl p-0 gap-0">
        {/* Black header */}
        <div className="bg-neutral-900 rounded-t-2xl px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-white">Objetivos de Hoje</DialogTitle>
              <p className="text-xs text-white/60">
                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          {/* Revenue targets in header */}
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/50">Objetivo diário</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(data.dailyRevenue || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/50">Semanal</p>
              <p className="text-sm font-semibold text-white/80">{formatCurrency(data.weeklyRevenue || 0)}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-2.5">
          {/* Actions list */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Ações necessárias hoje</p>

            {data.actions?.map((action) => {
              const Icon = ACTION_ICONS[action.key] || MessageSquare
              const style = STATUS_STYLES[action.status]
              const pct = action.target > 0 ? Math.min((action.done / action.target) * 100, 100) : 0
              const isDone = action.done >= action.target

              return (
                <div key={action.key} className="rounded-lg border-[0.5px] border-border/30 bg-muted/10 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg',
                        isDone ? 'bg-emerald-500/15' : 'bg-muted/50'
                      )}>
                        <Icon className={cn('h-3.5 w-3.5', isDone ? 'text-emerald-600' : 'text-muted-foreground')} />
                      </div>
                      <span className="text-sm font-medium">{action.label}</span>
                    </div>
                    <span className="text-sm tabular-nums font-bold">
                      {action.done}<span className="text-muted-foreground font-normal">/{action.target}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', style.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Projection message */}
          {data.projectionMessage && (
            <p className="rounded-lg border border-dashed border-border/20 bg-muted/10 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              {data.projectionMessage}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-0.5">
            <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={handleDismiss}>
              Fechar
            </Button>
            <Button size="sm" className="rounded-full bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200" asChild onClick={handleDismiss}>
              <Link href={`/dashboard/objetivos/${data.goalId}`}>
                Ver Dashboard
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
