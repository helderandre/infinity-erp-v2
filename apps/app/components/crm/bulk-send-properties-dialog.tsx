'use client'

/**
 * BulkSendPropertiesDialog — entry point for the kanban multi-select
 * "Enviar imóveis escolhidos" action.
 *
 * Flow:
 *   1. The dialog receives a list of selected negocios. It groups them
 *      by contact (lead_id) so the same person never gets the same
 *      message twice.
 *   2. For every contact with more than one negócio (in the selection or
 *      in the board overall), the user picks which negócio to attach the
 *      send to via a dropdown — this is what writes the dossier row in
 *      `negocio_properties`.
 *   3. The user picks one or more imóveis (search through dev_properties).
 *   4. Toggles email and/or WhatsApp, picks the sender account/instance,
 *      writes a short intro.
 *   5. Submit fires a single POST to /api/negocios/bulk-send-properties,
 *      which fans out to the existing single-target send endpoint per
 *      resolved negócio — that endpoint handles the actual SMTP /
 *      WhatsApp dispatch + every registry write
 *      (negocio_properties.sent_at, leads_activities, contact_property_sends).
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Search, X, Building2, Loader2, Check, AlertCircle, Mail, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { useIsMobile } from '@/hooks/use-mobile'

// ─── Types passed in by the kanban ──────────────────────────────────────────

export interface BulkSendNegocio {
  id: string
  lead_id: string | null
  contact_name: string
  tipo: string | null
  estado: string | null
  pipeline_stage_name?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Negocios picked in the kanban floating bar. */
  selectedNegocios: BulkSendNegocio[]
  /** All negocios visible on the board, used to look up the OTHER deals
   *  belonging to a contact (so we can offer "send via that other deal"). */
  boardNegocios: BulkSendNegocio[]
  /** Optional success callback — bumped after a successful send so the
   *  parent can refresh its data. */
  onDone?: () => void
}

// ─── Sender + property picker types ─────────────────────────────────────────

interface EmailAccount {
  id: string
  email_address: string
  display_name: string
}
interface WhatsappInstance {
  id: string
  name: string
  phone: string | null
  profile_name: string | null
}

interface PropertyOption {
  id: string
  title: string
  external_ref: string | null
  city: string | null
  zone: string | null
  listing_price: number | null
}

const fmtPrice = (v: number | null) =>
  v == null
    ? ''
    : new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(v)

// ─── Component ──────────────────────────────────────────────────────────────

