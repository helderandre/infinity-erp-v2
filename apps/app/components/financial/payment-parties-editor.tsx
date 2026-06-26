'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Pencil, Check, X, RotateCcw, Plus, Trash2, Lock,
  Users, Network, Building2, Handshake, Wallet, UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  setSplitAmountOverride, clearSplitOverride, deleteSplit, createManualSplit,
  setPaymentAmountOverride, clearPaymentOverrides,
} from '@/app/dashboard/financeiro/deals/actions'

const fmtEUR = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const initials = (name: string) =>
  name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '—'

interface Party {
  split_id: string
  agent_id: string | null
  name: string
  role: 'main' | 'partner' | 'referral'
  amount: number
  amount_auto: number
  amount_is_override: boolean
  is_manual: boolean
  consultant_paid: boolean
}
interface PaymentInfo {
  id: string
  moment: string
  amount: number
  amount_auto: number
  amount_is_override: boolean
  network_amount: number
  network_amount_auto: number
  network_amount_is_override: boolean
  agency_amount: number
  agency_amount_auto: number
  agency_amount_is_override: boolean
  partner_amount: number
  partner_amount_auto: number
  partner_amount_is_override: boolean
  partner_agency_name: string | null
  amounts_locked: boolean
  is_received: boolean
  moloni_status: number | null
}
interface Breakdown { payment: PaymentInfo; parties: Party[] }

const ROLE_LABEL: Record<Party['role'], string> = {
  main: 'Principal', partner: 'Partilha', referral: 'Referência',
}

/**
 * Editor "intervenientes do pagamento" — a lista de quem recebe o quê neste
 * momento (consultores/referências + Convictus/rede + agência parceira), cada um
 * editável e sobreponível, com "Adicionar interveniente". Os totais (total do
 * pagamento + margem da agência) ficam por baixo, com a reconciliação. Partilhado
 * pelo sheet do mapa de gestão (e reutilizável no painel/fecho).
 */
