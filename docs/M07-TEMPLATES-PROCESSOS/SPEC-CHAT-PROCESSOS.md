# SPEC: Sistema de Chat Interno por Processos

**Data**: 2026-02-24
**Baseado em**: [PRD-CHAT-PROCESSOS.md](PRD-CHAT-PROCESSOS.md)

---

## Resumo

Chat em tempo real por processo (1 canal por `proc_instance`), com menções `@`, replies, reações emoji, anexos (upload R2), read receipts, indicadores de presença/typing. Usa Supabase Realtime (Postgres Changes + Presence) e o padrão de `react-mentions` já existente no projecto.

---

## ETAPA 1 — Migração de Base de Dados

### Ficheiro: Migração Supabase (via MCP `apply_migration`)

**O que fazer:** Aplicar uma única migração com nome `create_chat_tables` contendo:

1. **Tabela `proc_chat_messages`**
   - Colunas: `id` (UUID PK), `proc_instance_id` (FK → proc_instances ON DELETE CASCADE), `sender_id` (FK → dev_users), `content` (TEXT NOT NULL), `parent_message_id` (self-ref FK → proc_chat_messages ON DELETE SET NULL), `mentions` (JSONB DEFAULT '[]'), `has_attachments` (BOOLEAN DEFAULT FALSE), `is_deleted` (BOOLEAN DEFAULT FALSE), `deleted_at` (TIMESTAMPTZ), `is_edited` (BOOLEAN DEFAULT FALSE), `edited_at` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ DEFAULT NOW()), `updated_at` (TIMESTAMPTZ DEFAULT NOW())
   - Índices: `idx_proc_chat_messages_instance` em `(proc_instance_id, created_at DESC)`, `idx_proc_chat_messages_parent` em `(parent_message_id) WHERE parent_message_id IS NOT NULL`, `idx_proc_chat_messages_sender` em `(sender_id)`
   - RLS: SELECT para `authenticated` (USING true), INSERT para `authenticated` (WITH CHECK auth.uid() = sender_id), UPDATE para `authenticated` (USING auth.uid() = sender_id)

2. **Tabela `proc_chat_reactions`**
   - Colunas: `id` (UUID PK), `message_id` (FK → proc_chat_messages ON DELETE CASCADE), `user_id` (FK → dev_users ON DELETE CASCADE), `emoji` (TEXT NOT NULL), `created_at` (TIMESTAMPTZ DEFAULT NOW())
   - Constraint: `UNIQUE(message_id, user_id, emoji)`
   - Índice: `idx_proc_chat_reactions_message` em `(message_id)`
   - RLS: SELECT para `authenticated` (USING true), INSERT (WITH CHECK auth.uid() = user_id), DELETE (USING auth.uid() = user_id)

3. **Tabela `proc_chat_attachments`**
   - Colunas: `id` (UUID PK), `message_id` (FK → proc_chat_messages ON DELETE CASCADE), `file_name` (TEXT NOT NULL), `file_url` (TEXT NOT NULL), `file_size` (BIGINT), `mime_type` (TEXT), `attachment_type` (TEXT NOT NULL DEFAULT 'file' — valores: 'image', 'document', 'audio', 'video', 'file'), `storage_key` (TEXT NOT NULL), `uploaded_by` (FK → dev_users), `created_at` (TIMESTAMPTZ DEFAULT NOW())
   - Índice: `idx_proc_chat_attachments_message` em `(message_id)`
   - RLS: SELECT para `authenticated` (USING true), INSERT (WITH CHECK auth.uid() = uploaded_by)

4. **Tabela `proc_chat_read_receipts`**
   - Colunas: `proc_instance_id` (FK → proc_instances ON DELETE CASCADE), `user_id` (FK → dev_users ON DELETE CASCADE), `last_read_message_id` (FK → proc_chat_messages ON DELETE SET NULL), `last_read_at` (TIMESTAMPTZ DEFAULT NOW())
   - PK composta: `(proc_instance_id, user_id)`
   - RLS: SELECT (USING auth.uid() = user_id), INSERT (WITH CHECK auth.uid() = user_id), UPDATE (USING auth.uid() = user_id)

