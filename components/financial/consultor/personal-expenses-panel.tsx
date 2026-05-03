'use client'

import { useEffect, useMemo, useState } from 'react'
import { Camera, Receipt, ArrowDownRight, RefreshCcw, Pause, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { usePersonalExpenses, usePersonalExpensesSummary } from '@/hooks/use-personal-expenses'
import { usePersonalExpenseRecurrences } from '@/hooks/use-personal-expense-recurrences'
import { DEFAULT_PERSONAL_EXPENSE_CATEGORIES } from '@/lib/financial/personal-expense-categories'
import { ReceiptCaptureSheet } from './receipt-capture-sheet'
import { PersonalExpenseRow } from './personal-expense-row'
import { PersonalExpenseDetailSheet } from './personal-expense-detail-sheet'
import type { PersonalExpense, PersonalExpenseRecurrence } from '@/types/personal-expense'
import { cn } from '@/lib/utils'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

type Period = 'month' | 'last3' | 'ytd' | 'all'

function rangeFor(period: Period): { from?: string; to?: string } {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (period === 'all') return {}
  if (period === 'month') {
    return {
      from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      to: today,
    }
  }
  if (period === 'last3') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  return { from: `${now.getFullYear()}-01-01`, to: today }
}

export function PersonalExpensesPanel() {
  const [period, setPeriod] = useState<Period>('month')
  const [category, setCategory] = useState<string>('all')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [selected, setSelected] = useState<PersonalExpense | null>(null)

  const range = useMemo(() => rangeFor(period), [period])
  const filterCategory = category === 'all' ? undefined : category

  const summary = usePersonalExpensesSummary({})
  const list = usePersonalExpenses({ ...range, category: filterCategory, limit: 50 })
  const recurrences = usePersonalExpenseRecurrences({ activeOnly: true })

  const refetchAll = () => {
    summary.refetch()
    list.refetch()
    recurrences.refetch()
  }

  // Refetch quando o quick-actions guarda uma despesa noutro sítio da app.
  useEffect(() => {
    const handler = () => {
      summary.refetch()
      list.refetch()
      recurrences.refetch()
    }
    window.addEventListener('personal-expense-saved', handler)
    return () => window.removeEventListener('personal-expense-saved', handler)
  }, [summary, list, recurrences])

  return (
    <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 sm:p-5 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4 min-w-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-tight">Despesas pessoais</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Recibos para acompanhares as tuas despesas de actividade
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCaptureOpen(true)}
          className="rounded-full shrink-0"
        >
          <Camera className="h-3.5 w-3.5 mr-1" />
          Tirar foto de recibo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <KpiTile
          label="Mês corrente"
          value={summary.loading ? null : fmtCurrency(summary.data?.month_amount ?? 0)}
          tone="negative"
        />
        <KpiTile
          label="Ano (YTD)"
          value={summary.loading ? null : fmtCurrency(summary.data?.ytd_amount ?? 0)}
          tone="neutral"
          hint={summary.data?.count != null ? `${summary.data.count} recibos arquivados` : undefined}
        />
      </div>

      {/* Pagamentos mensais activos */}
      {recurrences.data.length > 0 && (
        <RecurringSection items={recurrences.data} onChanged={refetchAll} />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="h-8 w-auto text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês corrente</SelectItem>
            <SelectItem value="last3">Últimos 3 meses</SelectItem>
            <SelectItem value="ytd">Ano corrente</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-auto text-xs">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {DEFAULT_PERSONAL_EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {list.loading && list.data.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : list.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
          <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Sem despesas registadas neste período.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Tira foto do primeiro recibo para começar.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {list.data.map((e) => (
            <li key={e.id}>
              <PersonalExpenseRow expense={e} onClick={() => setSelected(e)} />
            </li>
          ))}
        </ul>
      )}

      <ReceiptCaptureSheet
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onSaved={refetchAll}
      />
      <PersonalExpenseDetailSheet
        expense={selected}
        onOpenChange={(o) => { if (!o) setSelected(null) }}
        onChanged={refetchAll}
      />
    </div>
  )
}

function KpiTile({
  label, value, hint, tone = 'neutral',
}: {
  label: string
  value: string | null
  hint?: string
  tone?: 'neutral' | 'negative'
}) {
  const tones = { neutral: 'from-slate-500/10', negative: 'from-red-500/10' }
  return (
    <div className={cn(
      'rounded-xl bg-gradient-to-br to-transparent ring-1 ring-border/40 p-3',
      tones[tone],
    )}>
      <div className="flex items-center gap-1.5">
        <ArrowDownRight className={cn('h-3.5 w-3.5',
          tone === 'negative' ? 'text-red-600' : 'text-muted-foreground')} />
        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
      </div>
      {value === null ? (
        <Skeleton className="h-6 w-24 mt-1.5" />
      ) : (
        <p className="text-base sm:text-lg font-semibold tracking-tight tabular-nums mt-1.5">{value}</p>
      )}
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function RecurringSection({
  items, onChanged,
}: {
  items: PersonalExpenseRecurrence[]
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const togglePause = async (rec: PersonalExpenseRecurrence) => {
    setBusyId(rec.id)
    try {
      const res = await fetch(`/api/agent-personal-expense-recurrences/${rec.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: !rec.is_active }),
      })
      if (!res.ok) throw new Error()
      toast.success(rec.is_active ? 'Recorrência pausada.' : 'Recorrência reactivada.')
      onChanged()
    } catch {
      toast.error('Erro a actualizar recorrência.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (rec: PersonalExpenseRecurrence) => {
    setBusyId(rec.id)
    try {
      const res = await fetch(`/api/agent-personal-expense-recurrences/${rec.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Recorrência removida.')
      onChanged()
    } catch {
      toast.error('Erro a remover recorrência.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mb-4 rounded-xl bg-background/60 ring-1 ring-border/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pagamentos mensais
        </p>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-lg bg-card border border-border/40 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {r.vendor_name || r.description || r.category}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Dia {r.day_of_month} · {r.category}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-red-600 shrink-0">
              {fmtCurrency(Number(r.amount_gross))}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => togglePause(r)}
              disabled={busyId === r.id}
              title={r.is_active ? 'Pausar' : 'Reactivar'}
            >
              {r.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0 text-red-600"
                  disabled={busyId === r.id}
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover pagamento mensal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deixa de gerar despesas todos os meses. As despesas já criadas mantêm-se.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(r)}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
    </div>
  )
}
