'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Mic, MicOff, FileText, Check } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import type { UseFormReturn } from 'react-hook-form'

interface AcquisitionQuickFillProps {
  form: UseFormReturn<any>
  open: boolean
  onOpenChange: (open: boolean) => void
}

const fieldLabels: Record<string, string> = {
  title: 'Título',
  property_type: 'Tipo de Imóvel',
  listing_price: 'Preço',
  description: 'Descrição',
  property_condition: 'Estado do Imóvel',
  energy_certificate: 'Certificado Energético',
  city: 'Cidade',
  zone: 'Zona',
  address_street: 'Morada',
  address_parish: 'Freguesia',
  postal_code: 'Código Postal',
  contract_regime: 'Regime Contratual',
  commission_agreed: 'Comissão',
}

const specLabels: Record<string, string> = {
  bedrooms: 'Quartos',
  bathrooms: 'Casas de Banho',
  area_util: 'Área Útil (m²)',
  area_gross: 'Área Bruta (m²)',
  construction_year: 'Ano Construção',
  parking_spaces: 'Estacionamento',
  garage_spaces: 'Garagem',
  typology: 'Tipologia',
  has_elevator: 'Elevador',
  features: 'Características',
}

const NUMBER_FIELDS = new Set([
  'listing_price', 'commission_agreed',
  'bedrooms', 'bathrooms', 'area_util', 'area_gross',
  'construction_year', 'parking_spaces', 'garage_spaces',
])

function EditableRow({
  fieldKey,
  label,
  value,
  onChange,
}: {
  fieldKey: string
  label: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (fieldKey === 'features' && Array.isArray(value)) {
    return (
      <div className="space-y-1 col-span-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input
          value={(value as string[]).join(', ')}
          onChange={(e) => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          className="h-8 text-sm"
          placeholder="Ex: Piscina, Varanda, Jardim"
        />
      </div>
    )
  }

  if (fieldKey === 'description') {
    return (
      <div className="space-y-1 col-span-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          className="text-sm"
        />
      </div>
    )
  }

  if (NUMBER_FIELDS.has(fieldKey)) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="h-8 text-sm"
        />
      </div>
    )
  }

  if (fieldKey === 'has_elevator') {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input
          value={value ? 'Sim' : 'Não'}
          onChange={(e) => onChange(e.target.value.toLowerCase().startsWith('s'))}
          className="h-8 text-sm"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 text-sm"
      />
    </div>
  )
}

export function AcquisitionQuickFill({ form, open, onOpenChange }: AcquisitionQuickFillProps) {
  const [text, setText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [extractedFields, setExtractedFields] = useState<Record<string, unknown> | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const handleExtract = async () => {
    if (!text.trim()) return
    setIsExtracting(true)
    try {
      const res = await fetch('/api/acquisitions/fill-from-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro na extracção')
      }

      const data = await res.json()
      setExtractedFields(data)
      setShowPreview(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao extrair dados')
    } finally {
      setIsExtracting(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        await transcribeAudio(blob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', blob)

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Erro na transcrição')

      const data = await res.json()
      setText((prev) => (prev ? prev + '\n' + data.text : data.text))
      toast.success('Áudio transcrito com sucesso')
    } catch {
      toast.error('Erro ao transcrever áudio')
    } finally {
      setIsTranscribing(false)
    }
  }

  const updateField = (path: string, value: unknown) => {
    setExtractedFields((prev) => {
      if (!prev) return prev
      // Handle nested specifications fields
      if (path.startsWith('specifications.')) {
        const specKey = path.replace('specifications.', '')
        const specs = (prev.specifications || {}) as Record<string, unknown>
        return { ...prev, specifications: { ...specs, [specKey]: value } }
      }
      return { ...prev, [path]: value }
    })
  }

  const handleApply = () => {
    if (!extractedFields) return

    for (const [key, value] of Object.entries(extractedFields)) {
      if (value == null || value === '') continue
      if (key === 'specifications' && typeof value === 'object') {
        for (const [sk, sv] of Object.entries(value as Record<string, unknown>)) {
          if (sv != null && sv !== '') {
            form.setValue(`specifications.${sk}`, sv, { shouldValidate: true })
          }
        }
      } else {
        form.setValue(key, value, { shouldValidate: true })
      }
    }

    setShowPreview(false)
    setText('')
    toast.success('Dados aplicados com sucesso')
  }

  return (
    <>
      <Dialog open={open && !showPreview} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preencher com IA</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground leading-tight">
            Descreve ou dita as características do imóvel e a IA preenche os campos automaticamente.
          </p>

          <div className="space-y-3">
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Descreve o imóvel...&#10;Ex: 'Apartamento T3 em Cascais, 450mil, com garagem e piscina'"
              className="text-sm"
            />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleExtract}
                disabled={!text.trim() || isExtracting}
              >
                {isExtracting ? (
                  <Spinner variant="infinite" size={14} className="mr-1.5" />
                ) : (
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                )}
                Extrair
              </Button>

              <Button
                type="button"
                size="sm"
                variant={isRecording ? 'destructive' : 'outline'}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <Spinner variant="infinite" size={14} className="mr-1.5" />
                ) : isRecording ? (
                  <>
                    <MicOff className="mr-1.5 h-3.5 w-3.5" />
                    Parar
                  </>
                ) : (
                  <>
                    <Mic className="mr-1.5 h-3.5 w-3.5" />
                    Gravar
                  </>
                )}
              </Button>

              {isRecording && (
                <span className="flex items-center gap-1.5 text-xs text-destructive">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                  A gravar...
                </span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={(v) => { setShowPreview(v); if (!v) onOpenChange(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Dados Extraídos</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {extractedFields && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(extractedFields)
                  .filter(([, v]) => v != null)
                  .map(([key, value]) => {
                    if (key === 'specifications' && typeof value === 'object') {
                      return Object.entries(value as Record<string, unknown>)
                        .filter(([, sv]) => sv != null)
                        .map(([sk, sv]) => (
                          <EditableRow
                            key={`spec-${sk}`}
                            fieldKey={sk}
                            label={specLabels[sk] || sk}
                            value={sv}
                            onChange={(v) => updateField(`specifications.${sk}`, v)}
                          />
                        ))
                    }
                    return (
                      <EditableRow
                        key={key}
                        fieldKey={key}
                        label={fieldLabels[key] || key}
                        value={value}
                        onChange={(v) => updateField(key, v)}
                      />
                    )
                  })
                  .flat()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setShowPreview(false); onOpenChange(false) }}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleApply}>
              <Check className="mr-2 h-4 w-4" />
              Aplicar Dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
