'use client'

import { useState, useEffect } from 'react'

type MediaCacheEntry = {
  url: string | null
  resolvedAt: number
}

// Cache global — persiste entre re-renders e componentes
const mediaCache = new Map<string, MediaCacheEntry>()
// Evitar chamadas duplicadas em paralelo
const pendingRequests = new Map<string, Promise<string | null>>()

// UAZAPI decrypted URLs don't stay valid as long as the API implies.
// In practice, they often 404 within minutes / hours (session- or token-bound).
// Keep the cache short and always re-resolve if a cached URL is missing.
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
// Negative cache: when /api/whatsapp/media/download returns null (media gone
// from UAZAPI), remember that for a short window so we don't fire the same
// failing request on every render — those storms steal main-thread time and
// make page-to-page navigation feel sluggish.
const NEG_CACHE_TTL_MS = 60 * 1000 // 1 minute

/** Imperatively drop a cached entry (used when an <img> 404s). */
export function invalidateMediaCache(instanceId: string, waMessageId: string) {
  mediaCache.delete(`${instanceId}:${waMessageId}`)
}

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker'])

async function resolveMediaUrl(
  instanceId: string,
  waMessageId: string,
  messageType: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/whatsapp/media/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_id: instanceId,
        wa_message_id: waMessageId,
        generate_mp3: messageType === 'audio',
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    return data.fileURL || null
  } catch {
    return null
  }
}

// UAZAPI already-decrypted URLs — we use them directly. If one ever 404s, the
// <img onError> handler in MessageMediaRenderer calls invalidateMediaCache()
// and bumps retryKey, which forces a fresh resolution the next tick.
const UAZAPI_PATTERN = /uazapi\.com/i

function needsResolution(mediaUrl: string | undefined | null): boolean {
  if (!mediaUrl) return true
  if (UAZAPI_PATTERN.test(mediaUrl)) return false
  if (mediaUrl.includes('supabase')) return false
  if (mediaUrl.includes('r2.dev')) return false
  if (mediaUrl.includes('r2.cloudflarestorage')) return false
  // Encrypted WhatsApp CDN URLs — always resolve via UAZAPI
  if (mediaUrl.includes('.enc')) return true
  if (mediaUrl.includes('mmg.whatsapp.net')) return true
  if (mediaUrl.includes('whatsapp.net')) return true
  return true
}

export function useMediaUrl(
  instanceId: string | undefined,
  waMessageId: string | undefined,
  messageType: string,
  originalMediaUrl: string | undefined | null,
  /** Optional bump key to force a fresh resolution (used on <img> onError). */
  retryKey: number = 0
): { mediaUrl: string | null; loading: boolean } {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isMediaType = MEDIA_TYPES.has(messageType)
  const shouldResolve = isMediaType && needsResolution(originalMediaUrl)

  useEffect(() => {
    if (!shouldResolve || !instanceId || !waMessageId) {
      setResolvedUrl(null)
      setLoading(false)
      return
    }

    const cacheKey = `${instanceId}:${waMessageId}`

    // Verificar cache (positive + negative)
    const cached = mediaCache.get(cacheKey)
    if (cached) {
      const ttl = cached.url ? CACHE_TTL_MS : NEG_CACHE_TTL_MS
      if (Date.now() - cached.resolvedAt < ttl) {
        setResolvedUrl(cached.url)
        setLoading(false)
        return
      }
    }

    // Verificar se já tem request pendente
    const pending = pendingRequests.get(cacheKey)
    if (pending) {
      setLoading(true)
      pending.then((url) => {
        setResolvedUrl(url)
        setLoading(false)
      })
      return
    }

    setLoading(true)

    const request = resolveMediaUrl(instanceId, waMessageId, messageType)
    pendingRequests.set(cacheKey, request)

    request.then((url) => {
      pendingRequests.delete(cacheKey)
      // Cache the result either way — null entries are treated as
      // negative cache via NEG_CACHE_TTL_MS in the read path above.
      mediaCache.set(cacheKey, { url, resolvedAt: Date.now() })
      setResolvedUrl(url)
      setLoading(false)
    })
  }, [instanceId, waMessageId, messageType, shouldResolve, retryKey])

  // Se não precisa resolver, retorna a URL original
  if (!isMediaType) return { mediaUrl: originalMediaUrl || null, loading: false }
  if (!shouldResolve) return { mediaUrl: originalMediaUrl || null, loading: false }

  return { mediaUrl: resolvedUrl, loading }
}
