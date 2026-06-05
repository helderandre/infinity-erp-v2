'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Facebook,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { commitScope, fetchScopePreview } from './actions'
import type {
  AdAccountListItem,
  CommitScopePayload,
  ScopePreviewBusinessManager,
  ScopePreviewResponse,
} from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function accountsForBM(
  bm: ScopePreviewBusinessManager,
  includeClient: boolean,
): AdAccountListItem[] {
  return includeClient
    ? bm.owned_ad_accounts.concat(bm.client_ad_accounts)
    : bm.owned_ad_accounts
}

/**
 * Deriva o conjunto inicial de ad_account_ids "checked" a partir das
 * regras já persistidas em DB (current_rules):
 *   - account explicitamente em deny → NÃO marcar
 *   - account explicitamente em allow → marcar
 *   - account dentro de BM com allow → marcar (herdado)
 *   - outros → NÃO marcar (default-deny)
 */
function initialCheckedFromRules(
  preview: ScopePreviewResponse,
): Set<string> {
  const allowBMs = new Set(preview.current_rules.allow_business_managers)
  const allowAccts = new Set(preview.current_rules.allow_ad_accounts)
  const denyAccts = new Set(preview.current_rules.deny_ad_accounts)

  const checked = new Set<string>()
  for (const bm of preview.business_managers) {
    const accounts = bm.owned_ad_accounts.concat(bm.client_ad_accounts)
    for (const a of accounts) {
      if (denyAccts.has(a.ad_account_id)) continue
      if (allowAccts.has(a.ad_account_id)) {
        checked.add(a.ad_account_id)
      } else if (allowBMs.has(bm.id)) {
        checked.add(a.ad_account_id)
      }
    }
  }
  return checked
}

function accountStatusLabel(s: number | null): string {
  switch (s) {
    case 1:
      return 'ACTIVE'
    case 2:
      return 'DISABLED'
    case 3:
      return 'UNSETTLED'
    case 7:
      return 'PENDING_RISK_REVIEW'
    case 8:
      return 'PENDING_SETTLEMENT'
    case 9:
      return 'IN_GRACE_PERIOD'
    case 100:
      return 'PENDING_CLOSURE'
    case 101:
      return 'CLOSED'
    case 201:
      return 'ANY_ACTIVE'
    case 202:
      return 'ANY_CLOSED'
    default:
      return s !== null ? String(s) : '—'
  }
}

function accountStatusVariant(
  s: number | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 1) return 'default'
  if (s === 3 || s === 8 || s === 9) return 'secondary'
  if (s === 2 || s === 100 || s === 101) return 'outline'
  return 'outline'
}

/**
 * Constrói o payload do commit a partir do estado actual da UI.
 *
 * Regra: para cada BM, se PELO MENOS UM ad account está checked, adicionar o
 * BM em `allowed_business_manager_ids` e adicionar os accounts unchecked
 * desse BM em `denied_ad_account_ids` (override). Se NENHUM ad account está
 * checked, omitir o BM por completo (default-deny mais limpo).
 *
 * `allowed_ad_account_ids` fica reservado para o caso futuro de ad accounts
 * sem BM (não exposto neste sprint).
 */
