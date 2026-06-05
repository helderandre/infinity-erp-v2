'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Loader2, Forward, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { createClient } from '@/lib/supabase/client'
import type { WppMessage } from '@/lib/types/whatsapp-web'

interface ForwardDialogProps {
  open: boolean
  onClose: () => void
  messages: WppMessage[]
  instanceId: string
}

interface ChatOption {
  id: string
  wa_chat_id: string
  name: string | null
  profile_pic_url: string | null
  is_group: boolean
}

export function ForwardDialog({ open, onClose, messages, instanceId }: ForwardDialogProps) {
  const [search, setSearch] = useState('')
  const [chats, setChats] = useState<ChatOption[]>([])
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  // Fetch chats for selection
  const fetchChats = useCallback(async (query: string) => {
    if (!instanceId) return
    setIsLoading(true)
    try {
      const supabase = createClient() as any
      let q = supabase
        .from('wpp_chats')
        .select('id, wa_chat_id, name, profile_pic_url, is_group')
        .eq('instance_id', instanceId)
        .order('last_message_timestamp', { ascending: false })
        .limit(30)

      if (query) {
        q = q.ilike('name', `%${query}%`)
      }

      const { data } = await q
      setChats(data || [])
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [instanceId])

  useEffect(() => {
    if (open) {
      fetchChats(debouncedSearch)
    }
  }, [open, debouncedSearch, fetchChats])

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch('')
      setSelectedChats(new Set())
    }
  }, [open])

  const toggleChat = (chatId: string) => {
    setSelectedChats(prev => {
      const next = new Set(prev)
      if (next.has(chatId)) next.delete(chatId)
      else next.add(chatId)
      return next
    })
  }

  const handleForward = useCallback(async () => {
    if (selectedChats.size === 0 || messages.length === 0) return

    setIsSending(true)
    const toastId = toast.loading(
      `A reencaminhar ${messages.length} mensagem(ns) para ${selectedChats.size} conversa(s)...`
    )

    try {
      const targetChats = chats.filter(c => selectedChats.has(c.id))

      // For each message, forward to each selected chat
      for (const msg of messages) {
        for (const target of targetChats) {
          await fetch('/api/whatsapp/forward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instance_id: instanceId,
              wa_message_id: msg.wa_message_id,
              to_wa_chat_id: target.wa_chat_id,
            }),
          })
        }
      }

      toast.success(
        `${messages.length} mensagem(ns) reencaminhada(s) com sucesso`,
        { id: toastId }
      )
      onClose()
    } catch {
      toast.error('Erro ao reencaminhar mensagens', { id: toastId })
    } finally {
      setIsSending(false)
    }
  }, [messages, selectedChats, chats, instanceId, onClose])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-4 w-4" />
            Reencaminhar {messages.length > 1 ? `${messages.length} mensagens` : 'mensagem'}
          </DialogTitle>
        </DialogHeader>

        {/* Selected messages preview */}
        {messages.length > 0 && (
          <div className="bg-muted/50 rounded-md px-3 py-2 max-h-[80px] overflow-y-auto">
            {messages.slice(0, 3).map((msg) => (
              <div key={msg.id} className="text-xs text-muted-foreground truncate">
                {msg.from_me ? 'Você' : (msg.sender_name || 'Contacto')}: {msg.text || msg.message_type}
              </div>
            ))}
            {messages.length > 3 && (
              <div className="text-xs text-muted-foreground mt-0.5">
                +{messages.length - 3} mais...
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Chat list */}
        <div className="max-h-[300px] overflow-y-auto -mx-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma conversa encontrada
            </div>
          ) : (
            chats.map((chat) => {
              const isSelected = selectedChats.has(chat.id)
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => toggleChat(chat.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors rounded-md text-left ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      {chat.profile_pic_url && <AvatarImage src={chat.profile_pic_url} />}
                      <AvatarFallback className="text-xs">
                        {(chat.name || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isSelected && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {chat.name || chat.wa_chat_id}
                      </span>
                      {chat.is_group && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">Grupo</Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button
            onClick={handleForward}
            disabled={selectedChats.size === 0 || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Forward className="h-4 w-4 mr-2" />
            )}
            Reencaminhar{selectedChats.size > 0 ? ` (${selectedChats.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