5. **Realtime** — adicionar as 4 tabelas à publicação:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_messages;
   ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_reactions;
   ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_attachments;
   ALTER PUBLICATION supabase_realtime ADD TABLE proc_chat_read_receipts;
   ```

**SQL completo:** Usar exactamente o SQL das secções 3.1, 3.2, 3.3 e 3.4 do PRD.

---

## ETAPA 2 — Types

### Ficheiro: `types/process.ts`

**O que fazer:** Adicionar os seguintes tipos **no final do ficheiro**, após o bloco `TaskActivityEntry`:

```typescript
// ── Chat de Processo ──

export interface ChatMessage {
  id: string
  proc_instance_id: string
  sender_id: string
  content: string
  parent_message_id: string | null
  mentions: ChatMention[]
  has_attachments: boolean
  is_deleted: boolean
  deleted_at: string | null
  is_edited: boolean
  edited_at: string | null
  created_at: string
  updated_at: string
  // Joins
  sender?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  }
  parent_message?: {
    id: string
    content: string
    sender_id: string
    sender?: { id: string; commercial_name: string }
  } | null
  attachments?: ChatAttachment[]
  reactions?: ChatReaction[]
}

export interface ChatMention {
  user_id: string
  display_name: string
}

export interface ChatReaction {
  id: string
  emoji: string
  user_id: string
}

export interface ChatAttachment {
  id: string
  message_id: string
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  attachment_type: 'image' | 'document' | 'audio' | 'video' | 'file'
  storage_key: string
  uploaded_by: string
  created_at: string
}

export interface ChatPresenceUser {
  user_id: string
  user_name: string
  typing: boolean
  online_at: string
}
```

---

## ETAPA 3 — Validações Zod

### Ficheiro: `lib/validations/chat.ts` (CRIAR)

**O que fazer:** Criar este ficheiro com os schemas de validação para o chat.

```typescript
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

export const chatReadReceiptSchema = z.object({
  last_read_message_id: z.string().regex(uuidRegex),
})

export type ChatMessageFormData = z.infer<typeof chatMessageSchema>
export type ChatReactionFormData = z.infer<typeof chatReactionSchema>
```

**Nota:** Segue o mesmo padrão de `lib/validations/comment.ts` (usa `uuidRegex` em vez de `z.uuid()` para aceitar IDs com bits de versão zero).

---

## ETAPA 4 — Constantes PT-PT

### Ficheiro: `lib/constants.ts`

**O que fazer:** Adicionar o seguinte bloco **antes do comentário `// --- LEADS ---`** (linha ~605):

```typescript
// --- CHAT ---

export const CHAT_LABELS = {
  title: 'Chat do Processo',
  placeholder: 'Escrever mensagem... Use @ para mencionar',
  send: 'Enviar',
  no_messages: 'Sem mensagens. Inicie a conversa.',
  typing_one: 'está a escrever...',
  typing_many: 'estão a escrever...',
  online: 'online',
  edited: '(editado)',
  deleted_message: 'Esta mensagem foi eliminada.',
  reply_to: 'A responder a',
  reactions: 'Reações',
  attach_file: 'Anexar ficheiro',
  uploading: 'A enviar...',
  upload_error: 'Erro ao enviar ficheiro',
  upload_success: 'Ficheiro enviado com sucesso',
  max_file_size: 'Tamanho máximo: 20MB',
  edit_message: 'Editar mensagem',
  delete_message: 'Eliminar mensagem',
  delete_confirm: 'Tem a certeza de que pretende eliminar esta mensagem?',
} as const

export const CHAT_EMOJI_QUICK = ['👍', '❤️', '😂', '🎉', '👀', '✅'] as const
```

---

## ETAPA 5 — API Routes

### 5.1 Ficheiro: `app/api/processes/[id]/chat/route.ts` (CRIAR)

**O que fazer:** GET para listar mensagens + POST para enviar mensagem.

