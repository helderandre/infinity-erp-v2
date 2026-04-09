'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Loader2, Mic, MicOff, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AiFillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  negocioId: string
  onApply: (fields: Record<string, unknown>) => void
}

// SpeechRecognition cross-browser type
type SpeechRecognitionLike = {
  start: () => void
  stop: () => void
  abort: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function AiFillDialog({ open, onOpenChange, negocioId, onApply }: AiFillDialogProps) {
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [recording, setRecording] = useState(false)
  const [filling, setFilling] = useState(false)
  const [supportsLive, setSupportsLive] = useState(true)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Snapshot of the committed text at the moment recording started.
  // Used so each "result" event resets the live portion correctly.
  const baseTextRef = useRef<string>('')

  useEffect(() => {
    setSupportsLive(getSpeechRecognition() != null)
  }, [])

  function reset() {
    setText('')
    setInterim('')
    setRecording(false)
    setFilling(false)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
  }

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
  }, [])

  const startRecording = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) {
      toast.error('Reconhecimento de voz não suportado neste browser')
      return
    }
    try {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'pt-PT'

      baseTextRef.current = text ? text + (text.endsWith('\n') ? '' : '\n') : ''

      rec.onresult = (event: any) => {
        let finalChunk = ''
        let interimChunk = ''
        // Each onresult fires with the full results buffer; iterate from 0
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i]
          const transcript = r[0]?.transcript ?? ''
          if (r.isFinal) {
            finalChunk += transcript
          } else {
            interimChunk += transcript
          }
        }
        setText(baseTextRef.current + finalChunk)
        setInterim(interimChunk)
      }

      rec.onerror = (event: any) => {
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          toast.error('Permissão de microfone negada')
        } else if (event?.error === 'no-speech') {
          // silent
        } else {
          toast.error('Erro no reconhecimento de voz')
        }
      }

      rec.onend = () => {
        setRecording(false)
        // Promote any leftover interim text
        setInterim((cur) => {
          if (cur) {
            setText((t) => t + (t.endsWith(' ') || cur.startsWith(' ') ? '' : ' ') + cur)
          }
          return ''
        })
        recognitionRef.current = null
      }

      recognitionRef.current = rec
      rec.start()
      setRecording(true)
    } catch (e) {
      toast.error('Não foi possível iniciar a gravação')
    }
  }, [text])

  // Cleanup on unmount / when dialog closes
  useEffect(() => {
    if (!open && recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
        recognitionRef.current = null
      }
    }
  }, [open])

  async function handleFill() {
    const finalText = (text + (interim ? ' ' + interim : '')).trim()
    if (!finalText) return
    // Make sure we stop recording before sending
    if (recording) stopRecording()
    setFilling(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/fill-from-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalText }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Erro ao processar')
      }
      const data = await res.json()
      const fields = data?.fields || data || {}
      onApply(fields)
      toast.success('Campos preenchidos pela IA')
      onOpenChange(false)
      reset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao preencher')
    } finally {
      setFilling(false)
    }
  }

  // Combined display value: committed text + live interim chunk
  const displayValue = text + (interim ? (text.endsWith(' ') || text === '' ? '' : ' ') + interim : '')

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent className="sm:max-w-[520px] !rounded-2xl !p-0 !gap-0 !ring-0 overflow-hidden" showCloseButton={false}>
        <div className="bg-neutral-900 px-6 py-5">
          <DialogTitle className="flex items-center gap-2.5 text-white">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            Preencher com IA
          </DialogTitle>
          <DialogDescription className="text-neutral-400 mt-1">
            Cole texto livre ou grave uma nota de voz. A IA extrai os dados e preenche o negócio.
          </DialogDescription>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="relative">
            <Textarea
              value={displayValue}
              onChange={(e) => {
                setText(e.target.value)
                setInterim('')
              }}
              placeholder={
                recording
                  ? 'A ouvir... fale agora.'
                  : 'Cliente procura T2 em Cascais até 350.000€, com varanda e estacionamento...'
              }
              rows={6}
              className={cn(
                'text-sm resize-y rounded-lg pr-3',
                interim && 'text-foreground',
              )}
              disabled={filling}
              autoFocus
            />
            {recording && (
              <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                A gravar
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={recording ? 'destructive' : 'outline'}
              size="sm"
              className="rounded-full gap-1.5 h-8"
              onClick={recording ? stopRecording : startRecording}
              disabled={filling || !supportsLive}
              title={!supportsLive ? 'Reconhecimento de voz não suportado neste browser' : undefined}
            >
              {recording ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  Parar
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  Gravar voz
                </>
              )}
            </Button>
            {!supportsLive && (
              <span className="text-[10px] text-muted-foreground">Browser sem suporte</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border/60 bg-background">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
            disabled={filling}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button
            className="rounded-full px-5"
            onClick={handleFill}
            disabled={(!text.trim() && !interim.trim()) || filling}
          >
            {filling ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Preencher campos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
