// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { getPortalMessages, sendPortalMessage } from '../actions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, MessageCircle, Send, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

interface Conversation {
  id: string
  subject: string | null
  updated_at: string
  consultant: { id: string; commercial_name: string } | null
  last_message?: string
  unread_count?: number
}

interface Message {
  id: string
  content: string
  sender_id: string
  is_read: boolean
  created_at: string
}

export default function MensagensPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [text, setText] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
    // Get current user id from supabase client
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) setUserId(data.user.id)
      })
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversations() {
    setLoading(true)
    const { data, error } = await getPortalMessages()
    if (error) { toast.error(error); setLoading(false); return }
    setConversations(data?.conversations ?? [])
    setLoading(false)
  }

  async function openConversation(conv: Conversation) {
    setSelected(conv)
    setLoading(true)
    const { data, error } = await getPortalMessages(conv.id)
    if (error) { toast.error(error); setLoading(false); return }
    setMessages(data?.messages ?? [])
    setLoading(false)
  }

  async function handleSend() {
    if (!text.trim() || !selected) return
    setSending(true)
    const content = text.trim()
    setText('')

    // Optimistic add
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      content,
      sender_id: userId ?? '',
      is_read: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    const { error } = await sendPortalMessage(selected.id, content)
    if (error) {
      toast.error(error)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setText(content)
    }
    setSending(false)
  }

  function goBack() {
    setSelected(null)
    setMessages([])
    loadConversations()
  }

  function initials(name?: string) {
    if (!name) return '?'
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function timeAgo(date: string) {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: pt })
    } catch { return '' }
  }

  // ── Chat View ──
  if (selected) {
    const consultantName = selected.consultant?.commercial_name ?? 'Consultor'
    return (
      <div className="flex flex-col h-[calc(100svh-3.5rem-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(consultantName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{consultantName}</p>
            {selected.subject && <p className="text-xs text-muted-foreground truncate">{selected.subject}</p>}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-20">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
            ))
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sem mensagens nesta conversa.</p>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === userId
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {timeAgo(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="fixed bottom-16 left-0 right-0 bg-background border-t p-3">
          <div className="flex gap-2 max-w-lg mx-auto">
            <Input
              placeholder="Escreva uma mensagem..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              disabled={sending}
              className="rounded-full"
            />
            <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()} className="shrink-0 rounded-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Conversation List ──
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Mensagens</h1>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Sem mensagens</p>
          <p className="text-xs text-muted-foreground mt-1">As suas conversas com consultores aparecerao aqui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const name = conv.consultant?.commercial_name ?? 'Consultor'
            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.updated_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.subject ?? 'Conversa'}
                  </p>
                </div>
                {(conv.unread_count ?? 0) > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                    {conv.unread_count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
