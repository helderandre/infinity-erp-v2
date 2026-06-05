'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Languages, PenLine, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import type { WppMessage } from '@/lib/types/whatsapp-web'

interface AiSuggestButtonProps {
  messages: WppMessage[]
  draft: string
  contactLeadId?: string | null
  onSuggestion: (text: string) => void
  disabled?: boolean
}

export function AiSuggestButton({ messages, draft, contactLeadId, onSuggestion, disabled }: AiSuggestButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleAction(action: 'suggest' | 'rephrase' | 'translate') {
    if (action !== 'suggest' && !draft.trim()) {
      toast.error('Escreva uma mensagem primeiro para reformular ou traduzir')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/whatsapp/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-15).map((m) => ({
            text: m.text,
            from_me: m.from_me,
            sender_name: m.sender_name,
          })),
          draft: draft.trim() || undefined,
          contactLeadId,
          action,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao gerar sugestão')
      }

      const data = await res.json()
      if (data.suggestion) {
        onSuggestion(data.suggestion)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar sugestão'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" disabled>
        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0 text-violet-500 hover:text-violet-600 hover:bg-violet-50"
                disabled={disabled}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Assistente IA</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onClick={() => handleAction('suggest')}>
          <MessageSquareText className="mr-2 h-4 w-4" />
          Sugerir resposta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('rephrase')} disabled={!draft.trim()}>
          <PenLine className="mr-2 h-4 w-4" />
          Reformular mensagem
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('translate')} disabled={!draft.trim()}>
          <Languages className="mr-2 h-4 w-4" />
          Traduzir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
