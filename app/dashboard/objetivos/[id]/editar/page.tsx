'use client'

import { useState, useEffect, use } from 'react'
import { GoalConfigForm } from '@/components/goals/goal-config-form'
import { Skeleton } from '@/components/ui/skeleton'
import type { ConsultantGoal } from '@/types/goal'

export default function EditarObjetivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [goal, setGoal] = useState<ConsultantGoal | null>(null)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [goalRes, consultantsRes] = await Promise.all([
          fetch(`/api/goals/${id}`),
          fetch('/api/users/consultants'),
        ])

        if (goalRes.ok) {
          const goalData = await goalRes.json()
          setGoal(goalData)
        }

        if (consultantsRes.ok) {
          const json = await consultantsRes.json()
          setConsultants(json.data || json || [])
        }
      } catch {
        // handled by empty state
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Objetivo não encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Objetivo</h1>
        <p className="text-sm text-muted-foreground">
          Atualizar parâmetros do objetivo e funis de conversão
        </p>
      </div>

      <GoalConfigForm consultants={consultants} initialData={goal} goalId={id} />
    </div>
  )
}
