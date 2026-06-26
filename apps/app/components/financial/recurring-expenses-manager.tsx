'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, RefreshCw, Pencil, Trash2, Repeat, Calendar, Loader2,
  Users, Monitor, Building, Globe, Briefcase, CheckCircle2, Clock,
  Camera, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { categoryHex, categoryIcon } from '@/lib/financial/company-category-visuals'
import type {
  CompanyRecurringTemplate, CompanyCategory, RecurringFrequency, ReceiptScanResult,
} from '@/types/financial'
import { RECURRING_FREQUENCIES } from '@/types/financial'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const FREQUENCY_HINT: Record<RecurringFrequency, string> = {
  monthly: 'Todos os meses',
  quarterly: 'Jan · Abr · Jul · Out',
  annual: 'Uma vez por ano (Janeiro)',
}

// ── Helpers de calendário ────────────────────────────────────────────────────
const lastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

function qualifies(freq: RecurringFrequency, month: number) {
  if (freq === 'monthly') return true
  if (freq === 'quarterly') return [1, 4, 7, 10].includes(month)
  return month === 1 // annual
}

/** Próxima ocorrência (a partir de hoje, inclusive). */
function nextOccurrence(freq: RecurringFrequency, day: number): Date | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let y = now.getFullYear()
  let m = now.getMonth() + 1
  for (let i = 0; i < 24; i++) {
    if (qualifies(freq, m)) {
      const d = Math.min(day || 1, lastDayOfMonth(y, m))
      const cand = new Date(y, m - 1, d)
      if (cand >= today) return cand
    }
    m++
    if (m > 12) { m = 1; y++ }
  }
  return null
}

/** Valor bruto equivalente por mês (para o "compromisso mensal estimado"). */
function monthlyEquivalentGross(tpl: CompanyRecurringTemplate) {
  const gross = Number(tpl.amount_net) * (1 + (tpl.vat_pct ?? 23) / 100)
  if (tpl.frequency === 'monthly') return gross
  if (tpl.frequency === 'quarterly') return gross / 3
  return gross / 12 // annual
}

const grossOf = (tpl: CompanyRecurringTemplate) =>
  Number(tpl.amount_net) * (1 + (tpl.vat_pct ?? 23) / 100)

// ── Presets de criação rápida ────────────────────────────────────────────────
interface Preset {
  label: string
  icon: React.ElementType
  category: string
  vat: number
  frequency: RecurringFrequency
  day: number
  placeholder: string
}
const PRESETS: Preset[] = [
  { label: 'Salário', icon: Users, category: 'Salários', vat: 0, frequency: 'monthly', day: 1, placeholder: 'Ex: Salário — João Silva' },
  { label: 'Software / Subscrição', icon: Monitor, category: 'Software & Subscrições', vat: 23, frequency: 'monthly', day: 1, placeholder: 'Ex: Subscrição Adobe' },
  { label: 'Renda', icon: Building, category: 'Rendas', vat: 0, frequency: 'monthly', day: 1, placeholder: 'Ex: Renda escritório' },
  { label: 'Portal imobiliário', icon: Globe, category: 'Portais Imobiliários', vat: 23, frequency: 'monthly', day: 1, placeholder: 'Ex: Idealista' },
  { label: 'Contabilidade', icon: Briefcase, category: 'Serviços Profissionais', vat: 23, frequency: 'monthly', day: 1, placeholder: 'Ex: Avença contabilidade' },
]

const normCat = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

// ── Form state ───────────────────────────────────────────────────────────────
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
}
const emptyForm: FormState = {
  name: '', category: '', entity_name: '', entity_nif: '', description: '',
  amount_net: '', vat_pct: '23', frequency: 'monthly', day_of_month: '1',
}

interface Props {
  categories: CompanyCategory[]
  /** Mês/ano seleccionado na página — alvo do botão "Gerar". */
  month: number
  year: number
  /** Ids de templates já gerados no mês visível (para o estado por linha). */
  generatedTemplateIds: Set<string>
  /** Chamado após gerar/alterar — para a página recarregar as transacções. */
  onChanged?: () => void
}

