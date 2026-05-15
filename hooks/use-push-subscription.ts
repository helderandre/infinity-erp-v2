'use client'

import { useState, useEffect, useCallback } from 'react'

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

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
    if (permission === 'unsupported' || permission === 'denied') return false

    // iOS PWA requires Notification.requestPermission() to be invoked while
    // the user-gesture is still hot — i.e. before any long-running awaits.
    // Calling it first (and synchronously kicking off the promise) keeps the
    // prompt visible on iPhone Add-to-Home-Screen PWAs.
    const permPromise = Notification.requestPermission()

    setIsLoading(true)

    try {
      const perm = await permPromise
      setPermission(perm as PushPermission)
      if (perm !== 'granted') {
        console.warn('[Push] Permission not granted:', perm)
        return false
      }

      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      console.log('[Push] SW ready')

      // iOS PWA: PushManager keeps stale subscriptions in local cache even
      // after the row is removed server-side. Calling subscribe() while a
      // stale one is alive throws InvalidStateError. Wipe it first.
      try {
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          console.log('[Push] Clearing stale local subscription')
          await existing.unsubscribe()
        }
      } catch (err) {
        console.warn('[Push] Failed to clear stale subscription:', err)
      }

      // Subscribe to push
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
        return false
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })
      console.log('[Push] pushManager.subscribe ok', subscription.endpoint.slice(0, 60))

      // Send to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (res.ok) {
        console.log('[Push] Server stored subscription')
        setIsSubscribed(true)
        return true
      }
      const body = await res.text().catch(() => '')
      console.error('[Push] Server rejected subscription:', res.status, body)
      return false
    } catch (err) {
      console.error('[Push] Subscribe error:', err instanceof Error ? `${err.name}: ${err.message}` : err)
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
