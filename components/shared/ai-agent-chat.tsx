'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Infinity, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Quantas leads novas tenho esta semana?',
  'Quais são as minhas tarefas pendentes?',
  'Resume os meus KPIs',
  'Imóveis disponíveis em Lisboa',
]

export function AiAgentChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [messages, loading])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) throw new Error()
      const { message } = await res.json()

      setMessages(prev => [...prev, { role: 'assistant', content: message }])
    } catch {
      toast.error('Erro ao comunicar com o assistente')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted/50 transition-colors"
        >
          <Infinity className="size-4" />
          <span className="sr-only">Assistente IA</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[75vh] max-h-[650px] flex flex-col p-0 !rounded-t-3xl overflow-hidden">
        {/* Header */}
        <SheetHeader className="shrink-0 px-5 pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />
          <SheetTitle className="text-center text-sm font-medium italic text-muted-foreground">
            Infinitas possibilidades, basta perguntar
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-4 pt-4">
                <div className="text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Infinity className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium">Como posso ajudar?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pergunte sobre leads, imóveis, tarefas, calendário...
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left text-[11px] rounded-xl border p-3 transition-colors hover:bg-muted/50 text-muted-foreground"
                    >
                      <Sparkles className="h-3 w-3 inline-block mr-1.5 opacity-40" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl px-3.5 py-2.5 max-w-[85%] animate-in fade-in slide-in-from-top-1 duration-200',
                  msg.role === 'user'
                    ? 'bg-neutral-900 text-white dark:bg-neutral-700 ml-auto'
                    : 'bg-muted/60 mr-auto'
                )}
              >
                <div className="text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2">
                <Spinner variant="infinite" size={12} />
                A pensar...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="shrink-0 border-t p-3 flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="Pergunte algo..."
            rows={1}
            className="rounded-xl text-xs resize-none flex-1 min-h-[36px] max-h-[80px]"
            disabled={loading}
          />
          <Button
            size="icon"
            className="rounded-full h-9 w-9 shrink-0"
            disabled={!input.trim() || loading}
            onClick={() => sendMessage(input)}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
