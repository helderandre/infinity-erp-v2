'use client'

import { useEffect, useState } from 'react'

const cache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

/**
 * Resolve the email_signature_url of a consultant by id.
 *
 * Shared client-side cache keyed by consultantId keeps duplicate fetches
 * cheap when multiple components (e.g. standard canvas + preview) ask
 * for the same consultant.
 */
export function useResolvedSignature(
  consultantId: string | null | undefined
): { url: string | null; loading: boolean } {
  const id = typeof consultantId === 'string' && consultantId ? consultantId : null

  const [url, setUrl] = useState<string | null>(() => (id ? cache.get(id) ?? null : null))
  const [loading, setLoading] = useState<boolean>(() => Boolean(id && !cache.has(id)))

  useEffect(() => {
    if (!id) {
      setUrl(null)
      setLoading(false)
      return
    }

    if (cache.has(id)) {
      setUrl(cache.get(id) ?? null)
      setLoading(false)
      return
    }

    setLoading(true)
    let cancelled = false

    const existing = inflight.get(id)
    const promise =
      existing ??
      fetch(`/api/consultants/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (data): string | null =>
            data?.dev_consultant_profiles?.email_signature_url ??
            data?.profile?.email_signature_url ??
            data?.email_signature_url ??
            null
        )
        .catch(() => null)
        .finally(() => {
          inflight.delete(id)
        })

    if (!existing) inflight.set(id, promise)

    promise.then((resolved) => {
      cache.set(id, resolved)
      if (!cancelled) {
        setUrl(resolved)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [id])

  return { url, loading }
}