export function BulkSendPropertiesDialog({
  open, onOpenChange, selectedNegocios, boardNegocios, onDone,
}: Props) {
  const isMobile = useIsMobile()
  // Reset the form whenever the dialog re-opens with a different selection.
  const selKey = selectedNegocios.map((n) => n.id).join(',')

  // Per-contact resolved choice. Keyed by lead_id. Default = the negócio
  // the user selected; if the same contact appears in multiple selected
  // cards we fall back to the first id.
  const initialTargets = useMemo(() => {
    const map = new Map<string, { negocio_id: string }>()
    for (const n of selectedNegocios) {
      if (!n.lead_id) continue
      if (!map.has(n.lead_id)) {
        map.set(n.lead_id, { negocio_id: n.id })
      }
    }
    return map
  }, [selKey])

  const [targets, setTargets] = useState(initialTargets)
  useEffect(() => { setTargets(initialTargets) }, [initialTargets])

  // Negocios available per contact (selected + any other on the board)
  const negociosByContact = useMemo(() => {
    const map = new Map<string, BulkSendNegocio[]>()
    for (const n of boardNegocios) {
      if (!n.lead_id) continue
      const arr = map.get(n.lead_id) ?? []
      // Avoid dupes if the same negocio appears twice in boardNegocios.
      if (!arr.some((x) => x.id === n.id)) arr.push(n)
      map.set(n.lead_id, arr)
    }
    // Also fold in any selected ids that may not be on the board
    // (defensive — board should already include them).
    for (const n of selectedNegocios) {
      if (!n.lead_id) continue
      const arr = map.get(n.lead_id) ?? []
      if (!arr.some((x) => x.id === n.id)) arr.push(n)
      map.set(n.lead_id, arr)
    }
    return map
  }, [boardNegocios, selectedNegocios])

  // Unique list of contacts (one per lead_id, with display name).
  const contactRows = useMemo(() => {
    const seen = new Set<string>()
    const rows: { contact_id: string; contact_name: string }[] = []
    for (const n of selectedNegocios) {
      if (!n.lead_id || seen.has(n.lead_id)) continue
      seen.add(n.lead_id)
      rows.push({ contact_id: n.lead_id, contact_name: n.contact_name })
    }
    return rows
  }, [selectedNegocios])

  // ── Property picker ─────────────────────────────────────────────────────

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [results, setResults] = useState<PropertyOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProps, setSelectedProps] = useState<PropertyOption[]>([])
  const selectedPropIds = useMemo(
    () => new Set(selectedProps.map((p) => p.id)),
    [selectedProps],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSearching(true)
    const params = new URLSearchParams()
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
    params.set('status', 'active')
    params.set('per_page', '20')
    fetch(`/api/properties?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return
        const data = Array.isArray(json) ? json : json.data ?? []
        setResults(
          data.map((p: any) => ({
            id: p.id,
            title: p.title,
            external_ref: p.external_ref ?? null,
            city: p.city ?? null,
            zone: p.zone ?? null,
            listing_price: p.listing_price ?? null,
          })),
        )
      })
      .catch(() => { if (!cancelled) setResults([]) })
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [open, debouncedSearch])

  const toggleProp = (p: PropertyOption) => {
    setSelectedProps((prev) =>
      prev.some((x) => x.id === p.id)
        ? prev.filter((x) => x.id !== p.id)
        : [...prev, p],
    )
  }

  // ── Channels ────────────────────────────────────────────────────────────

  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [instances, setInstances] = useState<WhatsappInstance[]>([])
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [emailSubject, setEmailSubject] = useState('Sugestões de imóveis')
  const [emailIntro, setEmailIntro] = useState('')
  const [wppIntro, setWppIntro] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      fetch('/api/email/account').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/whatsapp/instances').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([emailRes, wppRes]) => {
        if (cancelled) return
        const accs: EmailAccount[] = Array.isArray(emailRes)
          ? emailRes
          : emailRes?.accounts ?? emailRes?.data ?? []
        const insts: WhatsappInstance[] = Array.isArray(wppRes)
          ? wppRes
          : wppRes?.instances ?? wppRes?.data ?? []
        setAccounts(accs)
        setInstances(insts)
        if (accs.length > 0 && !accountId) setAccountId(accs[0].id)
        if (insts.length > 0 && !instanceId) setInstanceId(insts[0].id)
        if (accs.length === 0) setEmailEnabled(false)
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Submit ──────────────────────────────────────────────────────────────

  const [submitting, setSubmitting] = useState(false)
  const [results_, setResults_] = useState<
    { negocio_id: string; ok: boolean; succeeded: number; error?: string }[] | null
  >(null)

  // Forget every user choice when the sheet closes — re-opening the bulk
  // send always starts fresh (no leftover properties / channel toggles
  // / intro text from the previous session).
  useEffect(() => {
    if (open) return
    setSelectedProps([])
    setSearch('')
    setEmailEnabled(true)
    setWhatsappEnabled(false)
    setEmailSubject('Sugestões de imóveis')
    setEmailIntro('')
    setWppIntro('')
    setResults_(null)
    setSubmitting(false)
  }, [open])

  const canSubmit =
    !submitting &&
    contactRows.length > 0 &&
    selectedProps.length > 0 &&
    (emailEnabled || whatsappEnabled) &&
    (!emailEnabled || !!accountId) &&
    (!whatsappEnabled || !!instanceId)

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setResults_(null)
    try {
      const targetsPayload = contactRows.map((c) => ({
        negocio_id: targets.get(c.contact_id)?.negocio_id ?? '',
      })).filter((t) => t.negocio_id)

      const property_ids = selectedProps.map((p) => p.id)

      const body: any = { targets: targetsPayload, }
      if (emailEnabled && accountId) {
        body.email = {
          account_id: accountId,
          subject: emailSubject,
          intro_html: emailIntro,
        }
      }
      if (whatsappEnabled && instanceId) {
        body.whatsapp = {
          instance_id: instanceId,
          intro_message: wppIntro,
        }
      }
      body.targets = targetsPayload.map((t) => ({
        ...t,
        property_ids,
      }))

      const res = await fetch('/api/negocios/bulk-send-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? 'Falha no envio')
        return
      }
      // New queue-based response — sends fan out asynchronously, the
      // user is free to leave. Skipped contacts (e.g. sem email) come
      // back so we can surface them inline in the same toast.
      const queued = Number(json?.queued ?? 0)
      const scheduledLast = json?.scheduled_last
      const totalMin = scheduledLast
        ? Math.max(0, Math.round((new Date(scheduledLast).getTime() - Date.now()) / 60000))
        : 0
      const skipped = Array.isArray(json?.skipped) ? json.skipped : []
      const desc =
        totalMin > 0
          ? `Espalhado por ~${totalMin} ${totalMin === 1 ? 'minuto' : 'minutos'}.`
          : 'O primeiro arranca já a seguir.'
      toast.success(
        `${queued} ${queued === 1 ? 'envio agendado' : 'envios agendados'}`,
        {
          description:
            skipped.length > 0
              ? `${desc} ${skipped.length} ${skipped.length === 1 ? 'contacto saltado' : 'contactos saltados'}.`
              : desc,
        },
      )
      onDone?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }, [
    contactRows, targets, selectedProps,
    emailEnabled, accountId, emailSubject, emailIntro,
    whatsappEnabled, instanceId, wppIntro,
    onDone,
  ])

  // ── UI ──────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] data-[side=bottom]:max-h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className={cn('shrink-0 px-6 gap-0', isMobile ? 'pt-8 pb-3' : 'pt-6 pb-3')}>
          <SheetTitle className="text-lg font-semibold tracking-tight">
            Enviar imóveis escolhidos
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {contactRows.length} {contactRows.length === 1 ? 'contacto' : 'contactos'} ·{' '}
            {selectedProps.length} {selectedProps.length === 1 ? 'imóvel' : 'imóveis'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-3 space-y-5">
          {/* ── Targets section ── */}
          <Section title="Destinatários" subtitle="Escolha o negócio a que o envio fica associado para cada contacto.">
            <div className="space-y-2">
              {contactRows.map((c) => {
                const list = negociosByContact.get(c.contact_id) ?? []
                const chosenId = targets.get(c.contact_id)?.negocio_id ?? list[0]?.id ?? ''
                return (
                  <div
                    key={c.contact_id}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.contact_name}</p>
                      {list.length > 1 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Tem {list.length} negócios — escolha qual.
                        </p>
                      )}
                    </div>
                    {list.length > 1 ? (
                      <Select
                        value={chosenId}
                        onValueChange={(v) => {
                          setTargets((prev) => {
                            const next = new Map(prev)
                            next.set(c.contact_id, { negocio_id: v })
                            return next
                          })
                        }}
                      >
                        <SelectTrigger className="w-[220px] h-8 text-xs">
                          <SelectValue placeholder="Escolha um negócio" />
                        </SelectTrigger>
                        <SelectContent>
                          {list.map((n) => (
                            <SelectItem key={n.id} value={n.id} className="text-xs">
                              {[
                                n.tipo ?? '—',
                                n.pipeline_stage_name ?? n.estado ?? '',
                              ].filter(Boolean).join(' · ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(() => {
                          const n = list[0]
                          if (!n) return '—'
                          return [
                            n.tipo,
                            n.pipeline_stage_name ?? n.estado,
                          ].filter(Boolean).join(' · ') || '—'
                        })()}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* ── Properties picker ── */}
          <Section
            title="Imóveis a enviar"
            subtitle="O mesmo conjunto será enviado a cada contacto."
          >
            {/* Selected chips */}
            {selectedProps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedProps.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-[11px] px-2.5 py-1"
                  >
                    {p.external_ref ? `#${p.external_ref}` : p.title.slice(0, 30)}
                    <button
                      type="button"
                      onClick={() => toggleProp(p)}
                      className="hover:bg-background/15 rounded-full p-0.5"
                      aria-label="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Procurar imóveis activos…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border/40 bg-background/40">
              {searching ? (
                <div className="p-2 space-y-1.5">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
                </div>
              ) : results.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhum imóvel encontrado.
                </p>
              ) : (
                <div className="divide-y divide-border/30">
                  {results.map((p) => {
                    const checked = selectedPropIds.has(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProp(p)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                          checked
                            ? 'bg-foreground/[0.04]'
                            : 'hover:bg-muted/40',
                        )}
                      >
                        <span
                          className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                            checked
                              ? 'bg-foreground border-foreground text-background'
                              : 'border-border',
                          )}
                        >
                          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {p.external_ref && (
                              <span className="text-muted-foreground mr-1">
                                #{p.external_ref}
                              </span>
                            )}
                            {p.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {[p.city, p.zone].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {p.listing_price != null && (
                          <span className="text-[11px] font-semibold tabular-nums shrink-0">
                            {fmtPrice(p.listing_price)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* ── Channels ── */}
          <Section title="Como enviar">
            <div className="space-y-3">
              {/* Email */}
              <div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">Email</span>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                    disabled={accounts.length === 0}
                  />
                </div>
                {emailEnabled && (
                  <div className="space-y-2 pl-6">
                    {accounts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sem contas de email configuradas.
                      </p>
                    ) : accounts.length === 1 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Conta:{' '}
                        <span className="font-medium text-foreground">
                          {accounts[0].display_name} &lt;{accounts[0].email_address}&gt;
                        </span>
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-[11px]">Conta</Label>
                        <Select value={accountId} onValueChange={setAccountId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id} className="text-xs">
                                {a.display_name} &lt;{a.email_address}&gt;
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-[11px]">Assunto</Label>
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Mensagem (opcional)</Label>
                      <Textarea
                        value={emailIntro}
                        onChange={(e) => setEmailIntro(e.target.value)}
                        rows={3}
                        placeholder="Texto antes da grelha de imóveis…"
                        className="text-xs resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp */}
              <div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">WhatsApp</span>
                  <Switch
                    checked={whatsappEnabled}
                    onCheckedChange={setWhatsappEnabled}
                    disabled={instances.length === 0}
                  />
                </div>
                {whatsappEnabled && (
                  <div className="space-y-2 pl-6">
                    {instances.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sem instâncias WhatsApp configuradas.
                      </p>
                    ) : instances.length === 1 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Instância:{' '}
                        <span className="font-medium text-foreground">
                          {instances[0].profile_name || instances[0].name}
                          {instances[0].phone ? ` (${instances[0].phone})` : ''}
                        </span>
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-[11px]">Instância</Label>
                        <Select value={instanceId} onValueChange={setInstanceId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {instances.map((i) => (
                              <SelectItem key={i.id} value={i.id} className="text-xs">
                                {i.profile_name || i.name}
                                {i.phone ? ` (${i.phone})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-[11px]">Mensagem (opcional)</Label>
                      <Textarea
                        value={wppIntro}
                        onChange={(e) => setWppIntro(e.target.value)}
                        rows={3}
                        placeholder="Texto antes da lista de imóveis…"
                        className="text-xs resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── Results (after submit) ── */}
          {results_ && (
            <Section title="Resultados">
              <div className="space-y-1.5">
                {results_.map((r) => {
                  const contact =
                    selectedNegocios.find((n) => n.id === r.negocio_id)?.contact_name ??
                    r.negocio_id.slice(0, 8)
                  return (
                    <div
                      key={r.negocio_id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                        r.ok
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-700 dark:text-red-400',
                      )}
                    >
                      {r.ok ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      <span className="font-medium">{contact}</span>
                      <span className="text-[10px] opacity-80">
                        {r.ok ? `${r.succeeded} canal(is) com sucesso` : r.error}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {results_ ? 'Fechar' : 'Cancelar'}
          </Button>
          {!results_ && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar a {contactRows.length}{' '}
              {contactRows.length === 1 ? 'contacto' : 'contactos'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title, subtitle, children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}
