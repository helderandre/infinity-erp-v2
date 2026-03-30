'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/kibo-ui/spinner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Globe, Send, ExternalLink, Sparkles, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MarketResearchProps {
  /** Optional context to improve results (e.g. property details, location) */
  context?: string
  /** Pre-filled suggested queries */
  suggestions?: string[]
  /** Trigger button variant */
  variant?: 'button' | 'icon'
  /** Custom trigger label */
  label?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: string[]
}

const DEFAULT_SUGGESTIONS = [
  'Qual o preço médio por m2 nesta zona?',
  'Como está o mercado imobiliário em Portugal?',
  'Quais as tendências de arrendamento em Lisboa?',
  'Qual a rentabilidade média de imóveis para investimento?',
]

export function MarketResearch({
  context,
  suggestions = DEFAULT_SUGGESTIONS,
  variant = 'button',
  label = 'Pesquisa de Mercado',
}: MarketResearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    const userMsg: Message = { role: 'user', content: searchQuery }
    setMessages(prev => [...prev, userMsg])
    setQuery('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/market-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, context }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro')
      }

      const { answer, citations } = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: answer, citations }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na pesquisa')
      setMessages(prev => prev.slice(0, -1)) // remove user msg on error
    } finally {
      setLoading(false)
    }
  }, [context])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
            <Globe className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="rounded-full gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            {label}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Pesquisa de Mercado
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Pesquisa em tempo real com dados actualizados do mercado imobiliário
          </p>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Sugestões</p>
                <div className="grid gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSearch(s)}
                      className="text-left text-xs rounded-xl border p-3 transition-colors hover:bg-muted/50"
                    >
                      <Sparkles className="h-3 w-3 inline-block mr-1.5 text-muted-foreground" />
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
                  'rounded-xl p-3',
                  msg.role === 'user'
                    ? 'bg-neutral-900 text-white dark:bg-neutral-700 ml-8'
                    : 'bg-muted/50 mr-4'
                )}
              >
                <div className="text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Fontes</p>
                    {msg.citations.map((url, j) => (
                      <a
                        key={j}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline truncate"
                      >
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        {url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
                <Spinner variant="infinite" size={14} />
                A pesquisar...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex gap-2 pt-2 border-t">
          <Textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSearch(query)
              }
            }}
            placeholder="Faça uma pergunta sobre o mercado..."
            rows={2}
            className="rounded-xl text-xs resize-none flex-1"
            disabled={loading}
          />
          <Button
            size="icon"
            className="rounded-full h-10 w-10 shrink-0 self-end"
            disabled={!query.trim() || loading}
            onClick={() => handleSearch(query)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
