'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldAlert, Search, Pencil, ArrowLeft } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { useUser } from '@/hooks/use-user'
import { UserEditSheet } from '@/components/admin/user-edit-sheet'
import { cn } from '@/lib/utils'

type UserRow = {
  id: string
  commercial_name: string
  professional_email: string | null
  is_active: boolean
  created_at: string
  roles: Array<{ id: string; name: string }>
  override_count: number
}

const ALLOWED_ROLE_NAMES = new Set(['admin', 'Broker/CEO', 'Office Manager'])

export default function UtilizadoresPage() {
  const { user, loading: userLoading } = useUser()
  const { isBroker } = usePermissions()
  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserRow | null>(null)

  const allowed = useMemo(() => {
    if (!user) return false
    if (isBroker()) return true
    return (user.role_names ?? []).some((r) => ALLOWED_ROLE_NAMES.has(r))
  }, [user, isBroker])

  const canManageOverrides = useMemo(() => {
    if (!user) return false
    if (isBroker()) return true
    return (user.role_names ?? []).some((r) => r === 'admin')
  }, [user, isBroker])

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/users', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar utilizadores')
      const json = await res.json()
      setUsers(json.data ?? [])
    } catch {
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) fetchUsers()
  }, [allowed, fetchUsers])

  if (userLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border py-16 px-8 text-center flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-amber-500/15 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold">Sem permissão</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            A gestão de utilizadores é exclusiva para Broker/CEO, admin e Office Manager.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/definicoes">Voltar a Definições</Link>
        </Button>
      </div>
    )
  }

  const term = search.trim().toLowerCase()
  const filtered = term
    ? users.filter((u) =>
        u.commercial_name.toLowerCase().includes(term) ||
        (u.professional_email ?? '').toLowerCase().includes(term) ||
        u.roles.some((r) => r.name.toLowerCase().includes(term))
      )
    : users

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild className="rounded-full">
          <Link href="/dashboard/definicoes">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilizadores</h1>
          <p className="text-sm text-muted-foreground">
            Gere roles {canManageOverrides ? 'e overrides ' : ''}por utilizador.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, email ou role..."
          className="pl-9 rounded-full h-9"
        />
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.5fr_2fr_auto_auto] gap-3 px-4 py-2.5 border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          <div>Utilizador</div>
          <div className="hidden sm:block">Roles</div>
          <div className="hidden sm:block text-right">Overrides</div>
          <div className="text-right">Acções</div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {term ? 'Sem resultados.' : 'Sem utilizadores.'}
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((u) => (
              <li
                key={u.id}
                className={cn(
                  'grid grid-cols-[1fr_auto] sm:grid-cols-[1.5fr_2fr_auto_auto] items-center gap-3 px-4 py-3',
                  !u.is_active && 'opacity-60'
                )}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{u.commercial_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.professional_email || '—'}
                  </div>
                </div>
                <div className="hidden sm:flex flex-wrap gap-1">
                  {u.roles.length === 0 ? (
                    <Badge variant="outline" className="text-[10px]">Sem role</Badge>
                  ) : (
                    u.roles.map((r) => (
                      <Badge
                        key={r.id}
                        variant="secondary"
                        className="text-[10px] font-normal"
                      >
                        {r.name}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="hidden sm:block text-right text-xs text-muted-foreground tabular-nums">
                  {u.override_count > 0 ? (
                    <span className="text-amber-600 font-semibold">{u.override_count}</span>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    onClick={() => setEditing(u)}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <UserEditSheet
        user={editing}
        open={!!editing}
        canManageOverrides={canManageOverrides}
        currentUserId={user?.id ?? null}
        onOpenChange={(open) => { if (!open) setEditing(null) }}
        onSaved={fetchUsers}
      />
    </div>
  )
}
