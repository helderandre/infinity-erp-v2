"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CustomEventDetail } from "@/types/custom-event"

export type AutomationKind = "custom" | "fixed"

export type FixedEventMeta = {
  id: string
  eventType: "aniversario_contacto" | "natal" | "ano_novo"
  name: string
  date: string
  defaultHour: number
}

/**
 * Hook partilhado pelo `<AutomationDetailSheet>`.
 * Para kind='custom', puxa `/api/automacao/custom-events/[id]` que devolve
 * evento + leads + runs + effective_channels num único payload.
 * Para kind='fixed', a shape é construída client-side a partir dos
 * endpoints legados existentes (eligible-leads, mutes, defaults).
 */
export function useAutomationDetail(kind: AutomationKind, eventId: string | null) {
  const [event, setEvent] = useState<CustomEventDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIt = useCallback(async () => {
    if (!eventId || kind !== "custom") return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/automacao/custom-events/${eventId}`)
      if (!res.ok) throw new Error("Erro ao carregar automatismo")
      const data = (await res.json()) as CustomEventDetail
      setEvent(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro")
    } finally {
      setIsLoading(false)
    }
  }, [eventId, kind])

  useEffect(() => {
    void fetchIt()
  }, [fetchIt])

  return { event, isLoading, error, refetch: fetchIt }
}

// ─── Channel availability cache ──────────────────────────────────────

interface ChannelAvailability {
  email: { available: boolean; account_count: number }
  whatsapp: { available: boolean; instance_count: number }
}

let cached: { data: ChannelAvailability; fetchedAt: number } | null = null
const TTL_MS = 60_000

/**
 * Cache module-level (TTL 60s) para poupar N round-trips.
 * Usado por todos os componentes do Sheet que precisam de saber se o
 * utilizador tem conta/instância activa.
 */
export function useChannelAvailability() {
  const [data, setData] = useState<ChannelAvailability | null>(
    cached && Date.now() - cached.fetchedAt < TTL_MS ? cached.data : null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const loadedOnce = useRef(false)

  const load = useCallback(async () => {
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      setData(cached.data)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch("/api/automacao/channel-availability")
      if (!res.ok) return
      const fresh = (await res.json()) as ChannelAvailability
      cached = { data: fresh, fetchedAt: Date.now() }
      setData(fresh)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loadedOnce.current) return
    loadedOnce.current = true
    void load()
  }, [load])

  return { availability: data, isLoading, refresh: load }
}