**GET:**
- Auth check via `supabase.auth.getUser()`
- Aceitar query params: `cursor` (string ISO date para paginação) e `limit` (int, default 50)
- Query `proc_chat_messages` com select:
  ```
  *, sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
  parent_message:proc_chat_messages!parent_message_id(id, content, sender_id, sender:dev_users(id, commercial_name)),
  attachments:proc_chat_attachments(*),
  reactions:proc_chat_reactions(id, emoji, user_id)
  ```
- Filtrar `.eq('proc_instance_id', processId)` e `.eq('is_deleted', false)`
- Ordenar `.order('created_at', { ascending: true })`
- Se `cursor` presente: `.lt('created_at', cursor)` para paginação
- `.limit(limit)`
- Return JSON array, status 200

**POST:**
- Auth check
- Validar body com `chatMessageSchema.safeParse(body)`
- Verificar que o processo existe: `supabase.from('proc_instances').select('id').eq('id', processId).single()`
- Se não existe: 404
- Insert em `proc_chat_messages` com campos: `proc_instance_id`, `sender_id` (= user.id), `content`, `mentions`, `parent_message_id`
- Select com os mesmos joins do GET (sem attachments e reactions, que ainda não existem)
- Return mensagem criada, status 201

**Referência de padrão:** Copiar estrutura exacta de `app/api/processes/[id]/tasks/[taskId]/comments/route.ts` — mesmo pattern de auth, validação, try/catch, e cast do supabase client.

---

### 5.2 Ficheiro: `app/api/processes/[id]/chat/[messageId]/route.ts` (CRIAR)

**O que fazer:** PUT para editar mensagem + DELETE para soft delete.

**PUT:**
- Auth check
- Validar body: `{ content: string }` com `z.object({ content: z.string().min(1).max(10000) })`
- Verificar que a mensagem existe e pertence ao user (`sender_id = user.id`)
- Update: `{ content, is_edited: true, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() }`
- Return mensagem actualizada, status 200

**DELETE:**
- Auth check
- Verificar que a mensagem pertence ao user
- Soft delete: update `{ is_deleted: true, deleted_at: new Date().toISOString(), content: '' }`
- Return `{ success: true }`, status 200

---

### 5.3 Ficheiro: `app/api/processes/[id]/chat/[messageId]/reactions/route.ts` (CRIAR)

**O que fazer:** POST para toggle de reação (adicionar se não existe, remover se existe).

**POST:**
- Auth check
- Validar body com `chatReactionSchema.safeParse(body)`
- Verificar se já existe: `supabase.from('proc_chat_reactions').select('id').eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji).maybeSingle()`
- Se existe: `.delete().eq('id', existing.id)` → return `{ action: 'removed' }`
- Se não existe: `.insert({ message_id: messageId, user_id: user.id, emoji })` → return `{ action: 'added', reaction }` com status 201

**Referência:** Usar exactamente o snippet 5.6 do PRD.

---

### 5.4 Ficheiro: `app/api/processes/[id]/chat/read/route.ts` (CRIAR)

**O que fazer:** POST para marcar mensagens como lidas (upsert).

**POST:**
- Auth check
- Validar body com `chatReadReceiptSchema.safeParse(body)`
- Upsert em `proc_chat_read_receipts`:
  ```typescript
  supabase.from('proc_chat_read_receipts').upsert({
    proc_instance_id: processId,
    user_id: user.id,
    last_read_message_id: validation.data.last_read_message_id,
    last_read_at: new Date().toISOString(),
  }, { onConflict: 'proc_instance_id,user_id' })
  ```
- Return `{ success: true }`, status 200

---

### 5.5 Ficheiro: `app/api/chat/upload/route.ts` (CRIAR)

**O que fazer:** POST para upload de anexo de chat ao Cloudflare R2.

**Fluxo:**
1. Auth check via `createClient()` (server)
2. Ler FormData: `file` (File), `processId` (string), `messageId` (string)
3. Validar:
   - Ficheiro existe e tamanho <= 20MB
   - `processId` e `messageId` são UUIDs válidos
4. Determinar `attachment_type` a partir do MIME type:
   - `image/*` → `'image'`
   - `application/pdf`, `application/msword`, `application/vnd.*` → `'document'`
   - `audio/*` → `'audio'`
   - `video/*` → `'video'`
   - default → `'file'`
