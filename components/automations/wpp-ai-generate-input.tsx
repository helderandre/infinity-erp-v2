'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  extractWppAiResult,
  cleanWppStreamText,
  type WppAiMeta,
} from '@/lib/automacao/wpp-ai-parser'
import type { WhatsAppTemplateMessage } from '@/lib/types/whatsapp-template'

const DEFAULT_SUGGESTIONS = [
  'Boas-vindas a novo lead',
  'Follow-up após visita',
  'Proposta de imóvel',
  'Lembrete de reunião',
  'Feliz Aniversário',
  'Feliz Natal',
]

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  aniversario_contacto: [
    'Parabéns calorosos e pessoais',
    'Parabéns simples e directo',
    'Parabéns com tom profissional',
  ],
  aniversario_fecho: [
    'Celebrar aniversário do negócio',
    'Lembrar a data especial da compra',
  ],
  natal: [
    'Feliz Natal pessoal e caloroso',
    'Boas Festas com agradecimento',
  ],
  ano_novo: [
    'Votos de Feliz Ano Novo',
    'Ano Novo com perspectivas',
  ],
  boas_vindas: [
    'Boas-vindas calorosas ao novo lead',
    'Apresentação e disponibilidade',
  ],
  follow_up: [
    'Follow-up após visita a imóvel',
    'Relembrar e perguntar interesse',
  ],
  festividade: [
    'Mensagem festiva calorosa',
    'Saudação de época',
  ],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): (new () => any) | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return SR || null
}

interface WppAiGenerateInputProps {
  visible: boolean
  onClose: () => void
  onResult: (messages: WhatsAppTemplateMessage[], meta: WppAiMeta | null) => void
  hasMessages: boolean
  scope?: 'consultant' | 'global'
  category?: string
}

export function WppAiGenerateInput({
  visible,
  onClose,
  onResult,
  hasMessages,
  scope,
  category,
}: WppAiGenerateInputProps) {
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

  useEffect(() => {
    if (visible && inputRef.current && !isGenerating) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [visible, isGenerating])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

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

      try {
        const res = await fetch('/api/automacao/templates-wpp/ai-generate', {
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

          const preview = cleanWppStreamText(fullText)
          if (preview) {
            setStreamText(preview)
          }
        }

        const result = extractWppAiResult(fullText)
        if (!result) {
          throw new Error('A IA não devolveu um template válido. Tente com uma descrição mais detalhada.')
        }

        onResult(result.messages, result.meta)
        toast.success('Template gerado com sucesso')
        setPrompt('')
      } catch (err) {
        console.error('[wpp-ai-generate] Error:', err)
        toast.error(
          err instanceof Error ? err.message : 'Erro ao gerar template. Tente novamente.'
        )
      } finally {
        setIsGenerating(false)
        setStreamText(null)
      }
    },
    [onResult, scope, category]
  )

  const startGeneration = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      if (hasMessages) {
        pendingPromptRef.current = trimmed
        setConfirmOpen(true)
      } else {
        setPrompt('')
        generate(trimmed)
      }
    },
    [hasMessages, generate]
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

  if (!visible && !isGenerating) return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Substituir mensagens</AlertDialogTitle>
          <AlertDialogDescription>
            O template já tem mensagens. Ao gerar com IA, as mensagens actuais serão substituídas. Pretende continuar?
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
      <div className="animate-in slide-in-from-bottom-3 fade-in duration-200">
        <BorderBeam active={isGenerating} colorVariant="colorful" size="md" theme="auto" strength={1} brightness={3} saturation={1.5} duration={2.4}>
          <div className="rounded-2xl border bg-background shadow-lg">
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

                <div className={cn('flex items-end gap-2 px-3 pb-3', showSuggestions ? 'pt-1' : 'pt-3')}>
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={inputRef}
                      value={prompt + (interimText ? (prompt ? ' ' : '') + interimText : '')}
                      onChange={handleInput}
                      onKeyDown={handleKeyDown}
                      placeholder="Descreva as mensagens WhatsApp que pretende criar..."
                      className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[36px] max-h-[120px] py-2"
                      rows={1}
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pb-1">
                    <Button
                      type="button"
                      variant={isListening ? 'destructive' : 'ghost'}
                      size="icon"
                      onClick={toggleListening}
                      className={cn('h-8 w-8', isListening && 'animate-pulse')}
                      title={isListening ? 'Parar ditado' : 'Ditar'}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>

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
            <AlertDialogTitle>Substituir mensagens</AlertDialogTitle>
            <AlertDialogDescription>
              O template já tem mensagens. Ao gerar com IA, as mensagens actuais serão substituídas. Pretende continuar?
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
