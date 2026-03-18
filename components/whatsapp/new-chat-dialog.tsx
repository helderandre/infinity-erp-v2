'use client'

import { useState, useCallback, useEffect } from 'react'
import { MessageSquarePlus, Search, Phone, User, Building2, UserRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { createClient } from '@/lib/supabase/client'

interface NewChatDialogProps {
  instanceId: string
  onChatCreated: (chatId: string) => void
}

interface ContactResult {
  id: string
  type: 'whatsapp' | 'lead' | 'owner'
  name: string
  phone: string
  avatar?: string | null
  waChatId?: string
  chatId?: string | null
}

export function NewChatDialog({ instanceId, onChatCreated }: NewChatDialogProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'whatsapp' | 'erp'>('all')
  const [results, setResults] = useState<ContactResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [customNumber, setCustomNumber] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const searchContacts = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !instanceId) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient() as any
      const contacts: ContactResult[] = []

      // Search WhatsApp contacts
      if (tab === 'all' || tab === 'whatsapp') {
        const { data: waContacts } = await supabase
          .from('wpp_contacts')
          .select('id, wa_contact_id, name, short_name, phone, profile_pic_url')
          .eq('instance_id', instanceId)
          .eq('is_group', false)
          .or(`name.ilike.%${query}%,short_name.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(20)

        if (waContacts) {
          // Find existing chats for these contacts
          const waIds = waContacts.map((c: any) => c.wa_contact_id)
          const { data: existingChats } = await supabase
            .from('wpp_chats')
            .select('id, wa_chat_id')
            .eq('instance_id', instanceId)
            .in('wa_chat_id', waIds)

          const chatMap = new Map<string, string>(existingChats?.map((c: any) => [c.wa_chat_id, c.id]) || [])

          for (const c of waContacts) {
            contacts.push({
              id: c.id,
              type: 'whatsapp',
              name: c.name || c.short_name || c.phone || 'Sem nome',
              phone: c.phone || c.wa_contact_id.replace('@s.whatsapp.net', ''),
              avatar: c.profile_pic_url,
              waChatId: c.wa_contact_id,
              chatId: chatMap.get(c.wa_contact_id) || null,
            })
          }
        }
      }

      // Search ERP contacts (leads + owners)
      if (tab === 'all' || tab === 'erp') {
        const { data: leads } = await supabase
          .from('leads')
          .select('id, nome, email, telemovel')
          .or(`nome.ilike.%${query}%,telemovel.ilike.%${query}%,email.ilike.%${query}%`)
          .not('telemovel', 'is', null)
          .limit(10)

        if (leads) {
          for (const l of leads) {
            if (!l.telemovel) continue
            contacts.push({
              id: l.id,
              type: 'lead',
              name: l.nome || l.email || 'Lead',
              phone: l.telemovel,
            })
          }
        }

        const { data: owners } = await supabase
          .from('owners')
          .select('id, name, phone, email')
          .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
          .not('phone', 'is', null)
          .limit(10)

        if (owners) {
          for (const o of owners) {
            if (!o.phone) continue
            contacts.push({
              id: o.id,
              type: 'owner',
              name: o.name || o.email || 'Proprietário',
              phone: o.phone,
            })
          }
        }
      }

      setResults(contacts)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [instanceId, tab])

  useEffect(() => {
    searchContacts(debouncedSearch)
  }, [debouncedSearch, searchContacts])

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch('')
      setCustomNumber('')
      setResults([])
      setTab('all')
    }
  }, [open])

  const startChat = useCallback(async (phone: string, existingChatId?: string | null) => {
    // If chat already exists, just navigate
    if (existingChatId) {
      onChatCreated(existingChatId)
      setOpen(false)
      return
    }

    setIsSending(true)
    try {
      // Format number for WhatsApp: remove spaces, +, dashes
      const cleaned = phone.replace(/[\s+\-()]/g, '')
      const waNumber = cleaned.includes('@') ? cleaned : `${cleaned}@s.whatsapp.net`

      // Send a presence check / create chat by sending via the API
      // First, check if a chat already exists in DB
      const supabase = createClient() as any
      const { data: existingChat } = await supabase
        .from('wpp_chats')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('wa_chat_id', waNumber)
        .single()

      if (existingChat) {
        onChatCreated(existingChat.id)
        setOpen(false)
        return
      }

      // Create the chat entry via upsert in the messaging function
      // We use the send endpoint which creates a chat entry
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: instanceId,
          wa_chat_id: waNumber,
          type: 'text',
          text: '', // Empty text just to create the chat entry
        }),
      })

      // If we can't send empty text, create the chat directly
      if (!res.ok) {
        // Create chat entry directly
        const { data: newChat, error } = await supabase
          .from('wpp_chats')
          .upsert({
            instance_id: instanceId,
            wa_chat_id: waNumber,
            name: phone,
            is_group: false,
            unread_count: 0,
            last_message_timestamp: Math.floor(Date.now() / 1000),
          }, { onConflict: 'instance_id,wa_chat_id' })
          .select('id')
          .single()

        if (error) throw error
        if (newChat) {
          onChatCreated(newChat.id)
          setOpen(false)
          return
        }
      }

      const data = await res.json()
      if (data.message?.chat_id) {
        onChatCreated(data.message.chat_id)
        setOpen(false)
      }
    } catch {
      toast.error('Erro ao iniciar conversa')
    } finally {
      setIsSending(false)
    }
  }, [instanceId, onChatCreated])

  const handleStartWithNumber = () => {
    const cleaned = customNumber.replace(/[\s+\-()]/g, '')
    if (cleaned.length < 8) {
      toast.error('Número inválido')
      return
    }
    startChat(cleaned)
  }

  const typeIcon = (type: ContactResult['type']) => {
    switch (type) {
      case 'whatsapp': return <Phone className="h-3 w-3" />
      case 'lead': return <UserRound className="h-3 w-3" />
      case 'owner': return <Building2 className="h-3 w-3" />
    }
  }

  const typeBadge = (type: ContactResult['type']) => {
    switch (type) {
      case 'whatsapp': return null
      case 'lead': return <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200">Lead</Badge>
      case 'owner': return <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200">Proprietário</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              disabled={!instanceId}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Nova conversa</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        {/* Custom number input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Número com código país (ex: 351912345678)"
              value={customNumber}
              onChange={(e) => setCustomNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartWithNumber()}
              className="pl-9"
            />
          </div>
          <Button
            onClick={handleStartWithNumber}
            disabled={isSending || customNumber.replace(/[\s+\-()]/g, '').length < 8}
            size="sm"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Iniciar'}
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou pesquisar contacto</span>
          </div>
        </div>

        {/* Search */}
        <div className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="w-full h-8">
              <TabsTrigger value="all" className="flex-1 text-xs">Todos</TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex-1 text-xs">WhatsApp</TabsTrigger>
              <TabsTrigger value="erp" className="flex-1 text-xs">Leads / Proprietários</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto -mx-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 && debouncedSearch.length >= 2 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum contacto encontrado
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Digite um nome ou número para pesquisar
            </div>
          ) : (
            results.map((contact) => (
              <button
                key={`${contact.type}-${contact.id}`}
                type="button"
                onClick={() => startChat(contact.phone, contact.chatId)}
                disabled={isSending}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors rounded-md text-left"
              >
                <Avatar className="h-9 w-9 flex-shrink-0">
                  {contact.avatar && <AvatarImage src={contact.avatar} />}
                  <AvatarFallback className="text-xs">
                    {typeIcon(contact.type)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{contact.name}</span>
                    {typeBadge(contact.type)}
                  </div>
                  <span className="text-xs text-muted-foreground">{contact.phone}</span>
                </div>

                {contact.chatId && (
                  <span className="text-[10px] text-muted-foreground">Conversa existente</span>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
