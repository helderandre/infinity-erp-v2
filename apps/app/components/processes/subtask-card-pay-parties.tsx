'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Check, Coins, Handshake, Network, Wallet, CheckCircle2,
  Pencil, RotateCcw, Trash2, Plus, X, AlertTriangle, Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { usePermissions } from '@/hooks/use-permissions'
import {
  updateSplitPaid, setSplitAmountOverride, clearSplitOverride,
  createManualSplit, deleteSplit,
} from '@/app/dashboard/financeiro/deals/actions'
import type { ProcSubtask } from '@/types/subtask'

interface Party {
  split_id: string
  agent_id: string | null
  agent_name: string
  role: 'main' | 'partner' | 'referral'
  share_pct: number
  amount: number
  amount_auto: number
  amount_is_override: boolean
  is_manual: boolean
  manual_label: string | null
  paid: boolean
  paid_date: string | null
}

interface Summary {
  payment_id: string
  payment_moment: string
  amount: number
  network_amount: number
  agency_amount: number
  partner_amount: number
  partner_agency_name: string | null
  moloni_status: number | null
  is_received: boolean
  received_date: string | null
}

interface BreakdownResponse {
  found: boolean
  moment: string
  deal_type?: string
  summary?: Summary
  parties?: Party[]
}

interface SubtaskCardPayPartiesProps {
  subtask: ProcSubtask
  dealId: string | null
  onCompleted: () => void
  onChanged?: () => void
}

const fmtEUR = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
const initials = (name: string) =>
  name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '—'

const ROLE_LABEL: Record<Party['role'], string> = {
  main: 'Principal',
  partner: 'Partilha',
  referral: 'Referral',
}

/**
 * Card do passo "Pagar às partes" (PROC-NEG).
 *
 * Mostra a repartição "quem recebe o quê" do pagamento do momento
 * (CPCV/escritura), com o MESMO cálculo do mapa de gestão
 * (`/api/deals/[id]/payout-breakdown` → `buildMapaRowsFromPayment`): total,
 * parte de cada consultor (toggle Pago), Convictus (rede), margem da agência e
 * agência parceira. O flip de "Pago" é gated a `financial`; concluir o passo
 * fica disponível a quem gere o processo.
 */
