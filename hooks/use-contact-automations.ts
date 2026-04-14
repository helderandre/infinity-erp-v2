"use client"

import { useCallback, useEffect, useState } from "react"
import type {
  ContactAutomation,
  ContactAutomationRun,
} from "@/types/contact-automation"

export interface ContactAutomationWithLastRun extends ContactAutomation {
  last_run?: ContactAutomationRun | null
}

export function useContactAutomations(contactId: string | undefined) {
  const [items, setItems] = useState<ContactAutomationWithLastRun[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!contactId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${contactId}/automations`)
      if (!res.ok) throw new Error((await res.json())?.error || "Erro ao carregar")
      const data = (await res.json()) as ContactAutomationWithLastRun[]
      setItems(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [contactId])

  useEffect(() => {
    if (contactId) fetchItems()
  }, [contactId, fetchItems])

  const create = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/leads/${contactId}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json())?.error || "Erro ao criar")
      await fetchItems()
      return res.json()
    },
    [contactId, fetchItems],
  )

  const patch = useCallback(
    async (automationId: string, payload: Record<string, unknown>) => {
      const res = await fetch(
        `/api/leads/${contactId}/automations/${automationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) throw new Error((await res.json())?.error || "Erro ao actualizar")
      await fetchItems()
      return res.json()
    },
    [contactId, fetchItems],
  )

  const cancel = useCallback(
    async (automationId: string) => {
      const res = await fetch(
        `/api/leads/${contactId}/automations/${automationId}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error((await res.json())?.error || "Erro ao cancelar")
      await fetchItems()
    },
    [contactId, fetchItems],
  )

  const cancelAll = useCallback(async () => {
    const res = await fetch(`/api/leads/${contactId}/automations`, {
      method: "DELETE",
    })
    if (!res.ok) throw new Error((await res.json())?.error || "Erro ao cancelar tudo")
    const out = await res.json()
    await fetchItems()
    return out.cancelled as number
  }, [contactId, fetchItems])

  const test = useCallback(
    async (automationId: string) => {
      const res = await fetch(
        `/api/leads/${contactId}/automations/${automationId}/test`,
        { method: "POST" },
      )
      if (!res.ok) throw new Error((await res.json())?.error || "Erro ao testar")
      return res.json()
    },
    [contactId],
  )

  const fetchRuns = useCallback(
    async (automationId: string) => {
      const res = await fetch(
        `/api/leads/${contactId}/automations/${automationId}/runs`,
      )
      if (!res.ok) throw new Error((await res.json())?.error || "Erro ao carregar histórico")
      return (await res.json()) as ContactAutomationRun[]
    },
    [contactId],
  )

  return { items, isLoading, error, refetch: fetchItems, create, patch, cancel, cancelAll, fetchRuns, test }
}
