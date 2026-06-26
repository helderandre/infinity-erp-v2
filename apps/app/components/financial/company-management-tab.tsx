'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw,
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  FileImage, Receipt, Building, BarChart3, ListFilter, Repeat,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { CompanyExpenseSheet } from '@/components/financial/company-expense-sheet'
import { CompanyStatsView } from '@/components/financial/company-stats-view'
import { RecurringExpensesManager } from '@/components/financial/recurring-expenses-manager'
import type { CompanyTransaction, CompanyCategory } from '@/types/financial'
import { COMPANY_TRANSACTION_STATUSES } from '@/types/financial'

interface PartnerOption {
  id: string
  name: string
  nif: string | null
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function CompanyManagementTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [transactions, setTransactions] = useState<CompanyTransaction[]>([])
  const [categories, setCategories] = useState<CompanyCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Totals
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)

  // Partners
  const [partners, setPartners] = useState<PartnerOption[]>([])

  // Sheets / dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  // Stats view tab + type toggle
  const [activeTab, setActiveTab] = useState<'stats' | 'entries' | 'recurring'>('stats')
  const [statsType, setStatsType] = useState<'income' | 'expense'>('expense')

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    fetch('/api/financial/company-categories')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data) })
      .catch(() => {})

    fetch('/api/partners?is_active=true&limit=200')
      .then((r) => r.json())
      .then((data) => {
        const list = data.data || data || []
        if (Array.isArray(list)) setPartners(list.map((p: any) => ({ id: p.id, name: p.name, nif: p.nif })))
      })
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) })
      const res = await fetch(`/api/financial/company-transactions?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTransactions(data.data || [])
      setTotal(data.total || 0)

      // Compute totals
      const txList = data.data || []
      setTotalIncome(txList.filter((t: CompanyTransaction) => t.type === 'income').reduce((s: number, t: CompanyTransaction) => s + Number(t.amount_gross || t.amount_net), 0))
      setTotalExpense(txList.filter((t: CompanyTransaction) => t.type === 'expense').reduce((s: number, t: CompanyTransaction) => s + Number(t.amount_gross || t.amount_net), 0))
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setIsLoading(false)
    }
  }, [month, year])

  useEffect(() => { loadData() }, [loadData])

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1) } else setMonth(month + 1) }

  // Filter to expenses only — receitas removidas do scope
  const expenseTransactions = transactions.filter((t) => t.type === 'expense')

  // Templates recorrentes já gerados no mês visível (estado por linha no manager).
  const generatedTemplateIds = useMemo(
    () => new Set(
      transactions
        .filter((t) => t.recurring_template_id)
        .map((t) => t.recurring_template_id as string),
    ),
    [transactions],
  )

  return (
    <div className="space-y-6">
      {/* Controls row: month picker + actions (mobile: 2 rows; desktop: 1 row) */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/40 border border-border/30 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={prevMonth}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-[11px] sm:text-xs font-medium px-2.5 sm:px-3 min-w-[100px] sm:min-w-[120px] text-center hover:bg-muted/60 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {MONTHS[month - 1]} {year}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="center">
                  <div className="flex items-center justify-between mb-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => setYear(year - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-base font-bold tabular-nums">{year}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => setYear(year + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {MONTHS.map((m, idx) => {
                      const isSelected = month === idx + 1
                      const isCurrent = (now.getMonth() + 1) === idx + 1 && now.getFullYear() === year
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setMonth(idx + 1)
                            setPickerOpen(false)
                          }}
                          className={`text-xs py-2 rounded-lg transition-all relative ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                              : isCurrent
                                ? 'bg-muted/60 text-foreground hover:bg-muted'
                                : 'hover:bg-muted text-foreground'
                          }`}
                        >
                          {m.slice(0, 3)}
                          {isCurrent && !isSelected && (
                            <span className="absolute top-1 right-1.5 h-1 w-1 rounded-full bg-primary" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 rounded-full text-xs"
                    onClick={() => {
                      setMonth(now.getMonth() + 1)
                      setYear(now.getFullYear())
                      setPickerOpen(false)
                    }}
                  >
                    Hoje
                  </Button>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={nextMonth}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex items-center gap-2 sm:flex-1 sm:min-w-0 sm:justify-end">
              <Button
                size="sm"
                className="h-8 rounded-full text-[11px] gap-1.5"
                onClick={() => setAddOpen(true)}
                title="Registar despesa (foto ou manual)"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="truncate">Registar despesa</span>
              </Button>
            </div>
          </div>

      {/* White card com tabs Estatísticas / Despesas */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'stats' | 'entries' | 'recurring')}
      >
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
          {/* Tabs header */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2">
            <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-3 rounded-full p-1 h-9 bg-muted/40 border border-border/30">
              <TabsTrigger
                value="stats"
                className="rounded-full text-xs px-4 sm:px-5 gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <BarChart3 className="h-3 w-3" /> Estatísticas
              </TabsTrigger>
              <TabsTrigger
                value="entries"
                className="rounded-full text-xs px-4 sm:px-5 gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <ListFilter className="h-3 w-3" /> Despesas
              </TabsTrigger>
              <TabsTrigger
                value="recurring"
                className="rounded-full text-xs px-4 sm:px-5 gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Repeat className="h-3 w-3" /> Recorrentes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Tab Estatísticas (donut + categorias) ─── */}
          <TabsContent value="stats" className="px-4 sm:px-6 pb-6 pt-2 mt-0">
            {isLoading ? (
              <Skeleton className="h-[500px] w-full rounded-2xl" />
            ) : (
              <CompanyStatsView
                transactions={expenseTransactions}
                categories={categories}
                type="expense"
                totalIncome={0}
                totalExpense={totalExpense}
                onTypeChange={() => {}}
                hideTypeToggle
                hideOuterCard
              />
            )}
          </TabsContent>

          {/* ─── Tab Despesas (lista individual) ─── */}
          <TabsContent value="entries" className="px-4 sm:px-6 pb-6 pt-2 mt-0">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
              </div>
            ) : expenseTransactions.length === 0 ? (
              <div className="rounded-2xl border bg-muted/20 p-12 text-center">
                <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="font-medium text-muted-foreground">Sem despesas neste período</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Total summary */}
                <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total despesas</p>
                    <p className="text-xl font-bold text-red-600 tabular-nums">{fmtCurrency(totalExpense)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Lançamentos</p>
                    <p className="text-xl font-bold tabular-nums">{expenseTransactions.length}</p>
                  </div>
                </div>

                {/* Individual list */}
                <div className="divide-y">
                  {expenseTransactions.map((tx) => {
                    const cat = categories.find((c) => c.name === tx.category)
                    const catColor = cat?.color && /^#[0-9a-f]{3,8}$/i.test(cat.color)
                      ? cat.color
                      : '#64748b'
                    const hasReceipt = tx.receipt_url && tx.receipt_url.startsWith('data:')
                    const displayDate = tx.invoice_date || tx.date
                    const amount = Number(tx.amount_gross || tx.amount_net)
                    return (
                      <div
                        key={tx.id}
                        className="group flex items-center gap-3 sm:gap-4 py-3 px-1 sm:px-2 hover:bg-muted/30 rounded-xl transition-colors"
                      >
                        {/* Avatar — receipt thumbnail or category icon */}
                        <button
                          type="button"
                          onClick={() => hasReceipt && setReceiptPreview(tx.receipt_url!)}
                          disabled={!hasReceipt}
                          className={`relative h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center transition-all ${
                            hasReceipt ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                          }`}
                          style={{ backgroundColor: `${catColor}15` }}
                          title={hasReceipt ? 'Ver recibo digitalizado' : tx.category}
                        >
                          <Receipt className="h-5 w-5" style={{ color: catColor }} />
                          {hasReceipt && (
                            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />
                          )}
                        </button>

                        {/* Name + date */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {tx.entity_name || tx.description || tx.category}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {displayDate ? fmtDate(displayDate) : '—'} · {tx.category}
                            {tx.is_recurring && ' · Recorrente'}
                          </p>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-red-600 tabular-nums whitespace-nowrap">
                            − {fmtCurrency(amount)}
                          </p>
                          {tx.status === 'draft' && (
                            <p className="text-[10px] text-amber-600 font-medium mt-0.5">Rascunho</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Tab Recorrentes (pagamentos recorrentes) ─── */}
          <TabsContent value="recurring" className="px-4 sm:px-6 pb-6 pt-2 mt-0">
            <RecurringExpensesManager
              categories={categories}
              month={month}
              year={year}
              generatedTemplateIds={generatedTemplateIds}
              onChanged={loadData}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Registar despesa — Sheet glassmorphic (foto → IA ou manual) */}
      <CompanyExpenseSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        categories={categories}
        partners={partners}
        onSaved={loadData}
      />

      {/* Receipt Preview Dialog */}
      <Dialog open={!!receiptPreview} onOpenChange={(v) => { if (!v) setReceiptPreview(null) }}>
        <DialogContent className="max-w-lg rounded-2xl p-2">
          <DialogTitle className="sr-only">Recibo Guardado</DialogTitle>
          <div className="-mx-6 -mt-6 mb-2 bg-neutral-900 rounded-t-2xl px-6 py-4">
            <h3 className="text-white font-semibold text-sm">Recibo Guardado</h3>
          </div>
          {receiptPreview && (
            <img
              src={receiptPreview}
              alt="Recibo"
              className="w-full max-h-[70vh] object-contain rounded-xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color, isCurrency = true }: {
  icon: React.ElementType; label: string; value: number; color: string; isCurrency?: boolean
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-500' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-md hover:bg-card/80">
      <div className={`rounded-xl p-2.5 w-fit ${c.bg}`}>
        <Icon className={`h-4 w-4 ${c.text}`} />
      </div>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">{label}</p>
      <p className={`text-xl font-bold tracking-tight ${c.text}`}>
        {isCurrency ? fmtCurrency(value) : value}
      </p>
    </div>
  )
}
