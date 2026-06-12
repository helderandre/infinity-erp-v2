'use client'

import { useState, useEffect } from 'react'
import { Bell, X, Share, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushSubscription } from '@/hooks/use-push-subscription'

/**
 * Subtle banner shown once to prompt users to enable push notifications.
 * Dismissible — remembers dismissal in localStorage.
 */
export function PushBanner() {
  const { permission, isSubscribed, isLoading, iosNeedsInstall, subscribe } = usePushSubscription()
  const [dismissed, setDismissed] = useState(true) // default hidden

  useEffect(() => {
    // Hide once we know push is already active OR denied. iOS-not-installed
    // surfaces "unsupported", but for that case we DO want the banner (with
    // install guidance), so it's excluded from the hide condition below.
    if (isSubscribed || permission === 'denied' || (permission === 'unsupported' && !iosNeedsInstall)) {
      setDismissed(true)
      return
    }
    const wasDismissed = localStorage.getItem('push_banner_dismissed')
    if (!wasDismissed) setDismissed(false)
  }, [permission, isSubscribed, iosNeedsInstall])

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

  // iPhone/iPad in a normal Safari tab: push is impossible until the app is
  // installed to the Home Screen. Show the install steps instead of an "Ativar"
  // button that can't work here.
  if (iosNeedsInstall) {
    return (
      <div className="rounded-xl border bg-primary/5 border-primary/20 p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <p className="text-xs flex-1 inline-flex flex-wrap items-center gap-1">
          Para receber notificações no iPhone, instala a app: toca em
          <Share className="inline h-3.5 w-3.5" aria-label="Partilhar" />
          <span className="font-medium">Partilhar</span> e depois
          <Plus className="inline h-3.5 w-3.5" aria-label="Adicionar" />
          <span className="font-medium">Adicionar ao ecrã principal</span>.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dispensar"
          title="Dispensar"
          className="p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-primary/5 border-primary/20 p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
      <div className="p-2 rounded-lg bg-primary/10">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <p className="text-xs flex-1">
        Ative as notificações para receber notificações no seu dispositivo.
      </p>
      <Button
        size="sm"
        className="rounded-full text-xs h-7"
        onClick={handleEnable}
        disabled={isLoading}
      >
        Ativar
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dispensar"
        title="Dispensar"
        className="p-1 rounded-full hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}
