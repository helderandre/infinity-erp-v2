'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Bell, Plus, Pencil, Trash2, Search,
  Users, User, UserCheck, Crown,
  Mail, MessageCircle, Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { NOTIFICATION_MODULES } from '@/lib/notifications/events'
import { NotificationRuleDialog, type NotificationRule } from './notification-rule-dialog'

const RECIPIENT_TYPE_LABELS: Record<string, { label: string; icon: typeof Users }> = {
  role: { label: 'Role', icon: Users },
  user: { label: 'Pessoa', icon: User },
  assigned_agent: { label: 'Agente atribuído', icon: UserCheck },
  entity_owner: { label: 'Dono da entidade', icon: Crown },
}

export function NotificationRoutingTab() {
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NotificationRule | null>(null)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/notification-rules')
      if (res.ok) {
        const data = await res.json()
        setRules(data)
      } else {
        toast.error('Erro ao carregar regras de notificação.')
      }
    } catch {
      toast.error('Erro ao carregar regras de notificação.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  // Group rules by module, then by event_key
  const grouped = rules.reduce((acc, rule) => {
    if (!acc[rule.module]) acc[rule.module] = {}
    if (!acc[rule.module][rule.event_key]) {
      acc[rule.module][rule.event_key] = {
        event_key: rule.event_key,
        label: rule.label,
        description: rule.description,
        rules: [],
      }
    }
    acc[rule.module][rule.event_key].rules.push(rule)
    return acc
  }, {} as Record<string, Record<string, { event_key: string; label: string; description: string | null; rules: NotificationRule[] }>>)

  // Get unique events for dialog dropdown
  const uniqueEvents = Object.values(grouped).flatMap(
    moduleEvents => Object.values(moduleEvents).map(ev => ({
      event_key: ev.event_key,
      module: ev.rules[0].module,
      label: ev.label,
    }))
  )
  // Dedupe
  const uniqueEventsMap = new Map(uniqueEvents.map(e => [e.event_key, e]))
  const existingEvents = [...uniqueEventsMap.values()]

  // Filter
  const filteredModules = Object.entries(grouped).filter(([mod]) => {
    if (moduleFilter !== 'all' && mod !== moduleFilter) return false
    return true
  })

  const searchLower = search.toLowerCase()

  const handleToggleActive = async (rule: NotificationRule) => {
    try {
      const res = await fetch(`/api/notification-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      })
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
      } else {
        toast.error('Erro ao alterar estado.')
      }
    } catch {
      toast.error('Erro ao alterar estado.')
    }
  }

  const handleToggleChannel = async (rule: NotificationRule, channel: 'channel_in_app' | 'channel_email' | 'channel_whatsapp') => {
    try {
      const res = await fetch(`/api/notification-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [channel]: !rule[channel] }),
      })
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, [channel]: !r[channel] } : r))
      }
    } catch {
      toast.error('Erro ao alterar canal.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/notification-rules/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Regra eliminada.')
        setRules(prev => prev.filter(r => r.id !== deleteTarget.id))
      } else {
        toast.error('Erro ao eliminar regra.')
      }
    } catch {
      toast.error('Erro ao eliminar regra.')
    } finally {
      setDeleteTarget(null)
    }
  }

  const getRecipientLabel = (rule: NotificationRule) => {
    if (rule.recipient_type === 'role' && rule.recipient_role) {
      return rule.recipient_role.name
    }
    if (rule.recipient_type === 'user' && rule.recipient_user) {
      return rule.recipient_user.commercial_name
    }
    return RECIPIENT_TYPE_LABELS[rule.recipient_type]?.label || rule.recipient_type
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-48 rounded-full" />
          <Skeleton className="h-9 w-64 rounded-full" />
        </div>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[200px] rounded-full h-9 text-xs">
            <SelectValue placeholder="Todos os módulos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os módulos</SelectItem>
            {Object.entries(NOTIFICATION_MODULES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar evento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-full h-9 text-xs"
          />
        </div>

        <Button
          className="rounded-full ml-auto"
          onClick={() => { setEditingRule(null); setDialogOpen(true) }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {/* Rules grouped by module → event */}
      {filteredModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma regra de notificação encontrada.</p>
        </div>
      ) : (
        filteredModules.map(([mod, events]) => {
          const moduleLabel = NOTIFICATION_MODULES[mod as keyof typeof NOTIFICATION_MODULES] || mod
          const eventEntries = Object.values(events).filter(ev =>
            !search || ev.label.toLowerCase().includes(searchLower) || ev.event_key.toLowerCase().includes(searchLower)
          )

          if (eventEntries.length === 0) return null

          return (
            <div key={mod} className="space-y-3">
              {/* Module header */}
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{moduleLabel}</h3>
                <Badge variant="secondary" className="text-[10px] rounded-full">
                  {eventEntries.reduce((sum, ev) => sum + ev.rules.length, 0)} regras
                </Badge>
              </div>

              {/* Events */}
              {eventEntries.map(ev => (
                <div
                  key={ev.event_key}
                  className="rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden"
                >
                  {/* Event header */}
                  <div className="px-4 py-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{ev.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ev.event_key}
                          {ev.description && <span className="ml-2">— {ev.description}</span>}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full h-7 text-xs gap-1"
                        onClick={() => {
                          setEditingRule(null)
                          setDialogOpen(true)
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  {/* Rules for this event */}
                  <div className="divide-y">
                    {ev.rules.map(rule => {
                      const recipientConfig = RECIPIENT_TYPE_LABELS[rule.recipient_type]
                      const RecipientIcon = recipientConfig?.icon || Users

                      return (
                        <div
                          key={rule.id}
                          className={cn(
                            'px-4 py-3 flex items-center gap-4 transition-colors hover:bg-muted/10',
                            !rule.is_active && 'opacity-50'
                          )}
                        >
                          {/* Recipient */}
                          <div className="flex items-center gap-2 min-w-[200px]">
                            <div className="h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                              <RecipientIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-medium">{getRecipientLabel(rule)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {recipientConfig?.label}
                              </p>
                            </div>
                          </div>

                          {/* Channels */}
                          <div className="flex items-center gap-3 ml-auto">
                            <button
                              onClick={() => handleToggleChannel(rule, 'channel_in_app')}
                              className={cn(
                                'flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-colors',
                                rule.channel_in_app
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-muted/30 text-muted-foreground'
                              )}
                            >
                              <Smartphone className="h-3 w-3" />
                              App
                            </button>
                            <button
                              onClick={() => handleToggleChannel(rule, 'channel_email')}
                              className={cn(
                                'flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-colors',
                                rule.channel_email
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-muted/30 text-muted-foreground'
                              )}
                            >
                              <Mail className="h-3 w-3" />
                              Email
                            </button>
                            <button
                              onClick={() => handleToggleChannel(rule, 'channel_whatsapp')}
                              className={cn(
                                'flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-colors',
                                rule.channel_whatsapp
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-muted/30 text-muted-foreground'
                              )}
                            >
                              <MessageCircle className="h-3 w-3" />
                              WhatsApp
                            </button>
                          </div>

                          {/* Active toggle */}
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => handleToggleActive(rule)}
                          />

                          {/* Actions */}
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => { setEditingRule(rule); setDialogOpen(true) }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(rule)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })
      )}

      {/* Dialog */}
      <NotificationRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        existingEvents={existingEvents}
        onSaved={fetchRules}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar regra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar esta regra de notificação? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
