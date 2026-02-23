'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Send, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface NegocioChatProps {
  negocioId: string
  onFieldsExtracted: (fields: Record<string, unknown>) => void
}

export function NegocioChat({ negocioId, onFieldsExtracted }: NegocioChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Start conversation
  useEffect(() => {
    if (messages.length === 0) {
      sendMessage('Olá, quero preencher os dados deste negócio.', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendMessage = async (content: string, isInitial = false) => {
    const userMessage: Message = { role: 'user', content }

    const updatedMessages = isInitial
      ? [userMessage]
      : [...messages, userMessage]

    if (!isInitial) {
      setMessages(updatedMessages)
    }

    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch(`/api/negocios/${negocioId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) {
        throw new Error('Erro na comunicação')
      }

      const data = await res.json()
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply || 'Sem resposta.',
      }

      setMessages([...updatedMessages, assistantMessage])

      // Aplicar campos extraidos
      if (data.fields && Object.keys(data.fields).length > 0) {
        onFieldsExtracted(data.fields)
        toast.success('Campos actualizados pelo assistente')
      }
    } catch {
      toast.error('Erro ao comunicar com o assistente')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
  }

  const handleReset = () => {
    setMessages([])
    setTimeout(() => {
      sendMessage('Olá, quero preencher os dados deste negócio.', true)
    }, 100)
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Assistente IA</h4>
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={isLoading}>
          <RotateCcw className="mr-1 h-3 w-3" />
          Reiniciar
        </Button>
      </div>

      <ScrollArea className="flex-1 pr-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card className={`max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : ''}`}>
                <CardContent className="py-2 px-3">
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </CardContent>
              </Card>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <Card>
                <CardContent className="py-2 px-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva a sua resposta..."
          disabled={isLoading}
        />
        <Button type="submit" size="sm" disabled={!input.trim() || isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
