'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, Loader2, Sparkles, X, AlertTriangle, QrCode } from 'lucide-react'
import jsQR from 'jsqr'
import { parsePtFiscalQr } from '@/lib/financial/parse-pt-fiscal-qr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import type { ReceiptScanResult, CompanyCategory, FieldConfidences } from '@/types/financial'

interface ReceiptScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CompanyCategory[]
  onConfirm: (data: ReceiptScanResult & { category: string; receiptImageBase64: string | null }) => void
}

const LOW_CONFIDENCE_THRESHOLD = 0.7

/**
 * Tenta encontrar um QR code numa imagem usando jsQR.
 * Faz um upscale moderado e tenta a imagem inteira (suficiente para faturas PT,
 * onde o QR está sempre num canto e ocupa 5–15% da área).
 */
async function detectQrFromImage(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      // Limita o canvas a 1600px no lado maior — chega para QR fiscal
      const maxDim = 1600
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        const imageData = ctx.getImageData(0, 0, width, height)
        const code = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' })
        resolve(code?.data || null)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/** Compress an image file to WebP, max 300KB / 1200px */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxDim = 1200
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // Try progressively lower quality until under 300KB
      let quality = 0.8
      let dataUrl = canvas.toDataURL('image/webp', quality)
      while (dataUrl.length > 400_000 && quality > 0.3) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/webp', quality)
      }
      resolve(dataUrl)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')) }
    img.src = url
  })
}

