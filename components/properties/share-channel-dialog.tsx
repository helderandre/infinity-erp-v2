'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { Loader2, Mail, MessageCircle, Plus, X, User, Check } from 'lucide-react'

type Channel = 'email' | 'whatsapp'

interface Lead {
  id: string
  nome: string | null
  email: string | null
  telemovel: string | null
}

type Recipient =
  | { kind: 'lead'; lead: Lead }
  | { kind: 'manual'; value: string; name?: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  propertyTitle: string
  channel: Channel
}

export function SharePropertyChannelDialog({
  open,
  onOpenChange,
  propertyId,
  propertyTitle,
  channel,
}: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [intro, setIntro] = useState('')
  const [subject, setSubject] = useState(`Imóvel · ${propertyTitle}`)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setRecipients([])
      setIntro('')
      setSubject(`Imóvel · ${propertyTitle}`)
    }
  }, [open, propertyTitle])

  const valid = recipients.length > 0

  const addRecipient = (r: Recipient) => {
    setRecipients((prev) => {
      const key = r.kind === 'lead' ? r.lead.id : r.value
      const already = prev.some(
        (p) => (p.kind === 'lead' ? p.lead.id : p.value) === key,
      )
      return already ? prev : [...prev, r]
    })
  }

  const removeRecipient = (idx: number) =>
    setRecipients((prev) => prev.filter((_, i) => i !== idx))

  const send = async () => {
    setLoading(true)
    try {
      const payload: any = {
        channel,
        intro: intro.trim() || undefined,
        recipients: recipients.map((r) =>
          r.kind === 'lead'
            ? { lead_id: r.lead.id }
            : channel === 'email'
              ? { email: r.value, name: r.name }
              : { phone: r.value, name: r.name },
        ),
      }
      if (channel === 'email') payload.subject = subject.trim() || undefined

      const res = await fetch(`/api/properties/${propertyId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao partilhar')

      const { success, failed } = data as { success: number; failed: number }
      if (failed > 0 && success > 0) {
        toast.warning(`${success} enviados, ${failed} falharam`)
      } else if (failed > 0) {
        toast.error(`Falha ao enviar (${failed})`)
      } else {
        toast.success(
          success === 1 ? 'Enviado' : `Enviado a ${success} destinatários`,
        )
      }
      if (success > 0) onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao partilhar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {channel === 'email' ? (
              <><Mail className="h-4 w-4" /> Partilhar por Email</>
            ) : (
              <><MessageCircle className="h-4 w-4" /> Partilhar por WhatsApp</>
            )}
          </DialogTitle>
          <DialogDescription>
            {channel === 'email'
              ? 'Envia o cartão do imóvel e o link público.'
              : 'Envia uma mensagem de texto com o link público.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient picker */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Destinatários
            </Label>
            <RecipientPicker channel={channel} onAdd={addRecipient} />
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recipients.map((r, i) => {
                  const label =
                    r.kind === 'lead'
                      ? r.lead.nome ||
                        (channel === 'email' ? r.lead.email : r.lead.telemovel) ||
                        'Lead'
                      : r.name || r.value
                  const subtle =
                    r.kind === 'lead'
                      ? channel === 'email'
                        ? r.lead.email
                        : r.lead.telemovel
                      : r.value
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
                    >
                      <span className="font-medium">{label}</span>
                      {subtle && subtle !== label && (
                        <span className="text-muted-foreground">· {subtle}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRecipient(i)}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Subject — email only */}
          {channel === 'email' && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Assunto
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={`Imóvel · ${propertyTitle}`}
              />
            </div>
          )}

          {/* Intro textarea */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Mensagem {intro.trim() ? '' : '(opcional — usaremos uma por omissão)'}
            </Label>
            <Textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder={
                channel === 'email'
                  ? 'Ex: Olá {Nome}, partilho consigo este imóvel…'
                  : 'Ex: Olá! Achei que este imóvel podia interessar-lhe.'
              }
              rows={channel === 'email' ? 4 : 3}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full gap-1.5"
            onClick={send}
            disabled={!valid || loading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> A enviar…</>
            ) : channel === 'email' ? (
              <><Mail className="h-4 w-4" /> Enviar email</>
            ) : (
              <><MessageCircle className="h-4 w-4" /> Enviar WhatsApp</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────

function RecipientPicker({
  channel,
  onAdd,
}: {
  channel: Channel
  onAdd: (r: Recipient) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualValue, setManualValue] = useState('')
  const [manualName, setManualName] = useState('')

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: '30' })
        if (query.trim()) params.set('nome', query.trim())
        const res = await fetch(`/api/leads?${params.toString()}`, {
          signal: ctrl.signal,
        })
        if (res.ok) {
          const data = await res.json()
          const rows = (data.data || data.items || data || []) as any[]
          const filtered = rows.filter((r) =>
            channel === 'email' ? !!r.email : !!r.telemovel,
          )
          setLeads(
            filtered.map((r) => ({
              id: r.id,
              nome: r.nome || null,
              email: r.email || null,
              telemovel: r.telemovel || null,
            })),
          )
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [query, open, channel])

  const manualValid = useMemo(() => {
    const v = manualValue.trim()
    if (!v) return false
    if (channel === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    // Phone: accept digits with optional + and spaces
    return /^\+?[\d\s()-]{7,}$/.test(v)
  }, [manualValue, channel])

  const submitManual = () => {
    if (!manualValid) return
    onAdd({ kind: 'manual', value: manualValue.trim(), name: manualName.trim() || undefined })
    setManualValue('')
    setManualName('')
    setManualOpen(false)
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="flex-1 justify-start gap-2 h-9 rounded-full"
            type="button"
          >
            <User className="h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs">
              Pesquisar contactos…
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Pesquisar por nome…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-[260px]">
              {loading ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> A
                  procurar…
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {channel === 'email'
                      ? 'Nenhum contacto com email.'
                      : 'Nenhum contacto com telemóvel.'}
                  </CommandEmpty>
                  <CommandGroup>
                    {leads.map((lead) => {
                      const label =
                        lead.nome ||
                        (channel === 'email' ? lead.email : lead.telemovel) ||
                        '—'
                      const sub =
                        channel === 'email' ? lead.email : lead.telemovel
                      return (
                        <CommandItem
                          key={lead.id}
                          value={lead.id}
                          onSelect={() => {
                            onAdd({ kind: 'lead', lead })
                            setOpen(false)
                            setQuery('')
                          }}
                          className="flex items-start gap-2"
                        >
                          <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{label}</div>
                            {sub && sub !== label && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {sub}
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover open={manualOpen} onOpenChange={setManualOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            type="button"
            title={channel === 'email' ? 'Adicionar email' : 'Adicionar número'}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3 space-y-2" align="end">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Nome (opcional)
            </Label>
            <Input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Ex: Ana"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {channel === 'email' ? 'Email' : 'Telemóvel'}
            </Label>
            <Input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={channel === 'email' ? 'nome@exemplo.com' : '+351 91…'}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitManual()
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full rounded-full gap-1"
            disabled={!manualValid}
            onClick={submitManual}
          >
            <Check className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Dummy use to suppress unused import warning in case shouldFilter mode changes
void cn
