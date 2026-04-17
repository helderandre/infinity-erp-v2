'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '@craftjs/core'
import { toast } from 'sonner'
import { Sparkles, Send, Mic, MicOff, Loader2, X } from 'lucide-react'
import { BorderBeam } from 'border-beam'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  extractAiResult,
  injectAiBodyIntoEditorState,
  bodyHasContent,
  type EmailMeta,
} from '@/lib/email/ai-state-injector'

const DEFAULT_SUGGESTIONS = [
  'Email de Feliz Aniversário',
  'Boas-vindas a novo cliente',
  'Proposta de imóvel',
  'Follow-up após visita',
  'Email de Feliz Natal',
  'Email de Ano Novo',
]

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  aniversario_contacto: [
    'Mensagem calorosa de parabéns com tom pessoal',
    'Parabéns formal com destaque nos serviços',
    'Parabéns simples e directo com CTA',
  ],
  aniversario_fecho: [
    'Celebrar aniversário da compra/venda do imóvel',
    'Lembrar o cliente do aniversário do negócio fechado',
  ],
  natal: [
    'Mensagem de Feliz Natal pessoal e calorosa',
    'Boas Festas formal com agradecimento pelo ano',
    'Natal com destaque em novos imóveis para o novo ano',
  ],
  ano_novo: [
    'Votos de Feliz Ano Novo pessoais',
    'Ano Novo com perspectivas do mercado imobiliário',
  ],
  festividade: [
    'Mensagem festiva genérica e calorosa',
    'Saudação de época com tom profissional',
  ],
}

// Web Speech API — not all browsers have types, so we use any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): (new () => any) | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return SR || null
}

interface AiGenerateInputProps {
  visible: boolean
  onClose: () => void
  onGeneratingChange?: (generating: boolean) => void
  onMetaGenerated?: (meta: EmailMeta) => void
  scope?: 'consultant' | 'global'
  category?: string
}

