# PRD-02: API Routes & Hooks

> WhatsApp Web — API Routes (Next.js) e Custom Hooks
> Projecto: ERP Infinity v2 | Data: 2026-03-18

---

## 1. Estrutura de API Routes

```
app/api/whatsapp/
├── instances/
│   └── [id]/
│       ├── webhook/route.ts              ← POST: registar/desregistar webhook
│       └── contacts/
│           ├── route.ts                  ← GET: listar contactos, POST: sync contactos
│           └── [contactId]/route.ts      ← GET/PUT: detalhe/vincular contacto
├── chats/
│   ├── route.ts                          ← GET: listar chats (com filtros)
│   └── [chatId]/
│       ├── route.ts                      ← GET: detalhe do chat, PUT: arquivo/pin/mute
│       ├── messages/
│       │   └── route.ts                  ← GET: mensagens (paginadas), POST: enviar
│       ├── media/route.ts                ← GET: listar media do chat
│       ├── read/route.ts                 ← POST: marcar como lido
│       └── presence/route.ts             ← POST: enviar presença (typing)
├── messages/
│   └── [messageId]/
│       ├── route.ts                      ← GET: detalhe, PUT: editar, DELETE: apagar
│       ├── react/route.ts                ← POST: reagir
│       ├── forward/route.ts              ← POST: reencaminhar
│       └── download/route.ts             ← POST: download media
├── send/route.ts                         ← POST: enviar qualquer tipo de mensagem
└── media/
    └── upload/route.ts                   ← POST: upload de ficheiro para R2 (para enviar)
```

---

## 2. API Routes — Implementação

### 2.1 `GET /api/whatsapp/chats` — Listar chats

```typescript
// app/api/whatsapp/chats/route.ts
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const instanceId = searchParams.get("instance_id")
  const search = searchParams.get("search") || ""
  const archived = searchParams.get("archived") === "true"
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  if (!instanceId) {
    return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
  }

  let query = supabase
    .from("wpp_chats")
    .select(`
      *,
      contact:wpp_contacts(
        id, name, phone, profile_pic_url, is_business,
        owner_id, lead_id,
        owner:owners(id, name, phone, email),
        lead:leads(id, name, email, phone_primary)
      )
    `, { count: "exact" })
    .eq("instance_id", instanceId)
    .eq("is_archived", archived)
    .order("last_message_timestamp", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ chats: data || [], total: count || 0 })
}
```

### 2.2 `GET /api/whatsapp/chats/[chatId]/messages` — Mensagens paginadas

```typescript
// app/api/whatsapp/chats/[chatId]/messages/route.ts
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const limit = parseInt(searchParams.get("limit") || "50")
  const before = searchParams.get("before") // cursor: timestamp
  const after = searchParams.get("after")   // cursor: timestamp

  let query = supabase
    .from("wpp_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("timestamp", { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt("timestamp", parseInt(before))
  }
  if (after) {
    query = query.gt("timestamp", parseInt(after))
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reverter para ordem cronológica
  const messages = (data || []).reverse()

  // Buscar mensagens citadas (quoted)
  const quotedIds = messages
    .filter(m => m.quoted_message_id)
    .map(m => m.quoted_message_id)

  let quotedMessages: Record<string, any> = {}
  if (quotedIds.length > 0) {
    const { data: quoted } = await supabase
      .from("wpp_messages")
      .select("wa_message_id, text, message_type, sender_name, from_me, media_url")
      .in("wa_message_id", quotedIds)

    if (quoted) {
      quotedMessages = Object.fromEntries(
        quoted.map(q => [q.wa_message_id, q])
      )
    }
  }

  return NextResponse.json({
    messages,
    quoted_messages: quotedMessages,
    has_more: (data || []).length === limit,
  })
}

// POST: Enviar mensagem (atalho para /api/whatsapp/send)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params
  const supabase = createAdminClient()
  const body = await request.json()

  // Buscar chat para obter instance_id e wa_chat_id
  const { data: chat } = await supabase
    .from("wpp_chats")
    .select("instance_id, wa_chat_id")
    .eq("id", chatId)
    .single()

  if (!chat) return NextResponse.json({ error: "Chat não encontrado" }, { status: 404 })

  // Chamar edge function de messaging
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      action: body.action || "send_text",
      instance_id: chat.instance_id,
      wa_chat_id: chat.wa_chat_id,
      ...body,
    }),
  })

  const result = await res.json()
  return NextResponse.json(result, { status: res.status })
}
```

### 2.3 `POST /api/whatsapp/send` — Enviar qualquer tipo

