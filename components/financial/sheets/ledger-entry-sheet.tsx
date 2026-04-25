'use client'

import { useState } from 'react'
import { Pencil, Trash2, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency, formatDateTime } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { FinanceiroSheet } from './financeiro-sheet'
import type { LedgerEntry, LedgerScope } from '@/lib/financial/ledger-types'

interface LedgerEntrySheetProps {
  entry: LedgerEntry | null
  scope: LedgerScope
  onClose: () => void
  onChanged?: () => void
}

// Sheet com os detalhes de uma entrada do ledger.
//   - Empresa (`company_transactions`): editável e eliminável (GET/PUT/DELETE)
//   - Consultor (`conta_corrente_transactions`): leitura só. As entradas são
//     geradas automaticamente a partir de marketing_orders / deal_payments,
//     pelo que não fazem sentido editar livremente.
export function LedgerEntrySheet({ entry, scope, onClose, onChanged }: LedgerEntrySheetProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [description, setDescription] = useState('')
  const [amountGross, setAmountGross] = useState('')
  const [notes, setNotes] = useState('')

  const open = entry !== null
  const editable = scope.kind === 'company'

  // Reset form when a new entry opens
  if (entry && !editing) {
    if (description !== entry.description) setDescription(entry.description)
    if (amountGross !== String(entry.amount)) setAmountGross(String(entry.amount))
  }

  const handleEnterEdit = () => {
    if (!entry) return
    setDescription(entry.description)
    setAmountGross(String(entry.amount))
    setNotes('')
    setEditing(true)
  }

  const handleSave = async () => {
    if (!entry) return
    setSaving(true)
    try {
      const res = await fetch(`/api/financial/company-transactions/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount_gross: Number(amountGross),
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Erro ao guardar')
      }
      toast.success('Entrada actualizada')
      setEditing(false)
      onChanged?.()
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!entry) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/financial/company-transactions/${entry.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Erro ao eliminar')
      }
      toast.success('Entrada eliminada')
      setConfirmDelete(false)
      onChanged?.()
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao eliminar')
    } finally {
      setDeleting(false)
    }
  }

  if (!entry) {
    return (
      <FinanceiroSheet open={false} onOpenChange={() => {}} title="">
        <div />
      </FinanceiroSheet>
    )
  }

  const isIn = entry.side === 'in'
  const subtitle = `${entry.categoryLabel} · ${formatDateTime(entry.date)}`

  return (
    <>
      <FinanceiroSheet
        open={open}
        onOpenChange={(v) => !v && onClose()}
        title={entry.description || (isIn ? 'Entrada' : 'Saída')}
        accent={
          <span
            className={cn(
              'inline-flex h-2 w-2 rounded-full',
              isIn ? 'bg-emerald-500' : 'bg-red-500'
            )}
          />
        }
        subtitle={subtitle}
        footer={
          editable ? (
            editing ? (
              <>
                <Button variant="ghost" onClick={() => setEditing(false)} className="rounded-full">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="rounded-full gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-full gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </Button>
                <Button onClick={handleEnterEdit} className="rounded-full gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button variant="ghost" onClick={onClose} className="rounded-full">
                  Fechar
                </Button>
              </>
            )
          ) : (
            <Button variant="ghost" onClick={onClose} className="rounded-full">
              Fechar
            </Button>
          )
        }
      >
        {/* Amount banner */}
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'rounded-full p-2.5',
              isIn ? 'bg-emerald-500/10' : 'bg-red-500/10'
            )}>
              {isIn
                ? <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                : <ArrowDownCircle className="h-5 w-5 text-red-600" />
              }
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {isIn ? 'Entrada' : 'Saída'}
              </p>
              <p className={cn(
                'text-2xl font-bold tracking-tight tabular-nums',
                isIn ? 'text-emerald-600' : 'text-red-600'
              )}>
                {isIn ? '+' : '−'} {formatCurrency(entry.amount)}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full">{entry.categoryLabel}</Badge>
        </div>

        {/* Detail fields */}
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor (bruto)</Label>
              <Input
                type="number"
                step="0.01"
                value={amountGross}
                onChange={(e) => setAmountGross(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="rounded-xl"
              />
            </div>
          </div>
        ) : (
          <dl className="space-y-3">
            <DetailRow label="Data" value={formatDateTime(entry.date)} />
            <DetailRow label="Categoria" value={entry.categoryLabel} />
            <DetailRow label="Descrição" value={entry.description || '—'} />
            {entry.balanceAfter != null && (
              <DetailRow label="Saldo após" value={formatCurrency(entry.balanceAfter)} />
            )}
            {!editable && (
              <p className="text-xs text-muted-foreground pt-2">
                Esta entrada foi gerada automaticamente. Para editar, vai à origem (encomenda
                da loja, pagamento de comissão, etc.).
              </p>
            )}
          </dl>
        )}
      </FinanceiroSheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção é irreversível. A entrada será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</dt>
      <dd className="text-sm font-medium text-right">{value}</dd>
    </div>
  )
}
