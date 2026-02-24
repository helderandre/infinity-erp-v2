# PRD: Sistema de Chat Interno por Processos

**Data**: 2026-02-24
**Stack**: Next.js 16 + Supabase Realtime + TypeScript + shadcn/ui + Cloudflare R2
**Escopo**: Chat geral por processo com read receipts, menções, replies, reações e anexos

---

## 1. Arquivos Relevantes da Base de Código

### 1.1 Arquivos que serão DIRECTAMENTE AFETADOS

| Arquivo | Motivo |
|---------|--------|
| `types/process.ts` | Adicionar tipos `ChatMessage`, `ChatReaction`, `ChatAttachment`, `ChatChannel` |
| `app/dashboard/processos/[id]/page.tsx` | Integrar tab/painel de chat do processo |
| `lib/validations/comment.ts` | Estender ou criar validação para mensagens de chat |
| `lib/constants.ts` | Adicionar constantes PT-PT para o chat |
| `hooks/use-task-comments.ts` | Padrão de referência para novo hook `useChatMessages` |

### 1.2 Novos Arquivos a CRIAR

| Arquivo | Propósito |
|---------|-----------|
| `app/api/processes/[id]/chat/route.ts` | GET (listar mensagens) + POST (enviar mensagem) |
| `app/api/processes/[id]/chat/[messageId]/reactions/route.ts` | POST/DELETE reações |
| `app/api/processes/[id]/chat/[messageId]/route.ts` | PUT (editar) + DELETE (soft delete) |
| `app/api/processes/[id]/chat/read/route.ts` | POST (marcar como lido) |
| `app/api/chat/upload/route.ts` | POST upload de anexos ao R2 |
| `components/processes/process-chat.tsx` | Componente principal do chat |
| `components/processes/chat-message.tsx` | Render de mensagem individual |
| `components/processes/chat-input.tsx` | Input de mensagem com menções e anexos |
| `components/processes/chat-reactions.tsx` | Reações em mensagens |
| `components/processes/chat-attachment.tsx` | Preview de anexos (imagem, PDF, etc.) |
| `components/processes/chat-reply-preview.tsx` | Preview da mensagem sendo respondida |
| `hooks/use-chat-messages.ts` | Hook com realtime + optimistic updates |
| `hooks/use-chat-presence.ts` | Hook de presença (quem está online/a escrever) |
| `lib/validations/chat.ts` | Schemas Zod para mensagens de chat |

### 1.3 Arquivos de REFERÊNCIA (padrões a reutilizar)

| Arquivo | O que reutilizar |
|---------|-----------------|
| `hooks/use-task-comments.ts` | Padrão de Supabase Realtime (channel, subscribe, cleanup, optimistic updates) |
| `components/processes/comment-input.tsx` | Padrão de `react-mentions` para @menções |
| `components/processes/task-activity-feed.tsx` | Padrão de render de menções com regex + avatar + timestamps |
| `components/processes/task-detail-sheet.tsx` | Layout fixo header/footer + scroll body |
| `app/api/processes/[id]/tasks/[taskId]/comments/route.ts` | Padrão de API com auth + validação Zod + joins |
| `app/api/r2/upload/route.ts` | Padrão de upload ao Cloudflare R2 |
| `lib/supabase/client.ts` | Cliente browser para realtime |
| `lib/supabase/server.ts` | Cliente server para API routes |
| `lib/supabase/admin.ts` | Cliente service role para bypass RLS |

---

## 2. Padrões da Base de Código Existente

### 2.1 Padrão de Realtime (de `use-task-comments.ts`)

```typescript
// hooks/use-task-comments.ts — PADRÃO ACTUAL
const supabase = createClient()
const channel = supabase
  .channel(`task-comments-${taskId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'proc_task_comments',
      filter: `proc_task_id=eq.${taskId}`,
    },
    () => {
      fetchComments() // re-fetch para obter dados com joins
    }
  )
  .subscribe()

