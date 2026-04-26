'use client'

/**
 * BulkSendMatchesDialog — for each selected negócio, automatically picks
 * the top N matches that pass the strict matching engine (no warnings)
 * and sends each one its OWN tailored property set via the existing
 * /api/negocios/bulk-send-properties endpoint (per-target property_ids).
 *
 * Different from BulkSendPropertiesDialog (which sends the SAME property
 * set to every target): here every contact receives a different list,
 * computed from their negócio's search criteria.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Loader2, Sparkles, Check, AlertCircle, Mail, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

export interface BulkMatchTarget {
  negocio_id: string
  contact_name: string
}

interface MatchProperty {
  id: string
  title: string
  external_ref: string | null
  listing_price: number | null
  city: string | null
  zone: string | null
}

interface PerTargetMatches {
  negocio_id: string
  contact_name: string
  matches: MatchProperty[]
  loading: boolean
  error: string | null
}

interface EmailAccount { id: string; email_address: string; display_name: string }
interface WhatsappInstance { id: string; name: string; phone: string | null; profile_name: string | null }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** One entry per UNIQUE selected negócio — already deduped at the kanban. */
  targets: BulkMatchTarget[]
  onDone?: () => void
}

const fmtPrice = (v: number | null) =>
  v == null
    ? ''
    : new Intl.NumberFormat('pt-PT', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
      }).format(v)

