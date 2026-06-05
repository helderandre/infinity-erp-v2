'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CategorySelect } from './category-select'
import type { PersonalExpenseRecurrence } from '@/types/personal-expense'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se passado, o diálogo entra em modo edit. Caso contrário cria nova. */
  recurrence: PersonalExpenseRecurrence | null
  onSaved: () => void
}

interface FormState {
  category: string
  vendor_name: string
  vendor_nif: string
  amount_gross: string
  vat_pct: string
  day_of_month: string
  description: string
  notes: string
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function emptyForm(): FormState {
  return {
    category: 'Outras',
    vendor_name: '',
    vendor_nif: '',
    amount_gross: '',
    vat_pct: '',
    day_of_month: String(new Date().getDate()),
    description: '',
    notes: '',
  }
}

export function RecurrenceFormDialog({ open, onOpenChange, recurrence, onSaved }: Props) {
  const isEdit = !!recurrence
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (recurrence) {
      setForm({
        category: recurrence.category,
        vendor_name: recurrence.vendor_name ?? '',
        vendor_nif: recurrence.vendor_nif ?? '',
        amount_gross: String(recurrence.amount_gross ?? ''),
        vat_pct: recurrence.vat_pct != null ? String(recurrence.vat_pct) : '',
        day_of_month: String(recurrence.day_of_month),
        description: recurrence.description ?? '',
        notes: recurrence.notes ?? '',
      })
    } else if (open) {
      setForm(emptyForm())
    }
  }, [recurrence, open])

  const handleSave = async () => {
    if (!form.amount_gross || isNaN(Number(form.amount_gross))) {
      toast.error('Indica o valor.')
      return
    }
    const day = Number(form.day_of_month)
    if (!day || day < 1 || day > 31) {
      toast.error('Dia do mês inválido (1-31).')
      return
    }
    setSaving(true)
    try {
      const body: any = {
        category: form.category || 'Outras',
        vendor_name: form.vendor_name || null,
        vendor_nif: form.vendor_nif || null,
        amount_gross: Number(form.amount_gross),
        vat_pct: form.vat_pct ? Number(form.vat_pct) : null,
        day_of_month: day,
        description: form.description || null,
        notes: form.notes || null,
      }
      if (!isEdit) {
        body.frequency = 'monthly'
        body.start_date = todayIso()
        body.is_active = true
      }
      const url = isEdit
        ? `/api/agent-personal-expense-recurrences/${recurrence!.id}`
        : '/api/agent-personal-expense-recurrences'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Erro a guardar')
      }
      toast.success(isEdit ? 'Pagamento mensal actualizado.' : 'Pagamento mensal criado.')
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar pagamento mensal' : 'Novo pagamento mensal'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cria ou actualiza uma regra que gera automaticamente uma despesa todos os meses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Categoria">
            <CategorySelect
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
            />
          </Field>

          <Field label="Entidade">
            <Input
              value={form.vendor_name}
              onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
              placeholder="Ex: NOS, Adobe, condomínio…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="NIF (opcional)">
              <Input
                value={form.vendor_nif}
                onChange={(e) => setForm({ ...form, vendor_nif: e.target.value })}
              />
            </Field>
            <Field label="Dia do mês">
              <Input
                type="number"
                min="1"
                max="31"
                value={form.day_of_month}
                onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Valor (€)">
              <Input
                type="number"
                step="0.01"
                value={form.amount_gross}
                onChange={(e) => setForm({ ...form, amount_gross: e.target.value })}
              />
            </Field>
            <Field label="IVA %">
              <Input
                type="number"
                step="1"
                value={form.vat_pct}
                onChange={(e) => setForm({ ...form, vat_pct: e.target.value })}
                placeholder="23"
              />
            </Field>
          </div>

          <Field label="Descrição">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Subscrição mensal, condomínio, etc."
            />
          </Field>

          <Field label="Notas">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {!isEdit && (
            <p className="text-[11px] text-muted-foreground">
              Em meses com menos dias usa-se o último dia disponível. A primeira despesa é gerada
              pelo cron quando o dia bater.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {isEdit ? 'Guardar alterações' : 'Criar pagamento mensal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
