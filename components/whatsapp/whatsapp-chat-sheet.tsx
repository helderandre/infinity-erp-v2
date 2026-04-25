'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquareOff } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { EmptyState } from '@/components/shared/empty-state'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ChatThread } from './chat-thread'

interface WhatsappChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  phone: string
  contactName: string
}

type ResolveState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; chatId: string; instanceId: string }
  | { kind: 'no_instances' }
  | { kind: 'error'; message: string }

export function WhatsappChatSheet({ open, onOpenChange, phone, contactName }: WhatsappChatSheetProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [state, setState] = useState<ResolveState>({ kind: 'idle' })

  useEffect(() => {
    if (!open || !phone) return
    let cancelled = false
    setState({ kind: 'loading' })
    const params = new URLSearchParams({ phone })
    if (contactName) params.set('name', contactName)
    fetch(`/api/whatsapp/resolve-chat?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.found && data.chat_id && data.instance_id) {
          setState({ kind: 'ready', chatId: data.chat_id, instanceId: data.instance_id })
        } else if (data.reason === 'no_instances') {
          setState({ kind: 'no_instances' })
        } else {
          setState({ kind: 'error', message: data.error || 'Não foi possível iniciar a conversa.' })
        }
      })
      .catch(() => {
        if (cancelled) return
        setState({ kind: 'error', message: 'Erro ao iniciar conversa.' })
      })
    return () => {
      cancelled = true
    }
  }, [open, phone, contactName])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl bg-background',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl'
        )}
        onClick={(e) => e.stopPropagation()}
        data-no-long-press
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}
        <SheetTitle className="sr-only">Conversa WhatsApp com {contactName}</SheetTitle>
        {state.kind === 'loading' || state.kind === 'idle' ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : state.kind === 'no_instances' ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <EmptyState
              icon={MessageSquareOff}
              title="Sem WhatsApp configurado"
              description="Ligue uma instância de WhatsApp para conversar a partir do ERP."
              action={{
                label: 'Configurar WhatsApp',
                onClick: () => {
                  onOpenChange(false)
                  router.push('/dashboard/whatsapp')
                },
              }}
            />
          </div>
        ) : state.kind === 'error' ? (
          <div className="flex-1 flex items-center justify-center p-6 text-sm text-destructive">
            {state.message}
          </div>
        ) : (
          <div className={cn('flex-1 min-h-0 flex flex-col', isMobile && 'pt-3')}>
            <ChatThread
              chatId={state.chatId}
              instanceId={state.instanceId}
              onToggleInfo={() => {}}
              onBack={() => onOpenChange(false)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
