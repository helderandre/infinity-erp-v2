'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import type {
  AcessosCompanyInfoPayload,
  ConvictusCompanyData,
  FaturacaoCompanyData,
} from '@/types/acessos'

interface UseAcessosCompanyInfoResult {
  faturacao: FaturacaoCompanyData | null
  convictus: ConvictusCompanyData | null
  canManage: boolean
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useAcessosCompanyInfo(): UseAcessosCompanyInfoResult {
  const [payload, setPayload] = useState<AcessosCompanyInfoPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInfo = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/acessos/company-info')
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Erro' }))
        throw new Error(body.error ?? 'Erro ao carregar estrutura')
      }
      const data: AcessosCompanyInfoPayload = await res.json()
      setPayload(data)
    } catch (err: any) {
      const message = err?.message ?? 'Erro ao carregar estrutura'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInfo()
  }, [fetchInfo])

  return {
    faturacao: payload?.faturacao ?? null,
    convictus: payload?.convictus ?? null,
    canManage: payload?.can_manage ?? false,
    isLoading,
    error,
    refetch: fetchInfo,
  }
}
