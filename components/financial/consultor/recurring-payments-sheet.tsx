'use client'

import { useState } from 'react'
import { Plus, Pause, Play, Pencil, Trash2, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { usePersonalExpenseRecurrences } from '@/hooks/use-personal-expense-recurrences'
import { RecurrenceFormDialog } from './recurrence-form-dialog'
import type { PersonalExpenseRecurrence } from '@/types/personal-expense'
import { cn } from '@/lib/utils'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se passado, refetch externo após mudanças (para painéis montados). */
  onChanged?: () => void
}

export function RecurringPaymentsSheet({ open, onOpenChange, onChanged }: Props) {
  // Buscamos TODAS (activas + pausadas) para o consultor poder gerir as duas.
  const { data: items, loading, refetch } = usePersonalExpenseRecurrences({ activeOnly: false })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<PersonalExpenseRecurrence | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const handleSaved = () => {
    refetch()
    onChanged?.()
  }

  const togglePause = async (rec: PersonalExpenseRecurrence) => {
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

  const handleDelete = async (rec: PersonalExpenseRecurrence) => {
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

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (rec: PersonalExpenseRecurrence) => {
    setEditing(rec)
    setFormOpen(true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
            'w-full sm:max-w-[480px] rounded-l-3xl sm:rounded-l-3xl',
          )}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <RefreshCcw className="h-5 w-5" />
              Pagamentos mensais
            </SheetTitle>
            <SheetDescription className="text-xs">
              Regras que geram automaticamente despesas todos os meses.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
            <Button onClick={openAdd} className="w-full justify-start">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar pagamento mensal
            </Button>

            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">A carregar…</p>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
                <RefreshCcw className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Sem pagamentos mensais configurados.
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Subscrições, telemóvel, condomínio, etc.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      'rounded-xl bg-card border border-border/40 p-3',
                      !r.is_active && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start gap-2">
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
                            <> · Última: {new Date(r.last_generated_at).toLocaleDateString('pt-PT')}</>
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
                        onClick={() => togglePause(r)}
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
                            <AlertDialogAction onClick={() => handleDelete(r)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
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
