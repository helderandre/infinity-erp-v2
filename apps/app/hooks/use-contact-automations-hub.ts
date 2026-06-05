"use client"

import { useCallback, useEffect, useState } from "react"

export interface ScheduledRow {
  source: "virtual" | "manual" | "custom_event"
  lead_id: string
  lead_name: string | null
  agent_id: string | null
  agent_name: string | null
  event_type: string
  next_at: string | null
  channels_active: Array<"email" | "whatsapp">
  channels_muted: Array<"email" | "whatsapp">
  state: "active" | "muted" | "skipped_no_channel"
  manual_automation_id?: string
}

export function useScheduled(params: Record<string, string | undefined>) {
  const [rows, setRows] = useState<ScheduledRow[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) query.set(k, v)
  const qs = query.toString()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/contact-automations-scheduled?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      setRows(json.rows ?? [])
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [qs])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { rows, isLoading, error, refetch: fetchData }
}

export type RunStatusFilter = "all" | "pending" | "sent" | "failed" | "skipped"

export interface RunRow {
  id: string
  lead_id: string | null
  event_type: string | null
  kind: string
  scheduled_for: string
  sent_at: string | null
  status: "pending" | "sent" | "failed" | "skipped"
  error: string | null
  skip_reason: string | null
  created_at: string
  leads?: { id: string; nome: string | null; full_name: string | null; agent_id: string | null } | null
}

export function useRuns(status: RunStatusFilter = "all") {
  const [rows, setRows] = useState<RunRow[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = status && status !== "all" ? `?status=${status}` : ""
      const res = await fetch(`/api/crm/contact-automations-runs${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      setRows(json.rows ?? [])
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { rows, isLoading, error, refetch: fetchData }
}