5. Sanitizar nome do ficheiro (remover caracteres especiais, manter extensão)
6. Gerar `storage_key`: `chat/${processId}/${Date.now()}-${sanitizedFilename}`
7. Upload ao R2 via S3Client + PutObjectCommand:
   ```typescript
   const S3 = new S3Client({
     region: 'auto',
     endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
     credentials: {
       accessKeyId: process.env.R2_ACCESS_KEY_ID!,
       secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
     },
   })
   await S3.send(new PutObjectCommand({
     Bucket: process.env.R2_BUCKET_NAME!,
     Key: storageKey,
     Body: buffer,
     ContentType: file.type,
   }))
   ```
8. Construir `file_url`: `${process.env.R2_PUBLIC_DOMAIN}/${storageKey}`
9. Insert em `proc_chat_attachments`: `{ message_id, file_name, file_url, file_size, mime_type, attachment_type, storage_key, uploaded_by: user.id }`
10. Update `proc_chat_messages` set `has_attachments = true` where `id = messageId`
11. Return attachment criado, status 201

---

## ETAPA 6 — Hooks

### 6.1 Ficheiro: `hooks/use-chat-messages.ts` (CRIAR)

**O que fazer:** Hook de mensagens com Supabase Realtime. Segue o padrão de `hooks/use-task-comments.ts`.

**Implementação:** Usar exactamente o snippet 5.1 do PRD, com as seguintes adições:

- Estado adicional: `isSending` (boolean) para bloquear envios duplos
- Subscrever a 2 eventos no mesmo canal:
  - `INSERT` em `proc_chat_messages` filtrado por `proc_instance_id=eq.${processId}` → `fetchMessages()`
  - `UPDATE` em `proc_chat_messages` filtrado por `proc_instance_id=eq.${processId}` → `fetchMessages()`
- `sendMessage(content, mentions, parentMessageId?)` — POST para `/api/processes/${processId}/chat`
- `editMessage(messageId, content)` — PUT para `/api/processes/${processId}/chat/${messageId}`
- `deleteMessage(messageId)` — DELETE para `/api/processes/${processId}/chat/${messageId}`
- `toggleReaction(messageId, emoji)` — POST para `/api/processes/${processId}/chat/${messageId}/reactions`
- `markAsRead(messageId)` — POST para `/api/processes/${processId}/chat/read`
- Optimistic update em `sendMessage`: adicionar mensagem ao array local com deduplicação (mesmo padrão do `use-task-comments.ts` linhas 76-79)
- Cleanup: `supabase.removeChannel(channel)` no return do useEffect

**Retorno:**
```typescript
return {
  messages, isLoading, isSending,
  sendMessage, editMessage, deleteMessage,
  toggleReaction, markAsRead,
  refetch: fetchMessages
}
```

---

### 6.2 Ficheiro: `hooks/use-chat-presence.ts` (CRIAR)

**O que fazer:** Hook de presença (online/typing) via Supabase Presence.

**Implementação:** Usar exactamente o snippet 5.2 do PRD.

**Interface de entrada:**
```typescript
function useChatPresence(processId: string, currentUser: { id: string; name: string })
```

**Retorno:**
```typescript
return { onlineUsers, typingUsers, setTyping }
```

**Detalhes:**
- Canal: `process-presence-${processId}`
- Track no `SUBSCRIBED`: `{ user_id, user_name, typing: false, online_at }`
- Evento `sync`: actualizar `onlineUsers` (todos) e `typingUsers` (filtrar `typing === true && user_id !== currentUser.id`)
- `setTyping(isTyping)`: `channel.track(...)` com `typing: isTyping`
- Cleanup: `supabase.removeChannel(channel)`

---

## ETAPA 7 — Componentes

### 7.1 Ficheiro: `components/processes/process-chat.tsx` (CRIAR)

**O que fazer:** Componente principal do chat. Layout fixo: header + scroll body + footer.

**Props:**
```typescript
interface ProcessChatProps {
  processId: string
  currentUser: { id: string; name: string; avatarUrl?: string }
}
```