export function PaymentPartiesEditor({
  paymentId, canEdit, onChanged,
}: {
  paymentId: string
  canEdit: boolean
  onChanged?: () => void
}) {
  const [data, setData] = useState<Breakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [delTarget, setDelTarget] = useState<Party | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/financial/deal-payments/${paymentId}/breakdown`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [paymentId])

  useEffect(() => { load() }, [load])

  const refresh = useCallback(async () => { await load(); onChanged?.() }, [load, onChanged])

  if (loading) {
    return <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4 text-xs text-muted-foreground">A carregar intervenientes…</div>
  }
  if (!data) {
    return <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4 text-xs text-muted-foreground">Sem dados de pagamento.</div>
  }

  const { payment, parties } = data
  const paymentLocked = payment.is_received || payment.moloni_status === 1 || payment.moloni_status === 2
  const lockReason = (payment.moloni_status === 1 || payment.moloni_status === 2)
    ? 'Fatura já emitida à AT — usa nota de crédito antes de alterar.'
    : payment.is_received
      ? 'Pagamento já recebido — desmarca "Recebido" antes de alterar.'
      : ''

  const consultorTotal = parties.reduce((s, p) => s + p.amount, 0)
  const agencyKeeps = payment.agency_amount - consultorTotal
  const reconciled = Math.abs(agencyKeeps) < 0.01 || agencyKeeps >= 0

  // ── handlers (todas devolvem boolean de sucesso) ──
  const saveSplit = async (split_id: string, amount: number): Promise<boolean> => {
    const r = await setSplitAmountOverride(split_id, { amount })
    if (!r.success) { toast.error(r.error ?? 'Erro'); return false }
    toast.success('Valor actualizado'); await refresh(); return true
  }
  const clearSplit = async (split_id: string) => {
    const r = await clearSplitOverride(split_id)
    if (!r.success) { toast.error(r.error ?? 'Erro'); return }
    toast.success('Reposto automático'); await refresh()
  }
  const savePayField = (field: 'amount' | 'network_amount' | 'agency_amount' | 'partner_amount') =>
    async (value: number): Promise<boolean> => {
      const r = await setPaymentAmountOverride(payment.id, field, value)
      if (!r.success) { toast.error(r.error ?? 'Erro'); return false }
      toast.success('Valor actualizado'); await refresh(); return true
    }
  const clearPay = async () => {
    const r = await clearPaymentOverrides(payment.id)
    if (!r.success) { toast.error(r.error ?? 'Erro'); return }
    toast.success('Repostos os montantes automáticos'); await refresh()
  }
  const confirmDelete = async () => {
    if (!delTarget) return
    const r = await deleteSplit(delTarget.split_id)
    setDelTarget(null)
    if (!r.success) { toast.error(r.error ?? 'Erro'); return }
    toast.success('Interveniente removido'); await refresh()
  }

  return (
    <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Intervenientes do pagamento
        </p>
        {(payment.amount_is_override || payment.network_amount_is_override ||
          payment.agency_amount_is_override || payment.partner_amount_is_override ||
          parties.some((p) => p.amount_is_override || p.is_manual)) && (
          <Badge variant="outline" className="rounded-full text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
            Editado
          </Badge>
        )}
      </div>

      {/* ── Lista de intervenientes ── */}
      <div className="space-y-1.5">
        {parties.map((p) => (
          <Row
            key={p.split_id}
            icon={<Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="text-[9px] bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-600 dark:to-neutral-800">{initials(p.name)}</AvatarFallback></Avatar>}
            title={p.name}
            badge={p.role !== 'main' ? ROLE_LABEL[p.role] : (p.is_manual ? 'Manual' : undefined)}
            locked={p.consultant_paid}
            lockedHint="Já pago — desmarca o pagamento para editar."
            amount={p.amount}
            auto={p.amount_auto}
            isOverride={p.amount_is_override}
            canEdit={canEdit}
            onSave={(v) => saveSplit(p.split_id, v)}
            onClear={p.amount_is_override ? () => clearSplit(p.split_id) : undefined}
            onRemove={canEdit && !p.consultant_paid ? () => setDelTarget(p) : undefined}
          />
        ))}

        {/* Convictus (rede) */}
        {(payment.network_amount > 0 || payment.network_amount_is_override) && (
          <Row
            icon={<IconBox tone="indigo"><Network className="h-3.5 w-3.5" /></IconBox>}
            title="Convictus (rede)"
            locked={paymentLocked}
            lockedHint={lockReason}
            amount={payment.network_amount}
            auto={payment.network_amount_auto}
            isOverride={payment.network_amount_is_override}
            canEdit={canEdit}
            onSave={savePayField('network_amount')}
          />
        )}

        {/* Agência parceira */}
        {(payment.partner_amount > 0 || payment.partner_amount_is_override) && (
          <Row
            icon={<IconBox tone="amber"><Handshake className="h-3.5 w-3.5" /></IconBox>}
            title={payment.partner_agency_name ? `Parceira · ${payment.partner_agency_name}` : 'Agência parceira'}
            locked={paymentLocked}
            lockedHint={lockReason}
            amount={payment.partner_amount}
            auto={payment.partner_amount_auto}
            isOverride={payment.partner_amount_is_override}
            canEdit={canEdit}
            onSave={savePayField('partner_amount')}
          />
        )}
      </div>

      {/* Adicionar interveniente */}
      {canEdit && (
        adding ? (
          <AddPartyForm
            paymentId={payment.id}
            onCancel={() => setAdding(false)}
            onAdded={async () => { setAdding(false); await refresh() }}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="rounded-full h-8 text-[11px] gap-1.5 w-full">
            <UserPlus className="h-3.5 w-3.5" /> Adicionar interveniente
          </Button>
        )
      )}

      {/* ── Totais ── */}
      <div className="rounded-xl bg-muted/30 ring-1 ring-border/30 p-3 space-y-1.5">
        <Row
          dense
          icon={<IconBox tone="slate"><Wallet className="h-3.5 w-3.5" /></IconBox>}
          title="Total do pagamento"
          locked={paymentLocked}
          lockedHint={lockReason}
          amount={payment.amount}
          auto={payment.amount_auto}
          isOverride={payment.amount_is_override}
          canEdit={canEdit}
          onSave={savePayField('amount')}
        />
        <Row
          dense
          icon={<IconBox tone="violet"><Building2 className="h-3.5 w-3.5" /></IconBox>}
          title="Margem da agência"
          locked={paymentLocked}
          lockedHint={lockReason}
          amount={payment.agency_amount}
          auto={payment.agency_amount_auto}
          isOverride={payment.agency_amount_is_override}
          canEdit={canEdit}
          onSave={savePayField('agency_amount')}
        />
        <div className="flex items-center justify-between pt-1 text-[11px]">
          <span className="text-muted-foreground">Agência fica com (após consultores)</span>
          <span className={cn('tabular-nums font-medium', reconciled ? 'text-foreground' : 'text-amber-600')}>
            {fmtEUR(agencyKeeps)}{!reconciled && ' ⚠'}
          </span>
        </div>
        {!reconciled && (
          <p className="text-[10px] text-amber-600">Distribuído a mais do que a margem da agência.</p>
        )}
      </div>

      {paymentLocked && canEdit && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> {lockReason}
        </p>
      )}

      {/* Repor automático (limpa overrides ao nível do pagamento) */}
      {canEdit && !paymentLocked && (payment.amount_is_override || payment.network_amount_is_override ||
        payment.agency_amount_is_override || payment.partner_amount_is_override) && (
        <Button variant="ghost" size="sm" onClick={clearPay} className="rounded-full h-7 text-[11px] gap-1.5">
          <RotateCcw className="h-3 w-3" /> Repor montantes automáticos
        </Button>
      )}

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover interveniente?</AlertDialogTitle>
            <AlertDialogDescription>
              {delTarget?.name} deixa de receber neste pagamento. Pode ser restaurado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Linha de interveniente / montante (com edição inline) ───────────────────

function Row({
  icon, title, badge, amount, auto, isOverride, canEdit, locked, lockedHint,
  onSave, onClear, onRemove, dense,
}: {
  icon: React.ReactNode
  title: string
  badge?: string
  amount: number
  auto: number
  isOverride: boolean
  canEdit: boolean
  locked?: boolean
  lockedHint?: string
  onSave: (v: number) => Promise<boolean>
  onClear?: () => void
  onRemove?: () => void
  dense?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState<number | null>(amount)
  const [busy, setBusy] = useState(false)
  const editable = canEdit && !locked

  const start = () => { setV(amount); setEditing(true) }
  const save = async () => {
    if (v == null) { setEditing(false); return }
    setBusy(true)
    const ok = await onSave(Number(v))
    setBusy(false)
    if (ok) setEditing(false)
  }

  return (
    <div className={cn('flex items-center gap-2.5 rounded-xl bg-muted/20', dense ? 'px-1 py-0.5' : 'p-2')}>
      {!dense && icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{title}</span>
          {badge && <Badge variant="outline" className="rounded-full text-[9px] px-1.5 py-0 shrink-0">{badge}</Badge>}
          {locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
        {isOverride && !editing && (
          <span className="text-[10px] text-muted-foreground">auto: {fmtEUR(auto)}</span>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <CurrencyInput value={v} onChange={setV} className="h-8 w-28 rounded-lg text-sm" />
          <button type="button" onClick={save} disabled={busy} className="rounded-full p-1.5 hover:bg-emerald-100 text-emerald-600">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-full p-1.5 hover:bg-muted text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <span className="tabular-nums text-sm font-semibold">{fmtEUR(amount)}</span>
          {editable && (
            <button type="button" onClick={start} title="Editar" className="rounded-full p-1.5 hover:bg-muted text-muted-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {editable && isOverride && onClear && (
            <button type="button" onClick={onClear} title="Repor automático" className="rounded-full p-1.5 hover:bg-muted text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} title="Remover" className="rounded-full p-1.5 hover:bg-red-100 text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {locked && lockedHint && !editable && (
            <span className="sr-only">{lockedHint}</span>
          )}
        </div>
      )}
    </div>
  )
}

function AddPartyForm({
  paymentId, onCancel, onAdded,
}: {
  paymentId: string
  onCancel: () => void
  onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [role, setRole] = useState<'main' | 'partner' | 'referral'>('referral')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim()) { toast.error('Indica um nome'); return }
    if (amount == null) { toast.error('Indica um valor'); return }
    setBusy(true)
    const r = await createManualSplit(paymentId, { manual_label: name.trim(), amount, role })
    setBusy(false)
    if (!r.success) { toast.error(r.error ?? 'Erro'); return }
    toast.success('Interveniente adicionado')
    onAdded()
  }

  return (
    <div className="rounded-xl ring-1 ring-border/40 bg-background/60 p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
        <Plus className="h-3 w-3" /> Novo interveniente
      </p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (consultor, referência, …)" className="h-9 rounded-lg text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <CurrencyInput value={amount} onChange={setAmount} className="h-9 rounded-lg text-sm" />
        <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
          <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="referral">Referência</SelectItem>
            <SelectItem value="partner">Partilha</SelectItem>
            <SelectItem value="main">Principal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-full h-8 text-[11px]">Cancelar</Button>
        <Button size="sm" onClick={submit} disabled={busy} className="rounded-full h-8 text-[11px] gap-1.5">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Adicionar
        </Button>
      </div>
    </div>
  )
}

function IconBox({ tone, children }: { tone: 'indigo' | 'amber' | 'slate' | 'violet'; children: React.ReactNode }) {
  const map = {
    indigo: 'from-indigo-500/15 text-indigo-600',
    amber: 'from-amber-500/15 text-amber-600',
    slate: 'from-slate-500/10 text-slate-600',
    violet: 'from-violet-500/15 text-violet-600',
  }[tone]
  return <div className={cn('h-7 w-7 rounded-full bg-gradient-to-br to-transparent flex items-center justify-center shrink-0', map)}>{children}</div>
}
