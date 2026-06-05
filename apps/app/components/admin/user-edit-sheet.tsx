'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, X, Loader2, AlertTriangle } from 'lucide-react'
import { PERMISSION_MODULES } from '@/lib/constants'
import { cn } from '@/lib/utils'

type UserRow = {
  id: string
  commercial_name: string
  professional_email: string | null
  is_active: boolean
  roles: Array<{ id: string; name: string }>
  override_count: number
}

type Override = {
  id: string
  module: string
  mode: 'grant' | 'deny'
  expires_at: string | null
  reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface Props {
  user: UserRow | null
  open: boolean
  canManageOverrides: boolean
  currentUserId: string | null
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

const MODULE_GROUPS = Array.from(
  new Map(PERMISSION_MODULES.map((m) => [m.group, true])).keys()
)

export function UserEditSheet({
  user,
  open,
  canManageOverrides,
  currentUserId,
  onOpenChange,
  onSaved,
}: Props) {
  const [allRoles, setAllRoles] = useState<Array<{ id: string; name: string; description: string | null }>>([])
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(false)
  const [submittingRoleId, setSubmittingRoleId] = useState<string | null>(null)
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null)
  const [pendingRoleAdd, setPendingRoleAdd] = useState('')

  const isSelf = user?.id === currentUserId

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [rolesRes, overridesRes] = await Promise.all([
        fetch('/api/libraries/roles'),
        canManageOverrides ? fetch(`/api/users/${user.id}/overrides`) : Promise.resolve(null),
      ])
      const rolesJson = rolesRes.ok ? await rolesRes.json() : { data: [] }
      setAllRoles(rolesJson.data ?? rolesJson ?? [])
      if (overridesRes && overridesRes.ok) {
        const ovJson = await overridesRes.json()
        setOverrides(ovJson.data ?? [])
      } else {
        setOverrides([])
      }
    } finally {
      setLoading(false)
    }
  }, [user, canManageOverrides])

  useEffect(() => {
    if (open && user) refresh()
  }, [open, user, refresh])

  const availableRolesToAdd = useMemo(() => {
    if (!user) return []
    const current = new Set(user.roles.map((r) => r.id))
    return allRoles.filter((r) => !current.has(r.id))
  }, [user, allRoles])

  const overrideByModule = useMemo(() => {
    const map = new Map<string, Override>()
    for (const o of overrides) map.set(o.module, o)
    return map
  }, [overrides])

  const handleAddRole = async () => {
    if (!user || !pendingRoleAdd) return
    setSubmittingRoleId(pendingRoleAdd)
    try {
      const res = await fetch(`/api/users/${user.id}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: pendingRoleAdd }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Falha ao atribuir role')
      toast.success('Role atribuído')
      setPendingRoleAdd('')
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSubmittingRoleId(null)
    }
  }

  const handleRemoveRole = async (roleId: string) => {
    if (!user) return
    setRemovingRoleId(roleId)
    try {
      const res = await fetch(`/api/users/${user.id}/roles?role_id=${roleId}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Falha ao remover role')
      toast.success('Role removido')
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setRemovingRoleId(null)
    }
  }

  const handleSetOverride = async (module: string, mode: 'grant' | 'deny' | null) => {
    if (!user) return
    try {
      if (mode === null) {
        const res = await fetch(`/api/users/${user.id}/overrides?module=${encodeURIComponent(module)}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error || 'Falha ao remover override')
        }
        toast.success('Override removido')
      } else {
        const res = await fetch(`/api/users/${user.id}/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module, mode }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error || 'Falha ao guardar override')
        }
        toast.success(mode === 'grant' ? 'Override "permitir" guardado' : 'Override "negar" guardado')
      }
      await refresh()
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  if (!user) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto bg-background/95 backdrop-blur-2xl rounded-l-3xl"
      >
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-xl">{user.commercial_name}</SheetTitle>
          <SheetDescription className="text-xs">
            {user.professional_email || 'Sem email registado'}
            {isSelf && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Está a editar a sua própria conta
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {/* Roles */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Roles</h3>
                <p className="text-xs text-muted-foreground">
                  Pode acumular vários — as permissões juntam-se (OR lógico).
                </p>
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-12 rounded-lg" />
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.length === 0 ? (
                    <Badge variant="outline" className="text-[11px]">Sem roles</Badge>
                  ) : (
                    user.roles.map((r) => (
                      <Badge
                        key={r.id}
                        variant="secondary"
                        className="gap-1 pr-1 text-[11px]"
                      >
                        {r.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveRole(r.id)}
                          disabled={removingRoleId === r.id || user.roles.length <= 1}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          title={user.roles.length <= 1 ? 'Não é possível remover o último role' : 'Remover'}
                        >
                          {removingRoleId === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Select value={pendingRoleAdd} onValueChange={setPendingRoleAdd}>
                    <SelectTrigger className="h-9 text-xs rounded-full flex-1">
                      <SelectValue placeholder="Adicionar role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRolesToAdd.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2">Sem roles disponíveis</div>
                      ) : (
                        availableRolesToAdd.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            <span className="font-medium">{r.name}</span>
                            {r.description && (
                              <span className="text-muted-foreground ml-2">{r.description}</span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleAddRole}
                    disabled={!pendingRoleAdd || !!submittingRoleId}
                    className="h-9 rounded-full"
                  >
                    {submittingRoleId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Atribuir
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Overrides — only for admin/Broker/CEO */}
          {canManageOverrides && (
            <section className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm">Overrides de permissões</h3>
                <p className="text-xs text-muted-foreground">
                  Permitir/negar módulos individuais por cima dos roles. Use com moderação — overrides
                  ocultam-se das auditorias normais e drift acumula com o tempo.
                </p>
              </div>

              {loading ? (
                <Skeleton className="h-32 rounded-lg" />
              ) : (
                <div className="space-y-3">
                  {MODULE_GROUPS.map((group) => (
                    <div key={group} className="space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group}
                      </div>
                      <div className="rounded-xl border divide-y">
                        {PERMISSION_MODULES.filter((m) => m.group === group).map((m) => {
                          const ov = overrideByModule.get(m.key)
                          return (
                            <div
                              key={m.key}
                              className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-medium">{m.label}</div>
                                <div className="text-[10px] text-muted-foreground font-mono truncate">
                                  {m.key}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <ToggleBtn
                                  active={ov?.mode === 'grant'}
                                  variant="grant"
                                  onClick={() => handleSetOverride(m.key, ov?.mode === 'grant' ? null : 'grant')}
                                />
                                <ToggleBtn
                                  active={ov?.mode === 'deny'}
                                  variant="deny"
                                  onClick={() => handleSetOverride(m.key, ov?.mode === 'deny' ? null : 'deny')}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ToggleBtn({
  active,
  variant,
  onClick,
}: {
  active: boolean
  variant: 'grant' | 'deny'
  onClick: () => void
}) {
  const label = variant === 'grant' ? 'Permitir' : 'Negar'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 rounded-full text-[10px] font-semibold transition-all border',
        active
          ? variant === 'grant'
            ? 'bg-emerald-500 text-white border-emerald-500'
            : 'bg-red-500 text-white border-red-500'
          : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted'
      )}
      title={active ? `Clique para limpar (${label})` : label}
    >
      {label}
    </button>
  )
}
