'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { usePermissions } from './use-permissions'
import type { HydratedAcessosCustomSite } from '@/types/acessos'

interface UseAcessosCustomSitesResult {
  sites: HydratedAcessosCustomSite[]
  isLoading: boolean
  error: string | null
  canManageGlobal: boolean
  refetch: () => Promise<void>
}

export function useAcessosCustomSites(): UseAcessosCustomSitesResult {
  const [sites, setSites] = useState<HydratedAcessosCustomSite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { hasPermission, isBroker } = usePermissions()
  const canManageGlobal = isBroker() || hasPermission('settings')

  const fetchSites = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/acessos/custom-sites', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Erro' }))
        throw new Error(body.error ?? 'Erro ao carregar sites')
      }
      const data: HydratedAcessosCustomSite[] = await res.json()
      setSites(data)
    } catch (err: any) {
      const message = err?.message ?? 'Erro ao carregar sites'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSites()
  }, [fetchSites])

  return { sites, isLoading, error, canManageGlobal, refetch: fetchSites }
}