// Cleanup
return () => {
  supabase.removeChannel(channel)
  channelRef.current = null
}
```

### 2.2 Padrão de Optimistic Update (de `use-task-comments.ts`)

```typescript
// Optimistic: adicionar imediatamente (realtime vai re-fetch mas deduplica)
setComments((prev) => {
  if (prev.find((c) => c.id === comment.id)) return prev
  return [...prev, comment]
})
```

### 2.3 Padrão de Menções (de `comment-input.tsx`)

```typescript
// Usa react-mentions
import { MentionsInput, Mention } from 'react-mentions'

<MentionsInput value={value} onChange={(_e, newValue) => onChange(newValue)}>
  <Mention
    trigger="@"
    data={users}
    markup="@[__display__](__id__)"
    displayTransform={(_id, display) => `@${display}`}
  />
</MentionsInput>
```

### 2.4 Padrão de Render de Menções (de `task-activity-feed.tsx`)

```typescript
function renderCommentContent(content: string): React.ReactNode {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/)
    if (match) {
      return (
        <span key={i} className="text-primary font-medium bg-primary/10 rounded px-1">
          @{match[1]}
        </span>
      )
    }
    return part
  })
}
```

### 2.5 Padrão de API Route (de `comments/route.ts`)

```typescript
// POST — Criar com validação Zod + verificação de pertença
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // 2. Validação Zod
  const body = await request.json()
  const validation = schema.safeParse(body)
  if (!validation.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  // 3. Verificar pertença da entidade
  // 4. Insert com select + joins
  // 5. Return 201
}
```

### 2.6 Padrão de Upload R2 (de `r2/upload/route.ts`)

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// Upload
await S3.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_NAME!,
  Key: `chat/${channelId}/${timestamp}-${sanitizedFilename}`,
  Body: buffer,
  ContentType: mimeType,
}))

const fileUrl = `${process.env.R2_PUBLIC_DOMAIN}/${key}`
```

---

## 3. Schema de Base de Dados Proposto

### 3.1 Tabela: `proc_chat_messages`

```sql
CREATE TABLE proc_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proc_instance_id UUID NOT NULL REFERENCES proc_instances(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES dev_users(id),
  content TEXT NOT NULL,

  -- Threading: responder a mensagem específica
  parent_message_id UUID REFERENCES proc_chat_messages(id) ON DELETE SET NULL,

  -- Menções (array de user_ids mencionados)
  mentions JSONB DEFAULT '[]'::jsonb,

  -- Anexos (metadata inline para evitar join extra em listagens)
  has_attachments BOOLEAN DEFAULT FALSE,

  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,

  -- Edição
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_proc_chat_messages_instance ON proc_chat_messages(proc_instance_id, created_at DESC);
CREATE INDEX idx_proc_chat_messages_parent ON proc_chat_messages(parent_message_id)
  WHERE parent_message_id IS NOT NULL;
CREATE INDEX idx_proc_chat_messages_sender ON proc_chat_messages(sender_id);

-- RLS
ALTER TABLE proc_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chat messages"
  ON proc_chat_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert chat messages"
  ON proc_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages"
  ON proc_chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_messages;
```

### 3.2 Tabela: `proc_chat_reactions`

```sql
CREATE TABLE proc_chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES proc_chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Uma reação por user por emoji por mensagem
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_proc_chat_reactions_message ON proc_chat_reactions(message_id);

ALTER TABLE proc_chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reactions"
  ON proc_chat_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can add reactions"
  ON proc_chat_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON proc_chat_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_reactions;
```

### 3.3 Tabela: `proc_chat_attachments`

```sql
CREATE TABLE proc_chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES proc_chat_messages(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  attachment_type TEXT NOT NULL DEFAULT 'file',  -- 'image' | 'document' | 'audio' | 'video' | 'file'
  storage_key TEXT NOT NULL,  -- chave R2 para eliminação

  uploaded_by UUID NOT NULL REFERENCES dev_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proc_chat_attachments_message ON proc_chat_attachments(message_id);

ALTER TABLE proc_chat_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attachments"
  ON proc_chat_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can upload attachments"
  ON proc_chat_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_attachments;
```

