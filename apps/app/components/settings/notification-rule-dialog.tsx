'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Bell, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { NOTIFICATION_MODULES } from '@/lib/notifications/events'

interface Role {
  id: string
  name: string
}

interface User {
  id: string
  commercial_name: string
}

export interface NotificationRule {
  id: string
  event_key: string
  module: string
  label: string
  description: string | null
  recipient_type: 'role' | 'user' | 'assigned_agent' | 'entity_owner'
  recipient_role_id: string | null
  recipient_user_id: string | null
  recipient_role?: { id: string; name: string } | null
  recipient_user?: { id: string; commercial_name: string } | null
  channel_in_app: boolean
  channel_email: boolean
  channel_whatsapp: boolean
  is_active: boolean
  priority: number
}

interface NotificationRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: NotificationRule | null
  /** Existing events for the "add rule to existing event" dropdown */
  existingEvents: { event_key: string; module: string; label: string }[]
  onSaved: () => void
}

export function NotificationRuleDialog({
  open,
  onOpenChange,
  rule,
  existingEvents,
  onSaved,
}: NotificationRuleDialogProps) {
  const isEditing = !!rule

  // Form state
  const [eventKey, setEventKey] = useState('')
  const [module, setModule] = useState('')
  const [label, setLabel] = useState('')
  const [recipientType, setRecipientType] = useState<string>('role')
  const [recipientRoleId, setRecipientRoleId] = useState<string>('')
  const [recipientUserId, setRecipientUserId] = useState<string>('')
  const [channelInApp, setChannelInApp] = useState(true)
  const [channelEmail, setChannelEmail] = useState(false)
  const [channelWhatsapp, setChannelWhatsapp] = useState(false)

  // Data
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  // Load roles & users
  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/libraries/roles').then(r => r.ok ? r.json() : []),
      fetch('/api/users/consultants').then(r => r.ok ? r.json() : []),
    ]).then(([rolesData, usersData]) => {
      setRoles(Array.isArray(rolesData) ? rolesData : [])
      setUsers(Array.isArray(usersData) ? usersData : [])
    })
  }, [open])

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      setEventKey(rule.event_key)
      setModule(rule.module)
      setLabel(rule.label)
      setRecipientType(rule.recipient_type)
      setRecipientRoleId(rule.recipient_role_id || '')
      setRecipientUserId(rule.recipient_user_id || '')
      setChannelInApp(rule.channel_in_app)
      setChannelEmail(rule.channel_email)
      setChannelWhatsapp(rule.channel_whatsapp)
    } else {
      setEventKey('')
      setModule('')
      setLabel('')
      setRecipientType('role')
      setRecipientRoleId('')
      setRecipientUserId('')
      setChannelInApp(true)
      setChannelEmail(false)
      setChannelWhatsapp(false)
    }
  }, [rule, open])

  const handleSelectExistingEvent = (ek: string) => {
    const ev = existingEvents.find(e => e.event_key === ek)
    if (ev) {
      setEventKey(ev.event_key)
      setModule(ev.module)
      setLabel(ev.label)
    }
  }

  const handleSave = async () => {
    if (!eventKey || !module || !label) {
      toast.error('Seleccione um evento.')
      return
    }
    if (recipientType === 'role' && !recipientRoleId) {
      toast.error('Seleccione uma role.')
      return
    }
    if (recipientType === 'user' && !recipientUserId) {
      toast.error('Seleccione um utilizador.')
      return
    }

    setSaving(true)
    try {
      const body = {
        event_key: eventKey,
        module,
        label,
        recipient_type: recipientType,
        recipient_role_id: recipientType === 'role' ? recipientRoleId : null,
        recipient_user_id: recipientType === 'user' ? recipientUserId : null,
        channel_in_app: channelInApp,
        channel_email: channelEmail,
        channel_whatsapp: channelWhatsapp,
      }

      const url = isEditing
        ? `/api/notification-rules/${rule.id}`
        : '/api/notification-rules'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erro ao guardar regra.')
        return
      }

      toast.success(isEditing ? 'Regra actualizada.' : 'Regra criada.')
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('Erro ao guardar regra.')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = userSearch
    ? users.filter(u => u.commercial_name?.toLowerCase().includes(userSearch.toLowerCase()))
    : users

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl">
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-white">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                <Bell className="h-4 w-4" />
              </div>
              {isEditing ? 'Editar Regra' : 'Nova Regra de Notificação'}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="grid gap-5">
          {/* Event selection */}
          <div className="grid gap-2">
            <Label className="text-xs font-medium">Evento *</Label>
            {isEditing ? (
              <div className="text-sm bg-muted/30 rounded-xl px-3 py-2">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground ml-2 text-xs">{eventKey}</span>
              </div>
            ) : (
              <Select value={eventKey} onValueChange={handleSelectExistingEvent}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccione um evento..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(
                    existingEvents.reduce((acc, ev) => {
                      if (!acc[ev.module]) acc[ev.module] = []
                      acc[ev.module].push(ev)
                      return acc
                    }, {} as Record<string, typeof existingEvents>)
                  ).map(([mod, events]) => (
                    <div key={mod}>
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {NOTIFICATION_MODULES[mod as keyof typeof NOTIFICATION_MODULES] || mod}
                      </div>
                      {events.map(ev => (
                        <SelectItem key={ev.event_key + '_new'} value={ev.event_key}>
                          {ev.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Recipient type */}
          <div className="grid gap-2">
            <Label className="text-xs font-medium">Tipo de Destinatário *</Label>
            <RadioGroup value={recipientType} onValueChange={setRecipientType} className="grid grid-cols-2 gap-2">
              {[
                { value: 'role', label: 'Role' },
                { value: 'user', label: 'Pessoa específica' },
                { value: 'assigned_agent', label: 'Agente atribuído' },
                { value: 'entity_owner', label: 'Dono da entidade' },
              ].map(opt => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`rt-${opt.value}`} />
                  <Label htmlFor={`rt-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Role select */}
          {recipientType === 'role' && (
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Role *</Label>
              <Select value={recipientRoleId} onValueChange={setRecipientRoleId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccione uma role..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* User select */}
          {recipientType === 'user' && (
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Utilizador *</Label>
              <Input
                placeholder="Pesquisar utilizador..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="rounded-xl mb-1"
              />
              <Select value={recipientUserId} onValueChange={setRecipientUserId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.commercial_name || user.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Channels */}
          <div className="grid gap-3">
            <Label className="text-xs font-medium">Canais</Label>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={channelInApp} onCheckedChange={setChannelInApp} id="ch-app" />
                <Label htmlFor="ch-app" className="text-xs font-normal cursor-pointer">App</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={channelEmail} onCheckedChange={setChannelEmail} id="ch-email" />
                <Label htmlFor="ch-email" className="text-xs font-normal cursor-pointer">Email</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={channelWhatsapp} onCheckedChange={setChannelWhatsapp} id="ch-wpp" />
                <Label htmlFor="ch-wpp" className="text-xs font-normal cursor-pointer">WhatsApp</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full px-6" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditing ? 'Guardar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