export function RecurringExpensesManager({
  categories, month, year, generatedTemplateIds, onChanged,
}: Props) {
  const [templates, setTemplates] = useState<CompanyRecurringTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [presetPlaceholder, setPresetPlaceholder] = useState('Ex: Renda escritório')
  const [scanning, setScanning] = useState(false)
  const [scanConfidence, setScanConfidence] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')

  // Lookup visual por nome de categoria (cor + ícone).
  const visualByCat = useMemo(() => {
    const map = new Map<string, { color: string | null; icon: string | null }>()
    categories.forEach((c) => map.set(normCat(c.name), { color: c.color, icon: c.icon }))
    return map
  }, [categories])

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/financial/recurring-templates')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Erro ao carregar pagamentos recorrentes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const active = templates.filter((t) => t.is_active)
  const paused = templates.filter((t) => !t.is_active)

  const monthlyCommitment = useMemo(
    () => active.reduce((s, t) => s + monthlyEquivalentGross(t), 0),
    [active],
  )
  const pendingThisMonth = active.filter(
    (t) => qualifies(t.frequency, month) && !generatedTemplateIds.has(t.id),
  ).length

  // ── Acções ──
  const openCreate = (preset?: Preset) => {
    if (preset) {
      const matched = expenseCategories.find((c) => normCat(c.name) === normCat(preset.category))
      setForm({
        ...emptyForm,
        category: matched?.name ?? '',
        vat_pct: String(preset.vat),
        frequency: preset.frequency,
        day_of_month: String(preset.day),
      })
      setPresetPlaceholder(preset.placeholder)
    } else {
      setForm(emptyForm)
      setPresetPlaceholder('Ex: Renda escritório')
    }
    setScanConfidence(null)
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
    })
    setPresetPlaceholder('Ex: Renda escritório')
    setScanConfidence(null)
    setFormOpen(true)
  }

  // Foto da despesa → IA preenche os campos (o que é, valor, IVA, dia, etc.).
  const handleScanFile = async (file: File) => {
    setScanning(true)
    setScanConfidence(null)
    try {
      let toScan: File = file
      if (file.type.startsWith('image/') && file.type !== 'image/heic' && file.type !== 'image/heif') {
        try {
          const compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true })
          toScan = new File([compressed], file.name, { type: compressed.type })
        } catch { /* não bloqueia */ }
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Falha a ler ficheiro'))
        reader.readAsDataURL(toScan)
      })
      const res = await fetch('/api/financial/scan-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      if (!res.ok) {
        toast.message('Não foi possível ler o documento — preenche os campos manualmente.')
        return
      }
      const result: ReceiptScanResult = await res.json()
      const matched = expenseCategories.find(
        (c) => result.category && normCat(c.name) === normCat(result.category),
      )
      // Dia do mês a partir da data da fatura (data de começo da recorrência).
      const day = result.invoice_date
        ? String(Math.min(Math.max(parseInt(result.invoice_date.slice(8, 10), 10) || 1, 1), 31))
        : undefined
      setForm((prev) => ({
        ...prev,
        name: prev.name || result.description || result.entity_name || '',
        category: matched?.name ?? prev.category,
        entity_name: result.entity_name ?? prev.entity_name,
        entity_nif: result.entity_nif ?? prev.entity_nif,
        description: result.description ?? prev.description,
        amount_net: result.amount_net != null ? String(result.amount_net) : prev.amount_net,
        vat_pct: result.vat_pct != null ? String(result.vat_pct) : prev.vat_pct,
        day_of_month: day ?? prev.day_of_month,
      }))
      setScanConfidence(typeof result.confidence === 'number' ? result.confidence : null)
      toast.success('Documento lido — confirma os dados.')
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a processar documento')
    } finally {
      setScanning(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.category || !form.amount_net) {
      toast.error('Preenche o nome, a categoria e o valor')
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
        is_active: true,
      }
      const url = form.id
        ? `/api/financial/recurring-templates/${form.id}`
        : '/api/financial/recurring-templates'
      const res = await fetch(url, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao guardar')
      }
      toast.success(form.id ? 'Pagamento recorrente actualizado' : 'Pagamento recorrente criado')
      setFormOpen(false)
      fetchTemplates()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const togglePause = async (tpl: CompanyRecurringTemplate) => {
    // Optimista
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, is_active: !t.is_active } : t)))
    try {
      const res = await fetch(`/api/financial/recurring-templates/${tpl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tpl.is_active }),
      })
      if (!res.ok) throw new Error()
      toast.success(tpl.is_active ? 'Pagamento pausado' : 'Pagamento reactivado')
    } catch {
      setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, is_active: tpl.is_active } : t)))
      toast.error('Erro ao actualizar')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/financial/recurring-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Pagamento recorrente eliminado')
      fetchTemplates()
    } catch {
      toast.error('Erro ao eliminar')
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
      toast.success(data.generated > 0
        ? `${data.generated} despesa(s) gerada(s) para ${MONTHS[month - 1]}`
        : 'Nada a gerar — já estava tudo lançado')
      onChanged?.()
      fetchTemplates()
    } catch {
      toast.error('Erro ao gerar despesas')
    } finally {
      setGenerating(false)
    }
  }

  const visualFor = (categoryName: string) => {
    const v = visualByCat.get(normCat(categoryName))
    return { hex: categoryHex(v?.color, 0), Icon: categoryIcon(v?.icon) }
  }

  return (
    <div className="space-y-5">
      {/* ── Resumo + acções ─────────────────────────────────────────── */}
      <div className="rounded-2xl bg-neutral-900 text-white dark:bg-neutral-800 dark:ring-1 dark:ring-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
              <Repeat className="h-4 w-4" />
              Compromisso mensal estimado
            </div>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums mt-1">
              {fmtCurrency(monthlyCommitment)}
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">
              {active.length} activo{active.length === 1 ? '' : 's'}
              {paused.length > 0 && ` · ${paused.length} em pausa`}
              {pendingThisMonth > 0 && ` · ${pendingThisMonth} por gerar em ${MONTHS[month - 1]}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline"
              className="rounded-full bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white gap-1.5"
              onClick={handleGenerate}
              disabled={generating || pendingThisMonth === 0}
              title={pendingThisMonth === 0
                ? `Nada por gerar em ${MONTHS[month - 1]}`
                : `Gerar as despesas dos pagamentos activos para ${MONTHS[month - 1]} ${year}`}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Gerar {MONTHS[month - 1]}
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-white text-neutral-900 hover:bg-neutral-100 gap-1.5"
              onClick={() => openCreate()}
            >
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          </div>
        </div>
      </div>

      {/* ── Lista ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState presets={PRESETS} onPick={openCreate} onBlank={() => openCreate()} />
      ) : (
        <div className="space-y-2">
          {active.map((tpl) => (
            <TemplateRow
              key={tpl.id}
              template={tpl}
              visual={visualFor(tpl.category)}
              generated={generatedTemplateIds.has(tpl.id)}
              pageMonth={month}
              onEdit={() => openEdit(tpl)}
              onToggle={() => togglePause(tpl)}
              onDelete={() => handleDelete(tpl.id)}
            />
          ))}

          {paused.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium pt-3 pb-1 px-1">
                Em pausa ({paused.length})
              </p>
              {paused.map((tpl) => (
                <TemplateRow
                  key={tpl.id}
                  template={tpl}
                  visual={visualFor(tpl.category)}
                  generated={false}
                  pageMonth={month}
                  onEdit={() => openEdit(tpl)}
                  onToggle={() => togglePause(tpl)}
                  onDelete={() => handleDelete(tpl.id)}
                  paused
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Form criar/editar — Sheet glassmorphic ─────────────────── */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent
          side="right"
          className={cn(
            'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
            'w-full sm:max-w-[480px] rounded-l-3xl',
          )}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              {form.id ? <Pencil className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
              {form.id ? 'Editar pagamento' : 'Novo pagamento recorrente'}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Gera a despesa automaticamente em cada período. Tira foto da fatura e a IA preenche.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
            {/* Foto da despesa → IA preenche o que é, valor, IVA, dia… */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleScanFile(f)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className={cn(
                'w-full rounded-2xl border-2 border-dashed border-border/60 bg-card/60 px-4 py-3',
                'flex items-center justify-center gap-2 text-center',
                'hover:bg-muted/50 hover:border-border transition-colors disabled:opacity-60',
              )}
            >
              {scanning ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">A ler o documento com IA…</span>
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Tirar foto da despesa</span>
                </>
              )}
            </button>
            {scanConfidence != null && (
              <div className="flex justify-center">
                <Badge variant="outline" className="text-[10px]">
                  <Sparkles className="h-3 w-3 mr-1" /> IA: {Math.round(scanConfidence * 100)}% — confirma os dados
                </Badge>
              </div>
            )}

            {/* Presets (só na criação) */}
            {!form.id && (
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => openCreate(p)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 hover:bg-muted px-2.5 py-1 text-[11px] font-medium transition-colors"
                  >
                    <p.icon className="h-3 w-3 text-muted-foreground" />
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wider">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9 text-sm mt-1"
                placeholder={presetPlaceholder}
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
                <Select value={form.frequency} onValueChange={(v: RecurringFrequency) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRING_FREQUENCIES) as RecurringFrequency[]).map((f) => (
                      <SelectItem key={f} value={f}>{RECURRING_FREQUENCIES[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1.5 px-0.5">{FREQUENCY_HINT[form.frequency]}</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Valor s/IVA</Label>
                <CurrencyInput
                  value={form.amount_net ? Number(form.amount_net) : null}
                  onChange={(v) => setForm({ ...form, amount_net: v != null ? String(v) : '' })}
                  className="h-9 text-sm mt-1"
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

            {/* Bruto calculado */}
            {form.amount_net && (
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Total c/ IVA por ocorrência</span>
                <span className="font-semibold tabular-nums">
                  {fmtCurrency(Number(form.amount_net) * (1 + (parseFloat(form.vat_pct) || 0) / 100))}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Fornecedor</Label>
                <Input
                  value={form.entity_name}
                  onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                  className="h-9 text-sm mt-1"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Dia do mês</Label>
                <Input
                  type="number" min="1" max="31"
                  value={form.day_of_month}
                  onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
                  className="h-9 text-sm mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wider">NIF / Descrição</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  value={form.entity_nif}
                  onChange={(e) => setForm({ ...form, entity_nif: e.target.value })}
                  className="h-9 text-sm"
                  placeholder="NIF (opcional)"
                />
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="h-9 text-sm"
                  placeholder="Descrição (opcional)"
                />
              </div>
            </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2 shrink-0">
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || scanning}>
              {submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {form.id ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Linha de template ───────────────────────────────────────────────────────

function TemplateRow({
  template, visual, generated, pageMonth, onEdit, onToggle, onDelete, paused = false,
}: {
  template: CompanyRecurringTemplate
  visual: { hex: string; Icon: React.ElementType }
  generated: boolean
  pageMonth: number
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  paused?: boolean
}) {
  const freqLabel = RECURRING_FREQUENCIES[template.frequency]
  const next = nextOccurrence(template.frequency, template.day_of_month || 1)
  const qualifiesNow = qualifies(template.frequency, pageMonth)
  const Glyph = visual.Icon

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-2xl border bg-card/50 hover:bg-muted/30 px-3.5 py-3 transition-colors',
        paused && 'opacity-60',
      )}
    >
      <div
        className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${visual.hex}1a` }}
      >
        <Glyph className="h-4 w-4" style={{ color: visual.hex }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{template.name}</p>
          <Badge variant="secondary" className="rounded-full text-[9px] h-4 px-1.5 bg-muted/60 font-normal">
            {template.category}
          </Badge>
          {/* Estado do mês visível */}
          {!paused && (generated ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Gerada
            </span>
          ) : qualifiesNow ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
              <Clock className="h-3 w-3" /> Por gerar
            </span>
          ) : null)}
        </div>
        <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {freqLabel} · dia {template.day_of_month || 1}
          </span>
          {next && !paused && <span className="hidden sm:inline">· próxima {next.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span>}
          {template.entity_name && <span className="truncate">· {template.entity_name}</span>}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums whitespace-nowrap">{fmtCurrency(grossOf(template))}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {fmtCurrency(Number(template.amount_net))} s/IVA
        </p>
      </div>

      {/* Acções */}
      <div className="flex items-center gap-1 shrink-0 pl-1">
        <Switch
          checked={template.is_active}
          onCheckedChange={onToggle}
          className="scale-90 data-[state=checked]:bg-emerald-500"
          title={template.is_active ? 'Pausar' : 'Reactivar'}
        />
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={onEdit} title="Editar"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 rounded-full text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              title="Eliminar"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar pagamento recorrente?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-semibold">{template.name}</span> deixa de existir e de gerar despesas.
                As despesas já lançadas mantêm-se. Esta acção é irreversível —
                para apenas parar a geração, usa o interruptor de pausa.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({
  presets, onPick, onBlank,
}: { presets: Preset[]; onPick: (p: Preset) => void; onBlank: () => void }) {
  return (
    <div className="rounded-2xl border bg-card/50 p-8 text-center">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
        <Repeat className="h-6 w-6 text-primary" />
      </div>
      <p className="font-semibold text-sm">Sem pagamentos recorrentes</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        Automatiza despesas que se repetem — salários, subscrições, rendas, portais.
        Cria um a partir de um atalho ou de raiz.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5 mt-4">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onPick(p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 hover:bg-muted px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <p.icon className="h-3.5 w-3.5 text-muted-foreground" />
            {p.label}
          </button>
        ))}
      </div>
      <Button size="sm" variant="outline" className="mt-4 rounded-full gap-1.5" onClick={onBlank}>
        <Plus className="h-3.5 w-3.5" /> Criar de raiz
      </Button>
    </div>
  )
}
