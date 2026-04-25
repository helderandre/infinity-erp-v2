'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Target, Sparkles } from 'lucide-react'
import { useGoals } from '@/hooks/use-goals'
import { useUser } from '@/hooks/use-user'
import { GoalConfigSheet } from '@/components/goals/goal-config-sheet'
import { ConsultantGoalDashboard } from '@/components/goals/consultant-goal-dashboard'
import { AICoachSheet } from '@/components/goals/ai-coach-sheet'

interface ConsultantObjetivosHomeProps {
  /** True quando o utilizador também é manager — mostra o toggle "A minha visão · Equipa". */
  showRoleToggle?: boolean
}

export function ConsultantObjetivosHome({ showRoleToggle = false }: ConsultantObjetivosHomeProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [configOpen, setConfigOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)

  const { goals, isLoading, refetch } = useGoals({ year, consultant_id: user?.id })
  const myGoal = goals[0]

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  function handleViewSwitch(view: 'self' | 'equipa') {
    const sp = new URLSearchParams(searchParams.toString())
    if (view === 'equipa') sp.set('view', 'equipa')
    else sp.delete('view')
    router.replace(`/dashboard/objetivos${sp.toString() ? `?${sp.toString()}` : ''}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Os Meus Objetivos</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            O teu plano para {year}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showRoleToggle && (
            <div className="inline-flex items-center rounded-full border bg-muted/40 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleViewSwitch('self')}
                className="rounded-full bg-white px-3 py-1 shadow-sm"
              >
                A minha visão
              </button>
              <button
                type="button"
                onClick={() => handleViewSwitch('equipa')}
                className="rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
              >
                Equipa
              </button>
            </div>
          )}
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[90px] rounded-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={!myGoal}
            onClick={() => setCoachOpen(true)}
            className="rounded-full h-8 text-xs gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-orange-500" />
            Coach
          </Button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-[500px] w-full rounded-2xl" />
        </div>
      ) : myGoal ? (
        <ConsultantGoalDashboard goalId={myGoal.id} mode="self" />
      ) : (
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
              <Target className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-base font-semibold mb-1">
              Define os teus objetivos para {year}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Sem objetivos definidos não há plano diário. Configura agora para começares a ver o teu ritmo, gaps e progresso.
            </p>
            <Button size="sm" className="rounded-full" onClick={() => setConfigOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Definir Objetivos {year}
            </Button>
          </div>
        </div>
      )}

      <GoalConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSuccess={() => refetch()}
      />

      <AICoachSheet
        goalId={myGoal?.id ?? null}
        consultantName={user?.commercial_name ?? null}
        open={coachOpen}
        onOpenChange={setCoachOpen}
      />
    </div>
  )
}