function buildCommitPayload(args: {
  connectionId: string
  preview: ScopePreviewResponse
  includeClient: boolean
  checked: Set<string>
}): CommitScopePayload {
  const { connectionId, preview, includeClient, checked } = args

  const allowed_business_manager_ids: string[] = []
  const denied_ad_account_ids: string[] = []
  const allowed_ad_account_ids: string[] = []

  for (const bm of preview.business_managers) {
    const accounts = accountsForBM(bm, includeClient)
    const checkedHere = accounts.filter((a) =>
      checked.has(a.ad_account_id),
    )
    const uncheckedHere = accounts.filter(
      (a) => !checked.has(a.ad_account_id),
    )

    if (checkedHere.length === 0) continue

    allowed_business_manager_ids.push(bm.id)
    for (const a of uncheckedHere) {
      denied_ad_account_ids.push(a.ad_account_id)
    }
  }

  return {
    connection_id: connectionId,
    allowed_business_manager_ids,
    allowed_ad_account_ids,
    denied_ad_account_ids,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScopeForm({
  initial,
  fromOauth: _fromOauth,
}: {
  initial: ScopePreviewResponse
  fromOauth: boolean
}) {
  const router = useRouter()
  const [preview, setPreview] = useState(initial)
  const [includeClient, setIncludeClient] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(() =>
    initialCheckedFromRules(initial),
  )
  const [openBMs, setOpenBMs] = useState<Set<string>>(
    () => new Set(initial.business_managers.map((b) => b.id)),
  )
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const totalChecked = checked.size
  const canSubmit = totalChecked > 0 && !isSubmitting

  // -------- Toggle include_client (re-fetch preview, preserve user choices)
  function handleIncludeClientToggle(next: boolean) {
    startTransition(async () => {
      const result = await fetchScopePreview(preview.connection_id, next)
      if (!result.ok) {
        toast.error('Falha a recarregar lista', {
          description: result.error,
        })
        return
      }

      // Preserve user picks: para accounts que já existiam em `preview`,
      // mantém a escolha; para accounts novos (apareceram porque
      // include_client virou true), inicializa a partir de current_rules.
      const oldVisible = new Set<string>()
      for (const bm of preview.business_managers) {
        for (const a of accountsForBM(bm, includeClient)) {
          oldVisible.add(a.ad_account_id)
        }
      }

      const fromRules = initialCheckedFromRules(result.data)
      const merged = new Set<string>()
      for (const bm of result.data.business_managers) {
        for (const a of accountsForBM(bm, next)) {
          if (oldVisible.has(a.ad_account_id)) {
            if (checked.has(a.ad_account_id)) merged.add(a.ad_account_id)
          } else if (fromRules.has(a.ad_account_id)) {
            merged.add(a.ad_account_id)
          }
        }
      }

      setPreview(result.data)
      setIncludeClient(next)
      setChecked(merged)
    })
  }

  // -------- Toggle single ad account
  function toggleAccount(id: string) {
    setChecked((prev) => {
      const nx = new Set(prev)
      if (nx.has(id)) nx.delete(id)
      else nx.add(id)
      return nx
    })
  }

  // -------- Master checkbox per BM (tri-state)
  function toggleBM(bm: ScopePreviewBusinessManager) {
    const accounts = accountsForBM(bm, includeClient)
    if (accounts.length === 0) return
    const allChecked = accounts.every((a) => checked.has(a.ad_account_id))
    setChecked((prev) => {
      const nx = new Set(prev)
      if (allChecked) {
        for (const a of accounts) nx.delete(a.ad_account_id)
      } else {
        for (const a of accounts) nx.add(a.ad_account_id)
      }
      return nx
    })
  }

  function bmCheckedState(
    bm: ScopePreviewBusinessManager,
  ): boolean | 'indeterminate' {
    const accounts = accountsForBM(bm, includeClient)
    if (accounts.length === 0) return false
    const checkedCount = accounts.filter((a) =>
      checked.has(a.ad_account_id),
    ).length
    if (checkedCount === 0) return false
    if (checkedCount === accounts.length) return true
    return 'indeterminate'
  }

  // -------- Toggle BM accordion open/closed
  function toggleBMOpen(id: string) {
    setOpenBMs((prev) => {
      const nx = new Set(prev)
      if (nx.has(id)) nx.delete(id)
      else nx.add(id)
      return nx
    })
  }

  // -------- Submit
  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      const payload = buildCommitPayload({
        connectionId: preview.connection_id,
        preview,
        includeClient,
        checked,
      })
      const result = await commitScope(payload)
      if (!result.ok) {
        toast.error('Erro a guardar scope', {
          description:
            result.error +
            (result.status ? ` (HTTP ${result.status})` : ''),
        })
        return
      }
      toast.success('Scope salvo', {
        description: `${result.data.total_rules} regra${result.data.total_rules === 1 ? '' : 's'} persistida${result.data.total_rules === 1 ? '' : 's'}. Sincronização iniciada em background — leva alguns minutos.`,
        duration: 9000,
      })
      router.push('/dashboard/integracoes/meta')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIsSubmitting(false)
    }
  }

  // -------- Computed: warnings derived from pages without BM + raw warnings
  const pagesWithoutBM = useMemo(
    () => preview.pages.filter((p) => !p.business),
    [preview.pages],
  )

  return (
    <div className="space-y-6">
      {/* --------------- Pages (read-only) --------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Facebook className="text-[#1877F2] h-5 w-5" />
            Pages selecionadas
          </CardTitle>
          <CardDescription>
            Vieram do consent do Facebook. Read-only — para alterar refaz o
            OAuth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {preview.pages.map((p) => (
              <li
                key={p.page_id}
                className="flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {p.page_name ?? '(sem nome)'}
                  </p>
                  <p className="text-muted-foreground font-mono text-[10px]">
                    {p.page_id}
                  </p>
                  {p.business ? (
                    <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                      <Building2 className="h-3 w-3" />
                      <span>BM:</span>
                      <span className="text-foreground font-medium">
                        {p.business.name ?? '(sem nome)'}
                      </span>
                      <span className="font-mono text-[10px]">
                        {p.business.id}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Sem Business Manager — Pages órfãs não têm ad accounts
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* --------------- Ad accounts (interactive) --------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ad accounts</CardTitle>
          <CardDescription>
            Marca as ad accounts que pertencem a este tenant. Sincronizamos
            campanhas e anúncios apenas das marcadas. Por defeito tudo
            desligado (default-deny).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* include_client toggle */}
          <div className="bg-muted/30 flex items-start gap-3 rounded-md border p-3">
            <Switch
              id="include-client"
              checked={includeClient}
              onCheckedChange={handleIncludeClientToggle}
              disabled={isPending || isSubmitting}
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="include-client"
                className="cursor-pointer font-medium"
              >
                Incluir ad accounts cedidas (client_ad_accounts)
              </Label>
              <p className="text-muted-foreground text-xs">
                Útil se este tenant é uma agência e o BM tem accounts cedidas
                por outros BMs. Default desligado.
              </p>
            </div>
            {isPending && (
              <Loader2 className="text-muted-foreground ml-auto mt-1 h-4 w-4 animate-spin" />
            )}
          </div>

          {preview.business_managers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              — nenhum Business Manager visível —
            </p>
          ) : (
            <ul className="space-y-2">
              {preview.business_managers.map((bm) => {
                const accounts = accountsForBM(bm, includeClient)
                const isOpen = openBMs.has(bm.id)
                const state = bmCheckedState(bm)
                return (
                  <li key={bm.id} className="rounded-md border">
                    {/* BM header */}
                    <div className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={state}
                        onCheckedChange={() => toggleBM(bm)}
                        disabled={
                          accounts.length === 0 || isPending || isSubmitting
                        }
                        aria-label={`Toggle todos os ad accounts de ${bm.name ?? bm.id}`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleBMOpen(bm.id)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="text-muted-foreground h-4 w-4" />
                        ) : (
                          <ChevronRight className="text-muted-foreground h-4 w-4" />
                        )}
                        <Building2 className="text-muted-foreground h-4 w-4" />
                        <span className="flex-1 truncate font-medium">
                          {bm.name ?? '(sem nome)'}
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {accounts.length} conta
                          {accounts.length === 1 ? '' : 's'}
                        </span>
                      </button>
                    </div>

                    {/* BM accounts */}
                    {isOpen && (
                      <div className="border-t">
                        {accounts.length === 0 ? (
                          <p className="text-muted-foreground p-3 text-xs">
                            — nenhuma ad account encontrada —
                          </p>
                        ) : (
                          <ul className="divide-y">
                            {accounts.map((a) => {
                              const isClient =
                                bm.client_ad_accounts.some(
                                  (c) =>
                                    c.ad_account_id === a.ad_account_id,
                                )
                              const isChecked = checked.has(a.ad_account_id)
                              return (
                                <li
                                  key={a.ad_account_id}
                                  className={cn(
                                    'flex items-center gap-3 px-3 py-2',
                                    isChecked && 'bg-muted/30',
                                  )}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() =>
                                      toggleAccount(a.ad_account_id)
                                    }
                                    disabled={isPending || isSubmitting}
                                    aria-label={`Toggle ${a.name ?? a.ad_account_id}`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                      {a.name ?? '(sem nome)'}
                                      {isClient && (
                                        <span className="text-muted-foreground ml-2 text-[10px] font-normal uppercase">
                                          cedida
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-muted-foreground font-mono text-[10px]">
                                      {a.ad_account_id}
                                    </p>
                                  </div>
                                  <span className="text-muted-foreground text-xs tabular-nums">
                                    {a.currency ?? '—'}
                                  </span>
                                  <Badge
                                    variant={accountStatusVariant(
                                      a.account_status,
                                    )}
                                    className="text-[10px]"
                                  >
                                    {accountStatusLabel(a.account_status)}
                                  </Badge>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* --------------- Warnings --------------- */}
      {(preview.warnings.length > 0 || pagesWithoutBM.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Avisos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground space-y-1 text-sm">
              {pagesWithoutBM.map((p) => (
                <li key={p.page_id}>
                  Page <strong>{p.page_name ?? p.page_id}</strong> não está em
                  nenhum Business Manager — não vai gerar ad accounts.
                </li>
              ))}
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* --------------- Sticky footer with actions --------------- */}
      <div className="bg-background/80 sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3 backdrop-blur">
        <p className="text-muted-foreground text-xs tabular-nums">
          {totalChecked} ad account{totalChecked === 1 ? '' : 's'} selecionada
          {totalChecked === 1 ? '' : 's'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/integracoes/meta')}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isSubmitting
              ? 'A guardar…'
              : totalChecked === 0
                ? 'Selecciona pelo menos uma ad account'
                : 'Confirmar e ativar'}
          </Button>
        </div>
      </div>

      {totalChecked === 0 && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>Default-deny activo</AlertTitle>
          <AlertDescription>
            Sem ad accounts marcadas o tenant não receberá dados de campanhas
            ou ads. Os leads (que vêm via webhook Page+Form) continuam a chegar
            independentemente disto.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// Ícone inline para o alert (evita import duplicado)
function AlertCircleIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
