'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { ReceiptScanResult, CompanyCategory } from '@/types/financial'

interface ReceiptScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CompanyCategory[]
  onConfirm: (data: ReceiptScanResult & { category: string }) => void
}

export function ReceiptScanner({ open, onOpenChange, categories, onConfirm }: ReceiptScannerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<ReceiptScanResult | null>(null)
  const [editedResult, setEditedResult] = useState<Partial<ReceiptScanResult>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
      setResult(null)
      setEditedResult({})
    }
    reader.readAsDataURL(file)
  }

  const handleScan = async () => {
    if (!imagePreview) return
    setIsScanning(true)
    try {
      const res = await fetch('/api/financial/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePreview }),
      })
      if (!res.ok) throw new Error('Erro na digitalização')
      const data = await res.json()
      setResult(data)
      setEditedResult(data)
    } catch {
      toast.error('Erro ao digitalizar recibo')
    } finally {
      setIsScanning(false)
    }
  }

  const handleConfirm = () => {
    const final = { ...result, ...editedResult } as ReceiptScanResult & { category: string }
    if (!final.category) {
      toast.error('Seleccione uma categoria')
      return
    }
    onConfirm(final)
    resetState()
    onOpenChange(false)
  }

  const resetState = () => {
    setImagePreview(null)
    setResult(null)
    setEditedResult({})
  }

  const confidenceColor = (c: number) =>
    c >= 0.8 ? 'bg-emerald-500/10 text-emerald-600' :
    c >= 0.5 ? 'bg-amber-500/10 text-amber-600' :
    'bg-red-500/10 text-red-600'

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl rounded-2xl">
        {/* Hero header */}
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Camera className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Digitalizar Recibo</h3>
              <p className="text-neutral-400 text-xs mt-0.5">Upload de foto → IA extrai dados automaticamente</p>
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

            {imagePreview && !result && (
              <Button
                className="w-full rounded-full"
                onClick={handleScan}
                disabled={isScanning}
              >
                {isScanning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A digitalizar...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Extrair dados com IA</>
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
              <>
                {result.confidence != null && (
                  <Badge className={`${confidenceColor(result.confidence)} rounded-full text-[10px] border-0`}>
                    Confianca: {Math.round(result.confidence * 100)}%
                  </Badge>
                )}
                <div className="space-y-2.5">
                  <div>
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Fornecedor</Label>
                    <Input
                      value={editedResult.entity_name || ''}
                      onChange={(e) => setEditedResult({ ...editedResult, entity_name: e.target.value })}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">NIF</Label>
                    <Input
                      value={editedResult.entity_nif || ''}
                      onChange={(e) => setEditedResult({ ...editedResult, entity_nif: e.target.value })}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Valor s/IVA</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editedResult.amount_net ?? ''}
                        onChange={(e) => setEditedResult({ ...editedResult, amount_net: parseFloat(e.target.value) || null })}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Valor c/IVA</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editedResult.amount_gross ?? ''}
                        onChange={(e) => setEditedResult({ ...editedResult, amount_gross: parseFloat(e.target.value) || null })}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">N.o Fatura</Label>
                      <Input
                        value={editedResult.invoice_number || ''}
                        onChange={(e) => setEditedResult({ ...editedResult, invoice_number: e.target.value })}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Data</Label>
                      <Input
                        type="date"
                        value={editedResult.invoice_date || ''}
                        onChange={(e) => setEditedResult({ ...editedResult, invoice_date: e.target.value })}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Descricao</Label>
                    <Input
                      value={editedResult.description || ''}
                      onChange={(e) => setEditedResult({ ...editedResult, description: e.target.value })}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
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
              </>
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
