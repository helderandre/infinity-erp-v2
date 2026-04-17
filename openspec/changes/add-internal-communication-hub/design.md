## Context

O ERP Infinity já possui um sistema de chat completo dentro de cada processo (`proc_chat_messages`, `proc_chat_attachments`, `proc_chat_reactions`, `proc_chat_read_receipts`). Os componentes UI (`chat-input`, `chat-message`, `chat-attachment`, `voice-recorder`, etc.) vivem em `components/processes/` e estão acoplados ao conceito de `processId`. O hook `useChatMessages(processId)` faz fetch a `/api/processes/{id}/chat/` e subscreve ao canal Realtime `proc-chat-{processId}`.

Actualmente, para um utilizador conversar com a equipa ou ver mensagens de processos, precisa navegar até cada processo individualmente. Não existe um canal geral de equipa nem uma vista agregada dos chats de processo.

O sidebar já tem um grupo "Comunicação" com WhatsApp, Email e Automatismos.

## Goals / Non-Goals

**Goals:**
- Criar uma página `/dashboard/comunicacao/chat` com duas secções navegáveis (tabs ou sidebar interna).
- **Secção 1 — Chat Interno**: canal de grupo único onde todos os `dev_users` activos participam. Suporta texto, ficheiros, áudio, menções, reacções, respostas, read receipts e presença em tempo real.
- **Secção 2 — Chats de Processos**: lista de todos os processos com chat activo em que o utilizador participa, com preview da última mensagem, contagem de não lidas, e possibilidade de abrir o chat inline com todas as capacidades de envio.
- Reutilizar ao máximo os componentes de chat existentes.
- Tempo real via Supabase Realtime (postgres changes + presence).

**Non-Goals:**
- Mensagens directas 1:1 entre utilizadores (futuro — fora deste scope).
- Canais/grupos adicionais além do grupo geral (futuro).
- Migração de mensagens existentes de processos para uma nova estrutura.
- Notificações push/browser (pode ser adicionado depois).
- Pesquisa full-text de mensagens (futuro).

## Decisions

### 1. Schema do Chat Interno — tabelas separadas (não reutilizar `proc_chat_*`)

**Decisão**: Criar tabelas `internal_chat_messages`, `internal_chat_attachments`, `internal_chat_reactions`, `internal_chat_read_receipts` com schema idêntico ao de processo, mas sem `proc_instance_id` — substituído por `channel_id` (UUID, default fixo para o grupo geral).

**Alternativa considerada**: Adicionar `channel_type` + `channel_id` às tabelas `proc_chat_*` existentes. Rejeitado porque: (a) mistura domínios diferentes, (b) complica queries existentes de processo, (c) requer migração de dados, (d) RLS policies ficam mais complexas.

**Alternativa considerada**: Uma única tabela `chat_messages` genérica para tudo. Rejeitado pelo mesmo motivo — alto risco de regressão nos chats de processo já em produção.

**Rationale**: Tabelas separadas isolam risco, mantêm o schema de processo intacto, e permitem RLS simples (qualquer `dev_user` activo pode ler/escrever no canal interno).

### 2. Canal único "Grupo Geral" — channel_id fixo

**Decisão**: Usar um `channel_id` fixo (UUID constante, ex: `00000000-0000-0000-0000-000000000001`) para o grupo geral. A coluna existe para futura extensão (canais/DMs) mas por agora há um único canal.

**Rationale**: Evita criar tabela de canais e lógica de membership antes de haver necessidade. O UUID fixo é declarado como constante em `lib/constants.ts`.

### 3. Componentes de chat — wrapper genérico, não refactoring profundo

**Decisão**: Criar um componente `<ChatPanel>` genérico em `components/chat/` que wrapa os componentes existentes de processo. O `ChatPanel` recebe um `chatConfig` com:
- `type: 'internal' | 'process'`
- `channelId: string` (channel_id ou processId)
- `apiBasePath: string` (ex: `/api/chat/internal` ou `/api/processes/{id}/chat`)

Os componentes de apresentação (`ChatMessageItem`, `ChatInput`, `ChatAttachment`, etc.) serão **copiados** para `components/chat/` e tornados genéricos (sem referência a `processId`). Os originais em `components/processes/` passam a importar destes genéricos para evitar duplicação. Isto é feito de forma incremental — primeiro copiar, depois re-exportar.

**Alternativa considerada**: Refactorizar os componentes existentes in-place para aceitar props genéricos. Rejeitado porque: alto risco de regressão no chat de processo que já funciona, e o scope desta change ficaria demasiado grande.

### 4. API Routes — novas routes para o chat interno

**Decisão**: Criar routes em `app/api/chat/internal/`:
- `route.ts` — GET (mensagens com paginação) + POST (enviar)
- `[messageId]/route.ts` — GET + PUT (editar) + DELETE (soft delete)
- `[messageId]/reactions/route.ts` — POST (toggle reacção)
- `read/route.ts` — GET + POST (read receipts)

Upload reutiliza o endpoint existente `/api/chat/upload/route.ts` (já é genérico).

### 5. Secção de Processos — aggregação via query

**Decisão**: Criar endpoint `GET /api/chat/process-channels` que retorna a lista de processos do utilizador com:
- `proc_instance_id`, `external_ref`, `property_title`
- `last_message` (conteúdo truncado + timestamp + sender)
- `unread_count` (mensagens após `last_read_at` do utilizador)

A query junta `proc_instances` (filtrado por participação: `consultant_id` ou tarefas atribuídas) com `proc_chat_messages` (last message) e `proc_chat_read_receipts` (unread count).

Ao clicar num processo, o chat abre inline na mesma página usando o `<ProcessChat>` existente (passando `processId`).

### 6. Layout da página — split-panel com lista à esquerda

**Decisão**: Layout com sidebar esquerda (lista de conversas: "Grupo Geral" no topo + processos abaixo) e painel de chat à direita. Semelhante ao WhatsApp Web.

- Sidebar esquerda (~320px): lista de conversas com avatar/ícone, nome, preview, timestamp, unread badge.
- Painel direito: o chat seleccionado (componente `ChatPanel` ou `ProcessChat`).
- Em mobile: navegação full-screen (lista → chat → voltar).

### 7. Realtime — canais separados

**Decisão**: 
- Chat interno: canal `internal-chat` com postgres changes em `internal_chat_messages` + presence.
- Chats de processo: mantêm os canais `proc-chat-{processId}` existentes. A lista de processos faz polling leve ou subscreve a um canal agregado para unread counts.

## Risks / Trade-offs

- **Duplicação de componentes de chat** → Mitiga-se extraindo componentes genéricos em `components/chat/` e fazendo os de processo re-importar. Pode ser feito incrementalmente após entrega inicial.
- **Performance da lista de processos com muitos processos** → Mitiga-se com paginação e query optimizada (índice em `proc_chat_messages.created_at`). Limite inicial de 50 processos.
- **Realtime em múltiplos canais simultaneamente** → O utilizador só tem um chat aberto de cada vez, portanto só um canal Realtime activo além do polling de unread counts.
- **RLS no chat interno** → Política simples: qualquer `dev_user` com `is_active = true` pode ler e escrever. Sem distinção de roles para o grupo geral.
