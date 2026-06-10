'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} d`
}

export function NotificationsButton({ openUp = false }: { openUp?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/notifications?limit=20', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setItems(json.notifications ?? [])
      setUnread(json.unread_count ?? 0)
    } catch {
      /* silent */
    }
  }, [])

  // Initial load + light polling for the badge (no realtime in the portal yet).
  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const markAllRead = useCallback(async () => {
    if (unread === 0) return
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await fetch('/api/crm/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch {
      /* silent */
    }
  }, [unread])

  const toggle = () => {
    setOpen((o) => {
      const next = !o
      if (next) markAllRead()
      return next
    })
  }

  const onItemClick = (n: NotificationRow) => {
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Notificações"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute z-50 w-80 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl ${openUp ? 'bottom-11 left-0' : 'right-0 top-11'}`}>
            <div className="border-b border-black/5 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">Notificações</p>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-neutral-300" />
                <p className="text-sm text-neutral-500">Sem notificações</p>
              </div>
            ) : (
              <ul className="max-h-80 divide-y divide-black/5 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => onItemClick(n)}
                      className="block w-full px-4 py-3 text-left hover:bg-neutral-50"
                    >
                      <p className="text-sm font-medium text-neutral-800">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-neutral-500">{n.body}</p>}
                      <p className="mt-1 text-xs text-neutral-400">{timeAgo(n.created_at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
