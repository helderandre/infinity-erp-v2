# SPEC-03: Frontend Components & UI

> WhatsApp Web — Componentes de interface e páginas
> Projecto: ERP Infinity v2 | Data: 2026-03-18

---

## Ficheiros a Criar

### 1. `src/app/dashboard/whatsapp/layout.tsx`

**Criar ficheiro.**

**O que fazer:**
- Exportar layout que remove padding do dashboard para o WhatsApp ocupar full-height
- Wrapper: `<div className="h-full -m-4">{children}</div>`

---

### 2. `src/app/dashboard/whatsapp/page.tsx`

**Criar ficheiro.** Server Component — página principal.

**O que fazer:**
- Import `createClient` de `@/lib/supabase/server`
- Query `auto_wpp_instances`: select `id, name, connection_status, phone, profile_name, profile_pic_url`, filtro `status = 'active'`, order `name`
- Renderizar `<ChatLayout instances={instances || []} />`

---

### 3. `src/components/whatsapp/chat-layout.tsx`

**Criar ficheiro.** `'use client'` — Layout de 3 painéis.

**Props:** `instances: Array<{ id, name, connection_status }>`

**State:**
- `selectedInstance` (string) — default `instances[0]?.id`
- `selectedChatId` (string | null) — default `null`
- `showInfo` (boolean) — default `false`

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ Chat Sidebar (w-80) │ Chat Thread (flex-1) │ Info (w-80) │
└──────────────────────────────────────────────────┘
```

**Estrutura JSX:**
- Container: `div className="flex h-[calc(100vh-64px)] overflow-hidden"`
- Sidebar: `div className="w-80 border-r flex-shrink-0"` → `<ChatSidebar>`
- Thread: `div className="flex-1 flex flex-col min-w-0"` → `<ChatThread>` ou `<EmptyChatState>`
- Info (condicional `showInfo && selectedChatId`): `div className="w-80 border-l flex-shrink-0 overflow-y-auto"` → `<ChatInfoPanel>`

---

### 4. `src/components/whatsapp/chat-sidebar.tsx`

**Criar ficheiro.** `'use client'` — Lista de chats à esquerda.

**Props:** `instances, selectedInstance, onInstanceChange, selectedChatId, onChatSelect`

**O que fazer:**
- Topo: `<InstanceSelector>` (dropdown com instâncias)
- Campo de pesquisa com `useDebounce(300ms)`
- Tabs: `Todos | Não lidos | Grupos` (usar shadcn `Tabs`)
- Usar hook `useWhatsAppChats({ instanceId: selectedInstance, search, archived: false })`
- Lista de `<ChatListItem>` para cada chat, destacando `selectedChatId` com `bg-accent`
- Loading: `<Skeleton>` durante fetch

---

### 5. `src/components/whatsapp/chat-list-item.tsx`

**Criar ficheiro.** `'use client'` — Item individual na lista.

**Props:** `chat: WppChat, isSelected: boolean, onClick: () => void`

**O que fazer:**
- Layout horizontal: Avatar (imagem ou iniciais) + Info (nome, última mensagem truncada) + Meta (hora, badge unread)
- Avatar: usar `<Avatar>` shadcn com `chat.image` ou iniciais de `chat.name`
- Nome: `chat.name || chat.phone`
- Última mensagem: truncar `chat.last_message_text` a ~40 chars, prefixar com tipo se não é texto (`📷 Imagem`, `🎵 Áudio`, etc.)
- Hora: formatar `chat.last_message_timestamp` — se hoje: `HH:mm`, se ontem: `"Ontem"`, senão: `dd/MM/yyyy` (usar `date-fns` com `isToday`, `isYesterday`, `format`)
- Badge unread: `<Badge>` com `chat.unread_count` se > 0
- Ícones: pin (`📌`) se `is_pinned`, mute (`🔇`) se `is_muted`
- Estilo seleccionado: `bg-accent`

---

### 6. `src/components/whatsapp/chat-thread.tsx`

**Criar ficheiro.** `'use client'` — Área de mensagens (centro).

**Props:** `chatId: string, onToggleInfo: () => void`

**O que fazer:**
- Usar hook `useWhatsAppMessages(chatId)`
- Usar hook `useWhatsAppPresence(instanceId)` (obter instanceId do chat)
- State: `replyTo` (mensagem sendo respondida)
- Topo: `<ChatHeader>` com nome do chat, avatar, botões (info, pesquisa)
- Centro: lista de mensagens com scroll — `ScrollArea` ou div com `overflow-y-auto`
  - Scroll automático para baixo em novas mensagens
  - Scroll para cima para carregar mais (`loadMore`)
  - Agrupar por data (separadores "Hoje", "Ontem", "12 Mar 2026")
  - Renderizar `<MessageBubble>` para cada mensagem
  - `<TypingIndicator>` se `isTyping(chatId)`
- Fundo: `<ChatInput>` com callbacks `onSendText`, `onSendMedia`, `onSendPresence`, `replyTo`, `onCancelReply`
- `markRead()` ao abrir o chat (useEffect)

---

### 7. `src/components/whatsapp/chat-header.tsx`

**Criar ficheiro.** `'use client'` — Header do chat activo.

**Props:** `chat: WppChat, isTyping: boolean, onToggleInfo: () => void, onSearch: () => void`

**O que fazer:**
- Layout: Avatar + Nome + Subtítulo ("online" / "a escrever..." / telefone) + Botões à direita
- Botões: Search (lupa), Info (ícone de info), Menu (3 pontos com dropdown: arquivar, fixar, silenciar)
- Se `isTyping`: mostrar "A escrever..." em vez do subtítulo normal
- Usar `<Avatar>`, `<Button>`, `<DropdownMenu>` shadcn

---

### 8. `src/components/whatsapp/chat-input.tsx`

**Criar ficheiro.** `'use client'` — Input de mensagem.

**Props:** `onSendText, onSendMedia, onSendPresence, replyTo?, onCancelReply?, disabled?`

**O que fazer:**
- `<Textarea>` expansível (1-5 linhas), `min-h-[40px] max-h-[120px] resize-none`
- Enter = enviar, Shift+Enter = nova linha
- Botão emoji (`<Smile>`) à esquerda
- Botão anexar (`<Paperclip>`) com `<DropdownMenu>`: Imagem, Vídeo, Documento
  - Hidden `<input type="file">` com accept dinâmico
- Botão enviar (`<Send>`) verde se há texto/ficheiro, senão botão microfone (`<Mic>`)
- Preview de reply: barra com nome + texto truncado + botão X para cancelar
- Preview de ficheiro: ícone + nome + botão X para remover
- Enviar presença `composing` no onChange com debounce 2s → `paused`
- Código completo: Ver PRD-03 secção 3.5

---

### 9. `src/components/whatsapp/message-bubble.tsx`

**Criar ficheiro.** `'use client'` — Bolha de mensagem.

**Props:** `message: WppMessage, quotedMessage?, onReply, onReact, onDelete, onForward, showSenderName?`

**O que fazer:**
- Alinhamento: `justify-end` se `from_me`, `justify-start` senão
- Cor: `bg-emerald-100 dark:bg-emerald-900/30` se minha, `bg-white dark:bg-zinc-800` senão
- Max width: `max-w-[65%]`
- Conteúdo (se não `is_deleted`):
  - Nome do sender (se `showSenderName && !isMe`) — para grupos
  - `<MessageQuoted>` se tem `quotedMessage`
  - Indicador "↗ Reencaminhada" se `is_forwarded`
  - `<MessageMediaRenderer>` se tipo != text
  - Texto com `whitespace-pre-wrap break-words`
- Se `is_deleted`: `"🚫 Esta mensagem foi apagada"` em itálico
- Footer: hora (HH:mm) + `<MessageStatus>` se `from_me`
- `<MessageReactions>` se tem reacções
- Hover: botão `▾` para abrir `<MessageContextMenu>`
- Código completo: Ver PRD-03 secção 3.2

---

### 10. `src/components/whatsapp/message-status.tsx`

**Criar ficheiro.**

**Props:** `status: WppMessageStatus`

**O que fazer:**
- `sent` → `<Check>` cinza (h-3.5 w-3.5)
- `delivered` → `<CheckCheck>` cinza
- `read` / `played` → `<CheckCheck>` azul (`text-blue-500`)
- `failed` → `!` vermelho
- Importar `Check`, `CheckCheck` de `lucide-react`

---

### 11. `src/components/whatsapp/message-reactions.tsx`

**Criar ficheiro.**

**Props:** `reactions: WppReaction[], onReact: (emoji) => void`

**O que fazer:**
- Agrupar reacções por emoji: `{ emoji, count, hasMine }`
- Renderizar botões com emoji + count
- Se `hasMine`: estilo `bg-primary/10 border-primary/30` (toggle off ao clicar)
- Se `!hasMine`: estilo `bg-muted` (toggle on ao clicar)
- Código completo: Ver PRD-03 secção 3.7

---

### 12. `src/components/whatsapp/message-quoted.tsx`

**Criar ficheiro.**

**Props:** `quoted: { text, message_type, sender_name, from_me, media_url }`

**O que fazer:**
- Barra lateral `border-l-4 border-primary/50` com `bg-muted/50`
- Nome do sender (ou "Você" se `from_me`)
- Ícone do tipo + texto truncado
- Thumbnail se imagem/vídeo (10x10 rounded)
- Código completo: Ver PRD-03 secção 3.6

---

### 13. `src/components/whatsapp/message-media-renderer.tsx`

**Criar ficheiro.** `'use client'` — Renderizador por tipo.

**Props:** `message: WppMessage`

**O que fazer — switch por `message.message_type`:**
- `image` → `<img>` clicável (max-h-[300px]) → abre `<MediaPreviewModal>`
- `video` → `<video>` com controls + badge de duração
- `audio` → `<AudioPlayer src={media_url} duration={media_duration}>`
- `document` → Link com `<FileText>` ícone + nome + tamanho + `<Download>`
- `sticker` → `<img>` max 180px
- `location` → Link Google Maps com `<MapPin>` + coordenadas
- `contact` → Div com `<User>` ícone + nome do contacto
- Helpers: `formatDuration(seconds)`, `formatFileSize(bytes)`
- Código completo: Ver PRD-03 secção 3.4

---

### 14. `src/components/whatsapp/message-context-menu.tsx`

**Criar ficheiro.** `'use client'`

**Props:** `message: WppMessage, onReply, onReact, onDelete, onForward`

**O que fazer:**
- Usar `<DropdownMenu>` shadcn
- Itens: Responder, Reagir (sub-menu com emojis rápidos: 👍❤️😂😮🙏), Reencaminhar, Copiar texto, Apagar (apenas para mensagens `from_me`)
- Trigger: botão `ChevronDown` que aparece on hover (`opacity-0 group-hover:opacity-100`)

---

### 15. `src/components/whatsapp/media-preview-modal.tsx`

**Criar ficheiro.** `'use client'`

**Props:** `url: string, type: "image" | "video", onClose: () => void`

**O que fazer:**
- Overlay fullscreen (`fixed inset-0 bg-black/80 z-50`)
- Botão fechar no canto superior direito
- Imagem centrada (`max-w-full max-h-full object-contain`)
- Ou video com controls
- Click no overlay fecha

---

### 16. `src/components/whatsapp/audio-player.tsx`

**Criar ficheiro.** `'use client'`

**Props:** `src: string, duration: number`

**O que fazer:**
- `<audio>` escondido com ref
- Botão play/pause redondo verde (`bg-emerald-600`)
- `<Slider>` shadcn para progresso
- Label de duração (`m:ss`)
- Event listeners: `timeupdate`, `loadedmetadata`, `ended`
- Código completo: Ver PRD-03 secção 3.8

---

### 17. `src/components/whatsapp/typing-indicator.tsx`

**Criar ficheiro.**

**Props:** `name?: string`

**O que fazer:**
- 3 pontos com `animate-bounce` com delays (0ms, 150ms, 300ms)
- Texto: `"${name} está a escrever..."` ou `"A escrever..."`
- Código completo: Ver PRD-03 secção 3.9

---

### 18. `src/components/whatsapp/instance-selector.tsx`

**Criar ficheiro.** `'use client'`

**Props:** `instances: Array<{id, name, connection_status, phone?}>, value: string, onChange: (id) => void`

**O que fazer:**
- `<Select>` shadcn com opções por instância
- Cada opção: nome + badge de status (connected = verde, disconnected = cinza)
- Se `phone`: mostrar número abaixo do nome

---

### 19. `src/components/whatsapp/empty-chat-state.tsx`

**Criar ficheiro.**

**O que fazer:**
- Centrado vertical e horizontal
- Ícone grande de WhatsApp ou `<MessageCircle>` (lucide)
- Título: "WhatsApp Web"
- Subtítulo: "Seleccione uma conversa para começar"
- Estilo muted, fundo subtil

---

### 20. `src/components/whatsapp/emoji-picker.tsx`

**Criar ficheiro.** `'use client'`

**Props:** `onSelect: (emoji: string) => void`

**O que fazer:**
- Grid de emojis comuns (pode ser simples inicialmente — grid de 30-40 emojis mais usados)
- Ou integrar `emoji-picker-react` se instalado
- Usar `<Popover>` shadcn para abrir/fechar

---

### 21. `src/components/whatsapp/search-messages.tsx`

**Criar ficheiro.** `'use client'`

**Props:** `chatId: string, onClose: () => void, onJumpToMessage: (messageId) => void`

**O que fazer:**
- Input de pesquisa com debounce 300ms
- Query `wpp_messages` filtrado por `chat_id` e `text.ilike.%search%`
- Lista de resultados com snippet + data
- Click navega para a mensagem no thread

---

### 22. `src/components/whatsapp/chat-info-panel.tsx`

**Criar ficheiro.** `'use client'` — Painel de info à direita.

**Props:** `chatId: string, onClose: () => void`

**O que fazer:**
- Buscar chat + contacto do hook
- Topo: Avatar grande + nome + telefone + botão fechar
- Secção "Vinculação ERP": `<ErpLinkTags contactId={contact.id}>` (ver SPEC-04)
- Secção "Media": galeria de imagens/vídeos do chat (GET `/api/whatsapp/chats/${chatId}/media?type=image,video`)
- Secção "Documentos": lista de docs (GET com `type=document`)
- Secção "Links": links extraídos das mensagens
- Botões: Silenciar, Arquivar, Bloquear

---

## Ficheiros a Modificar

### 23. `src/components/layout/app-sidebar.tsx`

**Modificar:** Adicionar item "WhatsApp Web" na sidebar.

**Onde:** Secção `automationItems` (ou como grupo separado).

**O que adicionar:**
```typescript
{
  title: "WhatsApp Web",
  url: "/dashboard/whatsapp",
  icon: MessageCircle, // de lucide-react
}
```

**Opção A:** Adicionar aos `automationItems` existentes (entre "Templates WhatsApp" e o fim).

**Opção B:** Criar grupo separado no sidebar (mais visível). Neste caso, adicionar novo item à raiz da navegação com ícone WhatsApp.

---

## Dependências

Verificar se já estão instaladas (a maioria já está):
- `date-fns` ✅ (já instalado)
- `lucide-react` ✅ (já instalado)
- shadcn/ui: Avatar, Badge, Button, Dialog, DropdownMenu, Input, Popover, ScrollArea, Select, Skeleton, Slider, Tabs, Textarea, Tooltip ✅ (todos já instalados)
- `emoji-picker-react` — **instalar se quiser picker completo** (`npm install emoji-picker-react`), ou implementar picker simples

---

## Ordem de Implementação

1. Layout + Página (`layout.tsx`, `page.tsx`)
2. `chat-layout.tsx` + `empty-chat-state.tsx` + `instance-selector.tsx`
3. `chat-sidebar.tsx` + `chat-list-item.tsx`
4. `chat-thread.tsx` + `chat-header.tsx`
5. `message-bubble.tsx` + `message-status.tsx`
6. `chat-input.tsx` (texto básico)
7. Sidebar link
8. **Testar:** fluxo completo de texto (enviar/receber)
9. `message-media-renderer.tsx` + `audio-player.tsx` + `media-preview-modal.tsx`
10. `message-quoted.tsx` + `message-reactions.tsx` + `message-context-menu.tsx`
11. `typing-indicator.tsx` + `emoji-picker.tsx`
12. `chat-info-panel.tsx` + `search-messages.tsx`
