'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Mic, MicOff, Sparkles, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface GoalQuickFillProps {
  onApply: (fields: Record<string, unknown>) => void
}

export function GoalQuickFill({ onApply }: GoalQuickFillProps) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const handleExtract = async () => {
    if (!text.trim()) return
    setIsExtracting(true)
    try {
      const res = await fetch('/api/goals/fill-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro na extracção')
      }

      const data = (await res.json()) as Record<string, unknown>
      const count = Object.values(data).filter((v) => v !== null && v !== undefined && v !== '').length

      if (count === 0) {
        toast.warning('Nenhum campo foi reconhecido no texto')
        return
      }

      onApply(data)
      toast.success(`${count} ${count === 1 ? 'campo preenchido' : 'campos preenchidos'}`)
      setText('')
      setExpanded(false)
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

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erro na transcrição')

      const data = await res.json()
      setText((prev) => (prev ? `${prev}\n${data.text}` : data.text))
      toast.success('Áudio transcrito')
    } catch {
      toast.error('Erro ao transcrever áudio')
    } finally {
      setIsTranscribing(false)
    }
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Preencher por voz ou texto</p>
          <p className="text-[11px] text-muted-foreground truncate">
            Ex: &quot;Marta, 150 mil anuais, 60% vendedores&quot;
          </p>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Descreve o objetivo... consultor, facturação anual, % vendedores/compradores, semanas de trabalho, etc."
            className="text-xs resize-none"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              onClick={handleExtract}
              disabled={!text.trim() || isExtracting}
              className="text-xs h-8"
            >
              {isExtracting ? (
                <Spinner variant="infinite" size={14} className="mr-1.5" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Preencher campos
            </Button>

            <Button
              type="button"
              size="sm"
              variant={isRecording ? 'destructive' : 'outline'}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className="text-xs h-8"
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
      )}
    </div>
  )
}
