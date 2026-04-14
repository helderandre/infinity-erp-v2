'use client'

import { useCallback, useEffect, useState } from 'react'

export type PropertySendCandidate = {
  source: 'consultant' | 'lead'
  id: string
  label: string
  email: string | null
  phone: string | null
  isMain?: boolean
}

export type PropertySendRecipients = {
  entityRef: string | null
  entityLabel: string | null
  consultant: PropertySendCandidate | null
  owners: PropertySendCandidate[]
  leadFirstName: string | null
}

export type EmailAccount = {
  id: string
  email_address: string
  display_name: string
  is_active: boolean
}

export type WhatsappInstance = {
  id: string
  name: string
  phone: string | null
  profile_name: string | null
}

export type SendResult = {
  channel: 'email' | 'whatsapp'
  to: string
  status: 'pending' | 'sending' | 'success' | 'failed'
  error?: string
}

export type SendPropertiesRequest = {
  negocioId: string
  negocio_property_ids: string[]
  email?: {
    account_id: string
    subject: string
    body_html: string
    recipients: string[]
  }
  whatsapp?: {
    instance_id: string
    message?: string
    recipients: string[]
  }
}

interface UseSendPropertiesOptions {
  negocioId: string
  enabled: boolean
}

export function useSendProperties({
  negocioId,
  enabled,
}: UseSendPropertiesOptions) {
  const [recipients, setRecipients] = useState<PropertySendRecipients | null>(null)
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsappInstance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SendResult[]>([])
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const [rRes, aRes, iRes] = await Promise.all([
          fetch(`/api/negocios/${negocioId}/properties/send/recipients`),
          fetch('/api/email/account'),
          fetch('/api/whatsapp/instances'),
        ])
        const [rData, aData, iData] = await Promise.all([
          rRes.ok ? rRes.json() : null,
          aRes.ok ? aRes.json() : null,
          iRes.ok ? iRes.json() : null,
        ])
        if (cancelled) return
        setRecipients(rData ?? null)
        const accounts: EmailAccount[] = Array.isArray(aData?.accounts)
          ? aData.accounts.filter((a: EmailAccount) => a.is_active)
          : []
        setEmailAccounts(accounts)
        setWhatsappInstances(
          Array.isArray(iData?.instances) ? iData.instances : []
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [negocioId, enabled])

  const send = useCallback(async (req: SendPropertiesRequest) => {
    setIsSending(true)
    const initial: SendResult[] = []
    if (req.email) {
      for (const to of req.email.recipients) {
        initial.push({ channel: 'email', to, status: 'sending' })
      }
    }
    if (req.whatsapp) {
      for (const to of req.whatsapp.recipients) {
        initial.push({ channel: 'whatsapp', to, status: 'sending' })
      }
    }
    setResults(initial)

    try {
      const res = await fetch(
        `/api/negocios/${req.negocioId}/properties/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            negocio_property_ids: req.negocio_property_ids,
            email: req.email,
            whatsapp: req.whatsapp,
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errMsg = (data?.error as string | undefined) ?? 'Erro ao enviar'
        setResults((prev) =>
          prev.map((r) => ({ ...r, status: 'failed', error: errMsg }))
        )
        return { ok: false, error: errMsg }
      }
      const incoming: SendResult[] = Array.isArray(data?.results)
        ? data.results.map((r: SendResult) => ({ ...r }))
        : []
      setResults((prev) => {
        const map = new Map<string, SendResult>()
        for (const r of prev) map.set(`${r.channel}:${r.to}`, r)
        for (const r of incoming) map.set(`${r.channel}:${r.to}`, r)
        return Array.from(map.values())
      })
      return { ok: true, results: incoming }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erro de rede'
      setResults((prev) =>
        prev.map((r) => ({ ...r, status: 'failed', error: errMsg }))
      )
      return { ok: false, error: errMsg }
    } finally {
      setIsSending(false)
    }
  }, [])

  const reset = useCallback(() => setResults([]), [])

  return {
    recipients,
    emailAccounts,
    whatsappInstances,
    isLoading,
    results,
    isSending,
    send,
    reset,
  }
}
