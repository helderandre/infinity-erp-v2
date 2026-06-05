'use client'

import { useEffect, useState } from 'react'
import { LeadForm } from '@/components/leads/lead-form'
import { Skeleton } from '@/components/ui/skeleton'
import { peekPrefill, clearPrefill } from '@/lib/voice/prefill'

type LeadPrefill = {
  nome?: string
  email?: string
  telemovel?: string
  observacoes?: string
  negocio_tipo?: string
  tipo_imovel?: string
  localizacao?: string
  quartos_min?: string | number
  orcamento?: string | number
  orcamento_max?: string | number
}

export default function NovoLeadPage() {
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Lazy init: peek returns the same value on both Strict Mode invocations so
  // the form always receives the prefill, even in dev double-render.
  const [prefill] = useState<LeadPrefill | null>(() => peekPrefill<LeadPrefill>('lead'))

  useEffect(() => {
    clearPrefill('lead')
  }, [])

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
        <h1 className="text-3xl font-bold tracking-tight">Novo Contacto</h1>
        <p className="text-muted-foreground">
          Criar um novo contacto no sistema
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
        <LeadForm consultants={consultants} initialValues={prefill ?? undefined} />
      )}
    </div>
  )
}
