'use client'

import { useState, useEffect } from 'react'
import { Clock, Loader2, X, CheckCircle2, XCircle, AlertCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

interface ScheduledMessage {
  id: string
  text: string | null
  message_type: string
  scheduled_at: string
  status: string
  sent_at: string | null
  error_message: string | null
  created_at: string
  wpp_chats: {
    name: string | null
    phone: string | null
  }
}

export function ScheduledMessagesPanel() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function fetchMessages() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/whatsapp/scheduled?limit=50')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchMessages()
  }, [open])

  async function cancelMessage(id: string) {
    try {
      const res = await fetch(`/api/whatsapp/scheduled?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Mensagem cancelada')
      fetchMessages()
    } catch {
      toast.error('Erro ao cancelar mensagem')
    }
  }

  const pendingCount = messages.filter((m) => m.status === 'pending').length

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-3.5 w-3.5 text-amber-500" />
      case 'sent': return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      case 'cancelled': return <XCircle className="h-3.5 w-3.5 text-slate-400" />
      case 'failed': return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      default: return null
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente'
      case 'sent': return 'Enviada'
      case 'cancelled': return 'Cancelada'
      case 'failed': return 'Falhou'
      default: return status
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8 flex-shrink-0">
              <Calendar className="h-4 w-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-medium text-white">
                  {pendingCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Mensagens agendadas</TooltipContent>
      </Tooltip>

      <SheetContent side="right" className="w-full sm:w-96 p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Mensagens agendadas
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-60px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Sem mensagens agendadas
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((msg) => (
                <div key={msg.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(msg.status)}
                      <span className="text-xs font-medium">
                        {msg.wpp_chats?.name || msg.wpp_chats?.phone || 'Conversa'}
                      </span>
                    </div>
                    {msg.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => cancelMessage(msg.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <p className="text-sm line-clamp-2">{msg.text || `[${msg.message_type}]`}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(msg.scheduled_at), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        msg.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        msg.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                        msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {statusLabel(msg.status)}
                    </Badge>
                  </div>

                  {msg.error_message && (
                    <p className="text-xs text-red-500">{msg.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