**Estrutura (usar exactamente o snippet 5.5 do PRD com os seguintes ajustes):**
- `'use client'`
- Usar `useChatMessages(processId)` e `useChatPresence(processId, currentUser)`
- Estado local: `replyTo` (ChatMessage | null) para replies
- Layout: `div.flex.flex-col.h-full` com 3 secções:
  1. **Header** (`div.border-b.px-4.py-2`): ícone MessageSquare + "Chat do Processo" + indicadores de online (bolinhas verdes + contagem)
  2. **Body** (`div.flex-1.overflow-y-auto.px-4.py-4.space-y-3` com ref `scrollRef`):
     - Se `isLoading`: 5x skeleton (avatar circle + 2 linhas)
     - Se `messages.length === 0`: empty state com ícone MessageSquare + texto da constante `CHAT_LABELS.no_messages`
     - Senão: mapear mensagens para `<ChatMessage>` components
     - No final: indicador de typing se `typingUsers.length > 0` (usar texto da constante)
  3. **Footer** (`div.border-t.px-4.py-3`):
     - Se `replyTo !== null`: preview da reply com botão de fechar (X)
     - `<ChatInput>` com prop `onSend`, `onTypingChange={setTyping}`
- Auto-scroll via `useEffect` quando `messages.length` muda

---

### 7.2 Ficheiro: `components/processes/chat-message.tsx` (CRIAR)

**O que fazer:** Render de uma mensagem individual com avatar, conteúdo, timestamp, reações e acções.

**Props:**
```typescript
interface ChatMessageProps {
  message: ChatMessage
  currentUserId: string
  processId: string
  onReply: () => void
  onToggleReaction: (messageId: string, emoji: string) => void
}
```

**Estrutura:**
- `'use client'`
- Se `message.is_deleted`: render texto cinzento itálico "Esta mensagem foi eliminada."
- Layout: `div.flex.gap-3.group` (group para hover actions)
  - **Avatar** (à esquerda): `<Avatar>` com foto do sender ou fallback com inicial
  - **Conteúdo** (à direita, `div.flex-1.min-w-0`):
    - **Linha 1**: nome do sender (font-medium) + timestamp relativo (text-xs text-muted-foreground, usar `formatDistanceToNow` com locale `pt` — mesmo padrão de `task-activity-feed.tsx` linhas 85-88) + badge "(editado)" se `is_edited`
    - **Reply preview** (se `parent_message` existe): `<ChatReplyPreview>` com nome do autor original + excerpt do conteúdo (truncado)
    - **Corpo**: usar a função `renderCommentContent()` já existente em `task-activity-feed.tsx` linhas 17-29 para parsear menções `@[Nome](id)`. Copiar essa função para este ficheiro (ou extrair para utils partilhados).
    - **Anexos** (se `attachments?.length > 0`): mapear para `<ChatAttachment>`
    - **Reações** (se `reactions?.length > 0`): `<ChatReactions>` component
    - **Hover actions** (visível apenas no hover do group): botões para Responder, Reagir, e (se é mensagem do próprio user) Editar/Eliminar. Usar ícones pequenos `Reply`, `Smile`, `Pencil`, `Trash2` de lucide-react.

---

### 7.3 Ficheiro: `components/processes/chat-input.tsx` (CRIAR)

**O que fazer:** Input de mensagem com suporte a @menções e anexos. **Reutilizar o padrão exacto de `components/processes/comment-input.tsx`** para o `MentionsInput`.

**Props:**
```typescript
interface ChatInputProps {
  processId: string
  onSend: (content: string, mentions: ChatMention[]) => Promise<void>
  onTypingChange: (isTyping: boolean) => void
  disabled?: boolean
}
```

**Estrutura:**
- `'use client'`
- Estado local: `value` (string), `isSubmitting` (boolean), `attachments` (File[]), `mentionUsers` (array de {id, display})
- Buscar utilizadores para menções: `useEffect` que faz fetch a `/api/users/consultants` (mesmo padrão de `task-detail-sheet.tsx` linhas 66-80)
- Typing indicator: `useEffect` com debounce — quando `value` muda, chamar `onTypingChange(true)`; após 2s sem alteração, chamar `onTypingChange(false)`
- Layout: `div.flex.items-end.gap-2`:
  - Botão de anexo (Paperclip icon) que abre input[type=file] hidden
  - `MentionsInput` com o mesmo estilo e configuração de `comment-input.tsx` (copiar `mentionsInputStyle` e `mentionStyle` exactamente)
  - Botão de enviar (Send icon) — disabled se `!value.trim() || isSubmitting`
