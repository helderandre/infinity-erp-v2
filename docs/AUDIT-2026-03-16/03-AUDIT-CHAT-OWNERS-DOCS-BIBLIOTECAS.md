# AUDIT — Chat, Proprietários, Documentos e Bibliotecas

**Data da auditoria:** 2026-03-16
**Âmbito:** Sub-módulos transversais de M06/M07

---

## 1. SISTEMA DE CHAT EM PROCESSO

### 1.1. Estado: ✅ IMPLEMENTADO (não documentado no CLAUDE.md)

O sistema de chat em processo é **completamente funcional** com mensagens, reacções, anexos e read receipts.

### 1.2. Base de Dados

| Tabela | Colunas | Registos | Documentada? |
|--------|---------|---------|:---:|
| proc_chat_messages | id, proc_instance_id, user_id, content, parent_message_id, created_at, updated_at | 37 | ❌ |
| proc_chat_reactions | id, proc_message_id, user_id, emoji | 6 | ❌ |
| proc_chat_attachments | id, proc_message_id, file_url, file_name, file_type, file_size | 2 | ❌ |
| proc_chat_read_receipts | id, proc_message_id, user_id, read_at | 3 | ❌ |

### 1.3. API Routes

| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET | `/api/processes/[id]/chat` | Listar mensagens (paginado) |
| POST | `/api/processes/[id]/chat` | Enviar mensagem |
| DELETE | `/api/processes/[id]/chat/[messageId]` | Eliminar mensagem |
| POST | `/api/processes/[id]/chat/[messageId]/reactions` | Adicionar/remover reacção |
| POST | `/api/processes/[id]/chat/read` | Marcar mensagens como lidas |
| GET | `/api/processes/[id]/chat/entities` | Listar entidades referenciáveis (tarefas, docs) |

### 1.4. Componentes Frontend (8 ficheiros)

| Componente | Ficheiro | Descrição |
|-----------|----------|-----------|
| ProcessChat | `process-chat.tsx` | Container principal do chat |
| ChatInput | `chat-input.tsx` | Input com suporte a anexos |
| ChatMessage | `chat-message.tsx` | Renderização de mensagem individual |
| ChatAttachment | `chat-attachment.tsx` | Display de anexo na mensagem |
| ChatReplyPreview | `chat-reply-preview.tsx` | Preview de resposta (quote) |
| ChatReactions | `chat-reactions.tsx` | UI de reacções emoji |
| VoiceRecorder | `voice-recorder.tsx` | Gravação de áudio |
| FloatingChat | `floating-chat.tsx` | Bolha flutuante do chat |

### 1.5. O Que Falta

| Feature | Prioridade | Notas |
|---------|:---:|-------|
| Supabase Realtime para mensagens | Média | Actualmente usa polling/refresh manual |
| Typing indicators | Baixa | Broadcast channel |
| Rich text editor (Tiptap) | Baixa | Actualmente texto simples |
| Threads/respostas aninhadas | Baixa | parent_message_id existe na DB mas UI básica |

---

## 2. GESTÃO DE PROPRIETÁRIOS EM PROCESSO

### 2.1. Estado: ✅ IMPLEMENTADO (parcialmente documentado)

Sistema completo para gerir proprietários dentro do contexto de um processo, incluindo tarefas por proprietário, cônjuges, e tipos de papel.

### 2.2. API Routes

| Método | Rota | Funcionalidade |
|--------|------|---------------|
| PUT/DELETE | `/api/processes/[id]/owners/[ownerId]` | Editar/remover proprietário |
| POST | `/api/processes/[id]/owners/populate-tasks` | Gerar tarefas para proprietários |
| GET | `/api/processes/[id]/owners/template-tasks` | Obter tarefas do template aplicáveis |

### 2.3. Componentes Frontend (8 ficheiros)

