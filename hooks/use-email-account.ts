import { useState, useEffect, useCallback } from 'react'
import type { ConsultantEmailAccount } from '@/types/email'

export function useEmailAccount() {
  const [account, setAccount] = useState<ConsultantEmailAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccount = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/email/account')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar conta')
      setAccount(data.account || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccount()
  }, [fetchAccount])

  const setupAccount = useCallback(async (payload: {
    email_address: string
    password: string
    display_name: string
    smtp_host?: string
    smtp_port?: number
    imap_host?: string
    imap_port?: number
  }) => {
    const res = await fetch('/api/email/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || data.detail || 'Erro ao configurar conta')
    setAccount(data.account)
    return data
  }, [])

  const removeAccount = useCallback(async () => {
    const res = await fetch('/api/email/account', { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao eliminar conta')
    setAccount(null)
    return data
  }, [])

  return {
    account,
    isLoading,
    error,
    refetch: fetchAccount,
    setupAccount,
    removeAccount,
  }
}