### 3.4 Tabela: `proc_chat_read_receipts`

```sql
CREATE TABLE proc_chat_read_receipts (
  proc_instance_id UUID NOT NULL REFERENCES proc_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES proc_chat_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (proc_instance_id, user_id)
);

ALTER TABLE proc_chat_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own receipts"
  ON proc_chat_read_receipts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts"
  ON proc_chat_read_receipts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own receipts"
  ON proc_chat_read_receipts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_read_receipts;
```

---

## 4. Documentação de Tecnologias Relevantes

### 4.1 Supabase Realtime — Padrões para Chat

**Fonte:** https://supabase.com/docs/guides/realtime/concepts

#### Três Mecanismos Disponíveis

| Mecanismo | Uso | Escalabilidade |
|-----------|-----|----------------|
| **Postgres Changes** | Subscrever a INSERT/UPDATE/DELETE numa tabela | Baixa-Média (single-threaded) |
| **Broadcast** | Enviar mensagens efémeras via channel | Alta |
| **Presence** | Tracking de online/typing | Média (overhead computacional) |

#### Recomendação: Postgres Changes para Chat de Processos

Para o nosso caso (chat por processo com ~5-20 utilizadores por processo), `postgres_changes` é suficiente e mais simples. Se a escala crescer, migrar para Broadcast com triggers.

```typescript
// Subscrever a múltiplos eventos no mesmo canal
const channel = supabase
  .channel(`process-chat:${processId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'proc_chat_messages',
      filter: `proc_instance_id=eq.${processId}` },
    (payload) => handleNewMessage(payload.new)
  )
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'proc_chat_reactions' },
    (payload) => handleReactionChange(payload)
  )
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'proc_chat_messages',
      filter: `proc_instance_id=eq.${processId}` },
    (payload) => handleMessageUpdate(payload.new)
  )
  .subscribe()
```

#### Presence para Indicadores de Typing/Online

```typescript
// Fonte: https://supabase.com/docs/guides/realtime/presence
const channel = supabase.channel(`process-presence:${processId}`)

// Escutar sync/join/leave
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    // state = { 'user-uuid-1': [{ typing: false, online_at: '...' }], ... }
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    // Novo utilizador entrou
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    // Utilizador saiu
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: currentUserId,
        user_name: userName,
        typing: false,
        online_at: new Date().toISOString(),
      })
    }
  })

// Actualizar estado de typing
const setTyping = (isTyping: boolean) => {
  channel.track({
    user_id: currentUserId,
    user_name: userName,
    typing: isTyping,
    online_at: new Date().toISOString(),
  })
}
```

### 4.2 Padrão de Pré-requisitos para Realtime

```sql
-- OBRIGATÓRIO: Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_read_receipts;
```

### 4.3 React Mentions — Padrão Actual do Projecto

**Biblioteca:** `react-mentions` (^4.4.10) — já instalada

```typescript
// Markup format: @[Display Name](user-id)
// Stored as plain text in content field
// Parsed on render with regex: /@\[([^\]]+)\]\(([^)]+)\)/
```

**Nota:** O projecto já usa `react-mentions` nos comentários de tarefas. Manter o mesmo padrão para consistência em vez de migrar para TipTap (que seria over-engineering para este caso).

### 4.4 Upload de Ficheiros — Padrão R2 Existente

**Fonte:** Padrão existente em `app/api/r2/upload/route.ts`

```
bucket/
├── imoveis-imagens/{property-uuid}/     ← imagens de imóveis
├── imoveis/{property-uuid}/             ← documentos de imóveis
├── public/usuarios-fotos/{user-uuid}/   ← fotos de perfil
└── chat/{process-uuid}/                 ← NOVO: anexos de chat
```

Path para anexos de chat: `chat/{proc_instance_id}/{timestamp}-{sanitized_filename}`

---

## 5. Snippets de Implementação Recomendados

### 5.1 Hook: `useChatMessages` (baseado no padrão existente)

```typescript
// hooks/use-chat-messages.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ChatMessage } from '@/types/process'

