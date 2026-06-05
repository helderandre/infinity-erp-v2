'use client'

import { useState, useEffect, useMemo } from 'react'
import { MessageSquare, ArrowLeft, Search } from 'lucide-react'
// Reuse the main app's real DM engine (@/ -> apps/app).
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { InternalChatPanel } from '@/components/comunicacao/internal-chat-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getDmChannelId } from '@/lib/constants'

type CompanyUser = { id: string; commercial_name: string; avatarUrl?: string; roles: string[] }

export const dynamic = 'force-dynamic'

export default function ChatPage() {
  const { user } = useUser()
  const [people, setPeople] = useState<CompanyUser[]>([])
  const [active, setActive] = useState<CompanyUser | null>(null)
  const [search, setSearch] = useState('')

  // Company people the partner can message 1:1 (no "Geral" group, no processes).
  useEffect(() => {
    let cancelled = false
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : []))
      .then((users: Array<{ id: string; commercial_name: string; dev_consultant_profiles: { profile_photo_url: string | null } | null; user_roles?: Array<{ role: { name: string } | null }> | null }>) => {
        if (cancelled) return
        setPeople(
          (users || []).map((u) => ({
            id: u.id,
            commercial_name: u.commercial_name,
            avatarUrl: u.dev_consultant_profiles?.profile_photo_url || undefined,
            roles: (u.user_roles || []).map((ur) => ur.role?.name).filter((n): n is string => Boolean(n)),
          })),
        )
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const currentUser = useMemo(
    () => ({ id: user?.id || '', name: user?.commercial_name || '', avatarUrl: user?.profile_photo_url || undefined }),
    [user],
  )

  const filtered = people.filter(
    (p) => p.id !== currentUser.id && (p.commercial_name || '').toLowerCase().includes(search.toLowerCase()),
  )

  const dmChannelId = active ? getDmChannelId(currentUser.id, active.id) : undefined

  return (
    <div
      className="flex overflow-hidden rounded-3xl border border-black/5 bg-background shadow-sm"
      style={{ height: 'calc(100vh - 9rem)' }}
    >
      {/* List of people */}
      <div className={cn('flex min-w-0 shrink-0 flex-col md:flex md:w-80 md:border-r', active ? 'hidden' : 'flex w-full')}>
        <div className="border-b p-4">
          <h2 className="mb-3 text-base font-semibold">Mensagens</h2>
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar pessoa…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Sem pessoas</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                  active?.id === p.id && 'bg-muted',
                )}
              >
                <Avatar className="h-10 w-10">
                  {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={p.commercial_name} />}
                  <AvatarFallback className="bg-primary/10 text-xs">
                    {p.commercial_name?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.commercial_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.roles.join(', ') || 'Equipa Infinity'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation panel — reuses the main DM engine */}
      <div className={cn('min-w-0 flex-1 flex-col md:flex', active ? 'flex' : 'hidden')}>
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">Seleccione uma conversa</p>
          </div>
        ) : (
          <InternalChatPanel
            key={dmChannelId}
            currentUser={currentUser}
            channelId={dmChannelId}
            dmRecipientId={active.id}
            header={
              <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden" onClick={() => setActive(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9">
                  {active.avatarUrl && <AvatarImage src={active.avatarUrl} alt={active.commercial_name} />}
                  <AvatarFallback className="bg-primary/10 text-xs">{active.commercial_name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{active.commercial_name}</h3>
                  <p className="truncate text-[11px] text-muted-foreground">{active.roles.join(', ') || 'Mensagem direta'}</p>
                </div>
              </div>
            }
          />
        )}
      </div>
    </div>
  )
}
