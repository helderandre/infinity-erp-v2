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

// Idempotently (re-)persist a live browser subscription to the server. The DB
// upsert is keyed on (user_id, endpoint), so re-sending an existing subscription
// is a no-op — but it HEALS the common failure where the browser still holds a
// local PushSubscription while the `push_subscriptions` row is missing (the
// initial POST failed silently, the row was pruned server-side after an expired
// endpoint, or it was lost on a previous error). Without this self-heal the UI
// shows "activas neste dispositivo" while sendPushToUser finds no row and
// silently delivers nothing.
async function syncSubscriptionToServer(sub: PushSubscription): Promise<void> {
  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })
    logRemote('reconcile.synced', { endpointPrefix: sub.endpoint.slice(0, 80) })
  } catch {
    // best-effort; the explicit subscribe() flow remains the primary path
  }
}

// Silently (re)create a push subscription and persist it — WITHOUT any prompt.
// Safe to call only when Notification.permission is already 'granted': in that
// state pushManager.subscribe() never shows UI. This is what lets a consultant
// keep receiving pushes after the local subscription is lost or invalidated
// (browser eviction, stale VAPID key) WITHOUT having to press "Ativar" again —
// the app re-subscribes itself on the next load. Returns true on success.
async function ensureFreshSubscription(reg: ServiceWorkerRegistration): Promise<boolean> {
  const vapidKey = await resolveVapidKey()
  if (!vapidKey) return false
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    })
    await syncSubscriptionToServer(sub)
    logRemote('autoresubscribe.ok', { endpointPrefix: sub.endpoint.slice(0, 80) })
    return true
  } catch (err) {
    logRemote('autoresubscribe.failed', {
      name: err instanceof Error ? err.name : 'unknown',
      message: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

// True on iPhone/iPad. iPadOS 13+ reports as "MacIntel" with a touch screen,
// so the platform+maxTouchPoints check is needed alongside the UA test.
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<PushPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // iOS Safari only exposes Web Push to apps installed to the Home Screen
  // (standalone PWA). In a regular tab, PushManager is absent and the device
  // reports as "unsupported" — but the real fix is to install the PWA, so we
  // flag that distinct case to drive guidance copy instead of a dead end.
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported')
      if (isIOSDevice() && !isStandalonePWA()) setIosNeedsInstall(true)
      return
    }
    setPermission(Notification.permission as PushPermission)

    // Check if already subscribed AND key matches. After a VAPID key rotation
    // the cached PushSubscription remains in the browser, but pushes signed
    // with the new key would be rejected by the provider. Detect the mismatch
    // and treat as not-subscribed so the user can re-activate.
    navigator.serviceWorker.ready.then(async (reg) => {
      // Whether the user ever granted permission. If granted, we can keep the
      // subscription alive silently (no prompt) so they never have to re-enable.
      const granted = Notification.permission === 'granted'
      const sub = await reg.pushManager.getSubscription()
      if (!sub) {
        // No local subscription. If permission is already granted, recreate it
        // transparently — the consultant stays subscribed without any action.
        if (granted) {
          const ok = await ensureFreshSubscription(reg)
          setIsSubscribed(ok)
        } else {
          setIsSubscribed(false)
        }
        return
      }
      try {
        const currentKey = await resolveVapidKey()
        if (!currentKey) {
          setIsSubscribed(true) // can't verify; trust local
          void syncSubscriptionToServer(sub) // heal a possibly-missing DB row
          return
        }
        const expected = urlBase64ToUint8Array(currentKey)
        const raw = sub.options.applicationServerKey
        const actual = raw ? new Uint8Array(raw as ArrayBuffer) : new Uint8Array(0)
        const matches = expected.length === actual.length &&
          expected.every((b, i) => b === actual[i])
        if (matches) {
          setIsSubscribed(true)
          // Self-heal: the local subscription is valid, but the server row may
          // be missing (silent POST failure, server-side prune). Re-upsert so
          // "activas neste dispositivo" always reflects a real push target.
          void syncSubscriptionToServer(sub)
        } else {
          // Stale VAPID key: the cached subscription can never receive pushes
          // signed with the current key. Replace it silently when permission is
          // still granted (no prompt) so delivery resumes without re-activation.
          console.warn('[Push] Local subscription uses stale VAPID key; replacing')
          try { await sub.unsubscribe() } catch {}
          if (granted) {
            const ok = await ensureFreshSubscription(reg)
            setIsSubscribed(ok)
            return
          }
          setIsSubscribed(false)
        }
      } catch (err) {
        console.warn('[Push] Key compare failed, trusting local subscription:', err)
        setIsSubscribed(true)
      }
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

  return { permission, isSubscribed, isLoading, iosNeedsInstall, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