export function BulkSendMatchesDialog({
  open, onOpenChange, targets, onDone,
}: Props) {
  const isMobile = useIsMobile()

  // Per-target matches state. Lazy-loaded when the sheet opens.
  const [matchesState, setMatchesState] = useState<PerTargetMatches[]>([])
  const [topN, setTopN] = useState<number>(5)

  // Channel state — same shape as the bulk send dialog.
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [instances, setInstances] = useState<WhatsappInstance[]>([])
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [emailSubject, setEmailSubject] = useState('Sugestões de imóveis')
  const [emailIntro, setEmailIntro] = useState('')
  const [wppIntro, setWppIntro] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<
    { negocio_id: string; ok: boolean; succeeded: number; error?: string }[] | null
  >(null)

  // Reset everything on close
  useEffect(() => {
    if (open) return
    setMatchesState([])
    setTopN(5)
    setEmailEnabled(true)
    setWhatsappEnabled(false)
    setEmailSubject('Sugestões de imóveis')
    setEmailIntro('')
    setWppIntro('')
    setSubmitting(false)
    setResults(null)
  }, [open])

  // Fetch matches per target (parallel) when sheet opens.
  useEffect(() => {
    if (!open || targets.length === 0) return
    let cancelled = false
    setMatchesState(
      targets.map((t) => ({
        negocio_id: t.negocio_id,
        contact_name: t.contact_name,
        matches: [],
        loading: true,
        error: null,
      })),
    )
    Promise.all(
      targets.map(async (t) => {
        try {
          const res = await fetch(
            `/api/negocios/${encodeURIComponent(t.negocio_id)}/matches?strict=true`,
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = await res.json()
          const data = (json?.data ?? []) as any[]
          return {
            negocio_id: t.negocio_id,
            matches: data.map((p) => ({
              id: p.id,
              title: p.title ?? '',
              external_ref: p.external_ref ?? null,
              listing_price: p.listing_price ?? null,
              city: p.city ?? null,
              zone: p.zone ?? null,
            })) as MatchProperty[],
            error: null,
          }
        } catch (e) {
          return {
            negocio_id: t.negocio_id,
            matches: [] as MatchProperty[],
            error: e instanceof Error ? e.message : 'Erro',
          }
        }
      }),
    ).then((all) => {
      if (cancelled) return
      const byId = new Map(all.map((r) => [r.negocio_id, r]))
      setMatchesState((prev) =>
        prev.map((s) => {
          const r = byId.get(s.negocio_id)
          if (!r) return { ...s, loading: false }
          return { ...s, matches: r.matches, error: r.error, loading: false }
        }),
      )
    })
    return () => { cancelled = true }
  }, [open, targets])

  // Lazy-load sender lists.
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
        if (accs.length > 0) setAccountId((id) => id || accs[0].id)
        if (insts.length > 0) setInstanceId((id) => id || insts[0].id)
        if (accs.length === 0) setEmailEnabled(false)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open])

  // Aggregate stats — total matches across targets, capped at topN.
  const stats = useMemo(() => {
    let totalMatches = 0
    let pickedTotal = 0
    let targetsWithNone = 0
    for (const s of matchesState) {
      totalMatches += s.matches.length
      const picked = Math.min(s.matches.length, topN)
      pickedTotal += picked
      if (s.matches.length === 0 && !s.loading) targetsWithNone++
    }
    return { totalMatches, pickedTotal, targetsWithNone }
  }, [matchesState, topN])

  const allLoading = matchesState.every((s) => s.loading) && matchesState.length > 0
  const canSubmit =
    !submitting &&
    !allLoading &&
    stats.pickedTotal > 0 &&
    (emailEnabled || whatsappEnabled) &&
    (!emailEnabled || !!accountId) &&
    (!whatsappEnabled || !!instanceId)

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setResults(null)
    try {
      // Build per-target property_ids (top N each, skipping targets with none).
      const sendTargets = matchesState
        .filter((s) => s.matches.length > 0)
        .map((s) => ({
          negocio_id: s.negocio_id,
          property_ids: s.matches.slice(0, topN).map((m) => m.id),
        }))

      if (sendTargets.length === 0) {
        toast.error('Sem matches para enviar')
        return
      }

      const body: Record<string, unknown> = { targets: sendTargets }
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
    matchesState, topN, emailEnabled, accountId, emailSubject, emailIntro,
    whatsappEnabled, instanceId, wppIntro, onDone,
  ])

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
          <SheetTitle className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Matches rígidos
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Cada contacto recebe os imóveis que coincidem rigorosamente com os critérios do seu negócio.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-3 space-y-5">

          {/* ── Top N picker + summary ── */}
          <Section title="Quantos imóveis por contacto">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={20}
                value={topN}
                onChange={(e) => setTopN(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-20 h-9"
              />
              <p className="text-xs text-muted-foreground">
                {allLoading
                  ? 'A calcular matches…'
                  : (
                    <>
                      <span className="font-semibold text-foreground">{stats.pickedTotal}</span>
                      {' '}imóveis no total
                      {stats.targetsWithNone > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {' · '}{stats.targetsWithNone} sem matches
                        </span>
                      )}
                    </>
                  )}
              </p>
            </div>
          </Section>

          {/* ── Per-target preview ── */}
          <Section
            title="Por contacto"
            subtitle="Escolhemos os top do matching estrito (sem badges warning)."
          >
            <div className="rounded-2xl ring-1 ring-border/40 bg-background/40 max-h-56 overflow-y-auto divide-y divide-border/30">
              {matchesState.length === 0 || allLoading ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
              ) : matchesState.map((s) => {
                const picked = Math.min(s.matches.length, topN)
                const sample = s.matches.slice(0, Math.min(picked, 2))
                return (
                  <div
                    key={s.negocio_id}
                    className="px-3 py-2 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{s.contact_name}</p>
                      {s.error ? (
                        <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                          {s.error}
                        </p>
                      ) : sample.length > 0 ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {sample.map((p) =>
                            p.external_ref ? `#${p.external_ref}` : p.title.slice(0, 30),
                          ).join(' · ')}
                          {picked > sample.length && (
                            <span className="ml-1 opacity-70">+{picked - sample.length}</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                          Sem matches
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-[11px] font-bold tabular-nums',
                        picked > 0
                          ? 'bg-foreground/10 text-foreground'
                          : 'bg-muted/40 text-muted-foreground/60',
                      )}
                    >
                      {picked}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* ── Channels — same controls as the regular bulk send ── */}
          <Section title="Como enviar">
            <div className="space-y-3">
              <ChannelBlock
                icon={Mail}
                label="Email"
                enabled={emailEnabled}
                onEnabledChange={setEmailEnabled}
                disabled={accounts.length === 0}
              >
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
              </ChannelBlock>

              <ChannelBlock
                icon={MessageSquare}
                label="WhatsApp"
                enabled={whatsappEnabled}
                onEnabledChange={setWhatsappEnabled}
                disabled={instances.length === 0}
              >
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
              </ChannelBlock>
            </div>
          </Section>

          {/* ── Results ── */}
          {results && (
            <Section title="Resultados">
              <div className="space-y-1.5">
                {results.map((r) => {
                  const target = matchesState.find((s) => s.negocio_id === r.negocio_id)
                  return (
                    <div
                      key={r.negocio_id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]',
                        r.ok
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-700 dark:text-red-400',
                      )}
                    >
                      {r.ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      <span className="font-medium truncate flex-1">
                        {target?.contact_name ?? r.negocio_id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] opacity-80">
                        {r.ok ? `${r.succeeded} canal(is)` : r.error}
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
            {results ? 'Fechar' : 'Cancelar'}
          </Button>
          {!results && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar matches a {matchesState.filter((s) => s.matches.length > 0).length}{' '}
              {matchesState.filter((s) => s.matches.length > 0).length === 1
                ? 'contacto'
                : 'contactos'}
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

function ChannelBlock({
  icon: Icon, label, enabled, onEnabledChange, disabled, children,
}: {
  icon: React.ElementType
  label: string
  enabled: boolean
  onEnabledChange: (e: boolean) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">{label}</span>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
        />
      </div>
      {enabled && <div className="space-y-2 pl-6">{children}</div>}
    </div>
  )
}
