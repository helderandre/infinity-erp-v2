'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'

export function NotificationsButton() {
  const [open, setOpen] = useState(false)
  // TODO: wire to `notifications` table scoped to this partner.
  const items: { id: string; title: string; when: string }[] = []

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificações"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
      >
        <Bell className="h-4.5 w-4.5" />
        {items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl">
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
                  <li key={n.id} className="px-4 py-3 hover:bg-neutral-50">
                    <p className="text-sm text-neutral-800">{n.title}</p>
                    <p className="text-xs text-neutral-400">{n.when}</p>
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
