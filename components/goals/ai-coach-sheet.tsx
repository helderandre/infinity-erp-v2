'use client'

import { useState, useRef, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Send, RotateCcw, Sparkles } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AICoachSheetProps {
  goalId: string | null
  consultantName?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const INITIAL_PROMPT = 'Olá. Faz-me um diagnóstico rápido: como estou hoje e onde devo focar?'

const QUICK_PROMPTS = [
  'Porque estou atrás do ritmo?',
  'O que devo focar amanhã?',
  'Qual a fase do funil mais fraca?',
  'Como posso recuperar o gap?',
]

export function AICoachSheet({ goalId, consultantName, open, onOpenChange }: AICoachSheetProps) {
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef<string | null>(null)

  // Auto-start conversation when sheet opens for a new goal
  useEffect(() => {
    if (open && goalId && startedRef.current !== goalId) {
      startedRef.current = goalId
      setMessages([])
      sendMessage(INITIAL_PROMPT, true)
    }
    if (!open) {
      // Reset on close so a re-open with the same goal also restarts
      startedRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goalId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  async function sendMessage(content: string, isInitial = false) {
    if (!goalId) return
    const userMessage: Message = { role: 'user', content }
    const updated = isInitial ? [userMessage] : [...messages, userMessage]
    if (!isInitial) setMessages(updated)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch(`/api/goals/${goalId}/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Erro na comunicação')
      }
      const data = await res.json()
      setMessages([...updated, { role: 'assistant', content: data.reply || 'Sem resposta.' }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao comunicar com o coach')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
  }

  function handleReset() {
    setMessages([])
    setTimeout(() => sendMessage(INITIAL_PROMPT, true), 50)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10 border-b border-border/30">
          <div className="flex items-start justify-between gap-4">
            <SheetHeader className="p-0 gap-0 flex-1 min-w-0">
              <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-orange-500" />
                Coach
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-1 truncate">
                {consultantName ? `Coaching para ${consultantName}` : 'Diagnóstico em tempo real'}
              </SheetDescription>
            </SheetHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading || !goalId}
              className="rounded-full h-8 text-xs shrink-0"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reiniciar
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 sm:px-6 py-4" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-12 text-xs text-muted-foreground">
                A iniciar diagnóstico...
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm',
                    m.role === 'user'
                      ? 'bg-foreground text-background'
                      : 'bg-white border border-border/40',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-border/40 rounded-2xl px-3.5 py-2 shadow-sm">
                  <Spinner variant="infinite" size={16} />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick prompts */}
        {messages.length <= 2 && !isLoading && (
          <div className="shrink-0 px-4 sm:px-6 pb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                disabled={isLoading || !goalId}
                className="rounded-full border bg-white/60 backdrop-blur-sm px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form onSubmit={handleSubmit} className="shrink-0 px-4 sm:px-6 pb-5 pt-3 flex gap-2 border-t border-border/30 bg-background/40">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunta ao coach..."
            disabled={isLoading || !goalId}
            className="rounded-full bg-white/80"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading || !goalId} className="rounded-full shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
