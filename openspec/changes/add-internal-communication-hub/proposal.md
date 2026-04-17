## Why

A comunicação interna entre consultores e equipa está dispersa: o chat só existe dentro de cada processo individual, obrigando os utilizadores a navegar até ao processo para trocar mensagens. Falta um ponto central onde a equipa possa conversar entre si (grupo geral) e aceder rapidamente a todos os chats de processos activos. Centralizar isto numa página dedicada dentro do grupo "Comunicação" do sidebar melhora a produtividade e a visibilidade das conversas internas.

## What Changes

- **Nova página `/dashboard/comunicacao/chat`** dentro do grupo "Comunicação" do sidebar, com duas secções:
  1. **Chat Interno (Grupo)** — canal de conversa geral com todos os utilizadores `dev_users` activos. Mensagens de texto, ficheiros, áudio, reacções, respostas, menções — as mesmas capacidades do chat de processo existente.
  2. **Chats de Processos** — listagem de todos os processos em que o utilizador participa, com preview da última mensagem, contagem de não lidas, e atalho directo para o chat do processo (abre inline ou navega para o processo). Todas as funcionalidades de envio do chat de processo (texto, ficheiros, áudio, menções, reacções, respostas) ficam disponíveis aqui sem sair da página.
- **Nova tabela `chat_messages`** (ou equivalente) para mensagens do chat geral interno (separada de `proc_chat_messages`).
- **Reutilização máxima** dos componentes de chat existentes (`chat-input`, `chat-message`, `chat-attachment`, `chat-reactions`, `voice-recorder`, etc.) — refactorizados para aceitar um `channelType` genérico.
- **Nova entrada no sidebar** "Chat Interno" no grupo "Comunicação".

## Capabilities

### New Capabilities
- `internal-group-chat`: Canal de chat geral entre todos os `dev_users` activos — mensagens, ficheiros, áudio, reacções, menções, respostas, read receipts, presença em tempo real.
- `process-chats-hub`: Listagem centralizada de todos os chats de processos do utilizador com preview, unread count e acesso inline completo (todas as capacidades de envio do chat de processo).

### Modified Capabilities
_(nenhuma — os chats de processo existentes continuam a funcionar sem alteração de requisitos)_

## Impact

- **Componentes**: Refactorizar componentes em `components/processes/` (chat-input, chat-message, etc.) para serem genéricos ou criar wrappers. Novos componentes em `components/comunicacao/`.
- **API**: Novas routes em `app/api/chat/` para o chat geral (CRUD mensagens, reacções, read receipts, upload). Reutilizar `/api/chat/upload/` existente.
- **Base de dados**: Nova(s) tabela(s) para mensagens do chat geral (`internal_chat_messages`, `internal_chat_reactions`, `internal_chat_read_receipts`). Possível migração Supabase.
- **Realtime**: Novo canal Supabase Realtime para o chat geral (presença + postgres changes).
- **Sidebar**: Adicionar item "Chat Interno" ao array `comunicacaoItems` em `app-sidebar.tsx`.
- **Hooks**: Adaptar `use-chat-messages.ts` e `use-chat-presence.ts` para suportar múltiplos tipos de canal, ou criar hooks paralelos.
- **Dependências**: Nenhuma nova — reutiliza infra existente (Supabase, R2, mapbox não aplicável).