export function useChatMessages(processId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/processes/${processId}/chat`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data)
    }
    setIsLoading(false)
  }, [processId])

  useEffect(() => {
    fetchMessages()

    const supabase = createClient()
    const channel = supabase
      .channel(`process-chat-${processId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'proc_chat_messages',
        filter: `proc_instance_id=eq.${processId}`,
      }, () => {
        fetchMessages() // Re-fetch para obter dados com joins
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'proc_chat_messages',
        filter: `proc_instance_id=eq.${processId}`,
      }, () => {
        fetchMessages()
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [processId, fetchMessages])

  const sendMessage = useCallback(async (
    content: string,
    mentions: { user_id: string; display_name: string }[],
    parentMessageId?: string
  ) => {
    const res = await fetch(`/api/processes/${processId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, mentions, parent_message_id: parentMessageId }),
    })
    if (!res.ok) throw new Error('Erro ao enviar mensagem')
    const message = await res.json()

    // Optimistic update com deduplicação
    setMessages(prev => {
      if (prev.find(m => m.id === message.id)) return prev
      return [...prev, message]
    })
    return message
  }, [processId])

  return { messages, isLoading, sendMessage, refetch: fetchMessages }
}
```

### 5.2 Hook: `useChatPresence`

```typescript
// hooks/use-chat-presence.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PresenceUser {
  user_id: string
  user_name: string
  typing: boolean
  online_at: string
}

export function useChatPresence(processId: string, currentUser: { id: string; name: string }) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([])
  const channelRef = useRef<ReturnType<typeof createClient>['channel'] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`process-presence-${processId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        const users = Object.values(state).flat()
        setOnlineUsers(users)
        setTypingUsers(users.filter(u => u.typing && u.user_id !== currentUser.id))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            user_name: currentUser.name,
            typing: false,
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel as any

    return () => {
      supabase.removeChannel(channel)
    }
  }, [processId, currentUser.id, currentUser.name])

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (channelRef.current) {
      await (channelRef.current as any).track({
        user_id: currentUser.id,
        user_name: currentUser.name,
        typing: isTyping,
        online_at: new Date().toISOString(),
      })
    }
  }, [currentUser.id, currentUser.name])

  return { onlineUsers, typingUsers, setTyping }
}
```

### 5.3 API Route: `GET/POST /api/processes/[id]/chat`

```typescript
// app/api/processes/[id]/chat/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chatMessageSchema } from '@/lib/validations/chat'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor') // para paginação
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabase
    .from('proc_chat_messages')
    .select(`
      *,
      sender:dev_users(id, commercial_name,
        profile:dev_consultant_profiles(profile_photo_url)
      ),
      parent_message:proc_chat_messages!parent_message_id(
        id, content, sender_id,
        sender:dev_users(id, commercial_name)
      ),
      attachments:proc_chat_attachments(*),
      reactions:proc_chat_reactions(id, emoji, user_id)
    `)
    .eq('proc_instance_id', processId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const validation = chatMessageSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  // Verificar que o processo existe
  const { data: process, error: procError } = await supabase
    .from('proc_instances')
    .select('id')
    .eq('id', processId)
    .single()

  if (procError || !process) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  const { data: message, error: insertError } = await supabase
    .from('proc_chat_messages')
    .insert({
      proc_instance_id: processId,
      sender_id: user.id,
      content: validation.data.content,
      mentions: validation.data.mentions,
      parent_message_id: validation.data.parent_message_id || null,
    })
    .select(`
      *,
      sender:dev_users(id, commercial_name,
        profile:dev_consultant_profiles(profile_photo_url)
      ),
      parent_message:proc_chat_messages!parent_message_id(
        id, content, sender_id,
        sender:dev_users(id, commercial_name)
      )
    `)
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(message, { status: 201 })
}
```

### 5.4 Validação Zod para Chat

```typescript
// lib/validations/chat.ts
import { z } from 'zod'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const chatMessageSchema = z.object({
  content: z.string()
    .min(1, 'Mensagem não pode estar vazia')
    .max(10000),
  mentions: z.array(
    z.object({
      user_id: z.string().regex(uuidRegex, 'UUID inválido'),
      display_name: z.string(),
    })
  ).default([]),
  parent_message_id: z.string().regex(uuidRegex).nullable().optional(),
})

