'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserCog, LogOut } from 'lucide-react'
import { createClient } from '@infinity/lib/supabase/client'

export function ProfileMenu({
  user,
  onSignedOut,
}: {
  user: { email: string | null; name: string | null; avatarUrl: string | null }
  onSignedOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const initials = (user.name || user.email || '?').trim().charAt(0).toUpperCase()

  async function signOut() {
    await createClient().auth.signOut()
    onSignedOut()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Perfil"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-sm font-semibold text-white"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl">
            <div className="border-b border-black/5 px-4 py-3">
              <p className="truncate text-sm font-medium text-neutral-900">{user.name || 'Parceiro'}</p>
              <p className="truncate text-xs text-neutral-500">{user.email}</p>
            </div>
            <div className="p-1.5">
              <Link
                href="/perfil"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                <UserCog className="h-4 w-4" />
                Editar perfil
              </Link>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Terminar sessão
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
