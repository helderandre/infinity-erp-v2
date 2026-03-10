'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Bell, ChevronRight, Mail, MessageSquare, Info } from 'lucide-react'
import {
  ALERT_EVENT_LABELS,
  ALERT_RECIPIENT_LABELS,
} from '@/lib/constants'
import type {
  AlertsConfig,
  AlertEventConfig,
  AlertChannelsConfig,
  AlertRecipientsConfig,
  AlertEventType,
  EmailSender,
  WppInstance,
} from '@/types/alert'

const ALERT_ROLES = [
  { value: 'Consultor', label: 'Consultor' },
  { value: 'Gestora Processual', label: 'Gestora Processual' },
  { value: 'Broker/CEO', label: 'Broker/CEO' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'Office Manager', label: 'Office Manager' },
] as const

const DEFAULT_CHANNELS: AlertChannelsConfig = {
  notification: false,
  email: { enabled: false, sender_id: null },
  whatsapp: { enabled: false, wpp_instance_id: null },
}

const DEFAULT_EVENT: AlertEventConfig = {
  enabled: false,
  channels: DEFAULT_CHANNELS,
  recipients: { type: 'assigned' },
}

const EVENT_KEYS: AlertEventType[] = ['on_complete', 'on_overdue', 'on_unblock', 'on_assign']

interface AlertConfigEditorProps {
  alerts: AlertsConfig | undefined
  onChange: (alerts: AlertsConfig) => void
  defaultOpen?: boolean
}

