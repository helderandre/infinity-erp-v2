'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * CRM Negócio redirect page.
 * Resolves the lead_id from the negócio and redirects to the full
 * negócio detail page at /dashboard/leads/[leadId]/negocios/[negocioId]
 * which has matching, visits, interessados, etc.
 * Query params (like ?tab=processos) are preserved across the redirect.
 */
export default function CrmNegocioRedirectPage() {
  const { id: negocioId } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState(false)

  useEffect(() => {
    async function resolve() {
      try {
        const res = await fetch(`/api/negocios/${negocioId}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const leadId = data.lead_id
        if (!leadId) throw new Error('No lead_id')
        const qs = searchParams.toString()
        const suffix = qs ? `?${qs}` : ''
        router.replace(`/dashboard/leads/${leadId}/negocios/${negocioId}${suffix}`)
      } catch {
        setError(true)
      }
    }
    resolve()
  }, [negocioId, router, searchParams])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <p className="text-sm font-medium">Negócio não encontrado</p>
        <button
          onClick={() => router.back()}
          className="mt-3 text-xs underline hover:text-foreground transition-colors"
        >
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}
