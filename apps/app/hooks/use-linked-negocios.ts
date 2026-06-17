'use client'

import { useEffect, useState } from 'react'

export interface LinkedNegocio {
  id: string
  tipo?: string | null
  localizacao?: string | null
  quartos?: number | null
  quartos_min?: number | null
  lead_id?: string | null
  lead?: { id?: string; nome?: string | null; full_name?: string | null } | null
}

/**
 * Oportunidades ligadas à actual (mesmo `deal_group_id` — "compra depende da
 * venda" / grupo manual), excluindo a própria. Vazio quando não há grupo.
 */
export function useLinkedNegocios(
  selfId: string | null | undefined,
  dealGroupId: string | null | undefined,
): LinkedNegocio[] {
  const [linked, setLinked] = useState<LinkedNegocio[]>([])

  useEffect(() => {
    if (!dealGroupId || !selfId) {
      setLinked([])
      return
    }
    let cancelled = false
    fetch(`/api/negocios?deal_group_id=${dealGroupId}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        if (cancelled) return
        const rows = ((j.data || []) as LinkedNegocio[]).filter((n) => n.id !== selfId)
        setLinked(rows)
      })
      .catch(() => {
        if (!cancelled) setLinked([])
      })
    return () => {
      cancelled = true
    }
  }, [selfId, dealGroupId])

  return linked
}
