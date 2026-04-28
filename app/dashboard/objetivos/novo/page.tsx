'use client'

import { useState, useEffect } from 'react'
import { GoalConfigForm } from '@/components/goals/goal-config-form'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'

export default function NovoObjetivoPage() {
  const { user } = useUser()
  const isManagement = isManagementRole(user?.role_names ?? [])
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Consultor não precisa do array — o seu próprio ID é injectado
    // server-side e o selector está escondido na UI.
    if (!isManagement) {
      setIsLoading(false)
      return
    }
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
  }, [isManagement])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo Objetivo</h1>
        <p className="text-sm text-muted-foreground">
          {isManagement
            ? 'Definir objetivo anual e parâmetros de funil para um consultor'
            : 'Definir o teu objetivo anual e parâmetros de funil'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      ) : (
        <GoalConfigForm
          consultants={consultants}
          currentUserId={user?.id}
          isManagement={isManagement}
        />
      )}
    </div>
  )
}