export function ReceiptScanner({ open, onOpenChange, categories, onConfirm }: ReceiptScannerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [compressedImage, setCompressedImage] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isDetectingQr, setIsDetectingQr] = useState(false)
  const [qrDetected, setQrDetected] = useState(false)
  const [result, setResult] = useState<ReceiptScanResult | null>(null)
  const [editedResult, setEditedResult] = useState<Partial<ReceiptScanResult>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview immediately
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Erro ao ler ficheiro'))
      reader.readAsDataURL(file)
    })

    setImagePreview(dataUrl)
    setResult(null)
    setEditedResult({})
    setQrDetected(false)

    // Run compression and QR detection in parallel
    setIsCompressing(true)
    setIsDetectingQr(true)

    const compressPromise = compressImage(file)
      .then((c) => { setCompressedImage(c); return c })
      .catch(() => { toast.error('Erro ao comprimir imagem'); return null })
      .finally(() => setIsCompressing(false))

    const qrPromise = detectQrFromImage(dataUrl)
      .then((qrText) => {
        if (!qrText) return null
        const parsed = parsePtFiscalQr(qrText)
        if (!parsed) return null
        // QR fiscal PT detectado — preencher resultado e saltar a IA
        setResult(parsed)
        setEditedResult(parsed)
        setQrDetected(true)
        toast.success('QR fiscal detectado — dados preenchidos automaticamente')
        return parsed
      })
      .catch(() => null)
      .finally(() => setIsDetectingQr(false))

    await Promise.all([compressPromise, qrPromise])
  }, [])

  const handleScan = async () => {
    const imageToSend = compressedImage || imagePreview
    if (!imageToSend) return
    setIsScanning(true)
    try {
      const res = await fetch('/api/financial/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageToSend }),
      })
      if (!res.ok) throw new Error('Erro na digitalização')
      const aiData: ReceiptScanResult = await res.json()

      if (qrDetected && result) {
        // Modo enriquecimento: preserva os dados oficiais do QR (numéricos + fatura)
        // e só usa a IA para campos que o QR não traz (entity_name, description, category).
        const merged: ReceiptScanResult = {
          ...aiData,
          entity_nif: result.entity_nif || aiData.entity_nif,
          amount_net: result.amount_net ?? aiData.amount_net,
          amount_gross: result.amount_gross ?? aiData.amount_gross,
          vat_amount: result.vat_amount ?? aiData.vat_amount,
          vat_pct: result.vat_pct ?? aiData.vat_pct,
          invoice_number: result.invoice_number || aiData.invoice_number,
          invoice_date: result.invoice_date || aiData.invoice_date,
          confidence: 1,
          field_confidences: {
            ...(aiData.field_confidences || {}),
            ...(result.field_confidences || {}),
          },
        }
        setResult(merged)
        setEditedResult(merged)
        toast.success('Nome do fornecedor enriquecido com IA')
      } else {
        setResult(aiData)
        setEditedResult(aiData)
      }
    } catch {
      toast.error('Erro ao digitalizar recibo')
    } finally {
      setIsScanning(false)
    }
  }

  const handleConfirm = () => {
    const final = { ...result, ...editedResult } as ReceiptScanResult & { category: string; receiptImageBase64: string | null }
    if (!final.category) {
      toast.error('Seleccione uma categoria')
      return
    }
    // Attach compressed image for storage
    final.receiptImageBase64 = compressedImage || imagePreview
    onConfirm(final)
    resetState()
    onOpenChange(false)
  }

  const resetState = () => {
    setImagePreview(null)
    setCompressedImage(null)
    setResult(null)
    setEditedResult({})
    setQrDetected(false)
  }

  const confidenceColor = (c: number) =>
    c >= 0.8 ? 'bg-emerald-500/10 text-emerald-600' :
    c >= 0.5 ? 'bg-amber-500/10 text-amber-600' :
    'bg-red-500/10 text-red-600'

  const fieldConfidences: FieldConfidences = result?.field_confidences || {}

  /** Returns border/ring classes for a field based on its confidence */
  const fieldStyle = (fieldName: string) => {
    const conf = fieldConfidences[fieldName]
    if (conf == null) return ''
    if (conf < LOW_CONFIDENCE_THRESHOLD) return 'ring-2 ring-amber-400/60 bg-amber-50/50'
    return ''
  }

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogTitle className="sr-only">Digitalizar Recibo</DialogTitle>
        {/* Hero header */}
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Camera className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Digitalizar Recibo</h3>
              <p className="text-neutral-400 text-xs mt-0.5">Upload de foto → leitura de QR fiscal AT (com fallback para IA) → guardado na base de dados</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Image */}
          <div className="space-y-3">
            {imagePreview ? (
              <div className="relative rounded-xl border overflow-hidden aspect-[3/4]">
                <img src={imagePreview} alt="Recibo" className="w-full h-full object-contain bg-muted/30" />
                <button
                  type="button"
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  onClick={resetState}
                >
                  <X className="h-4 w-4" />
                </button>
                {(isCompressing || isDetectingQr) && (
                  <div className="absolute bottom-2 left-2 right-2 bg-black/60 rounded-lg px-3 py-1.5 text-[10px] text-white flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {isDetectingQr ? 'A procurar QR fiscal...' : 'A comprimir imagem...'}
                  </div>
                )}
                {qrDetected && !isDetectingQr && (
                  <div className="absolute bottom-2 left-2 right-2 bg-emerald-600/90 rounded-lg px-3 py-1.5 text-[10px] text-white flex items-center gap-2 shadow-lg">
                    <QrCode className="h-3 w-3" /> QR fiscal detectado
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all duration-300"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 opacity-40" />
                <span className="text-sm font-medium">Carregar imagem</span>
                <span className="text-xs opacity-60">JPG, PNG ou PDF</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

            {imagePreview && !result && !isDetectingQr && (
              <Button
                className="w-full rounded-full"
                onClick={handleScan}
                disabled={isScanning || isCompressing}
              >
                {isScanning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A digitalizar...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Extrair dados com IA</>
                )}
              </Button>
            )}

            {imagePreview && qrDetected && (
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={handleScan}
                disabled={isScanning || isCompressing}
              >
                {isScanning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enriquecer...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Enriquecer com IA (nome do fornecedor)</>
                )}
              </Button>
            )}
          </div>

          {/* Right: Extracted data */}
          <div className="space-y-3">
            {!result ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Sparkles className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Os dados extraidos aparecerao aqui</p>
              </div>
            ) : (
              <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {qrDetected ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] border-0 gap-1">
                      <QrCode className="h-2.5 w-2.5" /> QR fiscal AT
                    </Badge>
                  ) : result.confidence != null && (
                    <Badge className={`${confidenceColor(result.confidence)} rounded-full text-[10px] border-0 gap-1`}>
                      <Sparkles className="h-2.5 w-2.5" /> IA · {Math.round(result.confidence * 100)}%
                    </Badge>
                  )}
                  {!qrDetected && result.confidence != null && result.confidence < LOW_CONFIDENCE_THRESHOLD && (
                    <span className="text-[10px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Revise os campos destacados
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  <ConfidenceField
                    label="Fornecedor"
                    fieldName="entity_name"
                    fieldConfidences={fieldConfidences}
                    fieldStyle={fieldStyle}
                  >
                    <Input
                      value={editedResult.entity_name || ''}
                      onChange={(e) => setEditedResult({ ...editedResult, entity_name: e.target.value })}
                      className={`h-8 text-sm ${fieldStyle('entity_name')}`}
                    />
                  </ConfidenceField>

                  <ConfidenceField
                    label="NIF"
                    fieldName="entity_nif"
                    fieldConfidences={fieldConfidences}
                    fieldStyle={fieldStyle}
                  >
                    <Input
                      value={editedResult.entity_nif || ''}
                      onChange={(e) => setEditedResult({ ...editedResult, entity_nif: e.target.value })}
                      className={`h-8 text-sm ${fieldStyle('entity_nif')}`}
                    />
                  </ConfidenceField>

                  <div className="grid grid-cols-2 gap-2">
                    <ConfidenceField
                      label="Valor s/IVA"
                      fieldName="amount_net"
                      fieldConfidences={fieldConfidences}
                      fieldStyle={fieldStyle}
                    >
                      <Input
                        type="number"
                        step="0.01"
                        value={editedResult.amount_net ?? ''}
                        onChange={(e) => setEditedResult({ ...editedResult, amount_net: parseFloat(e.target.value) || null })}
                        className={`h-8 text-sm ${fieldStyle('amount_net')}`}
                      />
                    </ConfidenceField>

                    <ConfidenceField
                      label="Valor c/IVA"
                      fieldName="amount_gross"
                      fieldConfidences={fieldConfidences}
                      fieldStyle={fieldStyle}
                    >
                      <Input
                        type="number"
                        step="0.01"
                        value={editedResult.amount_gross ?? ''}
                        onChange={(e) => setEditedResult({ ...editedResult, amount_gross: parseFloat(e.target.value) || null })}
                        className={`h-8 text-sm ${fieldStyle('amount_gross')}`}
                      />
                    </ConfidenceField>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <ConfidenceField
                      label="N.o Fatura"
                      fieldName="invoice_number"
                      fieldConfidences={fieldConfidences}
                      fieldStyle={fieldStyle}
                    >
                      <Input
                        value={editedResult.invoice_number || ''}
                        onChange={(e) => setEditedResult({ ...editedResult, invoice_number: e.target.value })}
                        className={`h-8 text-sm ${fieldStyle('invoice_number')}`}
                      />
                    </ConfidenceField>

                    <ConfidenceField
                      label="Data"
                      fieldName="invoice_date"
                      fieldConfidences={fieldConfidences}
                      fieldStyle={fieldStyle}
                    >
                      <Input
                        type="date"
                        value={editedResult.invoice_date || ''}
                        onChange={(e) => setEditedResult({ ...editedResult, invoice_date: e.target.value })}
                        className={`h-8 text-sm ${fieldStyle('invoice_date')}`}
                      />
                    </ConfidenceField>
                  </div>

                  <ConfidenceField
                    label="Descricao"
                    fieldName="description"
                    fieldConfidences={fieldConfidences}
                    fieldStyle={fieldStyle}
                  >
                    <Input
                      value={editedResult.description || ''}
                      onChange={(e) => setEditedResult({ ...editedResult, description: e.target.value })}
                      className={`h-8 text-sm ${fieldStyle('description')}`}
                    />
                  </ConfidenceField>

                  <div>
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Categoria</Label>
                    <Select
                      value={editedResult.category || ''}
                      onValueChange={(v) => setEditedResult({ ...editedResult, category: v })}
                    >
                      <SelectTrigger className="h-8 text-sm mt-1">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((c) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>

        {result && (
          <DialogFooter className="mt-4">
            <Button variant="outline" className="rounded-full" onClick={() => { resetState(); onOpenChange(false) }}>
              Cancelar
            </Button>
            <Button className="rounded-full" onClick={handleConfirm}>
              Confirmar e Guardar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Confidence Field Wrapper ────────────────────────────────────────────────

function ConfidenceField({
  label,
  fieldName,
  fieldConfidences,
  fieldStyle,
  children,
}: {
  label: string
  fieldName: string
  fieldConfidences: FieldConfidences
  fieldStyle: (name: string) => string
  children: React.ReactNode
}) {
  const conf = fieldConfidences[fieldName]
  const isLow = conf != null && conf < LOW_CONFIDENCE_THRESHOLD

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</Label>
        {isLow && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Confianca baixa ({Math.round((conf ?? 0) * 100)}%) — verifique este campo
            </TooltipContent>
          </Tooltip>
        )}
        {conf != null && !isLow && (
          <span className="text-[9px] text-emerald-500 font-medium">{Math.round(conf * 100)}%</span>
        )}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}