```typescript
// app/api/whatsapp/send/route.ts
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json()
  const { instance_id, wa_chat_id, type = "text" } = body

  if (!instance_id || !wa_chat_id) {
    return NextResponse.json({ error: "instance_id e wa_chat_id obrigatórios" }, { status: 400 })
  }

  // Mapear tipo para acção
  const actionMap: Record<string, string> = {
    text: "send_text",
    image: "send_media",
    video: "send_media",
    document: "send_media",
    audio: "send_audio",
    ptt: "send_audio",
    location: "send_location",
    contact: "send_contact",
    sticker: "send_sticker",
  }

  const action = actionMap[type] || "send_text"

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ action, ...body }),
  })

  const result = await res.json()
  return NextResponse.json(result, { status: res.status })
}
```

### 2.4 `POST /api/whatsapp/messages/[messageId]/react` — Reagir

```typescript
// app/api/whatsapp/messages/[messageId]/react/route.ts
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params
  const supabase = createAdminClient()
  const { emoji } = await request.json()

  // Buscar mensagem para obter instance_id e wa_message_id
  const { data: msg } = await supabase
    .from("wpp_messages")
    .select("instance_id, wa_message_id, chat_id")
    .eq("id", messageId)
    .single()

  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 })

  // Buscar wa_chat_id
  const { data: chat } = await supabase
    .from("wpp_chats")
    .select("wa_chat_id")
    .eq("id", msg.chat_id)
    .single()

  if (!chat) return NextResponse.json({ error: "Chat não encontrado" }, { status: 404 })

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      action: "react",
      instance_id: msg.instance_id,
      wa_chat_id: chat.wa_chat_id,
      wa_message_id: msg.wa_message_id,
      emoji,
    }),
  })

  const result = await res.json()
  return NextResponse.json(result, { status: res.status })
}
```

### 2.5 `GET /api/whatsapp/instances/[id]/contacts` — Contactos

```typescript
// app/api/whatsapp/instances/[id]/contacts/route.ts
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: instanceId } = await params
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search") || ""
  const linked = searchParams.get("linked") // "owner" | "lead" | "none" | null
  const limit = parseInt(searchParams.get("limit") || "100")
  const offset = parseInt(searchParams.get("offset") || "0")

  let query = supabase
    .from("wpp_contacts")
    .select(`
      *,
      owner:owners(id, name, phone, email, nif),
      lead:leads(id, name, email, phone_primary, status)
    `, { count: "exact" })
    .eq("instance_id", instanceId)
    .eq("is_group", false)
    .order("name", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  if (linked === "owner") {
    query = query.not("owner_id", "is", null)
  } else if (linked === "lead") {
    query = query.not("lead_id", "is", null)
  } else if (linked === "none") {
    query = query.is("owner_id", null).is("lead_id", null)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data || [], total: count || 0 })
}

// POST: Sincronizar contactos do UAZAPI
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: instanceId } = await params

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-chats-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      action: "sync_contacts",
      instance_id: instanceId,
    }),
  })

  const result = await res.json()
  return NextResponse.json(result, { status: res.status })
}
```

### 2.6 `PUT /api/whatsapp/instances/[id]/contacts/[contactId]` — Vincular contacto

```typescript
// app/api/whatsapp/instances/[id]/contacts/[contactId]/route.ts
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { contactId } = await params
  const supabase = createAdminClient()
  const body = await request.json()

  const updateData: Record<string, unknown> = {}
  if (body.owner_id !== undefined) updateData.owner_id = body.owner_id || null
  if (body.lead_id !== undefined) updateData.lead_id = body.lead_id || null

  const { data, error } = await supabase
    .from("wpp_contacts")
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .select(`
      *,
      owner:owners(id, name, phone, email),
      lead:leads(id, name, email, phone_primary)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### 2.7 `POST /api/whatsapp/media/upload` — Upload para envio

```typescript
// app/api/whatsapp/media/upload/route.ts
// Reutiliza padrão existente de app/api/automacao/media/upload/route.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { NextResponse } from "next/server"

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const instanceId = formData.get("instance_id") as string | null
  const chatId = formData.get("chat_id") as string | null

  if (!file || !instanceId) {
    return NextResponse.json({ error: "file e instance_id são obrigatórios" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const key = `wpp-media/${instanceId}/outgoing/${Date.now()}-${sanitizedName}`

  await S3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }))

  const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${key}`

  return NextResponse.json({
    url: publicUrl,
    key,
    file_name: file.name,
    mime_type: file.type,
    size: file.size,
  })
}
```

---

## 3. Hooks (Frontend)

### 3.1 `useWhatsAppChats` — Lista de chats

```typescript
// hooks/use-whatsapp-chats.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface WppChat {
  id: string
  instance_id: string
  wa_chat_id: string
  phone: string
  name: string
  image: string
  is_group: boolean
  is_archived: boolean
  is_pinned: boolean
  unread_count: number
  last_message_text: string
  last_message_type: string
  last_message_timestamp: number
  last_message_from_me: boolean
  contact?: {
    id: string
    name: string
    phone: string
    profile_pic_url: string
    owner?: { id: string; name: string } | null
    lead?: { id: string; name: string } | null
  } | null
}

