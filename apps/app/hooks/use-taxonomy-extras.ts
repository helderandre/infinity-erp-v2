'use client'

import { useCallback, useEffect, useState } from 'react'

export interface TaxonomyExtra {
  id: string
  scope: string
  value: string
  label: string
  is_active: boolean
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

interface UseTaxonomyExtrasResult {
  extras: TaxonomyExtra[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  /** Resolve a saved value (slug) to its display label, falling back to the
   *  value itself if nothing matches (covers admin-deactivated rows that legacy
   *  property records still reference). */
  resolveLabel: (value: string) => string
}

/**
 * Hook to fetch user-contributed extras for a taxonomy scope.
 *
 * Cache key: scope. The hook keeps a per-scope module-level cache so multiple
 * `<SelectWithOther>` instances on the same page don't re-fetch.
 *
 * Pass `includeInactive=true` from admin screens to surface soft-deleted rows
 * for management; default is active-only (what the picker shows users).
 */
const cache = new Map<string, TaxonomyExtra[]>()
const pending = new Map<string, Promise<TaxonomyExtra[]>>()

export function useTaxonomyExtras(
  scope: string,
  options?: { includeInactive?: boolean }
): UseTaxonomyExtrasResult {
  const includeInactive = !!options?.includeInactive
  const cacheKey = `${scope}::${includeInactive ? 'all' : 'active'}`

  const [extras, setExtras] = useState<TaxonomyExtra[]>(
    () => cache.get(cacheKey) ?? []
  )
  const [loading, setLoading] = useState(!cache.has(cacheKey))
  const [error, setError] = useState<string | null>(null)

  const fetchOnce = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let inflight = pending.get(cacheKey)
      if (!inflight) {
        const url = `/api/taxonomy/${scope}${includeInactive ? '?include_inactive=1' : ''}`
        inflight = fetch(url)
          .then(async (r) => {
            if (!r.ok) throw new Error((await r.json()).error || 'Erro')
            const json = await r.json()
            return (json.data ?? []) as TaxonomyExtra[]
          })
          .then((rows) => {
            cache.set(cacheKey, rows)
            return rows
          })
          .finally(() => pending.delete(cacheKey))
        pending.set(cacheKey, inflight)
      }
      const rows = await inflight
      setExtras(rows)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar')
      setExtras([])
    } finally {
      setLoading(false)
    }
  }, [scope, includeInactive, cacheKey])

  useEffect(() => {
    fetchOnce()
  }, [fetchOnce])

  const refetch = useCallback(async () => {
    cache.delete(cacheKey)
    await fetchOnce()
  }, [cacheKey, fetchOnce])

  const resolveLabel = useCallback(
    (value: string) => {
      const hit = extras.find((e) => e.value === value)
      return hit?.label ?? value
    },
    [extras]
  )

  return { extras, loading, error, refetch, resolveLabel }
}

/** Invalidate the module-level cache for a scope. Call after POST/PUT/DELETE
 *  to force the next `useTaxonomyExtras` mount to re-fetch. */
export function invalidateTaxonomyExtras(scope: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${scope}::`)) cache.delete(key)
  }
}
