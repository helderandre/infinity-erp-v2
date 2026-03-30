'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createLeadSchema, type CreateLeadInput } from '@/lib/validations/lead'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MaskInput } from '@/components/ui/mask-input'
import { Textarea } from '@/components/ui/textarea'
import { phonePTMask } from '@/lib/masks'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { LEAD_ORIGENS } from '@/lib/constants'
import {
  Mic, MicOff, Loader2, Sparkles, Users, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (id: string) => void
}

export function ContactDialog({ open, onOpenChange, onComplete }: ContactDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [aiExpanded, setAiExpanded] = useState(false)

  // Audio
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
  })

  useEffect(() => {
    if (open) {
      fetch('/api/users/consultants')
        .then(r => r.json())
        .then(d => setConsultants((d.data || d || []).map((c: Record<string, unknown>) => ({
          id: c.id as string, commercial_name: c.commercial_name as string,
        }))))
        .catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      reset()
      setTranscription(null)
      setAiExpanded(false)
    }
  }, [open, reset])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        await processAudio(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }
      mediaRecorder.start()
      setIsRecording(true)
    } catch { toast.error('Não foi possível aceder ao microfone') }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true)
    try {
      const fd = new FormData()
      fd.append('audio', blob)
      const trRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!trRes.ok) throw new Error()
      const { text } = await trRes.json()
      setTranscription(text)
      await extractAndFill(text)
    } catch { toast.error('Erro ao processar áudio') }
    finally { setIsProcessing(false) }
  }

  const extractAndFill = async (text: string) => {
    const res = await fetch('/api/leads/extract-from-text', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error()
    const { fields } = await res.json()
    if (fields.nome) setValue('nome', fields.nome)
    if (fields.email) setValue('email', fields.email)
    if (fields.telemovel) setValue('telemovel', fields.telemovel)
    if (fields.origem) setValue('origem', fields.origem)
    if (fields.observacoes) {
      const cur = watch('observacoes') || ''
      setValue('observacoes', cur ? `${cur}\n\n${fields.observacoes}` : fields.observacoes)
    }
    toast.success('Dados extraídos com sucesso')
  }

  const onSubmit = async (data: CreateLeadInput) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro') }
      const { id } = await res.json()
      toast.success('Contacto criado com sucesso')
      onOpenChange(false)
      onComplete?.(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar contacto')
    } finally { setIsSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 dark:bg-neutral-800 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-white text-lg">Nova Lead</DialogTitle>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* AI Section — collapsible */}
          <button
            type="button"
            onClick={() => setAiExpanded(!aiExpanded)}
            className="flex items-center gap-2 w-full text-left rounded-xl border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground flex-1">Preenchimento por voz ou texto</span>
            {aiExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {aiExpanded && (
            <div className="rounded-xl border bg-muted/20 p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'outline'}
                  size="sm"
                  className="rounded-full gap-2 h-8"
                  disabled={isProcessing}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-3.5 w-3.5" />
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      Parar
                    </>
                  ) : (
                    <><Mic className="h-3.5 w-3.5" /> Gravar</>
                  )}
                </Button>
                {isProcessing && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> A processar...
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ou cole texto com dados do contacto..."
                  rows={2} className="text-xs resize-none rounded-xl flex-1"
                  id="contact-ai-text"
                />
                <Button
                  type="button" variant="ghost" size="sm"
                  className="rounded-full text-xs gap-1 h-8 shrink-0 self-end"
                  disabled={isProcessing}
                  onClick={() => {
                    const el = document.getElementById('contact-ai-text') as HTMLTextAreaElement
                    if (el?.value) { setIsProcessing(true); extractAndFill(el.value).finally(() => setIsProcessing(false)) }
                  }}
                >
                  <Sparkles className="h-3 w-3" /> Extrair
                </Button>
              </div>
              {transcription && (
                <div className="rounded-lg bg-background border p-2.5 text-xs text-muted-foreground">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1">Transcrição</p>
                  <p className="leading-relaxed">{transcription}</p>
                </div>
              )}
            </div>
          )}

          {/* Form fields */}
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input {...register('nome')} className="rounded-xl" placeholder="Nome do contacto" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Email</Label>
                <Input type="email" {...register('email')} className="rounded-xl" placeholder="email@exemplo.com" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Telemóvel</Label>
                <MaskInput
                  mask={phonePTMask}
                  placeholder="+351 9XX XXX XXX"
                  className="rounded-xl"
                  onValueChange={(_m, u) => setValue('telemovel', u)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Origem</Label>
                <Select onValueChange={v => setValue('origem', v)}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Consultor</Label>
                <Select onValueChange={v => setValue('agent_id', v)}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Atribuir" /></SelectTrigger>
                  <SelectContent>
                    {consultants.map(c => <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea {...register('observacoes')} className="rounded-xl text-xs" rows={2} placeholder="Notas..." />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button type="button" variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full w-full sm:w-auto" disabled={isSubmitting}>
              {isSubmitting && <Spinner variant="infinite" size={14} className="mr-1.5" />}
              Criar Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
