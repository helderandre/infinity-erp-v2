'use client'

import { useState, useEffect } from 'react'
import { GoalConfigForm } from '@/components/goals/goal-config-form'
import { Skeleton } from '@/components/ui/skeleton'

export default function NovoObjetivoPage() {
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchConsultants() {
      try {
        const res = await fetch('/api/users/consultants')
        if (res.ok) {
          const json = await res.json()
          setConsultants(json.data || json || [])
        }
      } catch {
        // fallback
      } finally {
        setIsLoading(false)
      }
    }
    fetchConsultants()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo Objetivo</h1>
        <p className="text-sm text-muted-foreground">
          Definir objetivo anual e parâmetros de funil para um consultor
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      ) : (
        <GoalConfigForm consultants={consultants} />
      )}
    </div>
  )
}