export function AlertConfigEditor({ alerts, onChange, defaultOpen }: AlertConfigEditorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false)
  const [emailSenders, setEmailSenders] = useState<EmailSender[]>([])
  const [wppInstances, setWppInstances] = useState<WppInstance[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // Lazy-load dados apenas quando o collapsible abre
  useEffect(() => {
    if (!isOpen || dataLoaded) return
    setDataLoaded(true)

    fetch('/api/settings/email-senders')
      .then((r) => r.json())
      .then((d) => setEmailSenders(Array.isArray(d) ? d : []))
      .catch(() => setEmailSenders([]))

    fetch('/api/settings/wpp-instances')
      .then((r) => r.json())
      .then((d) => setWppInstances(Array.isArray(d) ? d : []))
      .catch(() => setWppInstances([]))
  }, [isOpen, dataLoaded])

  const currentAlerts = alerts || {}

  // Contar eventos activos para o badge resumo
  const activeCount = EVENT_KEYS.filter((k) => currentAlerts[k]?.enabled).length

  const updateEvent = (key: AlertEventType, data: Partial<AlertEventConfig>) => {
    const current = currentAlerts[key] || DEFAULT_EVENT
    onChange({
      ...currentAlerts,
      [key]: { ...current, ...data },
    })
  }

  const updateChannels = (key: AlertEventType, channels: Partial<AlertChannelsConfig>) => {
    const current = currentAlerts[key] || DEFAULT_EVENT
    updateEvent(key, {
      channels: { ...current.channels, ...channels },
    })
  }

  const updateRecipients = (key: AlertEventType, recipients: Partial<AlertRecipientsConfig>) => {
    const current = currentAlerts[key] || DEFAULT_EVENT
    updateEvent(key, {
      recipients: { ...current.recipients, ...recipients },
    })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
        <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
        <Bell className="h-3 w-3" />
        <span>Alertas</span>
        {activeCount > 0 && (
          <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">
            {activeCount} activo{activeCount > 1 ? 's' : ''}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 space-y-2">
        {EVENT_KEYS.map((eventKey) => {
          const event = currentAlerts[eventKey] || DEFAULT_EVENT
          return (
            <AlertEventEditor
              key={eventKey}
              eventKey={eventKey}
              event={event}
              emailSenders={emailSenders}
              wppInstances={wppInstances}
              onToggle={(enabled) => updateEvent(eventKey, { enabled })}
              onUpdateChannels={(channels) => updateChannels(eventKey, channels)}
              onUpdateRecipients={(recipients) => updateRecipients(eventKey, recipients)}
              onUpdateMessage={(message_template) => updateEvent(eventKey, { message_template })}
            />
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}

// --- Sub-componente: Editor de um evento individual ---

function AlertEventEditor({
  eventKey,
  event,
  emailSenders,
  wppInstances,
  onToggle,
  onUpdateChannels,
  onUpdateRecipients,
  onUpdateMessage,
}: {
  eventKey: AlertEventType
  event: AlertEventConfig
  emailSenders: EmailSender[]
  wppInstances: WppInstance[]
  onToggle: (enabled: boolean) => void
  onUpdateChannels: (channels: Partial<AlertChannelsConfig>) => void
  onUpdateRecipients: (recipients: Partial<AlertRecipientsConfig>) => void
  onUpdateMessage: (message: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2 rounded border px-2 py-1.5 bg-muted/30">
        <CollapsibleTrigger className="flex items-center gap-1 flex-1 text-xs hover:text-foreground transition-colors group">
          <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
          <span className="font-medium">{ALERT_EVENT_LABELS[eventKey]}</span>
        </CollapsibleTrigger>
        <Switch
          checked={event.enabled}
          onCheckedChange={onToggle}
          className="scale-75"
        />
      </div>

      <CollapsibleContent className="pl-4 border-l-2 border-muted ml-2 pt-2 space-y-3">
        {/* Canais */}
        <div className="space-y-2">
          {/* Notificação in-app */}
          <div className="flex items-center gap-2">
            <Switch
              checked={event.channels?.notification ?? false}
              onCheckedChange={(v) => onUpdateChannels({ notification: v })}
              className="scale-[0.65]"
            />
            <Bell className="h-3 w-3 text-muted-foreground" />
            <Label className="text-[11px]">Notificação in-app</Label>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={event.channels?.email?.enabled ?? false}
                onCheckedChange={(v) =>
                  onUpdateChannels({ email: { enabled: v, sender_id: event.channels?.email?.sender_id ?? null } })
                }
                className="scale-[0.65]"
              />
              <Mail className="h-3 w-3 text-muted-foreground" />
              <Label className="text-[11px]">Email</Label>
            </div>
            {event.channels?.email?.enabled && (
              <div className="pl-6">
                <Select
                  value={event.channels.email.sender_id || '_default'}
                  onValueChange={(v) =>
                    onUpdateChannels({
                      email: { enabled: true, sender_id: v === '_default' ? null : v },
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Remetente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_default">
                      (Remetente predefinido)
                    </SelectItem>
                    {emailSenders.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={event.channels?.whatsapp?.enabled ?? false}
                onCheckedChange={(v) =>
                  onUpdateChannels({
                    whatsapp: { enabled: v, wpp_instance_id: event.channels?.whatsapp?.wpp_instance_id ?? null },
                  })
                }
                className="scale-[0.65]"
              />
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <Label className="text-[11px]">WhatsApp</Label>
            </div>
            {event.channels?.whatsapp?.enabled && (
              <div className="pl-6">
                <Select
                  value={event.channels.whatsapp.wpp_instance_id || ''}
                  onValueChange={(v) =>
                    onUpdateChannels({
                      whatsapp: { enabled: true, wpp_instance_id: v || null },
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Seleccionar instância..." />
                  </SelectTrigger>
                  <SelectContent>
                    {wppInstances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name} ({inst.phone})
                        {inst.connection_status !== 'connected' && (
                          <span className="text-destructive ml-1">
                            — {inst.connection_status}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {event.channels.whatsapp.enabled && !event.channels.whatsapp.wpp_instance_id && (
                  <p className="text-[10px] text-destructive mt-0.5">Seleccione uma instância WhatsApp</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Destinatários */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Destinatários</Label>
          <Select
            value={event.recipients?.type || 'assigned'}
            onValueChange={(v) => onUpdateRecipients({ type: v as AlertRecipientsConfig['type'] })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ALERT_RECIPIENT_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {event.recipients?.type === 'role' && (
            <div className="pt-1">
              <Select
                value={event.recipients.roles?.[0] || ''}
                onValueChange={(v) => onUpdateRecipients({ type: 'role', roles: [v] })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Seleccionar role..." />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Mensagem personalizada */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Mensagem (opcional)</Label>
          <Input
            value={event.message_template || ''}
            onChange={(e) => onUpdateMessage(e.target.value)}
            placeholder="Ex: A tarefa '{title}' foi concluída..."
            className="h-7 text-xs"
          />
          <p className="text-[9px] text-muted-foreground flex items-center gap-1">
            <Info className="h-2.5 w-2.5" />
            Variáveis: {'{title}'}, {'{process_ref}'}, {'{triggered_by}'}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
