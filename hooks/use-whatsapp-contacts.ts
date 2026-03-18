'use client'

import { useState, useCallback } from 'react'
import type { WppContact } from '@/lib/types/whatsapp-web'

export function useWhatsAppContacts(instanceId: string | null) {
  const [contacts, setContacts] = useState<WppContact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchContacts = useCallback(
    async (opts?: { search?: string; linked?: string }) => {
      if (!instanceId) {
        setContacts([])
        setTotal(0)
        return
      }

      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (opts?.search) params.set("search", opts.search)
        if (opts?.linked) params.set("linked", opts.linked)

        const res = await fetch(`/api/whatsapp/instances/${instanceId}/contacts?${params}`)
        if (!res.ok) throw new Error("Erro ao carregar contactos")

        const data = await res.json()
        setContacts(data.contacts)
        setTotal(data.total)
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    },
    [instanceId]
  )

  const linkOwner = useCallback(
    async (contactId: string, ownerId: string | null) => {
      if (!instanceId) return

      const res = await fetch(`/api/whatsapp/instances/${instanceId}/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: ownerId }),
      })

      if (!res.ok) throw new Error("Erro ao vincular proprietário")

      const updated = await res.json()
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)))
    },
    [instanceId]
  )

  const linkLead = useCallback(
    async (contactId: string, leadId: string | null) => {
      if (!instanceId) return

      const res = await fetch(`/api/whatsapp/instances/${instanceId}/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })

      if (!res.ok) throw new Error("Erro ao vincular lead")

      const updated = await res.json()
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)))
    },
    [instanceId]
  )

  const syncContacts = useCallback(async () => {
    if (!instanceId) return

    setIsLoading(true)
    try {
      await fetch(`/api/whatsapp/instances/${instanceId}/contacts`, {
        method: 'POST',
      })
      await fetchContacts()
    } finally {
      setIsLoading(false)
    }
  }, [instanceId, fetchContacts])

  return { contacts, isLoading, total, fetchContacts, linkOwner, linkLead, syncContacts }
}
