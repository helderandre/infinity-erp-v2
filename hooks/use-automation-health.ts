"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { HealthSummaryRow } from "@/types/custom-event"

interface UseAutomationHealthParams {
  /**
   * Optional consultant id to query. Só tem efeito para roles broker/admin;
   * outros roles recebem 403 do endpoint se `consultantId !== self`.
   * Omitir para scope implícito ao próprio utilizador.
   */
  consultantId?: string
}

/**
 * Payload de `GET /api/automacao/custom-events/health-summary`.
 * Alimenta os cards da tab "Automatismos" com sinais de saúde
 * (sucesso/falhas/conclusão) sem duplicar requests por card.
 */
export function useAutomationHealth({ consultantId }: UseAutomationHealthParams = {}) {
  const [rows, setRows] = useState<HealthSummaryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (consultantId) params.set("consultant_id", consultantId)
      const qs = params.toString()
      const res = await fetch(
        `/api/automacao/custom-events/health-summary${qs ? `?${qs}` : ""}`,
      )
      if (!res.ok) {
        throw new Error(`Erro ao carregar saúde (${res.status})`)
      }
      const data = (await res.json()) as HealthSummaryRow[]
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [consultantId])

  useEffect(() => {
    void load()
  }, [load])

  const byKey = useMemo(() => {
    const map: Record<string, HealthSummaryRow> = {}
    for (const row of rows) map[row.event_key] = row
    return map
  }, [rows])

  return { rows, byKey, isLoading, error, refetch: load }
}