- `onSubmit`:
  1. Parsear menções do `value` com regex `/@\[([^\]]+)\]\(([^)]+)\)/g` (mesmo padrão de `task-detail-sheet.tsx` linhas 96-100)
  2. Chamar `onSend(value, mentions)`
  3. Se há attachments: upload via POST FormData a `/api/chat/upload`
  4. Reset `value` e `attachments`
- `onKeyDown`: Enter sem Shift = enviar (mesmo padrão de `comment-input.tsx` linhas 68-72)

---

### 7.4 Ficheiro: `components/processes/chat-reactions.tsx` (CRIAR)

**O que fazer:** Render das reações agrupadas numa mensagem + botão de adicionar reação.

**Props:**
```typescript
interface ChatReactionsProps {
  reactions: ChatReaction[]
  currentUserId: string
  onToggle: (emoji: string) => void
}
```

**Estrutura:**
- Agrupar reações por emoji: `Map<string, { count: number; userIds: string[]; hasCurrentUser: boolean }>`
- Layout: `div.flex.flex-wrap.gap-1.mt-1`
- Para cada grupo: botão pequeno `button.inline-flex.items-center.gap-1.rounded-full.border.px-2.py-0.5.text-xs`
  - Se `hasCurrentUser`: adicionar classe `bg-primary/10 border-primary/30`
  - Conteúdo: `emoji + count`
  - `onClick`: `onToggle(emoji)`
- Botão final "+" com `Popover` que mostra os emojis rápidos de `CHAT_EMOJI_QUICK` constante

---

### 7.5 Ficheiro: `components/processes/chat-attachment.tsx` (CRIAR)

**O que fazer:** Preview de um anexo (imagem inline, ou card para documentos/outros).

**Props:**
```typescript
interface ChatAttachmentProps {
  attachment: ChatAttachment
}
```

**Estrutura:**
- Se `attachment_type === 'image'`: `<img>` com `max-w-xs rounded-lg border cursor-pointer` (clicar abre em nova tab)
- Se `attachment_type === 'document'`: card com ícone FileText + nome do ficheiro + tamanho formatado + botão de download
- Se `attachment_type === 'audio'`: `<audio controls>` nativo
- Se `attachment_type === 'video'`: `<video controls>` com `max-w-xs`
- Default (`'file'`): card genérico com ícone File + nome + tamanho + link de download

---

### 7.6 Ficheiro: `components/processes/chat-reply-preview.tsx` (CRIAR)

**O que fazer:** Preview inline da mensagem à qual se está a responder (aparece acima da mensagem no feed).

**Props:**
```typescript
interface ChatReplyPreviewProps {
  parentMessage: ChatMessage['parent_message']
}
```

**Estrutura:**
- `div.border-l-2.border-primary/30.pl-2.mb-1`
- Texto: `span.text-xs.font-medium` com nome do sender original + `span.text-xs.text-muted-foreground.truncate` com excerpt do conteúdo (primeiros 100 chars)

---

## ETAPA 8 — Integração na Página de Processo

### Ficheiro: `app/dashboard/processos/[id]/page.tsx`

**O que fazer:** Adicionar o componente `<ProcessChat>` na página de detalhe do processo. O chat só aparece quando o processo está activo (status `active`, `on_hold` ou `completed`).

**Modificações específicas:**

1. **Imports** — adicionar no topo:
   ```typescript
   import { ProcessChat } from '@/components/processes/process-chat'
   import { useUser } from '@/hooks/use-user'
   ```

2. **Hook useUser** — adicionar dentro do componente, junto dos outros hooks:
   ```typescript
   const { user } = useUser()
   ```

