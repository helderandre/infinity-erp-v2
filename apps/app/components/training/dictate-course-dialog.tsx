'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Mic, MicOff, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { VoiceFillResponse } from '@/types/training'

interface DictateCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (fields: Partial<VoiceFillResponse['fields']> & { category_id?: string }, categoryMatch: VoiceFillResponse['category_match']) => void
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  summary: 'Resumo',
  description: 'Descrição',
  difficulty_level: 'Dificuldade',
  instructor_name: 'Formador',
  estimated_duration_minutes: 'Duração (min)',
  is_mandatory: 'Obrigatória',
  has_certificate: 'Emitir certificado',
  passing_score: 'Nota mínima (%)',
  tags: 'Tags',
  category_name: 'Categoria (não encontrada)',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermédio',
  advanced: 'Avançado',
}

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.join(', ') || '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (key === 'difficulty_level' && typeof value === 'string') {
    return DIFFICULTY_LABELS[value] ?? value
  }
  return String(value)
}

export function DictateCourseDialog({ open, onOpenChange, onApply }: DictateCourseDialogProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'uploading'>('idle')
  const [result, setResult] = useState<VoiceFillResponse | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledRef = useRef(false)

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setState('idle')
      setResult(null)
      stopStream()
    }
  }, [open])

  // Cleanup on unmount
  useEffect(() => () => stopStream(), [])

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const uploadBlob = useCallback(async (blob: Blob) => {
    setState('uploading')
    try {
      const formData = new FormData()
      formData.append('audio', blob)
      const res = await fetch('/api/training/courses/fill-from-voice', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Erro ao processar áudio')
      }
      const data: VoiceFillResponse = await res.json()
      setResult(data)
      if (Object.keys(data.fields).length === 0) {
        toast.info('Não consegui extrair dados da gravação.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar áudio')
    } finally {
      setState('idle')
    }
  }, [])

  const startRecording = useCallback(async () => {
    cancelledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stopStream()
        if (cancelledRef.current) {
          chunksRef.current = []
          setState('idle')
          return
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []
        await uploadBlob(blob)
      }
      mr.start()
      setState('recording')
    } catch (err) {
      const name = (err as Error & { name?: string })?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        toast.error('Permissão de microfone negada')
      } else {
        toast.error('Não foi possível aceder ao microfone')
      }
      setState('idle')
    }
  }, [uploadBlob])

  const stopRecording = useCallback((cancel = false) => {
    cancelledRef.current = cancel
    const mr = mediaRecorderRef.current
    try { mr && mr.state !== 'inactive' && mr.stop() } catch {}
  }, [])

  const handleMicClick = () => {
    if (state === 'idle') startRecording()
    else if (state === 'recording') stopRecording(false)
  }

  const handleApply = () => {
    if (!result) return
    onApply(result.fields, result.category_match)
    onOpenChange(false)
  }

  const entries = useMemo(() => {
    if (!result) return [] as Array<[string, unknown]>
    return Object.entries(result.fields).filter(([, v]) => v !== null && v !== undefined && v !== '')
  }, [result])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Ditar formação
          </DialogTitle>
          <DialogDescription>
            Grave uma descrição falada (ex.: título, dificuldade, duração, formador) e a IA preenche os campos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center gap-4 py-6">
          <Button
            type="button"
            size="lg"
            variant={state === 'recording' ? 'destructive' : 'default'}
            onClick={handleMicClick}
            disabled={state === 'uploading'}
            className={cn('h-20 w-20 rounded-full', state === 'recording' && 'animate-pulse')}
            aria-label={state === 'recording' ? 'Parar gravação' : 'Iniciar gravação'}
          >
            {state === 'uploading'
              ? <Loader2 className="h-8 w-8 animate-spin" />
              : state === 'recording'
                ? <MicOff className="h-8 w-8" />
                : <Mic className="h-8 w-8" />}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            {state === 'recording'
              ? 'A gravar… clique para parar.'
              : state === 'uploading'
                ? 'A transcrever e extrair campos…'
                : 'Clique no microfone e fale.'}
          </p>
        </div>

        {result && (
          <>
            <Separator />
            <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
              {result.transcription && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Transcrição</p>
                  <p className="text-sm rounded-md border bg-muted/40 p-3 leading-relaxed">
                    {result.transcription}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Campos extraídos {entries.length > 0 && <Badge variant="secondary" className="ml-1">{entries.length}</Badge>}
                </p>
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhum campo reconhecido. Tente gravar novamente com mais detalhe.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {entries.map(([key, value]) => (
                      <div key={key} className="rounded-md border px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {FIELD_LABELS[key] ?? key}
                        </p>
                        <p className="text-sm font-medium truncate">
                          {formatFieldValue(key, value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {result.category_match && (
                  <p className="mt-3 text-xs text-emerald-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Categoria reconhecida: <strong>{result.category_match.name}</strong>
                  </p>
                )}
                {result.fields.category_name && !result.category_match && (
                  <p className="mt-3 text-xs text-amber-600">
                    Categoria mencionada (<strong>{result.fields.category_name as string}</strong>) não encontrada — seleccione manualmente.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={!result || entries.length === 0}
          >
            <Check className="mr-2 h-4 w-4" />
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
