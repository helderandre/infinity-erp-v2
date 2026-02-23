'use client'

import { useEffect, useState } from 'react'
import { LeadForm } from '@/components/leads/lead-form'
import { Skeleton } from '@/components/ui/skeleton'

export default function NovoLeadPage() {
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadConsultants() {
      try {
        const res = await fetch('/api/users/consultants')
        if (res.ok) {
          const data = await res.json()
          setConsultants(
            (data || []).map((c: Record<string, unknown>) => ({
              id: c.id as string,
              commercial_name: c.commercial_name as string,
            }))
          )
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    }
    loadConsultants()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Novo Lead</h1>
        <p className="text-muted-foreground">
          Criar um novo lead no sistema
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4 max-w-2xl">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <LeadForm consultants={consultants} />
      )}
    </div>
  )
}