3. **Render do chat** — adicionar **após o bloco de Owners card** (após o fechamento do `{owners && owners.length > 0 && (...)}`) e **antes do `<TaskDetailSheet>`**, condicionado ao processo estar activo:
   ```tsx
   {/* Chat do Processo */}
   {isActive && (
     <Card className="overflow-hidden">
       <div className="h-[500px]">
         <ProcessChat
           processId={instance.id}
           currentUser={{
             id: user?.id || '',
             name: user?.commercial_name || 'Utilizador',
             avatarUrl: user?.profile_photo_url || undefined,
           }}
         />
       </div>
     </Card>
   )}
   ```

**Nota:** O chat fica num `Card` com altura fixa de `500px` para manter o scroll interno. A variável `isActive` já existe na página (linha que define `const isActive = ['active', 'on_hold', 'completed'].includes(instance.current_status)`).

---

## Resumo de Ficheiros

### Ficheiros a CRIAR (10)

| # | Path | Propósito |
|---|------|-----------|
| 1 | `lib/validations/chat.ts` | Schemas Zod para mensagens, reações e read receipts |
| 2 | `app/api/processes/[id]/chat/route.ts` | GET (listar mensagens) + POST (enviar mensagem) |
| 3 | `app/api/processes/[id]/chat/[messageId]/route.ts` | PUT (editar) + DELETE (soft delete) |
| 4 | `app/api/processes/[id]/chat/[messageId]/reactions/route.ts` | POST (toggle reação) |
| 5 | `app/api/processes/[id]/chat/read/route.ts` | POST (marcar como lido) |
| 6 | `app/api/chat/upload/route.ts` | POST (upload de anexo ao R2) |
| 7 | `hooks/use-chat-messages.ts` | Hook: mensagens + realtime + optimistic updates |
| 8 | `hooks/use-chat-presence.ts` | Hook: presença (online/typing) via Supabase Presence |
| 9 | `components/processes/process-chat.tsx` | Componente principal do chat (header + body + footer) |
| 10 | `components/processes/chat-message.tsx` | Render de mensagem individual |
| 11 | `components/processes/chat-input.tsx` | Input com @menções + anexos |
| 12 | `components/processes/chat-reactions.tsx` | Reações emoji agrupadas |
| 13 | `components/processes/chat-attachment.tsx` | Preview de anexos |
| 14 | `components/processes/chat-reply-preview.tsx` | Preview de reply |

### Ficheiros a MODIFICAR (3)

| # | Path | O que mudar |
|---|------|-------------|
| 1 | `types/process.ts` | Adicionar tipos `ChatMessage`, `ChatMention`, `ChatReaction`, `ChatAttachment`, `ChatPresenceUser` no final |
| 2 | `lib/constants.ts` | Adicionar bloco `CHAT_LABELS` e `CHAT_EMOJI_QUICK` antes da secção LEADS |
| 3 | `app/dashboard/processos/[id]/page.tsx` | Importar `ProcessChat` e `useUser`, render do chat condicionado a `isActive` |

### Migração de BD (1)

| # | Nome | Tabelas |
|---|------|---------|
| 1 | `create_chat_tables` | `proc_chat_messages`, `proc_chat_reactions`, `proc_chat_attachments`, `proc_chat_read_receipts` + índices + RLS + realtime |

---

## Ordem de Implementação

1. Migração de BD (ETAPA 1)
2. Types (ETAPA 2)
3. Validações Zod (ETAPA 3)
4. Constantes (ETAPA 4)
5. API Routes (ETAPA 5) — podem ser feitas em paralelo
6. Hooks (ETAPA 6) — dependem das API routes
7. Componentes (ETAPA 7) — dependem dos hooks
8. Integração na página (ETAPA 8) — depende do componente principal

---

## Dependências

Todas as dependências necessárias **já estão instaladas**:
- `react-mentions` (^4.4.10) — para @menções
- `@supabase/supabase-js` — para Realtime (Postgres Changes + Presence)
- `@aws-sdk/client-s3` — para upload ao R2
- `date-fns` + `date-fns/locale/pt` — para timestamps relativos
- `sonner` — para toasts
- `lucide-react` — para ícones

Nenhuma nova dependência é necessária.
