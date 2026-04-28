'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { GoalConfigForm } from './goal-config-form'
import type { ConsultantGoal } from '@/types/goal'

interface GoalConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (id: string) => void
  /** When set, the sheet opens in edit mode and pre-fills with the goal's data. */
  goalId?: string | null
}

export function GoalConfigSheet({ open, onOpenChange, onSuccess, goalId }: GoalConfigSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const isManagement = isManagementRole(user?.role_names ?? [])
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [goal, setGoal] = useState<ConsultantGoal | null>(null)
  // Track each fetch independently so we can render the form as soon as the
  // pieces it actually needs are ready, instead of blocking on the slowest one.
  const [loadingConsultants, setLoadingConsultants] = useState(true)
  const [loadingGoal, setLoadingGoal] = useState(false)
  const [goalFetchFailed, setGoalFetchFailed] = useState(false)
  const isEdit = !!goalId

  useEffect(() => {
    if (!open) return
    // Consultor não precisa do array — selector escondido + self injectado
    // server-side. Skip do fetch para reduzir 1 round-trip.
    if (!isManagement) {
      setConsultants([])
      setLoadingConsultants(false)
      return
    }
    let cancelled = false

    setLoadingConsultants(true)
    fetch('/api/users/consultants')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .catch(() => ({ data: [] }))
      .then((json) => {
        if (cancelled) return
        setConsultants(json?.data || json || [])
      })
      .finally(() => {
        if (!cancelled) setLoadingConsultants(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, isManagement])

  useEffect(() => {
    if (!open) return
    if (!goalId) {
      setGoal(null)
      setLoadingGoal(false)
      setGoalFetchFailed(false)
      return
    }
    let cancelled = false
    setLoadingGoal(true)
    setGoalFetchFailed(false)
    setGoal(null)

    fetch(`/api/goals/${goalId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setGoalFetchFailed(true)
          return null
        }
        return res.json()
      })
      .catch(() => {
        if (!cancelled) setGoalFetchFailed(true)
        return null
      })
      .then((json) => {
        if (cancelled) return
        setGoal(json || null)
      })
      .finally(() => {
        if (!cancelled) setLoadingGoal(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, goalId])

  // In edit mode we need both pieces. In create mode we only need consultants.
  const isLoading = loadingConsultants || (isEdit && loadingGoal)
  const editButGoalMissing = isEdit && !isLoading && !goal

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-1">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
              {isEdit ? 'Editar Objetivo' : 'Novo Objetivo'}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {isEdit
                ? 'Atualizar parâmetros do objetivo e funis de conversão'
                : isManagement
                  ? 'Definir objetivo anual e parâmetros de funil para um consultor'
                  : 'Definir o teu objetivo anual e parâmetros de funil'}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[280px] w-full rounded-xl" />
              <Skeleton className="h-[180px] w-full rounded-xl" />
            </div>
          ) : editButGoalMissing ? (
            <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm p-6 text-center space-y-3">
              <p className="text-sm font-medium">Objetivo não encontrado</p>
              <p className="text-xs text-muted-foreground">
                {goalFetchFailed
                  ? 'Não foi possível carregar este objetivo. Verifica as tuas permissões e tenta novamente.'
                  : 'Este objetivo já não existe.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </div>
          ) : (
            // `key` forces a clean remount when switching between create / edit
            // so useForm picks up the right defaults from the start instead of
            // depending on a follow-up form.reset.
            <GoalConfigForm
              key={goalId ?? 'new'}
              consultants={consultants}
              initialData={goal ?? undefined}
              goalId={isEdit ? (goalId as string) : undefined}
              enableQuickFill={!isEdit}
              currentUserId={user?.id}
              isManagement={isManagement}
              onCancel={() => onOpenChange(false)}
              onSuccess={(id) => {
                onOpenChange(false)
                onSuccess?.(id)
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