| Componente | Ficheiro | Descrição |
|-----------|----------|-----------|
| ProcessOwnersTab | `process-owners-tab.tsx` | Tab principal de proprietários |
| ProcessOwnerCard | `process-owner-card.tsx` | Card individual de proprietário |
| OwnerSelector | `owner-selector.tsx` | Dropdown de selecção |
| OwnerEditSheet | `owner-edit-sheet.tsx` | Sheet de edição |
| AddOwnerDialog | `add-owner-dialog.tsx` | Dialog para adicionar proprietário |
| SpouseRegistrationDialog | `spouse-registration-dialog.tsx` | Registo de cônjuge |
| OwnerTasksDropdown | `owner-tasks-dropdown.tsx` | Tarefas atribuídas ao proprietário |
| OwnershipSummaryBar | `ownership-summary-bar.tsx` | Barra de % de propriedade |

### 2.4. Tabelas Relacionadas

| Tabela | Notas |
|--------|-------|
| owners | Pessoa singular/colectiva |
| property_owners | Junction M:N com percentagem |
| owner_beneficiaries | Beneficiários efectivos (colectiva) |
| owner_role_types | Tipos de papel com cores e labels |

### 2.5. O Que Falta

| Feature | Prioridade | Notas |
|---------|:---:|-------|
| Validação KYC automatizada | Média | Estrutura de dados existe, falta validação automática |
| Notificação ao proprietário | Baixa | Quando documentos são pedidos |

---

## 3. GESTÃO DE DOCUMENTOS EM PROCESSO

### 3.1. Estado: ✅ IMPLEMENTADO

Sistema de pastas e ficheiros dentro do processo, com preview de PDF e imagens.

### 3.2. API Routes

| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET | `/api/processes/[id]/documents` | Listar documentos/pastas |

### 3.3. Componentes Frontend (7 ficheiros)

| Componente | Ficheiro | Descrição |
|-----------|----------|-----------|
| ProcessDocumentsManager | `process-documents-manager.tsx` | Gestor principal com pesquisa e stats |
| DocumentFolderCard | `document-folder-card.tsx` | Card de pasta |
| DocumentFileCard | `document-file-card.tsx` | Card de ficheiro (grid) |
| DocumentFileRow | `document-file-row.tsx` | Linha de ficheiro (tabela) |
| DocumentBreadcrumbNav | `document-breadcrumb-nav.tsx` | Navegação breadcrumb |
| DocumentPreviewDialog | `document-preview-dialog.tsx` | Preview de PDF/imagem |
| TaskDocumentsPanel | `task-documents-panel.tsx` | Documentos associados a tarefa |

### 3.4. Hook

| Hook | Ficheiro | Descrição |
|------|----------|-----------|
| useProcessDocuments | `hooks/use-process-documents.ts` | Fetch com pesquisa, stats, estrutura de pastas |

---

## 4. SISTEMA DE ACTIVIDADES

### 4.1. Estado: ✅ IMPLEMENTADO (não documentado)

Sistema completo de logging de actividades por processo e por tarefa.

### 4.2. API Routes

| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET | `/api/processes/[id]/activities` | Actividades do processo |
| GET | `/api/processes/[id]/tasks/[taskId]/activities` | Actividades da tarefa |

### 4.3. Componentes

| Componente | Ficheiro | Descrição |
|-----------|----------|-----------|
| TaskActivityFeed | `task-activity-feed.tsx` | Feed de actividades |
| TaskActivityTimeline | `task-activity-timeline.tsx` | Timeline visual |

### 4.4. Serviço

| Ficheiro | Descrição |
|----------|-----------|
| `lib/processes/activity-logger.ts` | Logger centralizado |

### 4.5. Hook

| Hook | Ficheiro | Descrição |
|------|----------|-----------|
| useProcessActivities | `hooks/use-process-activities.ts` | Fetch com Supabase Realtime |

---

## 5. BIBLIOTECAS (APIs de Suporte)

### 5.1. Estado: ✅ IMPLEMENTADO (maioritariamente não documentado)

As APIs de bibliotecas fornecem dados de referência para templates e processos.

