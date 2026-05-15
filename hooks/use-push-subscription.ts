'use client'

import { useState, useEffect, useCallback } from 'react'

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export type SubscribeResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'unsupported'
        | 'denied'
        | 'permission-not-granted'
        | 'missing-vapid'
        | 'sw-failed'
        | 'subscribe-failed'
        | 'server-failed'
      message: string
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

  const subscribe = useCallback(async (): Promise<SubscribeResult> => {
    if (permission === 'unsupported') {
      return { ok: false, reason: 'unsupported', message: 'Este dispositivo não suporta notificações push.' }
    }
    if (permission === 'denied') {
      return { ok: false, reason: 'denied', message: 'As notificações estão bloqueadas nas definições do navegador.' }
    }
    setIsLoading(true)

    try {
      // Register service worker
      let reg: ServiceWorkerRegistration
      try {
        reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready
      } catch (err) {
        console.error('[Push] Service worker registration failed:', err)
        return { ok: false, reason: 'sw-failed', message: 'Não foi possível registar o service worker.' }
      }

      // Request permission
      const perm = await Notification.requestPermission()
      setPermission(perm as PushPermission)
      if (perm !== 'granted') {
        return {
          ok: false,
          reason: 'permission-not-granted',
          message: perm === 'denied'
            ? 'Permissão negada. Desbloqueie nas definições do navegador.'
            : 'Permissão não concedida.',
        }
      }

      // Subscribe to push
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
        return {
          ok: false,
          reason: 'missing-vapid',
          message: 'Configuração de push em falta no servidor (VAPID key).',
        }
      }

      let subscription: PushSubscription
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
      } catch (err) {
        console.error('[Push] pushManager.subscribe failed:', err)
        return {
          ok: false,
          reason: 'subscribe-failed',
          message: err instanceof Error ? err.message : 'Falha ao subscrever push.',
        }
      }

      // Send to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (res.ok) {
        setIsSubscribed(true)
        return { ok: true }
      }

      const body = await res.json().catch(() => ({}))
      return {
        ok: false,
        reason: 'server-failed',
        message: body?.error || 'Falha ao registar subscrição no servidor.',
      }
    } catch (err) {
      console.error('[Push] Subscribe error:', err)
      return {
        ok: false,
        reason: 'subscribe-failed',
        message: err instanceof Error ? err.message : 'Erro inesperado.',
      }
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
