'use client'

import { useState, useEffect, useCallback } from 'react'

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

// Fire-and-forget remote log so we can debug iOS PWA flow via SQL.
// Never throws; never blocks.
function logRemote(stage: string, payload?: unknown) {
  try {
    void fetch('/api/debug/push-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ stage, payload: payload ?? null }),
    }).catch(() => {})
  } catch {
    // never throw
  }
}

// Resolve the VAPID public key at runtime via API.
// Avoids the build-time inlining pitfall of NEXT_PUBLIC_* vars: if the build
// environment didn't have the env, the bundle ships with `undefined` forever.
// Falls back to the bundle-inlined env for local dev.
// To revert: replace caller with `const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
async function resolveVapidKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/public-key', { cache: 'force-cache' })
    if (res.ok) {
      const body = (await res.json()) as { key?: string | null }
      if (body.key) return body.key
    }
  } catch {
    // swallow — try bundle fallback
  }
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<PushPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PushPermission)

    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setIsSubscribed(!!sub)
      })
    })
  }, [])

  const subscribe = useCallback(async () => {
    logRemote('subscribe.start', {
      permission,
      hasSW: 'serviceWorker' in navigator,
      hasPM: 'PushManager' in window,
      hasNotif: typeof Notification !== 'undefined',
      standalone:
        (typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches
          || (window.navigator as any)?.standalone === true)) || false,
    })

    if (permission === 'unsupported' || permission === 'denied') {
      logRemote('subscribe.early-exit', { permission })
      return false
    }

    // iOS PWA requires Notification.requestPermission() to be invoked while
    // the user-gesture is still hot — i.e. before any long-running awaits.
    // Calling it first (and synchronously kicking off the promise) keeps the
    // prompt visible on iPhone Add-to-Home-Screen PWAs.
    const permPromise = Notification.requestPermission()

    setIsLoading(true)

    try {
      const perm = await permPromise
      setPermission(perm as PushPermission)
      logRemote('permission.resolved', { perm })
      if (perm !== 'granted') {
        console.warn('[Push] Permission not granted:', perm)
        return false
      }

      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      console.log('[Push] SW ready')
      logRemote('sw.ready', {
        scope: reg.scope,
        hasActive: !!reg.active,
        activeState: reg.active?.state ?? null,
      })

      // iOS PWA: PushManager keeps stale subscriptions in local cache even
      // after the row is removed server-side. Calling subscribe() while a
      // stale one is alive throws InvalidStateError. Wipe it first.
      try {
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          console.log('[Push] Clearing stale local subscription')
          await existing.unsubscribe()
          logRemote('stale.cleared', { had: true })
        } else {
          logRemote('stale.cleared', { had: false })
        }
      } catch (err) {
        console.warn('[Push] Failed to clear stale subscription:', err)
        logRemote('stale.clear-failed', {
          name: err instanceof Error ? err.name : 'unknown',
          message: err instanceof Error ? err.message : String(err),
        })
      }

      // Subscribe to push — VAPID key fetched at runtime (see resolveVapidKey)
      const vapidKey = await resolveVapidKey()
      if (!vapidKey) {
        console.warn('[Push] VAPID public key not available at runtime')
        logRemote('vapid.missing', null)
        return false
      }
      logRemote('vapid.present', { length: vapidKey.length, first4: vapidKey.slice(0, 4) })

      let subscription: PushSubscription
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
      } catch (err) {
        logRemote('pushManager.subscribe.failed', {
          name: err instanceof Error ? err.name : 'unknown',
          message: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
      console.log('[Push] pushManager.subscribe ok', subscription.endpoint.slice(0, 60))
      logRemote('pushManager.subscribe.ok', { endpointPrefix: subscription.endpoint.slice(0, 80) })

      // Send to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (res.ok) {
        console.log('[Push] Server stored subscription')
        logRemote('server.ok', null)
        setIsSubscribed(true)
        return true
      }
      const body = await res.text().catch(() => '')
      console.error('[Push] Server rejected subscription:', res.status, body)
      logRemote('server.rejected', { status: res.status, body: body.slice(0, 200) })
      return false
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      console.error('[Push] Subscribe error:', detail)
      logRemote('subscribe.exception', { detail })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [permission])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
      setIsSubscribed(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