### 5.2. API Routes (15 route.ts files)

#### Email Library
| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET/POST | `/api/libraries/emails` | CRUD de email templates |
| GET/PUT/DELETE | `/api/libraries/emails/[id]` | Detalhe/edição/eliminação |
| POST | `/api/libraries/emails/upload` | Upload de HTML |
| POST | `/api/libraries/emails/upload-attachment` | Upload de anexo |
| GET | `/api/libraries/emails/preview-data` | Dados de preview |

#### Document Library
| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET/POST | `/api/libraries/docs` | CRUD de doc templates |
| GET/PUT/DELETE | `/api/libraries/docs/[id]` | Detalhe/edição/eliminação |
| POST | `/api/libraries/docs/upload-image` | Upload de imagem |
| POST | `/api/libraries/docs/upload-letterhead` | Upload de letterhead |

#### Document Types
| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET/POST | `/api/libraries/doc-types` | CRUD de tipos de documento |
| GET/PUT/DELETE | `/api/libraries/doc-types/[id]` | Detalhe/edição/eliminação |

#### Variables
| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET/POST | `/api/libraries/variables` | CRUD de variáveis |
| GET/PUT/DELETE | `/api/libraries/variables/[id]` | Detalhe/edição/eliminação |

#### Roles
| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET | `/api/libraries/roles` | Listar roles disponíveis |
| GET | `/api/libraries/roles/[id]` | Detalhe do role |

### 5.3. Hooks Relacionados

| Hook | Ficheiro | Descrição |
|------|----------|-----------|
| useTemplateVariables | `hooks/use-template-variables.ts` | Cache in-memory de variáveis |
| useEmailTemplate | `hooks/use-email-template.ts` | Fetch de template de email |
| useEmailTemplates | `hooks/use-email-templates.ts` | Lista de templates de email |
| useWppTemplates | `hooks/use-wpp-templates.ts` | Templates WhatsApp |

---

## 6. SISTEMA DE NOTIFICAÇÕES

### 6.1. Estado: ✅ IMPLEMENTADO

| Ficheiro | Descrição |
|----------|-----------|
| `lib/notifications/service.ts` | Serviço centralizado |
| `lib/notifications/types.ts` | Tipos de notificação |

### 6.2. Eventos Suportados

1. **Processo criado** → Roles aprovadores notificados
2. **Processo aprovado** → Requisitante notificado
3. **Tarefa atribuída** → Utilizador atribuído notificado
4. **Tarefa concluída** → Roles aprovadores notificados
5. **Tarefa actualizada** → Utilizador atribuído notificado
6. **Processo eliminado** → Requisitante + aprovadores notificados
7. **Processo devolvido** → Requisitante notificado
8. **Processo rejeitado** → Requisitante notificado

---

## 7. SISTEMA DE ALERTAS

### 7.1. Estado: ⚠️ PARCIAL

| Ficheiro | Descrição | Estado |
|----------|-----------|:---:|
| `lib/alerts/service.ts` | Serviço de alertas | ✅ |
| `lib/validations/alert.ts` | Validação Zod | ✅ |
| `types/alert.ts` | Tipos TypeScript | ✅ |
| `components/templates/alert-config-editor.tsx` | UI de configuração | ✅ |
| proc_alert_log | Tabela de log | ✅ |
| Trigger/cron de disparo automático | — | ❌ **Falta** |
| Dashboard de delivery | — | ❌ **Falta** |

### 7.2. O Que Falta

| Feature | Prioridade | Notas |
|---------|:---:|-------|
| Cron job para verificar tarefas com SLA próximo do vencimento | Alta | Disparar alertas X dias antes |
| Integração Resend para email de alerta | Alta | Infraestrutura Resend já existe no projecto |
| Integração Twilio para SMS/WhatsApp | Média | Infraestrutura WhatsApp existe em auto_wpp_* |
| UI de log de alertas enviados | Média | proc_alert_log existe, falta frontend |