export function SubtaskCardPayParties({
  subtask,
  dealId,
  onCompleted,
  onChanged,
}: SubtaskCardPayPartiesProps) {
  const { hasPermission } = usePermissions()
  const canManageFinancial = hasPermission('financial')

  const config = (subtask.config ?? {}) as Record<string, unknown>
  const moment = (config.moment as string | undefined) ?? 'cpcv'
  const hint = config.hint as string | undefined

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BreakdownResponse | null>(null)
  const [parties, setParties] = useState<Party[]>([])
  const [busySplit, setBusySplit] = useState<string | null>(null)

  // Edição inline do valor de uma parte
  const [editingSplit, setEditingSplit] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Remoção de parte (AlertDialog)
  const [deletingSplit, setDeletingSplit] = useState<string | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  // Adicionar interveniente
  const [addOpen, setAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addAmount, setAddAmount] = useState<number | null>(null)
  const [addingBusy, setAddingBusy] = useState(false)

  const load = useCallback(async () => {
    if (!dealId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/deals/${dealId}/payout-breakdown?moment=${moment}`)
      if (!res.ok) return
      const json = (await res.json()) as BreakdownResponse
      setData(json)
      setParties(json.parties ?? [])
    } finally {
      setLoading(false)
    }
  }, [dealId, moment])

  useEffect(() => {
    load()
  }, [load])

  const isCompleted = Boolean(subtask.is_completed)

  const togglePaid = async (party: Party) => {
    if (!canManageFinancial) return
    const next = !party.paid
    setBusySplit(party.split_id)
    try {
      const res = await updateSplitPaid(party.split_id, next)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      const updated = parties.map((p) =>
        p.split_id === party.split_id
          ? { ...p, paid: next, paid_date: next ? new Date().toISOString().slice(0, 10) : null }
          : p,
      )
      setParties(updated)
      toast.success(next ? `Pagamento a ${party.agent_name} marcado` : 'Pagamento desmarcado')
      onChanged?.()
      if (next && updated.every((p) => p.paid) && !isCompleted) onCompleted()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao actualizar o pagamento')
    } finally {
      setBusySplit(null)
    }
  }

  const startEdit = (p: Party) => {
    setEditingSplit(p.split_id)
    setEditValue(p.amount)
  }
  const cancelEdit = () => {
    setEditingSplit(null)
    setEditValue(null)
  }
  const saveEdit = async (p: Party) => {
    setSavingEdit(true)
    try {
      const res = await setSplitAmountOverride(p.split_id, { amount: editValue })
      if (!res.success) throw new Error(res.error ?? 'Erro')
      toast.success('Valor da parte actualizado')
      cancelEdit()
      await load()
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao guardar o valor')
    } finally {
      setSavingEdit(false)
    }
  }
  const resetEdit = async (p: Party) => {
    setBusySplit(p.split_id)
    try {
      const res = await clearSplitOverride(p.split_id)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      toast.success('Reposto o valor automático')
      await load()
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao repor o valor')
    } finally {
      setBusySplit(null)
    }
  }
  const confirmDelete = async () => {
    if (!deletingSplit) return
    setDeletingBusy(true)
    try {
      const res = await deleteSplit(deletingSplit)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      toast.success('Parte removida')
      setDeletingSplit(null)
      await load()
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao remover a parte')
    } finally {
      setDeletingBusy(false)
    }
  }
  const addParty = async (paymentId: string) => {
    if (!addLabel.trim()) {
      toast.error('Indica o nome do interveniente.')
      return
    }
    if (addAmount == null) {
      toast.error('Indica o valor a pagar.')
      return
    }
    setAddingBusy(true)
    try {
      const res = await createManualSplit(paymentId, {
        manual_label: addLabel.trim(),
        amount: addAmount,
        role: 'referral',
      })
      if (!res.success) throw new Error(res.error ?? 'Erro')
      toast.success('Parte adicionada')
      setAddOpen(false)
      setAddLabel('')
      setAddAmount(null)
      await load()
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao adicionar a parte')
    } finally {
      setAddingBusy(false)
    }
  }

  if (!dealId) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        Esta subtarefa requer um deal associado ao processo. Submete o negócio primeiro.
      </div>
    )
  }
  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        A calcular a repartição…
      </div>
    )
  }
  if (!data?.found || !data.summary) {
    return (
      <div className="rounded-lg border bg-amber-50 ring-1 ring-amber-500/20 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        Ainda não há pagamento para o momento{' '}
        <strong>{moment === 'escritura' ? 'da escritura' : 'do CPCV'}</strong> neste negócio.
      </div>
    )
  }

  const s = data.summary
  const allPaid = parties.length > 0 && parties.every((p) => p.paid)
  // Fatura já emitida (status 1 = emitida·AT, 2 = creditada/anulada) → bloqueia edição.
  const invoiceLocked = s.moloni_status === 1 || s.moloni_status === 2
  const canEdit = canManageFinancial && !invoiceLocked
  // Margem da agência = porção da agência menos o que sai para os consultores —
  // mesma fórmula do mapa de gestão (agency_amount − Σ split_amount).
  const consultantTotal = parties.reduce((sum, p) => sum + p.amount, 0)
  const agencyNetMargin = Math.max(0, s.agency_amount - consultantTotal)
  const overDistributed = consultantTotal > s.agency_amount + 0.005
  const reconciled = Math.abs(s.agency_amount - consultantTotal) <= 0.005

  return (
    <div className="space-y-3">
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}

      {/* Montantes — mesma leitura do mapa de gestão */}
      <div className="grid gap-2.5 grid-cols-2">
        <Tile label="Total do pagamento" value={fmtEUR(s.amount)} tone="slate" icon={Wallet} />
        {s.network_amount > 0 && (
          <Tile label="Convictus (rede)" value={fmtEUR(s.network_amount)} tone="indigo" icon={Network} />
        )}
        {agencyNetMargin > 0 && (
          <Tile label="Margem agência" value={fmtEUR(agencyNetMargin)} tone="violet" icon={Coins} />
        )}
        {s.partner_amount > 0 && (
          <Tile
            label={s.partner_agency_name ? `Parceira · ${s.partner_agency_name}` : 'Agência parceira'}
            value={fmtEUR(s.partner_amount)}
            tone="amber"
            icon={Handshake}
          />
        )}
      </div>

      {!s.is_received && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          O pagamento deste momento ainda não consta como recebido — confirma antes de pagar às partes.
        </p>
      )}

      {invoiceLocked && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 ring-1 ring-amber-500/25 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Fatura já emitida — valores bloqueados. Só podes marcar pagamentos e concluir o passo.
        </p>
      )}

      {/* Consultores — parte de cada um + estado de pagamento */}
      <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">
          Consultores
        </p>
        {parties.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-1">Sem comissões de consultor neste pagamento.</p>
        )}
        {parties.map((p) => {
          const isEditing = editingSplit === p.split_id
          const isBusy = busySplit === p.split_id
          return (
            <div key={p.split_id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-[10px] bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-600 dark:to-neutral-800">
                  {initials(p.agent_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{p.agent_name}</span>
                  {p.role !== 'main' && (
                    <Badge variant="outline" className="rounded-full text-[9px] px-1.5 py-0 shrink-0">
                      {ROLE_LABEL[p.role]}
                    </Badge>
                  )}
                  {(p.is_manual || p.amount_is_override) && (
                    <Badge variant="outline" className="rounded-full text-[9px] px-1.5 py-0 shrink-0 text-violet-600 border-violet-500/40">
                      Manual
                    </Badge>
                  )}
                </div>
                {isEditing ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <CurrencyInput
                      value={editValue}
                      onChange={setEditValue}
                      className="h-7 w-28 text-[12px]"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => saveEdit(p)}
                      disabled={savingEdit}
                      className="rounded-full h-7 px-2.5 text-[11px] gap-1"
                    >
                      {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      disabled={savingEdit}
                      className="rounded-full h-7 w-7 p-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>
                      {p.share_pct}% · <span className="font-semibold tabular-nums text-foreground">{fmtEUR(p.amount)}</span>
                    </span>
                    {p.amount_is_override && (
                      <span className="text-[10px] text-muted-foreground">auto: {fmtEUR(p.amount_auto)}</span>
                    )}
                    {canEdit && !p.paid && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="inline-flex items-center text-muted-foreground hover:text-foreground"
                          title="Editar valor"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {p.amount_is_override && (
                          <button
                            type="button"
                            onClick={() => resetEdit(p)}
                            disabled={isBusy}
                            className="inline-flex items-center text-muted-foreground hover:text-foreground"
                            title="Repor automático"
                          >
                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          </button>
                        )}
                      </>
                    )}
                  </p>
                )}
              </div>
              {/* Estado de pagamento + remover */}
              {!isEditing && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.paid ? (
                    <button
                      type="button"
                      onClick={() => togglePaid(p)}
                      disabled={!canManageFinancial || isBusy}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
                        canManageFinancial && 'hover:bg-emerald-200/70 cursor-pointer',
                      )}
                      title={canManageFinancial ? 'Clica para desmarcar' : undefined}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Pago{p.paid_date ? ` · ${fmtDate(p.paid_date)}` : ''}
                    </button>
                  ) : canManageFinancial ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePaid(p)}
                      disabled={isBusy}
                      className="rounded-full h-7 text-[11px] gap-1.5"
                    >
                      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3" />}
                      Marcar pago
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Por pagar</span>
                  )}
                  {canEdit && !p.paid && (
                    <button
                      type="button"
                      onClick={() => setDeletingSplit(p.split_id)}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Remover parte"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Adicionar interveniente */}
        {canEdit && (
          addOpen ? (
            <div className="rounded-xl ring-1 ring-border/40 bg-background/60 p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Input
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="Nome do interveniente"
                  className="h-8 text-[12px] flex-1"
                  autoFocus
                />
                <CurrencyInput
                  value={addAmount}
                  onChange={setAddAmount}
                  className="h-8 w-28 text-[12px]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => addParty(s.payment_id)}
                  disabled={addingBusy}
                  className="rounded-full h-7 text-[11px] gap-1.5"
                >
                  {addingBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAddOpen(false); setAddLabel(''); setAddAmount(null) }}
                  disabled={addingBusy}
                  className="rounded-full h-7 text-[11px]"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
              className="rounded-full h-7 text-[11px] gap-1.5"
            >
              <Plus className="h-3 w-3" />
              Adicionar parte
            </Button>
          )
        )}

        {/* Reconciliação (informativa, não bloqueia) */}
        {parties.length > 0 && (
          overDistributed ? (
            <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 ring-1 ring-amber-500/25 px-2.5 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Distribuído a mais — consultores ({fmtEUR(consultantTotal)}) excedem a porção da agência ({fmtEUR(s.agency_amount)}).
            </p>
          ) : (
            <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
              Margem agência: <span className="font-medium tabular-nums text-foreground">{fmtEUR(agencyNetMargin)}</span>
              {reconciled && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> reconciliado
                </span>
              )}
            </p>
          )
        )}
      </div>

      {/* Agência parceira (externa) — pagamento informativo (sem flag dedicada). */}
      {s.partner_amount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 ring-1 ring-border/30 px-3 py-2">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Handshake className="h-3.5 w-3.5" />
            {s.partner_agency_name ?? 'Agência parceira'}
          </span>
          <span className="text-sm font-semibold tabular-nums">{fmtEUR(s.partner_amount)}</span>
        </div>
      )}

      {/* Concluir o passo */}
      {isCompleted ? (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          Pagamento às partes concluído.
        </p>
      ) : (
        <Button
          size="sm"
          onClick={onCompleted}
          className="rounded-full h-8 text-[11px] gap-1.5 w-full"
        >
          <Check className="h-3.5 w-3.5" />
          {allPaid ? 'Concluir — todas as partes pagas' : 'Marcar pagamento concluído'}
        </Button>
      )}

      {/* Confirmação de remoção de parte */}
      <AlertDialog open={!!deletingSplit} onOpenChange={(o) => { if (!o) setDeletingSplit(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta parte?</AlertDialogTitle>
            <AlertDialogDescription>
              A parte deixa de ser paga e de contar para a distribuição. Podes voltar a adicioná-la depois, se for preciso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
              disabled={deletingBusy}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Tile({
  label, value, tone, icon: Icon,
}: {
  label: string
  value: string
  tone: 'slate' | 'indigo' | 'violet' | 'amber' | 'emerald'
  icon: React.ElementType
}) {
  const map = {
    slate: { from: 'from-slate-500/10', accent: 'bg-slate-400/40', text: 'text-slate-600' },
    indigo: { from: 'from-indigo-500/15', accent: 'bg-indigo-500/60', text: 'text-indigo-600' },
    violet: { from: 'from-violet-500/15', accent: 'bg-violet-500/60', text: 'text-violet-600' },
    amber: { from: 'from-amber-500/15', accent: 'bg-amber-500/60', text: 'text-amber-600' },
    emerald: { from: 'from-emerald-500/15', accent: 'bg-emerald-500/60', text: 'text-emerald-600' },
  }[tone]
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent ring-1 ring-border/40 p-3', map.from)}>
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', map.accent)} />
      <p className="text-[10px] text-muted-foreground font-medium leading-tight flex items-center gap-1 truncate">
        <Icon className={cn('h-3 w-3 shrink-0', map.text)} />
        {label}
      </p>
      <p className="text-base font-semibold tracking-tight tabular-nums truncate mt-1">{value}</p>
    </div>
  )
}
