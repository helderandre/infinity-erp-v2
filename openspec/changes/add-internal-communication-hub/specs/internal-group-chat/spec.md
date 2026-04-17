## ADDED Requirements

### Requirement: Chat geral interno entre utilizadores activos
O sistema SHALL disponibilizar um canal de chat de grupo único ("Grupo Geral") acessível a todos os `dev_users` com `is_active = true`. As mensagens são persistidas na tabela `internal_chat_messages` com `channel_id` fixo.

#### Scenario: Utilizador abre o Chat Interno
- **WHEN** o utilizador navega para `/dashboard/comunicacao/chat` e selecciona "Grupo Geral"
- **THEN** o painel de chat MUST exibir todas as mensagens do canal ordenadas por `created_at` ascendente, com scroll automático para a mensagem mais recente

#### Scenario: Utilizador envia mensagem de texto
- **WHEN** o utilizador escreve texto no input e submete (Enter ou botão)
- **THEN** o sistema MUST inserir registo em `internal_chat_messages` com `sender_id`, `content`, `channel_id` e a mensagem MUST aparecer em tempo real para todos os utilizadores conectados ao canal

#### Scenario: Utilizador envia ficheiro
- **WHEN** o utilizador anexa um ficheiro (imagem, documento, áudio, vídeo) e submete
- **THEN** o sistema MUST fazer upload ao R2 via `/api/chat/upload`, criar registo em `internal_chat_attachments` e exibir o anexo inline (imagem com preview, áudio com player, documento com ícone + download)

### Requirement: Gravação de áudio (voz)
O sistema SHALL permitir gravação de mensagens de áudio directamente no chat, idêntico ao comportamento do chat de processo.

#### Scenario: Utilizador grava mensagem de voz
- **WHEN** o utilizador clica no botão de microfone, grava áudio e confirma
- **THEN** o sistema MUST enviar o áudio como attachment do tipo `audio` e exibir player inline com controlos de reprodução

### Requirement: Menções de utilizadores
O sistema SHALL suportar menções `@utilizador` com autocomplete baseado na lista de `dev_users` activos.

#### Scenario: Utilizador menciona outro utilizador
- **WHEN** o utilizador digita `@` seguido de caracteres
- **THEN** o sistema MUST exibir dropdown de autocomplete com `dev_users` activos cujo `commercial_name` corresponde ao texto, e ao seleccionar, MUST inserir a menção no campo de mensagem com destaque visual

### Requirement: Respostas a mensagens (reply)
O sistema SHALL permitir responder a uma mensagem específica, mostrando preview da mensagem original.

#### Scenario: Utilizador responde a mensagem
- **WHEN** o utilizador clica "Responder" numa mensagem e envia nova mensagem
- **THEN** a nova mensagem MUST ter `parent_message_id` preenchido e MUST exibir preview da mensagem original acima do conteúdo

### Requirement: Reacções com emoji
O sistema SHALL permitir adicionar e remover reacções emoji a qualquer mensagem.

#### Scenario: Utilizador adiciona reacção
- **WHEN** o utilizador clica no botão de reacção e selecciona um emoji
- **THEN** o sistema MUST criar/toggle registo em `internal_chat_reactions` e exibir o emoji com contagem abaixo da mensagem, actualizado em tempo real

### Requirement: Edição e eliminação de mensagens
O sistema SHALL permitir que o autor edite ou elimine (soft delete) as suas próprias mensagens.

#### Scenario: Utilizador edita mensagem própria
- **WHEN** o autor clica "Editar", modifica o texto e confirma
- **THEN** o sistema MUST actualizar `content` e `edited_at` em `internal_chat_messages` e exibir indicador "(editado)"

#### Scenario: Utilizador elimina mensagem própria
- **WHEN** o autor clica "Eliminar" e confirma
- **THEN** o sistema MUST definir `is_deleted = true` e `deleted_at` e exibir placeholder "Mensagem eliminada"

### Requirement: Read receipts
O sistema SHALL rastrear quais utilizadores leram as mensagens via `internal_chat_read_receipts`.

#### Scenario: Utilizador abre o chat e lê mensagens
- **WHEN** o utilizador abre o painel do Grupo Geral e visualiza mensagens
- **THEN** o sistema MUST actualizar `last_read_message_id` e `last_read_at` em `internal_chat_read_receipts` e exibir ícone com contagem de leitores em cada mensagem

### Requirement: Presença em tempo real
O sistema SHALL mostrar quais utilizadores estão online e quem está a escrever, via Supabase Presence.

#### Scenario: Utilizadores online
- **WHEN** múltiplos utilizadores têm o chat aberto
- **THEN** o sistema MUST exibir indicador verde e contagem de utilizadores online no cabeçalho do chat

#### Scenario: Indicador de escrita
- **WHEN** um utilizador está a digitar no input
- **THEN** os outros utilizadores MUST ver indicador "X está a escrever..." com animação

### Requirement: Contactos visíveis
O sistema SHALL exibir a lista de todos os `dev_users` activos como contactos disponíveis no canal geral, com avatar, nome e estado online/offline.

#### Scenario: Listagem de contactos
- **WHEN** o utilizador visualiza o painel do Grupo Geral
- **THEN** o cabeçalho ou sidebar MUST mostrar os participantes do grupo (todos os `dev_users` activos) com indicação de online/offline
