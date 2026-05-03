'use client'

import { useEffect, useState } from 'react'
import { FileText, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DEFAULT_PERSONAL_EXPENSE_CATEGORIES } from '@/lib/financial/personal-expense-categories'
import type { PersonalExpense } from '@/types/personal-expense'

interface Props {
  expense: PersonalExpense | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function PersonalExpenseDetailSheet({ expense, onOpenChange, onChanged }: Props) {
  const open = !!expense
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (expense) {
      setForm({
        expense_date: expense.expense_date,
        category: expense.category,
        vendor_name: expense.vendor_name ?? '',
        vendor_nif: expense.vendor_nif ?? '',
        amount_gross: String(expense.amount_gross ?? ''),
        amount_net: expense.amount_net != null ? String(expense.amount_net) : '',
        vat_amount: expense.vat_amount != null ? String(expense.vat_amount) : '',
        vat_pct: expense.vat_pct != null ? String(expense.vat_pct) : '',
        invoice_number: expense.invoice_number ?? '',
        description: expense.description ?? '',
        notes: expense.notes ?? '',
      })
    }
  }, [expense])

  if (!expense || !form) return null

  const isImage = expense.receipt_mimetype?.startsWith('image/') ?? false
  const isPdf = expense.receipt_mimetype === 'application/pdf'

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        expense_date: form.expense_date,
        category: form.category,
        vendor_name: form.vendor_name || null,
        vendor_nif: form.vendor_nif || null,
        amount_gross: Number(form.amount_gross),
        amount_net: form.amount_net ? Number(form.amount_net) : null,
        vat_amount: form.vat_amount ? Number(form.vat_amount) : null,
        vat_pct: form.vat_pct ? Number(form.vat_pct) : null,
        invoice_number: form.invoice_number || null,
        description: form.description || null,
        notes: form.notes || null,
      }
      const res = await fetch(`/api/agent-personal-expenses/${expense.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Erro a guardar')
      }
      toast.success('Despesa actualizada.')
      onChanged()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/agent-personal-expenses/${expense.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro a apagar')
      toast.success('Despesa eliminada.')
      onChanged()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a apagar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{expense.vendor_name || expense.description || 'Despesa'}</SheetTitle>
          <SheetDescription>
            {new Date(expense.expense_date).toLocaleDateString('pt-PT')} · {expense.category}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 sm:px-6 space-y-4 pb-6">
          {/* Recibo */}
          {expense.receipt_url && (
            <div className="rounded-xl ring-1 ring-border/40 overflow-hidden bg-muted/30">
              {isImage ? (
                <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                  <img src={expense.receipt_url} alt="Recibo" className="w-full max-h-[300px] object-contain" />
                </a>
              ) : isPdf ? (
                <a
                  href={expense.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-5 w-5" />
                  Abrir PDF
                </a>
              ) : null}
            </div>
          )}

          {/* Form */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Data">
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </Field>
            <Field label="Categoria">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_PERSONAL_EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Entidade">
            <Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="NIF">
              <Input value={form.vendor_nif} onChange={(e) => setForm({ ...form, vendor_nif: e.target.value })} />
            </Field>
            <Field label="Nº Documento">
              <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Total c/ IVA">
              <Input type="number" step="0.01" value={form.amount_gross}
                onChange={(e) => setForm({ ...form, amount_gross: e.target.value })} />
            </Field>
            <Field label="Sem IVA">
              <Input type="number" step="0.01" value={form.amount_net}
                onChange={(e) => setForm({ ...form, amount_net: e.target.value })} />
            </Field>
            <Field label="IVA %">
              <Input type="number" step="1" value={form.vat_pct}
                onChange={(e) => setForm({ ...form, vat_pct: e.target.value })} />
            </Field>
          </div>

          <Field label="Descrição">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          <Field label="Notas">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          {/* Acções */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-red-600">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar despesa</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem a certeza? O recibo e o registo serão apagados de forma permanente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                    {deleting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