interface UseWhatsAppChatsOptions {
  instanceId: string
  search?: string
  archived?: boolean
}

export function useWhatsAppChats({ instanceId, search, archived = false }: UseWhatsAppChatsOptions) {
  const [chats, setChats] = useState<WppChat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchChats = useCallback(async () => {
    if (!instanceId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        instance_id: instanceId,
        archived: String(archived),
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/whatsapp/chats?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar chats")
      const data = await res.json()
      setChats(data.chats)
      setTotal(data.total)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [instanceId, search, archived])

  // Fetch + Subscribe to realtime
  useEffect(() => {
    fetchChats()

    if (!instanceId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`wpp-chats-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wpp_chats',
          filter: `instance_id=eq.${instanceId}`,
        },
        () => {
          // Refetch on any change
          fetchChats()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [instanceId, fetchChats])

  return { chats, isLoading, total, refetch: fetchChats }
}
```

### 3.2 `useWhatsAppMessages` — Mensagens de um chat

```typescript
// hooks/use-whatsapp-messages.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface WppMessage {
  id: string
  chat_id: string
  instance_id: string
  wa_message_id: string
  sender: string
  sender_name: string
  from_me: boolean
  message_type: string
  text: string
  media_url: string
  media_mime_type: string | null
  media_file_name: string | null
  media_file_size: number | null
  media_duration: number | null
  quoted_message_id: string
  status: string
  is_deleted: boolean
  is_forwarded: boolean
  reactions: Array<{ emoji: string; sender: string; from_me: boolean }>
  latitude: number | null
  longitude: number | null
  location_name: string | null
  vcard: string | null
  timestamp: number
}

interface QuotedMessage {
  wa_message_id: string
  text: string
  message_type: string
  sender_name: string
  from_me: boolean
  media_url: string
}

export function useWhatsAppMessages(chatId: string) {
  const [messages, setMessages] = useState<WppMessage[]>([])
  const [quotedMessages, setQuotedMessages] = useState<Record<string, QuotedMessage>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchMessages = useCallback(async (opts?: { before?: number; append?: boolean }) => {
    if (!chatId) return
    if (!opts?.append) setIsLoading(true)

    try {
      const params = new URLSearchParams({ limit: "50" })
      if (opts?.before) params.set("before", String(opts.before))

      const res = await fetch(`/api/whatsapp/chats/${chatId}/messages?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar mensagens")
      const data = await res.json()

      if (opts?.append) {
        setMessages(prev => [...data.messages, ...prev])
      } else {
        setMessages(data.messages)
      }

      setQuotedMessages(prev => ({ ...prev, ...data.quoted_messages }))
      setHasMore(data.has_more)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [chatId])

  const loadMore = useCallback(() => {
    if (messages.length === 0 || !hasMore) return
    const oldest = messages[0]
    fetchMessages({ before: oldest.timestamp, append: true })
  }, [messages, hasMore, fetchMessages])

  // Fetch + Realtime
  useEffect(() => {
    fetchMessages()

    if (!chatId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`wpp-messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wpp_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new as WppMessage
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wpp_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const updated = payload.new as WppMessage
          setMessages(prev =>
            prev.map(m => m.id === updated.id ? { ...m, ...updated } : m)
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [chatId, fetchMessages])

  // ── Acções ──

  const sendText = useCallback(async (text: string, replyId?: string) => {
    if (!chatId || isSending) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_text", text, reply_id: replyId }),
      })
      if (!res.ok) throw new Error("Erro ao enviar")
      const data = await res.json()

      // Optimistic: adicionar imediatamente
      if (data.message) {
        setMessages(prev => {
          if (prev.find(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
    } finally {
      setIsSending(false)
    }
  }, [chatId, isSending])

  const sendMedia = useCallback(async (
    file: File,
    type: string,
    caption?: string,
    replyId?: string
  ) => {
    if (!chatId || isSending) return
    setIsSending(true)
    try {
      // 1. Upload ao R2
      const formData = new FormData()
      formData.append("file", file)
      formData.append("instance_id", "") // será preenchido pelo chat
      formData.append("chat_id", chatId)

      const uploadRes = await fetch("/api/whatsapp/media/upload", {
        method: "POST",
        body: formData,
      })
      if (!uploadRes.ok) throw new Error("Erro no upload")
      const { url, file_name } = await uploadRes.json()

      // 2. Enviar via WhatsApp
      const res = await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_media",
          type,
          file_url: url,
          caption,
          doc_name: type === "document" ? file_name : undefined,
          reply_id: replyId,
        }),
      })
      if (!res.ok) throw new Error("Erro ao enviar media")
      const data = await res.json()

      if (data.message) {
        setMessages(prev => {
          if (prev.find(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
    } finally {
      setIsSending(false)
    }
  }, [chatId, isSending])

  const react = useCallback(async (messageId: string, emoji: string) => {
    await fetch(`/api/whatsapp/messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    })
  }, [])

  const deleteMessage = useCallback(async (messageId: string, forEveryone = true) => {
    await fetch(`/api/whatsapp/messages/${messageId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ for_everyone: forEveryone }),
    })
    // Optimistic: marcar como deleted
    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, is_deleted: true } : m)
    )
  }, [])

  const markRead = useCallback(async () => {
    if (!chatId) return
    await fetch(`/api/whatsapp/chats/${chatId}/read`, {
      method: "POST",
    })
  }, [chatId])

  return {
    messages,
    quotedMessages,
    isLoading,
    isSending,
    hasMore,
    loadMore,
    sendText,
    sendMedia,
    react,
    deleteMessage,
    markRead,
    refetch: fetchMessages,
  }
}
```

### 3.3 `useWhatsAppPresence` — Indicadores de digitação

```typescript
// hooks/use-whatsapp-presence.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PresenceState {
  chatId: string
  type: 'composing' | 'recording' | 'paused' | 'unavailable'
  participant: string
}

export function useWhatsAppPresence(instanceId: string) {
  const [presences, setPresences] = useState<Record<string, PresenceState>>({})
  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    if (!instanceId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`wpp-presence-${instanceId}`)
      .on('broadcast', { event: 'presence' }, (payload) => {
        const data = payload.payload as PresenceState & { instance_id: string }
        const key = `${data.chatId}-${data.participant}`

        if (data.type === 'unavailable' || data.type === 'paused') {
          setPresences(prev => {
            const next = { ...prev }
            delete next[key]
            return next
          })
        } else {
          setPresences(prev => ({ ...prev, [key]: data }))

          // Auto-clear after 30 seconds
          if (timeoutsRef.current[key]) {
            clearTimeout(timeoutsRef.current[key])
          }
          timeoutsRef.current[key] = setTimeout(() => {
            setPresences(prev => {
              const next = { ...prev }
              delete next[key]
              return next
            })
          }, 30000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      Object.values(timeoutsRef.current).forEach(clearTimeout)
    }
  }, [instanceId])

  const sendPresence = useCallback(async (chatId: string, type: 'composing' | 'recording' | 'paused') => {
    await fetch(`/api/whatsapp/chats/${chatId}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    })
  }, [])

  const isTyping = useCallback((chatId: string): boolean => {
    return Object.values(presences).some(
      p => p.chatId === chatId && (p.type === 'composing' || p.type === 'recording')
    )
  }, [presences])

  return { presences, sendPresence, isTyping }
}
```

### 3.4 `useWhatsAppContacts` — Gestão de contactos

```typescript
// hooks/use-whatsapp-contacts.ts
'use client'

import { useState, useCallback } from 'react'

interface WppContact {
  id: string
  instance_id: string
  wa_contact_id: string
  phone: string
  name: string
  profile_pic_url: string
  is_business: boolean
  owner_id: string | null
  lead_id: string | null
  owner?: { id: string; name: string; phone: string; email: string } | null
  lead?: { id: string; name: string; email: string; phone_primary: string } | null
}

export function useWhatsAppContacts(instanceId: string) {
  const [contacts, setContacts] = useState<WppContact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchContacts = useCallback(async (opts?: { search?: string; linked?: string }) => {
    if (!instanceId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (opts?.search) params.set("search", opts.search)
      if (opts?.linked) params.set("linked", opts.linked)

      const res = await fetch(`/api/whatsapp/instances/${instanceId}/contacts?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar contactos")
      const data = await res.json()
      setContacts(data.contacts)
      setTotal(data.total)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [instanceId])

  const linkOwner = useCallback(async (contactId: string, ownerId: string | null) => {
    const res = await fetch(`/api/whatsapp/instances/${instanceId}/contacts/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_id: ownerId }),
    })
    if (res.ok) {
      const updated = await res.json()
      setContacts(prev => prev.map(c => c.id === contactId ? updated : c))
    }
  }, [instanceId])

  const linkLead = useCallback(async (contactId: string, leadId: string | null) => {
    const res = await fetch(`/api/whatsapp/instances/${instanceId}/contacts/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId }),
    })
    if (res.ok) {
      const updated = await res.json()
      setContacts(prev => prev.map(c => c.id === contactId ? updated : c))
    }
  }, [instanceId])

  const syncContacts = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetch(`/api/whatsapp/instances/${instanceId}/contacts`, {
        method: "POST",
      })
      await fetchContacts()
    } finally {
      setIsLoading(false)
    }
  }, [instanceId, fetchContacts])

  return { contacts, isLoading, total, fetchContacts, linkOwner, linkLead, syncContacts }
}
```

---

## 4. Tipos TypeScript

```typescript
// lib/types/whatsapp-web.ts

// ── Mensagem ──
export type WppMessageType =
  | 'text' | 'image' | 'video' | 'audio' | 'document'
  | 'sticker' | 'location' | 'contact' | 'reaction'
  | 'poll' | 'view_once'

export type WppMessageStatus = 'sent' | 'delivered' | 'read' | 'played' | 'failed'

export interface WppMessage {
  id: string
  chat_id: string
  instance_id: string
  wa_message_id: string
  sender: string
  sender_name: string
  from_me: boolean
  message_type: WppMessageType
  text: string
  media_url: string
  media_mime_type: string | null
  media_file_name: string | null
  media_file_size: number | null
  media_duration: number | null
  quoted_message_id: string
  status: WppMessageStatus
  is_deleted: boolean
  deleted_at: string | null
  is_forwarded: boolean
  is_starred: boolean
  reactions: WppReaction[]
  latitude: number | null
  longitude: number | null
  location_name: string | null
  vcard: string | null
  timestamp: number
  created_at: string
}

export interface WppReaction {
  emoji: string
  sender: string
  from_me: boolean
  timestamp: number
}

// ── Chat ──
export interface WppChat {
  id: string
  instance_id: string
  wa_chat_id: string
  contact_id: string | null
  phone: string
  name: string
  image: string
  is_group: boolean
  is_archived: boolean
  is_pinned: boolean
  is_muted: boolean
  unread_count: number
  last_message_text: string
  last_message_type: string
  last_message_timestamp: number
  last_message_from_me: boolean
  contact: WppContact | null
  created_at: string
  updated_at: string
}

// ── Contacto ──
export interface WppContact {
  id: string
  instance_id: string
  wa_contact_id: string
  phone: string
  name: string
  short_name: string
  profile_pic_url: string
  is_business: boolean
  is_group: boolean
  is_blocked: boolean
  owner_id: string | null
  lead_id: string | null
  owner?: { id: string; name: string; phone: string; email: string } | null
  lead?: { id: string; name: string; email: string; phone_primary: string } | null
  created_at: string
  updated_at: string
}

// ── Constantes PT-PT ──
export const MESSAGE_TYPE_LABELS: Record<WppMessageType, string> = {
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
  sticker: 'Sticker',
  location: 'Localização',
  contact: 'Contacto',
  reaction: 'Reacção',
  poll: 'Sondagem',
  view_once: 'Ver uma vez',
}

export const MESSAGE_STATUS_LABELS: Record<WppMessageStatus, string> = {
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  played: 'Reproduzida',
  failed: 'Falhada',
}
```

---

## 5. Padrões Reutilizados do Codebase

### Padrão: Route Handler com Admin Client
- Ficheiro de referência: `app/api/automacao/instancias/route.ts`
- Usa `createAdminClient()` para bypass RLS
- Tipo cast `SupabaseAny` para tabelas sem types gerados

### Padrão: Edge Function call from Route Handler
```typescript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const res = await fetch(`${SUPABASE_URL}/functions/v1/<function-name>`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_KEY}`,
  },
  body: JSON.stringify({ action: "...", ...params }),
})
```

### Padrão: Hook com Realtime (de `hooks/use-chat-messages.ts`)
- `useRef` para guardar referência do channel
- Cleanup com `supabase.removeChannel(channel)` no return do useEffect
- `postgres_changes` para INSERT e UPDATE
- Optimistic updates no `sendMessage`

### Padrão: Upload para R2 (de `app/api/automacao/media/upload/route.ts`)
- `S3Client` com endpoint R2
- `PutObjectCommand` com ContentType
- Retornar URL pública: `${R2_PUBLIC_DOMAIN}/${key}`
- Path: `wpp-media/{instance_id}/outgoing/{timestamp}-{filename}`
