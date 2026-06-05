import { useState, useEffect, useCallback } from 'react'
import type { ConsultantEmailAccount } from '@/types/email'

export function useEmailAccount() {
  const [accounts, setAccounts] = useState<ConsultantEmailAccount[]>([])
  const [isEmailAdmin, setIsEmailAdmin] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/email/account')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar contas')

      const list: ConsultantEmailAccount[] = data.accounts || []
      setAccounts(list)
      setIsEmailAdmin(data.is_email_admin ?? false)

      // Auto-select first account if none selected or current selection no longer exists
      setSelectedAccountId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null

  const setupAccount = useCallback(async (payload: {
    email_address: string
    password: string
    display_name: string
    smtp_host?: string
    smtp_port?: number
    imap_host?: string
    imap_port?: number
    consultant_id?: string
  }) => {
    const res = await fetch('/api/email/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || data.detail || 'Erro ao configurar conta')
    // Refresh the full list
    await fetchAccounts()
    return data
  }, [fetchAccounts])

  const removeAccount = useCallback(async (accountId?: string) => {
    const params = accountId ? `?id=${accountId}` : ''
    const res = await fetch(`/api/email/account${params}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao eliminar conta')
    // Refresh the full list
    await fetchAccounts()
    return data
  }, [fetchAccounts])

  return {
    /** All accounts visible to the current user */
    accounts,
    /** Whether the current user is an email admin (sees all accounts) */
    isEmailAdmin,
    /** Currently selected account */
    selectedAccount,
    /** ID of the currently selected account */
    selectedAccountId,
    /** Change the selected account */
    setSelectedAccountId,
    /** Backward compat: alias for selectedAccount */
    account: selectedAccount,
    isLoading,
    error,
    refetch: fetchAccounts,
    setupAccount,
    removeAccount,
  }
}
