'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, FileText, Loader2, Receipt, RefreshCcw, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_PERSONAL_EXPENSE_CATEGORIES } from '@/lib/financial/personal-expense-categories'
import { CategorySelect } from './category-select'
import type { ReceiptScanResult } from '@/types/personal-expense'
import { cn } from '@/lib/utils'

interface ReceiptCaptureSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type Step = 'capture' | 'review'

interface UploadedReceipt {
  url: string
  mimetype: string
  size_bytes: number
  name: string | null
  preview: string
}

interface FormState {
  expense_date: string
  category: string
  vendor_name: string
  vendor_nif: string
  amount_gross: string
  amount_net: string
  vat_amount: string
  vat_pct: string
  invoice_number: string
  description: string
  notes: string
  is_recurring: boolean
  day_of_month: string
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function emptyForm(): FormState {
  return {
    expense_date: todayIso(),
    category: 'Outras',
    vendor_name: '',
    vendor_nif: '',
    amount_gross: '',
    amount_net: '',
    vat_amount: '',
    vat_pct: '',
    invoice_number: '',
    description: '',
    notes: '',
    is_recurring: false,
    day_of_month: String(new Date().getDate()),
  }
}

export function ReceiptCaptureSheet({ open, onOpenChange, onSaved }: ReceiptCaptureSheetProps) {
  const [step, setStep] = useState<Step>('capture')
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState<UploadedReceipt | null>(null)
  const [scan, setScan] = useState<ReceiptScanResult | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setStep('capture')
      setReceipt(null)
      setScan(null)
      setForm(emptyForm())
      setUploading(false)
      setScanning(false)
      setSaving(false)
    }
  }, [open])

  const handlePick = () => fileInputRef.current?.click()

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      let toUpload: File = file
      if (file.type.startsWith('image/') && file.type !== 'image/heic' && file.type !== 'image/heif') {
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 1.5,
            maxWidthOrHeight: 2048,
            useWebWorker: true,
          })
          toUpload = new File([compressed], file.name, { type: compressed.type })
        } catch { /* não bloqueia */ }
      }

      const previewUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Falha a ler ficheiro'))
        reader.readAsDataURL(toUpload)
      })

      const fd = new FormData()
      fd.append('file', toUpload)
      const res = await fetch('/api/agent-personal-expenses/upload-receipt', { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Erro a fazer upload')
      }
      const uploaded = await res.json()
      const fullReceipt: UploadedReceipt = { ...uploaded, preview: previewUrl }
      setReceipt(fullReceipt)
      setUploading(false)

      setScanning(true)
      const scanRes = await fetch('/api/financial/scan-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: previewUrl }),
      })
      if (scanRes.ok) {
        const result: ReceiptScanResult = await scanRes.json()
        setScan(result)
        setForm((prev) => ({
          ...prev,
          expense_date: result.invoice_date || todayIso(),
          category: matchCategory(result.category) || 'Outras',
          vendor_name: result.entity_name ?? '',
          vendor_nif: result.entity_nif ?? '',
          amount_gross: result.amount_gross != null ? String(result.amount_gross) : '',
          amount_net: result.amount_net != null ? String(result.amount_net) : '',
          vat_amount: result.vat_amount != null ? String(result.vat_amount) : '',
          vat_pct: result.vat_pct != null ? String(result.vat_pct) : '',
          invoice_number: result.invoice_number ?? '',
          description: result.description ?? '',
        }))
      } else {
        toast.message('Não foi possível ler o recibo automaticamente — preenche os campos manualmente.')
      }
      setScanning(false)
      setStep('review')
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a processar recibo')
      setUploading(false)
      setScanning(false)
    }
  }

  const handleSkipPhoto = () => {
    // Permite registar despesa manualmente sem foto (e.g. pagamento mensal sem recibo)
    setReceipt({ url: '', mimetype: '', size_bytes: 0, name: null, preview: '' })
    setStep('review')
  }

  const handleSave = async () => {
    if (!receipt) return
    if (!form.amount_gross || isNaN(Number(form.amount_gross))) {
      toast.error('Indica o valor com IVA.')
      return
    }
    if (!form.expense_date) {
      toast.error('Indica a data.')
      return
    }
    if (form.is_recurring) {
      const day = Number(form.day_of_month)
      if (!day || day < 1 || day > 31) {
        toast.error('Dia do mês inválido (1-31).')
        return
      }
    }
    setSaving(true)
    try {
      // 1. Recorrência primeiro (se for recurring) — para podermos linkar
      //    a despesa manual deste mês à regra criada.
      let recurrenceId: string | null = null
      if (form.is_recurring) {
        const recBody = {
          category: form.category || 'Outras',
          description: form.description || null,
          vendor_name: form.vendor_name || null,
          vendor_nif: form.vendor_nif || null,
          amount_gross: Number(form.amount_gross),
          amount_net: form.amount_net ? Number(form.amount_net) : null,
          vat_amount: form.vat_amount ? Number(form.vat_amount) : null,
          vat_pct: form.vat_pct ? Number(form.vat_pct) : null,
          invoice_number: null,
          notes: form.notes || null,
          frequency: 'monthly' as const,
          day_of_month: Number(form.day_of_month),
          start_date: form.expense_date,
          is_active: true,
          // Marca como "já gerada este mês" para o cron não duplicar.
          last_generated_at: form.expense_date,
        }
        const rRes = await fetch('/api/agent-personal-expense-recurrences', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(recBody),
        })
        if (!rRes.ok) {
          // Falha não bloqueia — a despesa será guardada sem recorrência.
          toast.error('Falhou criar pagamento mensal. Despesa será guardada sem recorrência.')
        } else {
          const created = await rRes.json()
          recurrenceId = created.id ?? null
        }
      }

      // 2. Despesa (com recurrence_id se aplicável)
      const expenseBody = {
        expense_date: form.expense_date,
        category: form.category || 'Outras',
        description: form.description || null,
        vendor_name: form.vendor_name || null,
        vendor_nif: form.vendor_nif || null,
        amount_gross: Number(form.amount_gross),
        amount_net: form.amount_net ? Number(form.amount_net) : null,
        vat_amount: form.vat_amount ? Number(form.vat_amount) : null,
        vat_pct: form.vat_pct ? Number(form.vat_pct) : null,
        invoice_number: form.invoice_number || null,
        notes: form.notes || null,
        receipt_url: receipt.url || null,
        receipt_mimetype: receipt.mimetype || null,
        receipt_size_bytes: receipt.size_bytes || null,
        ocr_confidence: scan?.confidence ?? null,
        ocr_field_confidences: scan?.field_confidences ?? null,
        recurrence_id: recurrenceId,
      }
      const res = await fetch('/api/agent-personal-expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(expenseBody),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Erro a guardar despesa')
      }

      toast.success(
        recurrenceId
          ? 'Despesa registada e marcada como pagamento mensal.'
          : 'Despesa registada.'
      )
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a guardar')
    } finally {
      setSaving(false)
    }
  }

  const isPdf = receipt?.mimetype === 'application/pdf'
  const hasReceipt = !!receipt?.url

  return (
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
            <Receipt className="h-5 w-5" />
            {step === 'capture' ? 'Registar despesa' : 'Rever e guardar'}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {step === 'capture'
              ? 'Tira foto do recibo ou regista manualmente. A IA preenche os campos por ti.'
              : 'Confirma os dados extraídos e marca como mensal se for recorrente.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {step === 'capture' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              />
              <button
                type="button"
                onClick={handlePick}
                disabled={uploading || scanning}
                className={cn(
                  'w-full rounded-2xl border-2 border-dashed border-border/60 bg-card p-10',
                  'flex flex-col items-center justify-center gap-3 text-center',
                  'hover:bg-muted/50 hover:border-border transition-colors',
                  'disabled:opacity-60'
                )}
              >
                {uploading || scanning ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {uploading ? 'A enviar recibo…' : 'A ler o recibo com IA…'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-background p-3 ring-1 ring-border">
                      <Camera className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Tirar foto ou anexar ficheiro</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        JPEG, PNG, WebP, HEIC ou PDF · até 10MB
                      </p>
                    </div>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">ou</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSkipPhoto}
                disabled={uploading || scanning}
              >
                Preencher manualmente (sem foto)
              </Button>
              <p className="text-[10px] text-muted-foreground text-center px-4">
                Útil para registos retroactivos ou pagamentos sem talão (transferências, débitos directos).
              </p>
            </div>
          )}

          {step === 'review' && receipt && (
            <div className="space-y-4">
              {/* Preview compacto (se houver) */}
              {hasReceipt && (
                <div className="flex items-start gap-3 rounded-2xl bg-card border border-border/50 p-3">
                  {isPdf ? (
                    <div className="shrink-0 h-16 w-16 rounded-lg bg-muted/50 flex items-center justify-center ring-1 ring-border">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  ) : (
                    <a href={receipt.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img
                        src={receipt.preview}
                        alt="Recibo"
                        className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
                      />
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{receipt.name ?? 'recibo'}</p>
                    {scan?.confidence != null && (
                      <Badge variant="outline" className="text-[10px] mt-1">
                        <Sparkles className="h-3 w-3 mr-1" />
                        IA: {Math.round((scan.confidence || 0) * 100)}%
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => setStep('capture')}
                      className="text-[10px] text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
                    >
                      <RefreshCcw className="h-3 w-3" /> Refazer
                    </button>
                  </div>
                </div>
              )}

              {scanning ? (
                <Skeleton className="h-64" />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Data">
                      <Input type="date" value={form.expense_date}
                        onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                    </Field>
                    <Field label="Categoria">
                      <CategorySelect
                        value={form.category}
                        onChange={(v) => setForm({ ...form, category: v })}
                      />
                    </Field>
                  </div>

                  <Field label="Entidade">
                    <Input value={form.vendor_name}
                      onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                      placeholder="Nome do estabelecimento" />
                  </Field>

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="NIF">
                      <Input value={form.vendor_nif}
                        onChange={(e) => setForm({ ...form, vendor_nif: e.target.value })}
                        placeholder="999999999" />
                    </Field>
                    <Field label="Nº Documento">
                      <Input value={form.invoice_number}
                        onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
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
                    <Input value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Almoço com cliente João, projecto X…" />
                  </Field>

                  <Field label="Notas">
                    <Textarea rows={2} value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </Field>

                  {/* Pagamento mensal */}
                  <div className="rounded-2xl border border-border/50 bg-card p-3 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <Label className="text-sm font-medium">Pagamento mensal recorrente</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Cria automaticamente uma nova despesa todos os meses no dia indicado.
                        </p>
                      </div>
                      <Switch
                        checked={form.is_recurring}
                        onCheckedChange={(v) => setForm({ ...form, is_recurring: v })}
                      />
                    </div>
                    {form.is_recurring && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Dia do mês">
                          <Input type="number" min="1" max="31" value={form.day_of_month}
                            onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} />
                        </Field>
                        <div className="flex flex-col justify-end pb-2">
                          <p className="text-[10px] text-muted-foreground">
                            Em meses com menos dias usa o último dia disponível.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer fixo */}
        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2 shrink-0">
          {step === 'capture' && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button variant="ghost" onClick={() => setStep('capture')}>
                <X className="h-3 w-3 mr-1" /> Voltar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Guardar despesa
              </Button>
            </>
          )}
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

function matchCategory(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lc = raw.toLowerCase()
  for (const c of DEFAULT_PERSONAL_EXPENSE_CATEGORIES) {
    if (c.toLowerCase().includes(lc) || lc.includes(c.toLowerCase().split(' ')[0])) return c
  }
  if (lc.includes('combust') || lc.includes('desloca')) return 'Deslocações & combustível'
  if (lc.includes('almoço') || lc.includes('refeic') || lc.includes('refeição')) return 'Refeições com clientes'
  if (lc.includes('estacion') || lc.includes('portag') || lc.includes('via verde')) return 'Estacionamento & portagens'
  if (lc.includes('telem') || lc.includes('dados') || lc.includes('mobile')) return 'Telemóvel & dados'
  if (lc.includes('software') || lc.includes('subscr')) return 'Subscrições & software'
  if (lc.includes('material')) return 'Material de escritório'
  return null
}
