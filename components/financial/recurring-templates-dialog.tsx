'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, RefreshCw, Trash2, Pencil, Calendar, Repeat, CheckCircle2,
  Sparkles, Loader2, X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { CompanyRecurringTemplate, CompanyCategory, RecurringFrequency } from '@/types/financial'
import { RECURRING_FREQUENCIES } from '@/types/financial'

interface RecurringTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CompanyCategory[]
  /** Mês/ano actual da página — usado pelo botão "Gerar para este mês" */
  month: number
  year: number
  /** Chamado depois de gerar transacções recorrentes para o mês actual */
  onGenerated?: () => void
}

interface FormState {
  id?: string
  name: string
  category: string
  entity_name: string
  entity_nif: string
  description: string
  amount_net: string
  vat_pct: string
  frequency: RecurringFrequency
  day_of_month: string
  is_active: boolean
}

const emptyForm: FormState = {
  name: '',
  category: '',
  entity_name: '',
  entity_nif: '',
  description: '',
  amount_net: '',
  vat_pct: '23',
  frequency: 'monthly',
  day_of_month: '1',
  is_active: true,
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const FREQUENCY_LABELS: Record<RecurringFrequency, { label: string; short: string }> = {
  monthly: { label: 'Mensal', short: 'Todos os meses' },
  quarterly: { label: 'Trimestral', short: 'Jan · Abr · Jul · Out' },
  annual: { label: 'Anual', short: 'Janeiro' },
}

export function RecurringTemplatesDialog({
  open,
  onOpenChange,
  categories,
  month,
  year,
  onGenerated,
}: RecurringTemplatesDialogProps) {
  const [templates, setTemplates] = useState<CompanyRecurringTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/financial/recurring-templates')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Erro ao carregar templates')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchTemplates()
  }, [open, fetchTemplates])

  const openCreate = () => {
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (tpl: CompanyRecurringTemplate) => {
    setForm({
      id: tpl.id,
      name: tpl.name,
      category: tpl.category,
      entity_name: tpl.entity_name || '',
      entity_nif: tpl.entity_nif || '',
      description: tpl.description || '',
      amount_net: String(tpl.amount_net),
      vat_pct: String(tpl.vat_pct ?? 23),
      frequency: tpl.frequency,
      day_of_month: String(tpl.day_of_month || 1),
      is_active: tpl.is_active,
    })
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.category || !form.amount_net) {
      toast.error('Preencha nome, categoria e valor')
      return
    }
    const amount = parseFloat(form.amount_net)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor inválido')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        entity_name: form.entity_name.trim() || undefined,
        entity_nif: form.entity_nif.trim() || undefined,
        description: form.description.trim() || undefined,
        amount_net: amount,
        vat_pct: parseFloat(form.vat_pct) || 0,
        frequency: form.frequency,
        day_of_month: parseInt(form.day_of_month) || 1,
        is_active: form.is_active,
      }

      const url = form.id
        ? `/api/financial/recurring-templates/${form.id}`
        : '/api/financial/recurring-templates'
      const method = form.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao guardar')
      }

      toast.success(form.id ? 'Template actualizado' : 'Template criado')
      setFormOpen(false)
      fetchTemplates()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/financial/recurring-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Template desactivado')
      fetchTemplates()
    } catch {
      toast.error('Erro ao desactivar')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/financial/recurring-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(data.message || `${data.generated} despesas geradas`)
      onGenerated?.()
      fetchTemplates()
    } catch {
      toast.error('Erro ao gerar despesas')
    } finally {
      setGenerating(false)
    }
  }

  const activeTemplates = templates.filter((t) => t.is_active)
  const inactiveTemplates = templates.filter((t) => !t.is_active)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl rounded-2xl p-0 max-h-[90vh] flex flex-col">
          <DialogTitle className="sr-only">Despesas Recorrentes</DialogTitle>

          {/* Hero header */}
          <div className="bg-neutral-900 rounded-t-2xl px-6 py-5 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Repeat className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Despesas Recorrentes</h3>
                  <p className="text-neutral-400 text-xs mt-0.5">
                    Templates que geram despesas automaticamente todos os meses
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="rounded-full bg-white text-neutral-900 hover:bg-neutral-100 gap-1.5 shrink-0"
                onClick={openCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                Novo
              </Button>
            </div>

            {/* Generate button — sticky action */}
            <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium">Gerar para o mês actual</p>
                <p className="text-[10px] text-neutral-400">
                  Cria as despesas dos templates activos para o mês visível na página (sem duplicar)
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white gap-1.5 shrink-0"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Gerar
              </Button>
            </div>
          </div>

          {/* Templates list */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Repeat className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="font-medium text-sm">Sem templates recorrentes</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Cria um template para automatizar despesas que se repetem (rendas, seguros, software, etc.)
                </p>
                <Button size="sm" className="mt-4 rounded-full gap-1.5" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  Criar primeiro template
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {activeTemplates.map((tpl) => (
                  <TemplateRow
                    key={tpl.id}
                    template={tpl}
                    onEdit={() => openEdit(tpl)}
                    onDelete={() => handleDelete(tpl.id)}
                  />
                ))}

                {inactiveTemplates.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pt-4 pb-1">
                      Inactivos ({inactiveTemplates.length})
                    </p>
                    {inactiveTemplates.map((tpl) => (
                      <TemplateRow
                        key={tpl.id}
                        template={tpl}
                        onEdit={() => openEdit(tpl)}
                        onDelete={() => handleDelete(tpl.id)}
                        inactive
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogTitle className="sr-only">{form.id ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                {form.id ? <Pencil className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  {form.id ? 'Editar Template' : 'Novo Template Recorrente'}
                </h3>
                <p className="text-neutral-400 text-xs mt-0.5">
                  Define a despesa que será gerada periodicamente
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wider">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9 text-sm mt-1"
                placeholder="Ex: Renda escritório"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Frequência</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v: RecurringFrequency) => setForm({ ...form, frequency: v })}
                >
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRING_FREQUENCIES) as RecurringFrequency[]).map((f) => (
                      <SelectItem key={f} value={f}>{RECURRING_FREQUENCIES[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wider">Fornecedor</Label>
              <Input
                value={form.entity_name}
                onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                className="h-9 text-sm mt-1"
                placeholder="Nome do fornecedor (opcional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">NIF</Label>
                <Input
                  value={form.entity_nif}
                  onChange={(e) => setForm({ ...form, entity_nif: e.target.value })}
                  className="h-9 text-sm mt-1"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Dia do mês</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={form.day_of_month}
                  onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
                  className="h-9 text-sm mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Valor s/IVA</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_net}
                  onChange={(e) => setForm({ ...form, amount_net: e.target.value })}
                  className="h-9 text-sm mt-1"
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">IVA %</Label>
                <Input
                  type="number"
                  value={form.vat_pct}
                  onChange={(e) => setForm({ ...form, vat_pct: e.target.value })}
                  className="h-9 text-sm mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wider">Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-9 text-sm mt-1"
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-full" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {form.id ? 'Guardar alterações' : 'Criar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Template row ────────────────────────────────────────────────

function TemplateRow({
  template,
  onEdit,
  onDelete,
  inactive = false,
}: {
  template: CompanyRecurringTemplate
  onEdit: () => void
  onDelete: () => void
  inactive?: boolean
}) {
  const vatPct = template.vat_pct ?? 23
  const amountGross = Number(template.amount_net) * (1 + vatPct / 100)
  const freq = FREQUENCY_LABELS[template.frequency]

  return (
    <div
      className={`group flex items-center gap-3 rounded-2xl border bg-card/50 hover:bg-muted/30 px-4 py-3 transition-colors ${
        inactive ? 'opacity-60' : ''
      }`}
    >
      <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
        <Repeat className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{template.name}</p>
          <Badge variant="secondary" className="rounded-full text-[9px] h-4 px-1.5 bg-muted/60">
            {template.category}
          </Badge>
          {inactive && (
            <Badge variant="outline" className="rounded-full text-[9px] h-4 px-1.5 text-muted-foreground">
              Inactivo
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {freq.label} · dia {template.day_of_month || 1}
          </span>
          {template.entity_name && (
            <span className="truncate">· {template.entity_name}</span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums whitespace-nowrap">
          {fmtCurrency(amountGross)}
        </p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {fmtCurrency(Number(template.amount_net))} s/IVA
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onEdit}
          title="Editar"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              title="Desactivar"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desactivar template?</AlertDialogTitle>
              <AlertDialogDescription>
                O template <span className="font-semibold">{template.name}</span> deixa de gerar despesas.
                As despesas já criadas mantêm-se inalteradas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Desactivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
