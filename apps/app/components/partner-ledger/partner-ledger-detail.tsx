'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowDownLeft, ArrowUpRight, Check, Plus, Trash2, Wallet,
} from 'lucide-react'
import {
  usePartnerLedger, usePendingCommissions, confirmCommission, createMovement,
  deleteLedgerEntry, formatEUR, type PendingCommission, type PartnerLedgerEntry,
} from '@/hooks/use-partner-ledger'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function PartnerLedgerDetail({ partnerId }: { partnerId: string }) {
  const { entries, summary, loading, refetch } = usePartnerLedger(partnerId)
  const { pending, loading: pendingLoading, refetch: refetchPending } = usePendingCommissions(partnerId)

  const [confirmTarget, setConfirmTarget] = useState<PendingCommission | null>(null)
  const [payTarget, setPayTarget] = useState<{ amount: number; description: string; negocio_id?: string | null } | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const reload = () => { refetch(); refetchPending() }

  const aReceber = entries.filter((e) => e.kind === 'commission' && e.status === 'pending')

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Saldo" value={summary ? formatEUR(summary.saldo) : '—'}
          tone={summary && summary.saldo < 0 ? 'red' : 'default'} loading={loading} />
        <KpiCard label="A receber" value={summary ? formatEUR(summary.total_a_receber) : '—'}
          tone="amber" loading={loading} />
        <KpiCard label="Pago" value={summary ? formatEUR(summary.total_pago) : '—'}
          tone="default" loading={loading} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setPayTarget({ amount: 0, description: '' })}>
          <Wallet className="h-4 w-4" /> Registar pagamento
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
          <Plus className="h-4 w-4" /> Ajuste
        </Button>
      </div>

      {/* Comissões a confirmar */}
      <Section title="Comissões a confirmar" hint="negócios fechados ainda por confirmar">
        {pendingLoading ? (
          <RowSkeleton />
        ) : pending.length === 0 ? (
          <Empty>Nada por confirmar.</Empty>
        ) : (
          <ul className="divide-y divide-border/60">
            {pending.map((p) => (
              <li key={p.negocio_id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.lead_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[p.tipo, p.localizacao].filter(Boolean).join(' · ')}
                    {p.referral_pct ? ` · ${p.referral_pct}%` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-emerald-600">{formatEUR(p.amount)}</span>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmTarget(p)}>
                    <Check className="h-3.5 w-3.5" /> Confirmar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* A receber (confirmed, unpaid) */}
      <Section title="A receber" hint="comissões confirmadas por liquidar">
        {loading ? (
          <RowSkeleton />
        ) : aReceber.length === 0 ? (
          <Empty>Nada pendente de pagamento.</Empty>
        ) : (
          <ul className="divide-y divide-border/60">
            {aReceber.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.description}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.entry_date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-amber-600">{formatEUR(Number(e.amount))}</span>
                  <Button size="sm" variant="secondary"
                    onClick={() => setPayTarget({ amount: Number(e.amount), description: `Pagamento — ${e.description}`, negocio_id: e.negocio_id })}>
                    <Wallet className="h-3.5 w-3.5" /> Pagar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Movimentos */}
      <Section title="Movimentos" hint="histórico completo">
        {loading ? (
          <RowSkeleton />
        ) : entries.length === 0 ? (
          <Empty>Sem movimentos.</Empty>
        ) : (
          <ul className="divide-y divide-border/60">
            {entries.map((e) => <MovementRow key={e.id} entry={e} onDeleted={reload} />)}
          </ul>
        )}
      </Section>

      {/* Confirm commission dialog */}
      <ConfirmCommissionDialog
        target={confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onDone={() => { setConfirmTarget(null); reload() }}
      />

      {/* Register payment dialog */}
      <PaymentDialog
        partnerId={partnerId}
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onDone={() => { setPayTarget(null); reload() }}
      />

      {/* Adjustment dialog */}
      <AdjustmentDialog
        partnerId={partnerId}
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onDone={() => { setAdjustOpen(false); reload() }}
      />
    </div>
  )
}

// ─── Movement row ───────────────────────────────────────────────────────────
function MovementRow({ entry, onDeleted }: { entry: PartnerLedgerEntry; onDeleted: () => void }) {
  const isCredit = entry.direction === 'credit'
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteLedgerEntry(entry.id)
      toast.success('Movimento eliminado')
      onDeleted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao eliminar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2.5 group">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0',
          isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
          {isCredit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{entry.description}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {fmtDate(entry.entry_date)}
            {entry.kind === 'commission' && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] rounded-full">
                {entry.status === 'paid' ? 'Pago' : 'A receber'}
              </Badge>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn('text-sm font-semibold tabular-nums', isCredit ? 'text-emerald-600' : 'text-red-600')}>
          {isCredit ? '+' : '−'}{formatEUR(Number(entry.amount))}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" disabled={busy}
              className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar movimento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem a certeza de que pretende eliminar este movimento? Esta acção é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}

// ─── Dialogs ────────────────────────────────────────────────────────────────
function ConfirmCommissionDialog({ target, onClose, onDone }: {
  target: PendingCommission | null; onClose: () => void; onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const open = !!target

  async function submit() {
    if (!target) return
    const val = amount !== '' ? Number(amount) : target.amount
    if (!val || val <= 0) { toast.error('Valor inválido'); return }
    setBusy(true)
    try {
      await confirmCommission(target.negocio_id, val)
      toast.success('Comissão confirmada')
      setAmount('')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setAmount(''); onClose() } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar comissão</DialogTitle>
          <DialogDescription>{target?.lead_name} — comissão a creditar ao parceiro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Valor (€)</Label>
          <Input type="number" step="0.01" placeholder={target ? String(target.amount) : ''}
            value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="text-xs text-muted-foreground">Calculado: {target ? formatEUR(target.amount) : '—'}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setAmount(''); onClose() }}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PaymentDialog({ partnerId, target, onClose, onDone }: {
  partnerId: string
  target: { amount: number; description: string; negocio_id?: string | null } | null
  onClose: () => void; onDone: () => void
}) {
  const open = !!target
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [seeded, setSeeded] = useState<string | null>(null)

  // Seed fields from target when a new dialog opens.
  if (target && seeded !== JSON.stringify(target)) {
    setSeeded(JSON.stringify(target))
    setAmount(target.amount ? String(target.amount) : '')
    setDescription(target.description || '')
    setDate(new Date().toISOString().slice(0, 10))
  }

  async function submit() {
    const val = Number(amount)
    if (!val || val <= 0) { toast.error('Valor inválido'); return }
    if (!description.trim()) { toast.error('Descrição obrigatória'); return }
    setBusy(true)
    try {
      await createMovement({
        partner_id: partnerId, kind: 'payment', direction: 'debit',
        amount: val, description: description.trim(), entry_date: date || undefined,
        negocio_id: target?.negocio_id ?? null,
      })
      toast.success('Pagamento registado')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSeeded(null); onClose() } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registar pagamento</DialogTitle>
          <DialogDescription>Pagamento ao parceiro (sai do saldo).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Valor (€)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Transferência comissão CPCV" />
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setSeeded(null); onClose() }}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>Registar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdjustmentDialog({ partnerId, open, onClose, onDone }: {
  partnerId: string; open: boolean; onClose: () => void; onDone: () => void
}) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const val = Number(amount)
    if (!val || val <= 0) { toast.error('Valor inválido'); return }
    if (!description.trim()) { toast.error('Descrição obrigatória'); return }
    setBusy(true)
    try {
      await createMovement({
        partner_id: partnerId, kind: 'adjustment', direction,
        amount: val, description: description.trim(),
      })
      toast.success('Ajuste registado')
      setAmount(''); setDescription('')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste manual</DialogTitle>
          <DialogDescription>Crédito (a favor do parceiro) ou débito.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant={direction === 'credit' ? 'default' : 'outline'} size="sm"
              className="flex-1" onClick={() => setDirection('credit')}>Crédito (+)</Button>
            <Button type="button" variant={direction === 'debit' ? 'default' : 'outline'} size="sm"
              className="flex-1" onClick={() => setDirection('debit')}>Débito (−)</Button>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (€)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>Registar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Small presentational helpers ───────────────────────────────────────────
function KpiCard({ label, value, tone = 'default', loading }: {
  label: string; value: string; tone?: 'default' | 'red' | 'amber'; loading?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-3.5">
      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="h-6 w-20 mt-1" /> : (
        <p className={cn('text-lg font-bold tabular-nums mt-0.5',
          tone === 'red' && 'text-red-600', tone === 'amber' && 'text-amber-600')}>{value}</p>
      )}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground/70 italic">{children}</p>
}
function RowSkeleton() {
  return <div className="space-y-2 py-1">{[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
}
