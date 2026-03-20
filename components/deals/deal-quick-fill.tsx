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

const FIELD_LABELS: Record<string, string> = {
  business_type: 'Tipo de Negócio',
  deal_value: 'Valor Acordado',
  commission_pct: 'Comissão (%)',
  cpcv_pct: 'Pagamento CPCV (%)',
  deposit_value: 'Sinal / Caução',
  contract_signing_date: 'Data Assinatura',
  max_deadline: 'Prazo',
  has_guarantor: 'Tem Fiador',
  has_furniture: 'Com Mobília',
  is_bilingual: 'Bilingue',
  has_financing: 'Financiamento',
  has_financing_condition: 'Condição Resolutiva',
  has_signature_recognition: 'Reconhecimento Assinaturas',
  housing_regime: 'Regime',
  has_referral: 'Referência',
  referral_pct: 'Referência (%)',
  referral_type: 'Tipo Referência',
  conditions_notes: 'Observações',
  partner_agency_name: 'Agência Parceira',
  external_consultant_name: 'Consultor Externo',
  clients: 'Clientes',
}

const NUMBER_FIELDS = new Set(['deal_value', 'commission_pct', 'cpcv_pct', 'referral_pct'])
const BOOLEAN_FIELDS = new Set(['has_guarantor', 'has_furniture', 'is_bilingual', 'has_financing', 'has_financing_condition', 'has_signature_recognition', 'has_referral'])

interface DealQuickFillProps {
  form: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DealQuickFill({ form, open, onOpenChange }: DealQuickFillProps) {
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
      const res = await fetch('/api/deals/fill-from-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro na extracção')
      }
      const data = await res.json()
      delete data._transcription
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

      const res = await fetch('/api/deals/fill-from-voice', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Erro na transcrição')

      const data = await res.json()
      if (data._transcription) {
        setText((prev) => (prev ? prev + '\n' + data._transcription : data._transcription))
      }
      delete data._transcription
      setExtractedFields(data)
      setShowPreview(true)
      toast.success('Áudio transcrito e dados extraídos')
    } catch {
      toast.error('Erro ao transcrever áudio')
    } finally {
      setIsTranscribing(false)
    }
  }

  const updateField = (key: string, value: unknown) => {
    setExtractedFields((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleApply = () => {
    if (!extractedFields) return

    for (const [key, value] of Object.entries(extractedFields)) {
      if (value == null || value === '' || key.startsWith('_')) continue
      form.setValue(key, value, { shouldValidate: true })
    }

    setShowPreview(false)
    setText('')
    setExtractedFields(null)
    onOpenChange(false)
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
            Descreve ou dita os dados do negócio e a IA preenche os campos automaticamente.
          </p>

          <div className="space-y-3">
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Descreve o negócio...\nEx: 'Venda de T3 em Cascais, 450 mil, comissão 5%, sinal de 10 mil no CPCV, escritura em 90 dias'"}
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
                  .filter(([k, v]) => v != null && !k.startsWith('_'))
                  .map(([key, value]) => {
                    if (key === 'clients' && Array.isArray(value)) {
                      return (
                        <div key={key} className="space-y-1 col-span-2">
                          <p className="text-xs text-muted-foreground">Clientes</p>
                          {(value as any[]).map((c, i) => (
                            <div key={i} className="text-sm bg-muted/50 rounded-md px-3 py-1.5">
                              {c.name} {c.email && `(${c.email})`} {c.phone && `— ${c.phone}`}
                            </div>
                          ))}
                        </div>
                      )
                    }

                    const label = FIELD_LABELS[key] || key

                    if (BOOLEAN_FIELDS.has(key)) {
                      return (
                        <div key={key} className="space-y-1">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <Input
                            value={value ? 'Sim' : 'Não'}
                            onChange={(e) => updateField(key, e.target.value.toLowerCase().startsWith('s'))}
                            className="h-8 text-sm"
                          />
                        </div>
                      )
                    }

                    if (NUMBER_FIELDS.has(key)) {
                      return (
                        <div key={key} className="space-y-1">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <Input
                            type="number"
                            value={value != null ? String(value) : ''}
                            onChange={(e) => updateField(key, e.target.value ? Number(e.target.value) : null)}
                            className="h-8 text-sm"
                          />
                        </div>
                      )
                    }

                    return (
                      <div key={key} className="space-y-1">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <Input
                          value={String(value ?? '')}
                          onChange={(e) => updateField(key, e.target.value || null)}
                          className="h-8 text-sm"
                        />
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleApply}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Aplicar Dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
