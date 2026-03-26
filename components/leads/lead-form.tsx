'use client'

import { useState, useRef, useCallback } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { LEAD_ORIGENS } from '@/lib/constants'
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeadFormProps {
  consultants: { id: string; commercial_name: string }[]
  onSuccess?: (id: string) => void
  onCancel?: () => void
}

export function LeadForm({ consultants, onSuccess, onCancel }: LeadFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Audio recording
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
  })

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await processAudio(blob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
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
      // 1. Transcribe
      const formData = new FormData()
      formData.append('audio', blob)
      const transcribeRes = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!transcribeRes.ok) throw new Error('Erro na transcrição')
      const { text } = await transcribeRes.json()
      setTranscription(text)

      // 2. Extract fields
      const extractRes = await fetch('/api/leads/extract-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!extractRes.ok) throw new Error('Erro ao extrair dados')
      const { fields } = await extractRes.json()

      // 3. Fill form fields
      if (fields.nome) setValue('nome', fields.nome)
      if (fields.email) setValue('email', fields.email)
      if (fields.telemovel) setValue('telemovel', fields.telemovel)
      if (fields.telefone) setValue('telefone', fields.telefone)
      if (fields.origem) setValue('origem', fields.origem)
      if (fields.observacoes) {
        const current = watch('observacoes') || ''
        setValue('observacoes', current ? `${current}\n\n${fields.observacoes}` : fields.observacoes)
      }

      toast.success('Dados extraídos com sucesso')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao processar áudio')
    } finally {
      setIsProcessing(false)
    }
  }

  const processText = async (text: string) => {
    if (!text.trim()) return
    setIsProcessing(true)
    try {
      const extractRes = await fetch('/api/leads/extract-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!extractRes.ok) throw new Error('Erro ao extrair dados')
      const { fields } = await extractRes.json()

      if (fields.nome) setValue('nome', fields.nome)
      if (fields.email) setValue('email', fields.email)
      if (fields.telemovel) setValue('telemovel', fields.telemovel)
      if (fields.telefone) setValue('telefone', fields.telefone)
      if (fields.origem) setValue('origem', fields.origem)
      if (fields.observacoes) {
        const current = watch('observacoes') || ''
        setValue('observacoes', current ? `${current}\n\n${fields.observacoes}` : fields.observacoes)
      }

      toast.success('Dados extraídos com sucesso')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao extrair dados')
    } finally {
      setIsProcessing(false)
    }
  }

  const onSubmit = async (data: CreateLeadInput) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar lead')
      }

      const { id } = await res.json()
      toast.success('Contacto criado com sucesso')
      if (onSuccess) {
        onSuccess(id)
      } else {
        router.push(`/dashboard/leads/${id}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar lead')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* AI Quick-fill — audio or text */}
      <div className="rounded-2xl border bg-neutral-50 dark:bg-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preenchimento por voz ou texto</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Grave um áudio ou cole um texto com as informações do lead e a IA preenche os campos automaticamente.
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'outline'}
            size="sm"
            className="rounded-full gap-2"
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
              <>
                <Mic className="h-3.5 w-3.5" />
                Gravar Áudio
              </>
            )}
          </Button>
          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              A processar...
            </span>
          )}
        </div>
        {/* Text paste option */}
        <div className="space-y-1.5">
          <Textarea
            placeholder="Ou cole aqui um texto / mensagem com os dados do lead..."
            rows={2}
            className="text-xs resize-none"
            id="ai-text-input"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full text-xs gap-1.5"
            disabled={isProcessing}
            onClick={() => {
              const el = document.getElementById('ai-text-input') as HTMLTextAreaElement
              if (el?.value) processText(el.value)
            }}
          >
            <Sparkles className="h-3 w-3" />
            Extrair dados do texto
          </Button>
        </div>
        {transcription && (
          <div className="rounded-xl bg-white dark:bg-neutral-900 border p-3 text-xs text-muted-foreground">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1">Transcrição</p>
            <p className="leading-relaxed">{transcription}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            placeholder="Nome do lead"
            {...register('nome')}
          />
          {errors.nome && (
            <p className="text-sm text-destructive">{errors.nome.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telemovel">Telemóvel</Label>
            <MaskInput
              mask={phonePTMask}
              placeholder="+351 9XX XXX XXX"
              onValueChange={(_masked, unmasked) => {
                setValue('telemovel', unmasked)
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="origem">Origem</Label>
            <Select onValueChange={(v) => setValue('origem', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar origem" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_ORIGENS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent_id">Consultor</Label>
            <Select onValueChange={(v) => setValue('agent_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Atribuir consultor" />
              </SelectTrigger>
              <SelectContent>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            placeholder="Notas sobre o lead..."
            rows={3}
            {...register('observacoes')}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel || (() => router.back())}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner variant="infinite" size={16} className="mr-2" />}
          Criar Contacto
        </Button>
      </div>
    </form>
  )
}
