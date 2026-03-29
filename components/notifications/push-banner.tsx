'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushSubscription } from '@/hooks/use-push-subscription'

/**
 * Subtle banner shown once to prompt users to enable push notifications.
 * Dismissible — remembers dismissal in localStorage.
 */
export function PushBanner() {
  const { permission, isSubscribed, isLoading, subscribe } = usePushSubscription()
  const [dismissed, setDismissed] = useState(true) // default hidden

  useEffect(() => {
    // Show only if: not subscribed, not denied, not dismissed before
    if (permission === 'unsupported' || permission === 'denied' || isSubscribed) return
    const wasDismissed = localStorage.getItem('push_banner_dismissed')
    if (!wasDismissed) setDismissed(false)
  }, [permission, isSubscribed])

  const handleEnable = async () => {
    const ok = await subscribe()
    if (ok) {
      setDismissed(true)
      localStorage.setItem('push_banner_dismissed', '1')
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('push_banner_dismissed', '1')
  }

  if (dismissed) return null

  return (
    <div className="rounded-xl border bg-primary/5 border-primary/20 p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
      <div className="p-2 rounded-lg bg-primary/10">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <p className="text-xs flex-1">
        Active as notificações para receber alertas de novas leads e SLAs no seu dispositivo.
      </p>
      <Button
        size="sm"
        className="rounded-full text-xs h-7"
        onClick={handleEnable}
        disabled={isLoading}
      >
        Activar
      </Button>
      <button onClick={handleDismiss} className="p-1 rounded-full hover:bg-muted transition-colors">
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}
