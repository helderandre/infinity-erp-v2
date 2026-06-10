'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { usePushSubscription } from '@/hooks/use-push-subscription'

/**
 * Subtle one-time banner prompting the parceiro to enable device push
 * notifications (e.g. for deletion-request approvals). Dismissal is remembered
 * in localStorage. Hidden when push is already active, denied, or unsupported.
 */
export function PushBanner() {
  const { permission, isSubscribed, isLoading, subscribe } = usePushSubscription()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (permission === 'unsupported' || permission === 'denied' || isSubscribed) {
      setDismissed(true)
      return
    }
    const wasDismissed = localStorage.getItem('partner_push_banner_dismissed')
    if (!wasDismissed) setDismissed(false)
  }, [permission, isSubscribed])

  const handleEnable = async () => {
    const ok = await subscribe()
    if (ok) {
      setDismissed(true)
      localStorage.setItem('partner_push_banner_dismissed', '1')
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('partner_push_banner_dismissed', '1')
  }

  if (dismissed) return null

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-neutral-900/10 bg-neutral-900/[0.03] p-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900/10">
        <Bell className="h-4 w-4 text-neutral-700" />
      </div>
      <p className="flex-1 text-xs text-neutral-700">
        Ative as notificações para ser avisado de pedidos de eliminação e novidades no seu dispositivo.
      </p>
      <button
        type="button"
        onClick={handleEnable}
        disabled={isLoading}
        className="rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
      >
        {isLoading ? 'A ativar…' : 'Ativar'}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dispensar"
        title="Dispensar"
        className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
