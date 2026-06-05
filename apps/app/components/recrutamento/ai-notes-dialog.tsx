// @ts-nocheck
'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Mic, MicOff, Sparkles, Loader2, Check, X, Pencil,
  Phone, Mail, User, FileText, AlertTriangle,
} from 'lucide-react'

interface ExtractedFields {
  full_name?: string
  phone?: string
  email?: string
  source_detail?: string
  identified_pains?: string
  solutions_presented?: string
  candidate_objections?: string
  has_real_estate_experience?: boolean
  previous_agency?: string
  reason_for_leaving?: string
}

interface AiNotesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateName: string
  onConfirm: (data: { note: string; fields: ExtractedFields }) => Promise<void>
}

type Step = 'input' | 'processing' | 'review'

export function AiNotesDialog({ open, onOpenChange, candidateName, onConfirm }: AiNotesDialogProps) {
  const [step, setStep] = useState<Step>('input')
  const [textInput, setTextInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [noteSummary, setNoteSummary] = useState('')
  const [extractedFields, setExtractedFields] = useState<ExtractedFields>({})
  const [saving, setSaving] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const reset = () => {
    setStep('input')
    setTextInput('')
    setTranscription('')
    setNoteSummary('')
    setExtractedFields({})
    setIsRecording(false)
    setSaving(false)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  // ─── Recording ───
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(blob)
      }
      recorder.start()
      setIsRecording(true)
    } catch { toast.error('Não foi possível aceder ao microfone') }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const transcribeAudio = async (blob: Blob) => {
    setStep('processing')
    try {
      const fd = new FormData()
      fd.append('audio', blob)
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const { text } = await res.json()
      setTranscription(text)
      await extractFromText(text)
    } catch {
      toast.error('Erro na transcrição')
      setStep('input')
    }
  }

  // ─── Extract ───
  const extractFromText = async (text: string) => {
    setStep('processing')
    try {
      const res = await fetch('/api/recrutamento/candidates/extract-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error()
      const { note_summary, fields } = await res.json()
      setNoteSummary(note_summary || text)
      setExtractedFields(fields || {})
      setStep('review')
    } catch {
      toast.error('Erro ao extrair dados')
      setStep('input')
    }
  }

  const handleSubmitText = () => {
    if (!textInput.trim()) return
    extractFromText(textInput.trim())
  }

  // ─── Confirm ───
  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm({ note: noteSummary, fields: extractedFields })
      handleOpenChange(false)
    } catch {
      toast.error('Erro ao guardar')
    } finally { setSaving(false) }
  }

  const removeField = (key: string) => {
    setExtractedFields(prev => {
      const next = { ...prev }
      delete (next as any)[key]
      return next
    })
  }

  const fieldLabels: Record<string, { label: string; icon: any; color: string }> = {
    full_name: { label: 'Nome', icon: User, color: 'text-neutral-600' },
    phone: { label: 'Telemóvel', icon: Phone, color: 'text-blue-600' },
    email: { label: 'Email', icon: Mail, color: 'text-emerald-600' },
    source_detail: { label: 'Detalhe Origem', icon: FileText, color: 'text-violet-600' },
    identified_pains: { label: 'Dores Identificadas', icon: AlertTriangle, color: 'text-amber-600' },
    solutions_presented: { label: 'Soluções', icon: Sparkles, color: 'text-emerald-600' },
    candidate_objections: { label: 'Objecções', icon: X, color: 'text-red-600' },
    previous_agency: { label: 'Agência Anterior', icon: FileText, color: 'text-sky-600' },
    reason_for_leaving: { label: 'Razão de Saída', icon: FileText, color: 'text-orange-600' },
  }

  const fieldEntries = Object.entries(extractedFields).filter(([, v]) => v !== null && v !== undefined && v !== '')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Nota com IA — {candidateName}
          </DialogTitle>
        </DialogHeader>

        {/* ═══ Step: Input ═══ */}
        {step === 'input' && (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">Grave um áudio ou escreva as suas notas. A IA irá extrair um resumo e preencher campos automaticamente.</p>

            {/* Record button */}
            <div className="flex justify-center">
              <button type="button" onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  'h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center transition-all',
                  isRecording
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110'
                    : 'bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 hover:scale-105'
                )}>
                {isRecording ? <MicOff className="h-6 w-6 sm:h-8 sm:w-8" /> : <Mic className="h-6 w-6 sm:h-8 sm:w-8" />}
              </button>
            </div>
            {isRecording && (
              <div className="text-center">
                <span className="inline-flex items-center gap-2 text-red-600 text-xs font-medium">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
                  A gravar... Clique para parar.
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-muted-foreground">ou escreva</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Textarea
              rows={4}
              placeholder="Notas da chamada, reunião, mensagem do WhatsApp..."
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              className="text-sm"
            />

            <Button className="w-full rounded-xl gap-2" disabled={!textInput.trim()} onClick={handleSubmitText}>
              <Sparkles className="h-4 w-4" />Processar com IA
            </Button>
          </div>
        )}

        {/* ═══ Step: Processing ═══ */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            <p className="text-sm text-muted-foreground">A processar com IA...</p>
            {transcription && (
              <div className="rounded-xl bg-muted/30 border p-3 w-full mt-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Transcrição</p>
                <p className="text-xs text-muted-foreground">{transcription}</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ Step: Review ═══ */}
        {step === 'review' && (
          <div className="space-y-4 py-2">
            {/* Note summary — editable */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nota (editável)</Label>
              <Textarea
                rows={4}
                value={noteSummary}
                onChange={e => setNoteSummary(e.target.value)}
                className="text-sm"
              />
            </div>

            <Separator />

            {/* Extracted fields */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Campos a preencher</Label>
                {fieldEntries.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] rounded-full">{fieldEntries.length} campo{fieldEntries.length !== 1 ? 's' : ''}</Badge>
                )}
              </div>

              {fieldEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum campo adicional detectado.</p>
              ) : (
                <div className="space-y-2">
                  {fieldEntries.map(([key, value]) => {
                    const meta = fieldLabels[key]
                    if (!meta) return null
                    const Icon = meta.icon
                    const isLong = typeof value === 'string' && value.length > 60
                    return (
                      <div key={key} className="rounded-xl border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', meta.color)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted-foreground font-medium">{meta.label}</p>
                              {isLong ? (
                                <textarea
                                  value={String(value)}
                                  onChange={e => setExtractedFields(prev => ({ ...prev, [key]: e.target.value }))}
                                  rows={2}
                                  className="w-full text-xs font-medium mt-0.5 bg-transparent border-0 p-0 focus:outline-none resize-none"
                                />
                              ) : (
                                <input
                                  value={String(value)}
                                  onChange={e => setExtractedFields(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-full text-xs font-medium mt-0.5 bg-transparent border-0 p-0 focus:outline-none"
                                />
                              )}
                            </div>
                          </div>
                          <button type="button" onClick={() => removeField(key)}
                            className="shrink-0 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {step === 'review' && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => { setStep('input'); setNoteSummary(''); setExtractedFields({}) }}>
              Recomeçar
            </Button>
            <Button className="rounded-full gap-1.5 w-full sm:w-auto" disabled={saving || !noteSummary.trim()} onClick={handleConfirm}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirmar e Guardar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
