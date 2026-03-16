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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Objetivos de Hoje</DialogTitle>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Daily revenue target */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Objetivo diário</p>
              <p className="text-xl font-bold">{formatCurrency(data.dailyRevenue || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Semanal</p>
              <p className="text-sm font-semibold">{formatCurrency(data.weeklyRevenue || 0)}</p>
            </div>
          </div>
        </div>

        {/* Actions list */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Ações necessárias hoje</p>

          {data.actions?.map((action) => {
            const Icon = ACTION_ICONS[action.key] || MessageSquare
            const style = STATUS_STYLES[action.status]
            const pct = action.target > 0 ? Math.min((action.done / action.target) * 100, 100) : 0

            return (
              <div key={action.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', style.dot)} />
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{action.label}</span>
                  </div>
                  <span className="text-sm tabular-nums font-medium">
                    {action.done}<span className="text-muted-foreground">/{action.target}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={cn('h-1.5 rounded-full transition-all', style.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Projection message */}
        {data.projectionMessage && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {data.projectionMessage}
          </p>
        )}

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Fechar
          </Button>
          <Button size="sm" asChild onClick={handleDismiss}>
            <Link href={`/dashboard/objetivos/${data.goalId}`}>
              Ver Dashboard Completo
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