export function AiGenerateInput({
  visible,
  onClose,
  onGeneratingChange,
  onMetaGenerated,
  scope,
  category,
}: AiGenerateInputProps) {
  const { actions, query } = useEditor()
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamText, setStreamText] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const pendingPromptRef = useRef<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const suggestions = useMemo(() => {
    if (category && CATEGORY_SUGGESTIONS[category]) {
      return CATEGORY_SUGGESTIONS[category]
    }
    return DEFAULT_SUGGESTIONS
  }, [category])

  const showSuggestions = !prompt.trim() && !interimText && !isGenerating

  // Focus input when visible
  useEffect(() => {
    if (visible && inputRef.current && !isGenerating) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [visible, isGenerating])

  // Cleanup speech recognition on unmount or close
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  // Speech recognition — real-time transcription
  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      setInterimText('')
      return
    }

    const SRClass = getSpeechRecognition()
    if (!SRClass) {
      toast.error('O seu browser não suporta reconhecimento de voz')
      return
    }

    const recognition = new SRClass()
    recognition.lang = 'pt-PT'
    recognition.continuous = true
    recognition.interimResults = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interim += transcript
        }
      }

      if (finalTranscript) {
        setPrompt((prev) => {
          const separator = prev && !prev.endsWith(' ') ? ' ' : ''
          return prev + separator + finalTranscript
        })
        setInterimText('')
      } else {
        setInterimText(interim)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast.error('Erro no reconhecimento de voz')
      }
      setIsListening(false)
      setInterimText('')
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }, [isListening])

  const generate = useCallback(
    async (text: string) => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        setIsListening(false)
        setInterimText('')
      }

      setIsGenerating(true)
      setStreamText(null)
      onGeneratingChange?.(true)

      try {
        const res = await fetch('/api/libraries/emails/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text, scope, category }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
          throw new Error(err.error || `Erro ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('Stream indisponível')

        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })

          // Extract clean preview text — strip all marker blocks
          let preview = fullText

          // Remove meta block entirely
          const metaStart = preview.indexOf(':::EMAIL_META_START:::')
          const metaEnd = preview.indexOf(':::EMAIL_META_END:::')
          if (metaStart !== -1 && metaEnd !== -1) {
            preview = preview.slice(0, metaStart) + preview.slice(metaEnd + ':::EMAIL_META_END:::'.length)
          } else if (metaStart !== -1) {
            preview = preview.slice(0, metaStart)
          }

          // Remove state block entirely (including partial markers)
          const stateStart = preview.indexOf(':::EMAIL_STATE_START:::')
          if (stateStart !== -1) {
            preview = preview.slice(0, stateStart)
          }

          // Also catch partial marker at the end (e.g. ":::EMAIL_S" being typed)
          const partialMarker = preview.indexOf(':::EMAIL_')
          if (partialMarker !== -1) {
            preview = preview.slice(0, partialMarker)
          }

          preview = preview.trim()
          if (preview) {
            setStreamText(preview)
          }
        }

        const result = extractAiResult(fullText)
        if (!result) {
          throw new Error('A IA não devolveu um template válido. Tente com uma descrição mais detalhada.')
        }

        const currentState = query.serialize()
        const newState = injectAiBodyIntoEditorState(currentState, result.nodes)
        actions.deserialize(newState)

        if (result.meta) {
          onMetaGenerated?.(result.meta)
        }

        toast.success('Template gerado e aplicado com sucesso')
        setPrompt('')
      } catch (err) {
        console.error('[ai-generate] Error:', err)
        toast.error(
          err instanceof Error
            ? err.message
            : 'Erro ao gerar template. Tente novamente.'
        )
      } finally {
        setIsGenerating(false)
        setStreamText(null)
        onGeneratingChange?.(false)
      }
    },
    [actions, query, onGeneratingChange, onMetaGenerated, scope, category]
  )

  const startGeneration = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const currentState = query.serialize()
      if (bodyHasContent(currentState)) {
        pendingPromptRef.current = trimmed
        setConfirmOpen(true)
      } else {
        setPrompt('')
        generate(trimmed)
      }
    },
    [query, generate]
  )

  const handleConfirmReplace = useCallback(() => {
    setConfirmOpen(false)
    if (pendingPromptRef.current) {
      const text = pendingPromptRef.current
      pendingPromptRef.current = null
      setPrompt('')
      generate(text)
    }
  }, [generate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        startGeneration(prompt)
      }
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [prompt, startGeneration, onClose]
  )

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  if (!visible) return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Substituir conteúdo</AlertDialogTitle>
          <AlertDialogDescription>
            O corpo do email já tem conteúdo. Ao gerar com IA, o conteúdo actual será substituído. Pretende continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmReplace}>
            Substituir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return (
    <>
      {/* Inline floating input */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-[580px] animate-in slide-in-from-bottom-3 fade-in duration-200">
        <BorderBeam active={isGenerating} colorVariant="colorful" size="md" theme="auto" strength={1} brightness={3} saturation={1.5} duration={2.4}>
          <div className="rounded-2xl border bg-background shadow-lg">
            {/* Generating state — replaces the input */}
            {isGenerating ? (
              <div className="flex items-center gap-3 px-4 py-4">
                <Sparkles className="h-5 w-5 text-amber-500 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">A gerar template com IA...</p>
                  {streamText && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 animate-in fade-in duration-200">
                      {streamText}
                    </p>
                  )}
                </div>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              </div>
            ) : (
              <>
                {/* Suggestions — only show when input is empty */}
                {showSuggestions && (
                  <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 flex-wrap animate-in fade-in duration-150">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    {suggestions.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent transition-colors text-[11px] py-0.5"
                        onClick={() => startGeneration(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Input row */}
                <div className={cn('flex items-end gap-2 px-3 pb-3', showSuggestions ? 'pt-1' : 'pt-3')}>
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={inputRef}
                      value={prompt + (interimText ? (prompt ? ' ' : '') + interimText : '')}
                      onChange={handleInput}
                      onKeyDown={handleKeyDown}
                      placeholder="Descreva o email que pretende criar..."
                      className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[36px] max-h-[120px] py-2"
                      rows={1}
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pb-1">
                    {/* Voice — real-time transcription */}
                    <Button
                      type="button"
                      variant={isListening ? 'destructive' : 'ghost'}
                      size="icon"
                      onClick={toggleListening}
                      className={cn('h-8 w-8', isListening && 'animate-pulse')}
                      title={isListening ? 'Parar ditado' : 'Ditar'}
                    >
                      {isListening ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>

                    {/* Submit */}
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => startGeneration(prompt)}
                      disabled={!prompt.trim()}
                      className="h-8 w-8"
                      title="Gerar template"
                    >
                      <Send className="h-4 w-4" />
                    </Button>

                    {/* Close */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="h-8 w-8 text-muted-foreground"
                      title="Fechar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </BorderBeam>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir conteúdo</AlertDialogTitle>
            <AlertDialogDescription>
              O corpo do email já tem conteúdo. Ao gerar com IA, o conteúdo actual será substituído. Pretende continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
