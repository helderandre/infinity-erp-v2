## 1. Base de Dados — Migração

- [x] 1.1 Criar tabela `internal_chat_messages` (id, channel_id, sender_id, content, parent_message_id, mentions, has_attachments, is_deleted, is_edited, created_at, updated_at, deleted_at, edited_at)
- [x] 1.2 Criar tabela `internal_chat_attachments` (id, message_id FK, file_name, file_url, file_size, mime_type, attachment_type, storage_key, uploaded_by, created_at)
- [x] 1.3 Criar tabela `internal_chat_reactions` (id, message_id FK, user_id FK, emoji, created_at) com unique(message_id, user_id, emoji)
- [x] 1.4 Criar tabela `internal_chat_read_receipts` (channel_id, user_id PK, last_read_message_id FK, last_read_at)
- [x] 1.5 Configurar RLS policies: qualquer `dev_user` com `is_active = true` pode SELECT/INSERT/UPDATE/DELETE nas 4 tabelas
- [x] 1.6 Habilitar Realtime (publication) para `internal_chat_messages` e `internal_chat_reactions`
- [x] 1.7 Adicionar constante `INTERNAL_CHAT_CHANNEL_ID` em `lib/constants.ts` (UUID fixo `00000000-0000-0000-0000-000000000001`)

## 2. API Routes — Chat Interno

- [x] 2.1 `GET /api/chat/internal` — listar mensagens com paginação (cursor-based, limit 50) incluindo sender (commercial_name, profile_photo_url), attachments e reactions
- [x] 2.2 `POST /api/chat/internal` — enviar mensagem (validação Zod: content max 10000 chars, mentions array, parent_message_id opcional)
- [x] 2.3 `GET /api/chat/internal/[messageId]` — detalhe de mensagem única com relações
- [x] 2.4 `PUT /api/chat/internal/[messageId]` — editar mensagem (apenas autor, actualizar content + edited_at)
- [x] 2.5 `DELETE /api/chat/internal/[messageId]` — soft delete (apenas autor, set is_deleted + deleted_at)
- [x] 2.6 `POST /api/chat/internal/[messageId]/reactions` — toggle reacção (insert ou delete)
- [x] 2.7 `GET /api/chat/internal/read` — listar read receipts do canal
- [x] 2.8 `POST /api/chat/internal/read` — marcar como lido (upsert last_read_message_id + last_read_at)

## 3. API Routes — Hub de Processos

- [x] 3.1 `GET /api/chat/process-channels` — listar processos do utilizador com last_message, unread_count, external_ref, property_title. Filtrar por processos onde utilizador é consultant ou tem tarefas atribuídas. Ordenar por last_message_at DESC. Suportar query param `search` para filtro por referência/título.

## 4. Tipos e Validações

- [x] 4.1 Criar tipos TypeScript em `types/internal-chat.ts`: InternalChatMessage, InternalChatAttachment, InternalChatReaction, InternalChatReadReceipt, ProcessChannelPreview
- [x] 4.2 Criar schemas Zod em `lib/validations/internal-chat.ts`: sendMessageSchema, editMessageSchema, toggleReactionSchema

## 5. Hooks

- [x] 5.1 Criar `hooks/use-internal-chat.ts` — fetch mensagens, send, edit, delete, toggle reaction, mark read. Subscrição Realtime em `internal_chat_messages` (INSERT/UPDATE) e `internal_chat_reactions`
- [x] 5.2 Criar `hooks/use-internal-chat-presence.ts` — presença online + typing indicator via Supabase Presence no canal `internal-chat`
- [x] 5.3 Criar `hooks/use-process-channels.ts` — fetch lista de processos com preview e unread counts, refetch periódico ou Realtime

## 6. Componentes de Chat Genéricos

- [x] 6.1 Extrair componentes genéricos para `components/chat/`: ChatMessageItem, ChatInput, ChatAttachment, ChatReactions, ChatReplyPreview, VoiceRecorder — removendo acoplamento a `processId`, parametrizando via props
- [x] 6.2 Criar `components/chat/chat-panel.tsx` — componente wrapper que recebe `chatConfig` (type, channelId, apiBasePath) e compõe os sub-componentes genéricos com o hook adequado
- [x] 6.3 Actualizar `components/processes/process-chat.tsx` para importar componentes genéricos de `components/chat/` (evitar duplicação)

## 7. Componentes da Página de Comunicação

- [x] 7.1 Criar `components/comunicacao/conversation-list.tsx` — sidebar esquerda com lista de conversas: "Grupo Geral" fixo no topo + lista de processos abaixo. Cada item com avatar/ícone, nome, preview truncada, timestamp relativo, badge unread
- [x] 7.2 Criar `components/comunicacao/conversation-list-item.tsx` — item individual da lista (reutilizável para grupo geral e processo)
- [x] 7.3 Criar `components/comunicacao/process-channel-list.tsx` — secção de processos na lista com campo de pesquisa (debounce 300ms), empty state, skeleton loading
- [x] 7.4 Criar `components/comunicacao/internal-chat-header.tsx` — cabeçalho do chat interno com nome do grupo, contagem online, lista de participantes
- [x] 7.5 Criar `components/comunicacao/process-chat-header.tsx` — cabeçalho do chat de processo inline com referência, título do imóvel, botão "Ver processo" (link para `/dashboard/processos/{id}`)

## 8. Página e Routing

- [x] 8.1 Criar `app/dashboard/comunicacao/chat/page.tsx` — página com layout split-panel (lista esquerda ~320px + painel chat direito). Estado local para conversa seleccionada. Responsive: mobile full-screen navigation
- [x] 8.2 Criar `app/dashboard/comunicacao/layout.tsx` se não existir — layout wrapper para o grupo de comunicação
- [x] 8.3 Adicionar item "Chat Interno" ao array `comunicacaoItems` em `components/layout/app-sidebar.tsx` com ícone `MessagesSquare` e href `/dashboard/comunicacao/chat`

## 9. Integração e Polish

- [x] 9.1 Garantir que o upload de ficheiros reutiliza `/api/chat/upload` existente, passando `channelType: 'internal'` e `channelId`
- [x] 9.2 Implementar empty states PT-PT: "Sem mensagens ainda — comece a conversa!", "Nenhum processo encontrado"
- [x] 9.3 Skeleton loading na lista de conversas e no painel de chat durante carregamento inicial
- [ ] 9.4 Testar fluxo completo: enviar texto, ficheiro, áudio, responder, reagir, editar, eliminar, presença, read receipts
- [ ] 9.5 Testar responsividade mobile: lista → chat → voltar
- [ ] 9.6 Verificar que os chats de processo inline enviam mensagens para as tabelas `proc_chat_*` existentes (sem regressão no chat flutuante do processo)