export const chatReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
})

export type ChatMessageFormData = z.infer<typeof chatMessageSchema>
export type ChatReactionFormData = z.infer<typeof chatReactionSchema>
```

### 5.5 Componente: `ProcessChat` (estrutura principal)

```typescript
// components/processes/process-chat.tsx — Estrutura de alto nível
'use client'

import { useRef, useEffect, useState } from 'react'
import { useChatMessages } from '@/hooks/use-chat-messages'
import { useChatPresence } from '@/hooks/use-chat-presence'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare } from 'lucide-react'

interface ProcessChatProps {
  processId: string
  currentUser: { id: string; name: string; avatarUrl?: string }
}

export function ProcessChat({ processId, currentUser }: ProcessChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { messages, isLoading, sendMessage } = useChatMessages(processId)
  const { onlineUsers, typingUsers, setTyping } = useChatPresence(processId, currentUser)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)

  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  return (
    <div className="flex flex-col h-full">
      {/* Header com utilizadores online */}
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-medium">Chat do Processo</span>
        </div>
        <div className="flex items-center gap-1">
          {onlineUsers.map(u => (
            <div key={u.user_id} className="h-2 w-2 rounded-full bg-emerald-500"
                 title={u.user_name} />
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {onlineUsers.length} online
          </span>
        </div>
      </div>

      {/* Mensagens com scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Sem mensagens. Inicie a conversa.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              currentUserId={currentUser.id}
              processId={processId}
              onReply={() => setReplyTo(msg)}
            />
          ))
        )}

        {/* Indicador de typing */}
        {typingUsers.length > 0 && (
          <div className="text-xs text-muted-foreground italic">
            {typingUsers.map(u => u.user_name).join(', ')}
            {typingUsers.length === 1 ? ' está a escrever...' : ' estão a escrever...'}
          </div>
        )}
      </div>

      {/* Input fixo no fundo */}
      <div className="border-t px-4 py-3">
        {replyTo && (
          <div className="mb-2 p-2 bg-muted rounded flex items-center justify-between">
            <div className="text-xs">
              <span className="font-medium">A responder a {replyTo.sender?.commercial_name}</span>
              <p className="text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-xs text-muted-foreground">
              ✕
            </button>
          </div>
        )}
        <ChatInput
          processId={processId}
          onSend={async (content, mentions) => {
            await sendMessage(content, mentions, replyTo?.id)
            setReplyTo(null)
          }}
          onTypingChange={setTyping}
        />
      </div>
    </div>
  )
}
```

### 5.6 Toggle de Reação

```typescript
// API: POST /api/processes/[id]/chat/[messageId]/reactions
export async function POST(request: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const { messageId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { emoji } = await request.json()

  // Toggle: se já existe, remover; senão, adicionar
  const { data: existing } = await supabase
    .from('proc_chat_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    await supabase.from('proc_chat_reactions').delete().eq('id', existing.id)
    return NextResponse.json({ action: 'removed' })
  } else {
    const { data } = await supabase
      .from('proc_chat_reactions')
      .insert({ message_id: messageId, user_id: user.id, emoji })
      .select()
      .single()
    return NextResponse.json({ action: 'added', reaction: data }, { status: 201 })
  }
}
```

---

## 6. Decisões de Arquitectura

### 6.1 Porquê `react-mentions` em vez de TipTap?

| Critério | react-mentions | TipTap |
|----------|---------------|--------|
| Já instalado no projecto | Sim | Não |
| Padrão existente nos comentários | Sim | Não |
| Complexidade | Baixa | Alta |
| Tamanho do bundle | ~15KB | ~100KB+ |
| Necessidade de rich text | Não (plain text + menções é suficiente) | Sim (se editor WYSIWYG) |

**Decisão:** Manter `react-mentions` por consistência e simplicidade.

### 6.2 Porquê Postgres Changes em vez de Broadcast?

| Critério | Postgres Changes | Broadcast |
|----------|-----------------|-----------|
| Configuração | Simples (ALTER PUBLICATION) | Requer triggers SQL |
| Escala | ~50-100 conexões simultâneas | 1000+ conexões |
| Dados | Payload completo do INSERT | Payload customizável |
| RLS | Via tabela original | Via realtime.messages |
| Utilizadores por processo | ~5-20 | N/A (irrelevante) |

**Decisão:** Postgres Changes — suficiente para ~5-20 utilizadores por processo. Se escalar, migrar para Broadcast.

### 6.3 Porquê Tabela Separada em vez de Reutilizar Comentários?

O sistema de comentários existente (`proc_task_comments`) está vinculado a tarefas individuais. O chat de processo é transversal — abrange todo o processo, não uma tarefa específica. Criar uma tabela separada (`proc_chat_messages`) evita:
- Poluir a timeline de tarefas com mensagens gerais
- Complexidade de queries com filtros
- Conflitos de realtime (canal por tarefa vs canal por processo)

### 6.4 Armazenamento de Menções

Manter o formato existente: `@[Display Name](user-id)` em plain text + array JSONB de mentions.
- Consistente com `proc_task_comments`
- Simples de pesquisar e renderizar
- Não requer schema JSON complexo (TipTap)

---

## 7. Fontes e Referências

### Documentação Oficial
- [Supabase Realtime: Concepts](https://supabase.com/docs/guides/realtime/concepts)
- [Supabase Realtime: Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Supabase Realtime: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase Realtime: Presence](https://supabase.com/docs/guides/realtime/presence)
- [Supabase Realtime: Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase Storage: Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Storage: Access Control](https://supabase.com/docs/guides/storage/security/access-control)

### Padrões de Implementação
- [Supabase Blog: "Seen by" in PostgreSQL](https://supabase.com/blog/seen-by-in-postgresql) — Padrão de read receipts
- [Mattermost Database Schema](https://databasesample.com/database/mattermost-database) — Reactions table pattern
- [TipTap Mention Extension](https://tiptap.dev/docs/editor/extensions/nodes/mention) — Referência (não vamos usar, mas documenta o padrão JSON)
- [Supabase Realtime Chat (GitHub)](https://github.com/shwosner/realtime-chat-supabase-react) — Implementação de referência
- [Building Real-time with Supabase + Next.js 15](https://dev.to/lra8dev/building-real-time-magic-supabase-subscriptions-in-nextjs-15-2kmp) — Padrão de hooks

### Padrões de Schema
- [PostgreSQL Self-Referencing FK](https://www.dbvis.com/thetable/how-to-use-a-foreign-key-referring-to-the-source-table-in-postgres/) — Threading/replies
- [Chat Application Database Schema](https://github.com/sudhanshutiwari264/Chat-Application-Database) — Schema completo
- [Many-to-Many Relationships](https://www.datacamp.com/blog/many-to-many-relationship) — Reactions pattern

---

## 8. Resumo de Features vs Complexidade

| Feature | Complexidade | Prioridade | Dependência |
|---------|-------------|------------|-------------|
| Enviar/receber mensagens com realtime | Média | P0 (essencial) | Nenhuma |
| @Menções | Baixa | P0 (essencial) | Padrão existente |
| Responder a mensagem específica (reply) | Baixa | P1 | Mensagens base |
| Read receipts (visto por) | Média | P1 | Mensagens base |
| Envio de ficheiros/anexos | Média | P1 | Upload R2 existente |
| Reações com emoji | Baixa | P2 | Mensagens base |
| Indicador de typing | Baixa | P2 | Supabase Presence |
| Indicador de online | Baixa | P2 | Supabase Presence |
| Edição de mensagem | Baixa | P3 | Mensagens base |
| Eliminação de mensagem (soft delete) | Baixa | P3 | Mensagens base |
