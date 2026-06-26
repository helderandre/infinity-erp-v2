'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, FileText, Loader2, Receipt, RefreshCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { CompanyCategory, ReceiptScanResult } from '@/types/financial'

interface PartnerOption { id: string; name: string; nif: string | null }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CompanyCategory[]
  partners: PartnerOption[]
  onSaved: () => void
}

interface FormState {
  date: string
  type: 'income' | 'expense'
  category: string
  entity_name: string
  entity_nif: string
  description: string
  amount_net: string
  vat_pct: string
  invoice_number: string
  due_date: string
  partner_id: string
  notes: string
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function emptyForm(): FormState {
  return {
    date: todayIso(), type: 'expense', category: '', entity_name: '', entity_nif: '',
    description: '', amount_net: '', vat_pct: '23', invoice_number: '', due_date: '', partner_id: '', notes: '',
  }
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const normCat = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

// Glassmorphic sheet para registar uma despesa avulsa da empresa.
// Suporta foto → IA (preenchimento automático) ou preenchimento manual.
export function CompanyExpenseSheet({ open, onOpenChange, categories, partners, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scan, setScan] = useState<ReceiptScanResult | null>(null)
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setForm(emptyForm())
      setScan(null)
      setReceiptBase64(null)
      setPreview(null)
      setScanning(false)
      setSaving(false)
    }
  }, [open])

  const typeCategories = categories.filter((c) => c.type === form.type || c.type === 'both')

  const handlePick = () => fileInputRef.current?.click()

  const handleFile = async (file: File) => {
    setScanning(true)
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
      setPreview(dataUrl)
      setReceiptBase64(dataUrl)

      // A IA de visão só lê imagens (JPEG/PNG/WebP). PDF/HEIC ficam guardados,
      // mas o preenchimento é manual — evita uma chamada que falharia.
      const scannable = /^image\/(jpe?g|png|webp)$/i.test(toScan.type)
      if (!scannable) {
        toast.message('Ficheiro anexado — preenche os campos manualmente.')
        return
      }

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
      setScan(result)
      const matched = typeCategories.find((c) => result.category && normCat(c.name) === normCat(result.category))
      setForm((prev) => ({
        ...prev,
        type: 'expense',
        date: result.invoice_date || prev.date,
        category: matched?.name ?? prev.category,
        entity_name: result.entity_name ?? prev.entity_name,
        entity_nif: result.entity_nif ?? prev.entity_nif,
        description: result.description ?? prev.description,
        amount_net: result.amount_net != null ? String(result.amount_net) : prev.amount_net,
        vat_pct: result.vat_pct != null ? String(result.vat_pct) : prev.vat_pct,
        invoice_number: result.invoice_number ?? prev.invoice_number,
      }))
      toast.success('Documento lido — confirma os dados.')
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a processar documento')
    } finally {
      setScanning(false)
    }
  }

  const clearReceipt = () => {
    setReceiptBase64(null)
    setPreview(null)
    setScan(null)
  }

  const grossValue = form.amount_net
    ? Number(form.amount_net) * (1 + (parseFloat(form.vat_pct) || 0) / 100)
    : 0

  const handleSave = async () => {
    if (!form.description || !form.amount_net || !form.category) {
      toast.error('Preenche a categoria, a descrição e o valor')
      return
    }
    const amountNet = parseFloat(form.amount_net)
    if (isNaN(amountNet) || amountNet <= 0) {
      toast.error('Valor inválido')
      return
    }
    setSaving(true)
    try {
      const vatPct = parseFloat(form.vat_pct) || 0
      // Mantém os valores do documento quando o líquido/IVA não foram alterados
      // (evita divergências de arredondamento / IVA misto face à fatura digitalizada).
      const keepScanned = scan != null && scan.amount_gross != null
        && Number(scan.amount_net) === amountNet
        && Number(scan.vat_pct ?? 0) === vatPct
      const vatAmount = keepScanned && scan?.vat_amount != null
        ? Number(scan.vat_amount)
        : Math.round(amountNet * (vatPct / 100) * 100) / 100
      const amountGross = keepScanned && scan?.amount_gross != null
        ? Number(scan.amount_gross)
        : Math.round((amountNet + vatAmount) * 100) / 100

      // Aviso de possível duplicado (não bloqueia) quando há fatura + NIF.
      if (form.invoice_number && form.entity_nif) {
        const [y, m] = form.date.split('-')
        try {
          const checkRes = await fetch(`/api/financial/company-transactions?month=${Number(m)}&year=${y}`)
          if (checkRes.ok) {
            const existing = await checkRes.json()
            const dup = (existing.data || []).find((tx: any) =>
              tx.invoice_number === form.invoice_number && tx.entity_nif === form.entity_nif && tx.status !== 'cancelled')
            if (dup) toast.warning(`Possível duplicado: já existe a fatura ${form.invoice_number} de ${form.entity_nif}`)
          }
        } catch { /* check best-effort */ }
      }

      const res = await fetch('/api/financial/company-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          // invoice_date alimenta a coluna da data da fatura na lista de despesas.
          invoice_date: form.date || undefined,
          type: form.type,
          category: form.category,
          // Campos opcionais: enviar `undefined` (não `null`) — o schema Zod usa
          // `.optional()` sem `.nullable()`, logo `null` seria rejeitado (400).
          entity_name: form.entity_name || undefined,
          entity_nif: form.entity_nif || undefined,
          description: form.description,
          amount_net: amountNet,
          amount_gross: amountGross,
          vat_amount: vatAmount,
          vat_pct: vatPct,
          invoice_number: form.invoice_number || undefined,
          due_date: form.due_date || undefined,
          partner_id: form.partner_id || null,
          notes: form.notes || undefined,
          receipt_url: receiptBase64 || undefined,
          ai_extracted: !!scan,
          ai_confidence: scan?.confidence ?? undefined,
          field_confidences: scan?.field_confidences ?? undefined,
          // Despesa digitalizada entra como rascunho (revisão); manual confirmada.
          status: scan ? 'draft' : 'confirmed',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao guardar')
      }
      toast.success('Despesa registada')
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const isPdf = receiptBase64?.startsWith('data:application/pdf')
  // O browser não decodifica HEIC — mostra um placeholder em vez de um <img> partido.
  const isHeic = /^data:image\/hei[cf]/i.test(receiptBase64 ?? '')
  const showFileTile = isPdf || isHeic

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          'w-full sm:max-w-[480px] rounded-l-3xl',
        )}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5" />
            Registar despesa
          </SheetTitle>
          <SheetDescription className="text-xs">
            Tira foto da fatura e a IA preenche, ou preenche manualmente.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {/* Captura / scan */}
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

          {!receiptBase64 ? (
            <button
              type="button"
              onClick={handlePick}
              disabled={scanning}
              className={cn(
                'w-full rounded-2xl border-2 border-dashed border-border/60 bg-card/60 p-6',
                'flex flex-col items-center justify-center gap-2 text-center',
                'hover:bg-muted/50 hover:border-border transition-colors disabled:opacity-60',
              )}
            >
              {scanning ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">A ler o documento com IA…</p>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-background p-2.5 ring-1 ring-border">
                    <Camera className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">Tirar foto / anexar fatura</p>
                  <p className="text-[11px] text-muted-foreground">JPEG, PNG, WebP, HEIC ou PDF</p>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-card/60 border border-border/50 p-3">
              {showFileTile ? (
                <div className="shrink-0 h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center ring-1 ring-border">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              ) : (
                <img src={preview ?? ''} alt="Documento" className="shrink-0 h-12 w-12 rounded-lg object-cover ring-1 ring-border" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Documento anexado</p>
                {scan?.confidence != null && (
                  <Badge variant="outline" className="text-[10px] mt-1">
                    <Sparkles className="h-3 w-3 mr-1" /> IA: {Math.round((scan.confidence || 0) * 100)}%
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={clearReceipt}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
              >
                <RefreshCcw className="h-3 w-3" /> Remover
              </button>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo">
                <Select value={form.type} onValueChange={(v: 'income' | 'expense') => setForm({ ...form, type: v, category: '' })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data">
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-9 text-sm" />
              </Field>
            </div>

            <Field label="Categoria">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {typeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {partners.length > 0 && (
              <Field label="Parceiro">
                <Select
                  value={form.partner_id}
                  onValueChange={(v) => {
                    const p = partners.find((x) => x.id === v)
                    setForm({ ...form, partner_id: v, entity_name: p?.name || form.entity_name, entity_nif: p?.nif || form.entity_nif })
                  }}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.nif ? ` (${p.nif})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="Entidade">
              <Input value={form.entity_name} onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                className="h-9 text-sm" placeholder="Nome do fornecedor" />
            </Field>

            <Field label="Descrição">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-9 text-sm" placeholder="A que se refere a despesa" />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Valor s/IVA">
                <CurrencyInput value={form.amount_net ? Number(form.amount_net) : null}
                  onChange={(v) => setForm({ ...form, amount_net: v != null ? String(v) : '' })} className="h-9 text-sm" />
              </Field>
              <Field label="IVA %">
                <Input type="number" value={form.vat_pct} onChange={(e) => setForm({ ...form, vat_pct: e.target.value })} className="h-9 text-sm" />
              </Field>
            </div>

            {form.amount_net && (
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Total c/ IVA</span>
                <span className="font-semibold tabular-nums">{fmtCurrency(grossValue)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Field label="Nº Fatura">
                <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} className="h-9 text-sm" />
              </Field>
              <Field label="NIF">
                <Input value={form.entity_nif} onChange={(e) => setForm({ ...form, entity_nif: e.target.value })} className="h-9 text-sm" placeholder="Opcional" />
              </Field>
            </div>

            <Field label="Vencimento">
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-9 text-sm" />
            </Field>

            <Field label="Notas">
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="text-sm" placeholder="Opcional" />
            </Field>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || scanning}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Guardar despesa
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
