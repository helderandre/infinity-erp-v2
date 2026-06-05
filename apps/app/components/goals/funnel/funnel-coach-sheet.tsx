'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, RotateCcw, Sparkles, AlertTriangle } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { FunnelResponse } from '@/types/funnel'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  funnelSnapshot: FunnelResponse | null
  consultantName?: string | null
}

const INITIAL_PROMPT = 'Olá. Faz-me um diagnóstico rápido: como estamos e onde devo focar?'

const QUICK_PROMPTS_CONSULTANT = [
  'Porque estou atrás do ritmo?',
  'O que devo focar amanhã?',
  'Qual a etapa mais fraca?',
  'Como posso recuperar o gap?',
]

const QUICK_PROMPTS_TEAM = [
  'Quem está mais atrasado?',
  'Onde a equipa converte mal?',
  'Que etapa precisa mais atenção?',
  'O que pedir aos consultores esta semana?',
]

export function FunnelCoachSheet({
  open,
  onOpenChange,
  funnelSnapshot,
  consultantName,
}: Props) {
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dataIssues, setDataIssues] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef<string | null>(null)

  useEffect(() => {
    const key = funnelSnapshot
      ? `${funnelSnapshot.scope}:${funnelSnapshot.consultant.id}:${funnelSnapshot.period}:${funnelSnapshot.period_start}`
      : null
    if (open && key && startedRef.current !== key) {
      startedRef.current = key
      setMessages([])
      setDataIssues([])
      sendMessage(INITIAL_PROMPT, true)
    }
    if (!open) startedRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, funnelSnapshot])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  async function sendMessage(content: string, isInitial = false) {
    if (!funnelSnapshot) return
    const userMessage: Message = { role: 'user', content }
    const updated = isInitial ? [userMessage] : [...messages, userMessage]
    if (!isInitial) setMessages(updated)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/goals/funnel/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          funnel_snapshot: funnelSnapshot,
          consultant_name: consultantName,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Erro na comunicação')
      }
      const data = await res.json()
      setMessages([...updated, { role: 'assistant', content: data.reply || 'Sem resposta.' }])
      setDataIssues(data.data_issues || [])
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
    setDataIssues([])
    setTimeout(() => sendMessage(INITIAL_PROMPT, true), 50)
  }

  const isTeam = funnelSnapshot?.scope === 'team'
  const quickPrompts = isTeam ? QUICK_PROMPTS_TEAM : QUICK_PROMPTS_CONSULTANT
  const headerLabel = isTeam
    ? `Equipa · ${funnelSnapshot?.team_member_count ?? '?'} consultores`
    : consultantName || funnelSnapshot?.consultant.commercial_name || ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          'shadow-[0_24px_48px_-12px_rgba(0,0,0,0.32)]',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        {/* Header */}
        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10 border-b border-border/30">
          <div className="flex items-start justify-between gap-4">
            <SheetHeader className="p-0 gap-0 flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-orange-500" />
                AI · Coach
              </p>
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight mt-1">
                Diagnóstico
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-1.5 truncate">
                {headerLabel || 'Em tempo real'}
              </SheetDescription>
            </SheetHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading || !funnelSnapshot}
              className="rounded-full h-8 text-xs shrink-0 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reiniciar
            </Button>
          </div>
        </div>

        {/* Data quality issues banner */}
        {dataIssues.length > 0 && (
          <div className="shrink-0 mx-4 mt-3 rounded-2xl border border-amber-200/60 bg-amber-50/70 backdrop-blur-sm p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-xl bg-amber-100 ring-1 ring-amber-200/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-amber-700 font-medium tracking-wider uppercase">
                  Qualidade de dados
                </p>
                <p className="text-[12px] font-semibold text-amber-900 leading-tight mt-0.5">
                  Resolver antes de afinar performance
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-900/90 list-disc list-inside leading-snug">
                  {dataIssues.map((iss, i) => (
                    <li key={i}>{iss}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

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
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-background/70 backdrop-blur-sm border border-border/40 shadow-sm',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-background/70 backdrop-blur-sm border border-border/40 rounded-2xl px-3.5 py-2 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick prompts */}
        {messages.length <= 2 && !isLoading && (
          <div className="shrink-0 px-4 sm:px-6 pb-2 flex flex-wrap gap-1.5">
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                disabled={isLoading || !funnelSnapshot}
                className="rounded-full border border-border/40 bg-background/60 backdrop-blur-sm px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-background/90 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="shrink-0 px-4 sm:px-6 pb-5 pt-3 flex gap-2 border-t border-border/30 bg-background/40"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunta ao coach..."
            disabled={isLoading || !funnelSnapshot}
            className="rounded-full bg-background/80 border-border/40"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || !funnelSnapshot}
            className="rounded-full shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
