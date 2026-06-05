'use client'

import { useState } from 'react'
import { Plus, Pause, Play, Pencil, Trash2, RefreshCcw, ShoppingBag, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { usePersonalExpenseRecurrences } from '@/hooks/use-personal-expense-recurrences'
import { useMarketingSubscriptions } from '@/hooks/use-marketing-subscriptions'
import { RecurrenceFormDialog } from './recurrence-form-dialog'
import type { PersonalExpenseRecurrence } from '@/types/personal-expense'
import { cn } from '@/lib/utils'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const BILLING_LABEL: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se passado, refetch externo após mudanças (para painéis montados). */
  onChanged?: () => void
}

export function RecurringPaymentsSheet({ open, onOpenChange, onChanged }: Props) {
  const personal = usePersonalExpenseRecurrences({ activeOnly: false })
  const marketing = useMarketingSubscriptions()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<PersonalExpenseRecurrence | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const handleSaved = () => {
    personal.refetch()
    marketing.refetch()
    onChanged?.()
  }

  const togglePersonalPause = async (rec: PersonalExpenseRecurrence) => {
    setBusyId(rec.id)
    try {
      const res = await fetch(`/api/agent-personal-expense-recurrences/${rec.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: !rec.is_active }),
      })
      if (!res.ok) throw new Error()
      toast.success(rec.is_active ? 'Pausado.' : 'Reactivado.')
      handleSaved()
    } catch {
      toast.error('Erro a actualizar.')
    } finally {
      setBusyId(null)
    }
  }

  const handlePersonalDelete = async (rec: PersonalExpenseRecurrence) => {
    setBusyId(rec.id)
    try {
      const res = await fetch(`/api/agent-personal-expense-recurrences/${rec.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Pagamento mensal removido.')
      handleSaved()
    } catch {
      toast.error('Erro a remover.')
    } finally {
      setBusyId(null)
    }
  }

  const handleSubscriptionCancel = async (id: string, immediate: boolean) => {
    setBusyId(id)
    try {
      await marketing.cancelSubscription(id, immediate)
      toast.success(immediate ? 'Subscrição cancelada.' : 'Cancelamento agendado para fim do período.')
      handleSaved()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a cancelar subscrição.')
    } finally {
      setBusyId(null)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (rec: PersonalExpenseRecurrence) => {
    setEditing(rec)
    setFormOpen(true)
  }

  const personalItems = personal.data
  const subscriptionItems = marketing.subscriptions.filter((s) => s.status !== 'cancelled')
  const totalCount = personalItems.length + subscriptionItems.length

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
            'w-full sm:max-w-[520px] rounded-l-3xl sm:rounded-l-3xl',
          )}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <RefreshCcw className="h-5 w-5" />
              Pagamentos mensais
            </SheetTitle>
            <SheetDescription className="text-xs">
              Subscrições da loja e regras pessoais que geram despesas todos os meses.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            <Button onClick={openAdd} className="w-full justify-start">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar pagamento mensal pessoal
            </Button>

            {/* ─── Subscrições da loja ─── */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-3.5 w-3.5 text-sky-600" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
                  Subscrições da loja
                </p>
                <Badge variant="outline" className="text-[10px]">{subscriptionItems.length}</Badge>
                <a
                  href="/dashboard/marketing/loja"
                  className="ml-auto text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  Encomendas <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>

              {marketing.loading ? (
                <p className="text-xs text-muted-foreground py-2">A carregar…</p>
              ) : subscriptionItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  Sem subscrições activas na loja.
                </p>
              ) : (
                <ul className="space-y-2">
                  {subscriptionItems.map((s) => {
                    const willCancel = s.cancel_at_period_end === true
                    const itemName = s.catalog_item?.name ?? 'Subscrição'
                    return (
                      <li
                        key={s.id}
                        className={cn(
                          'rounded-xl bg-card border border-border/40 p-3',
                          willCancel && 'opacity-70',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="rounded-lg p-2 bg-sky-500/10 text-sky-600 shrink-0">
                            <ShoppingBag className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium truncate">{itemName}</p>
                              {willCancel && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                  Termina no fim do período
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {BILLING_LABEL[s.billing_cycle] ?? s.billing_cycle}
                              {' · Próxima cobrança '}
                              {fmtDate(s.next_billing_date)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-red-600 shrink-0">
                            {fmtCurrency(Number(s.price_per_cycle))}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border/30">
                          {!willCancel ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px] text-amber-700"
                                  disabled={busyId === s.id}
                                >
                                  Cancelar no fim do período
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar subscrição?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A subscrição mantém-se activa até {fmtDate(s.current_period_end)} e depois termina automaticamente. Não és cobrado novamente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleSubscriptionCancel(s.id, false)}>
                                    Confirmar cancelamento
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={async () => {
                                setBusyId(s.id)
                                try {
                                  await marketing.reactivateSubscription(s.id)
                                  toast.success('Subscrição reactivada.')
                                  handleSaved()
                                } catch (e: any) {
                                  toast.error(e?.message ?? 'Erro')
                                } finally {
                                  setBusyId(null)
                                }
                              }}
                              disabled={busyId === s.id}
                            >
                              <Play className="h-3 w-3 mr-1" /> Reactivar
                            </Button>
                          )}
                          <a
                            href="/dashboard/marketing/loja"
                            className="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-md"
                          >
                            <Pencil className="h-3 w-3 mr-0.5" />
                            Editar nas encomendas
                          </a>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* ─── Pagamentos pessoais ─── */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCcw className="h-3.5 w-3.5 text-violet-600" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
                  Pagamentos pessoais
                </p>
                <Badge variant="outline" className="text-[10px]">{personalItems.length}</Badge>
              </div>

              {personal.loading ? (
                <p className="text-xs text-muted-foreground py-2">A carregar…</p>
              ) : personalItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/40 p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    Sem pagamentos mensais pessoais configurados.
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Telemóvel, condomínio, software, etc.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {personalItems.map((r) => (
                    <li
                      key={r.id}
                      className={cn(
                        'rounded-xl bg-card border border-border/40 p-3',
                        !r.is_active && 'opacity-60',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-lg p-2 bg-violet-500/10 text-violet-600 shrink-0">
                          <RefreshCcw className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium truncate">
                              {r.vendor_name || r.description || r.category}
                            </p>
                            {!r.is_active && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                Pausado
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Dia {r.day_of_month} · {r.category}
                            {r.last_generated_at && (
                              <> · Última: {fmtDate(r.last_generated_at)}</>
                            )}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-red-600 shrink-0">
                          {fmtCurrency(Number(r.amount_gross))}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border/30">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => togglePersonalPause(r)}
                          disabled={busyId === r.id}
                        >
                          {r.is_active ? (
                            <><Pause className="h-3 w-3 mr-1" /> Pausar</>
                          ) : (
                            <><Play className="h-3 w-3 mr-1" /> Reactivar</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => openEdit(r)}
                          disabled={busyId === r.id}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] text-red-600"
                              disabled={busyId === r.id}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Remover
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
                              <AlertDialogAction onClick={() => handlePersonalDelete(r)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {totalCount === 0 && !personal.loading && !marketing.loading && (
              <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
                <RefreshCcw className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Sem pagamentos mensais.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <RecurrenceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        recurrence={editing}
        onSaved={handleSaved}
      />
    </>
  )
}
