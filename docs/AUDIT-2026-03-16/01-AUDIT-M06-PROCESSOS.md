# AUDIT M06 — Processos (Instâncias)

**Data da auditoria:** 2026-03-16
**Âmbito:** Backend (API Routes) + Frontend (Pages, Components, Hooks) + Base de Dados

---

## 1. RESUMO

O módulo de Processos está **significativamente mais avançado** do que a documentação original descreve. A implementação real inclui 26 API routes, 61 componentes frontend, e um sistema completo de estado com 8 status possíveis.

| Área | Documentado | Real | Delta |
|------|------------|------|-------|
| API Routes | 8 endpoints | 26 route.ts | +18 |
| Componentes | ~10 | 61 | +51 |
| Colunas proc_instances | 11 | 25 | +14 |
| Colunas proc_tasks | 15 | 26 | +11 |
| Status de processo | 5 | 8 | +3 |

---

## 2. BASE DE DADOS — ESTADO ACTUAL

### 2.1. proc_instances (25 colunas, 35 registos)

| Coluna | Tipo | Documentada? | Notas |
|--------|------|:---:|-------|
| id | uuid | ✅ | PK |
| property_id | uuid | ✅ | FK → dev_properties |
| tpl_process_id | uuid | ✅ | FK → tpl_processes (null até aprovação) |
| external_ref | text | ✅ | Gerado por trigger `trg_generate_proc_ref` |
| current_status | text | ✅ | 8 valores possíveis |
| current_stage_id | uuid | ✅ | FK → tpl_stages |
| percent_complete | integer | ✅ | 0-100 |
| started_at | timestamptz | ✅ | |
| completed_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| **requested_by** | uuid | ❌ | FK → dev_users (quem criou) |
| **approved_by** | uuid | ❌ | FK → dev_users |
| **approved_at** | timestamptz | ❌ | |
| **returned_at** | timestamptz | ❌ | |
| **returned_reason** | text | ❌ | Motivo da devolução |
| **returned_by** | uuid | ❌ | FK → dev_users |
| **rejected_at** | timestamptz | ❌ | |
| **rejected_reason** | text | ❌ | Motivo da rejeição |
| **rejected_by** | uuid | ❌ | FK → dev_users |
| **notes** | text | ❌ | Notas livres |
| **deleted_at** | timestamptz | ❌ | Soft delete |
| **deleted_by** | uuid | ❌ | FK → dev_users |
| **negocio_id** | uuid | ❌ | FK → negocios (processos de negócio) |
| **last_completed_step** | integer | ❌ | Step da angariação multi-step |
| **process_type** | text | ❌ | `angariacao` ou `negocio` |

### 2.2. proc_tasks (26 colunas, 159 registos)

| Coluna | Tipo | Documentada? | Notas |
|--------|------|:---:|-------|
| id | uuid | ✅ | PK |
| proc_instance_id | uuid | ✅ | FK → proc_instances |
| tpl_task_id | uuid | ✅ | FK → tpl_tasks |
| title | text | ✅ | Copiado do template |
| status | text | ✅ | pending/in_progress/completed/skipped |
| is_mandatory | boolean | ✅ | |
| is_bypassed | boolean | ✅ | |
| bypass_reason | text | ✅ | |
| bypassed_by | uuid | ✅ | FK → dev_users |
| assigned_to | uuid | ✅ | FK → dev_users |
| due_date | timestamptz | ✅ | |
| completed_at | timestamptz | ✅ | |
| task_result | jsonb | ✅ | |
| stage_name | text | ✅ | |
| stage_order_index | integer | ✅ | |
| **action_type** | text | ❌ | COMPOSITE/UPLOAD/EMAIL/etc. |
| **config** | jsonb | ❌ | Configuração herdada do template |
| **assigned_role** | text | ❌ | Role atribuído (não user específico) |
| **order_index** | integer | ❌ | Ordem dentro da fase |
| **owner_id** | uuid | ❌ | FK → owners (tarefas por proprietário) |
| **priority** | text | ❌ | urgent/normal/low |
| **started_at** | timestamptz | ❌ | Quando passou a in_progress |
| **created_at** | timestamptz | ❌ | |
| **is_blocked** | boolean | ❌ | Bloqueada por dependência |
| **dependency_proc_task_id** | uuid | ❌ | FK → proc_tasks (self-ref) |
| **unblocked_at** | timestamptz | ❌ | Quando foi desbloqueada |

### 2.3. proc_subtasks (22 colunas, 104 registos) — NÃO DOCUMENTADA

Tabela **completamente ausente** da documentação original.

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid | PK |
| proc_task_id | uuid | FK → proc_tasks |
| tpl_subtask_id | uuid | FK → tpl_subtasks |
| title | text | |
| is_mandatory | boolean | |
| is_completed | boolean | |
| completed_at | timestamptz | |
| completed_by | uuid | FK → dev_users |
| order_index | integer | |
| config | jsonb | Configuração por tipo (upload, email, form, etc.) |
| created_at | timestamptz | |
| owner_id | uuid | FK → owners (multiplicação por proprietário) |
| due_date | timestamptz | |
| assigned_to | uuid | FK → dev_users |
| assigned_role | text | |
| priority | text | urgent/normal/low |
| started_at | timestamptz | |
| is_blocked | boolean | |
| dependency_type | text | none/subtask/task |
| dependency_proc_subtask_id | uuid | FK → proc_subtasks (self-ref) |
| dependency_proc_task_id | uuid | FK → proc_tasks |
| unblocked_at | timestamptz | |

### 2.4. Tabelas de Chat — NÃO DOCUMENTADAS

| Tabela | Registos | Colunas |
|--------|---------|---------|
| proc_chat_messages | 37 | id, proc_instance_id, user_id, content, parent_message_id, created_at, updated_at |
| proc_chat_reactions | 6 | id, proc_message_id, user_id, emoji |
| proc_chat_attachments | 2 | id, proc_message_id, file_url, file_name, file_type, file_size |
| proc_chat_read_receipts | 3 | id, proc_message_id, user_id, read_at |

### 2.5. Tabelas de Actividades e Comentários — NÃO DOCUMENTADAS

| Tabela | Registos |
|--------|---------|
| proc_task_activities | Existe |
| proc_task_comments | 1 |
| proc_alert_log | Existe |

### 2.6. Triggers

| Trigger | Tabela | Existe? | Notas |
|---------|--------|:---:|-------|
| trg_generate_proc_ref | proc_instances | ✅ | Gera referência ANG-YYYY-XXXX |
| trg_populate_tasks | proc_instances | ❌ | **NÃO EXISTE** — é chamado via RPC no approve |

**Nota crítica:** O CLAUDE.md menciona `trg_populate_tasks` como trigger automático, mas na realidade a população de tarefas é feita via **RPC `populate_process_tasks()`** chamado explicitamente na rota de aprovação.

### 2.7. ref_counters

| prefix | year | counter |
|--------|------|---------|
| ANG | 2026 | 38 |

O prefixo é "ANG" (angariação), não "PROC" como sugerido na documentação original.

---

## 3. MÁQUINA DE ESTADOS — REAL

```
                    ┌─────────┐
                    │  draft   │ ← Angariação multi-step
                    └────┬────┘
                         │ [finalize]
                    ┌────▼────────────┐
                    │ pending_approval │
                    └─┬──────┬──────┬─┘
          [approve]   │      │      │   [reject]
        ┌─────────────┘      │      └──────────────┐
        ▼                    │                      ▼
   ┌────────┐          [return]              ┌──────────┐
   │ active │                │               │ rejected │ (final)
   └──┬──┬──┘          ┌────▼────┐           └──────────┘
      │  │              │returned │
      │  │              └────┬────┘
      │  │                   │ [re-approve]
      │  │                   └──► pending_approval
      │  │
      │  └──── [hold] ──► on_hold ──► [resume] ──► active
      │
      ├──── [complete all tasks] ──► completed
      └──── [cancel] ──► cancelled
```

**Status documentados:** pending_approval, active, on_hold, completed, rejected (5)
**Status reais:** draft, pending_approval, returned, active, on_hold, completed, rejected, cancelled (8)

---

## 4. API ROUTES — INVENTÁRIO COMPLETO

### 4.1. Gestão de Instâncias (Documentadas ✅)

| Método | Rota | Estado |
|--------|------|:---:|
| GET | `/api/processes` | ✅ Implementado + filtros (search, status, process_type, property_id) |
| POST | `/api/processes` | ✅ Criação via angariação |
| GET | `/api/processes/[id]` | ✅ Detalhe com todas as relações |
| DELETE | `/api/processes/[id]` | ✅ Soft delete com notificação |
| POST | `/api/processes/[id]/approve` | ✅ Com selecção de template + RPC |
| POST | `/api/processes/[id]/reject` | ✅ Com motivo |
| POST | `/api/processes/[id]/return` | ✅ Com motivo |
| POST | `/api/processes/[id]/hold` | ✅ Pausar/reactivar |

### 4.2. Rotas NÃO Documentadas mas Implementadas

| Método | Rota | Funcionalidade |
|--------|------|---------------|
| POST | `/api/processes/[id]/cancel` | Cancelar processo |
| POST | `/api/processes/[id]/re-template` | Re-aplicar template diferente |
| GET/POST | `/api/processes/[id]/tasks` | Listar + criar tarefas ad-hoc |
| PUT/DELETE | `/api/processes/[id]/tasks/[taskId]` | Actualizar/eliminar tarefa |
| POST | `/api/processes/[id]/tasks/[taskId]/subtasks` | Criar subtarefa |
| PUT/DELETE | `/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]` | Gerir subtarefa |
| POST | `/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form` | Submeter formulário de subtarefa |
| GET/POST | `/api/processes/[id]/tasks/[taskId]/comments` | Comentários na tarefa |
| GET | `/api/processes/[id]/tasks/[taskId]/activities` | Actividades da tarefa |
| POST | `/api/processes/[id]/tasks/[taskId]/resend-email` | Reenviar email |
| GET | `/api/processes/[id]/activities` | Actividades do processo |
| GET | `/api/processes/[id]/documents` | Documentos/pastas do processo |
| GET/POST | `/api/processes/[id]/chat` | Mensagens do chat |
| DELETE | `/api/processes/[id]/chat/[messageId]` | Eliminar mensagem |
| POST | `/api/processes/[id]/chat/[messageId]/reactions` | Reacções |
| POST | `/api/processes/[id]/chat/read` | Marcar como lido |
| GET | `/api/processes/[id]/chat/entities` | Entidades referenciáveis |
| PUT/DELETE | `/api/processes/[id]/owners/[ownerId]` | Gerir proprietário |
| POST | `/api/processes/[id]/owners/populate-tasks` | Popular tarefas por proprietário |
| GET | `/api/processes/[id]/owners/template-tasks` | Tarefas do template por proprietário |

---

## 5. FRONTEND — INVENTÁRIO COMPLETO

### 5.1. Páginas

| Página | Rota | Estado | Notas |
|--------|------|:---:|-------|
| Listagem de processos | `/dashboard/processos` | ✅ | Lista + grid, filtros por status e tipo, bulk actions |
| Detalhe do processo | `/dashboard/processos/[id]` | ✅ | 8 tabs: Geral, Dados, Tarefas, Proprietários, Documentos, Chat, Actividades, Revisão |
| Layout | `/dashboard/processos/layout.tsx` | ✅ | |

### 5.2. Componentes (61 ficheiros em `components/processes/`)

#### Core Processo
| Componente | Ficheiro | Estado |
|-----------|----------|:---:|
| ProcessStepper | `process-stepper.tsx` | ✅ |
| ProcessTasksSection | `process-tasks-section.tsx` | ✅ |
| ProcessReviewSection | `process-review-section.tsx` | ✅ |
| ProcessReviewBento | `process-review-bento.tsx` | ✅ |
| ProcessPropertyTab | `process-property-tab.tsx` | ✅ |

#### Vistas de Tarefas
| Componente | Ficheiro | Estado |
|-----------|----------|:---:|
| ProcessKanbanView | `process-kanban-view.tsx` | ✅ |
| ProcessListView | `process-list-view.tsx` | ✅ |
| ProcessTimelineView | `process-timeline-view.tsx` | ✅ |
| ProcessTaskCard | `process-task-card.tsx` | ✅ |
| ProcessTaskAssignDialog | `process-task-assign-dialog.tsx` | ✅ |

#### Detalhe de Tarefa
| Componente | Ficheiro | Estado |
|-----------|----------|:---:|
| TaskDetailSheet | `task-detail-sheet.tsx` | ✅ |
| TaskDetailMetadata | `task-detail-metadata.tsx` | ✅ |
| TaskDetailActions | `task-detail-actions.tsx` | ✅ |
| TaskSheetSidebar | `task-sheet-sidebar.tsx` | ✅ |
| TaskDocumentsPanel | `task-documents-panel.tsx` | ✅ |
| TaskUploadAction | `task-upload-action.tsx` | ✅ |
| TaskFormAction | `task-form-action.tsx` | ✅ |
| AdhocTaskSheet | `adhoc-task-sheet.tsx` | ✅ |

#### Subtarefas (7 variantes por tipo)
| Componente | Ficheiro | Tipo |
|-----------|----------|------|
| SubtaskCardList | `subtask-card-list.tsx` | Container |
| SubtaskCardBase | `subtask-card-base.tsx` | Base |
| SubtaskCardUpload | `subtask-card-upload.tsx` | Upload ficheiro |
| SubtaskCardEmail | `subtask-card-email.tsx` | Enviar email |
| SubtaskCardDoc | `subtask-card-doc.tsx` | Gerar documento |
| SubtaskCardForm | `subtask-card-form.tsx` | Formulário dinâmico |
| SubtaskCardChecklist | `subtask-card-checklist.tsx` | Checklist manual |
| SubtaskCardField | `subtask-card-field.tsx` | Campo individual |
| SubtaskEmailSheet | `subtask-email-sheet.tsx` | Sheet de envio email |
| SubtaskDocSheet | `subtask-doc-sheet.tsx` | Sheet de geração doc |
| FormSubtaskDialog | `form-subtask-dialog.tsx` | Dialog de formulário |

#### Formulários Dinâmicos
| Componente | Ficheiro | Estado |
|-----------|----------|:---:|
| DynamicFormRenderer | `dynamic-form-renderer.tsx` | ✅ |
| FieldSubtaskInline | `field-subtask-inline.tsx` | ✅ |
| AddressMapFieldRenderer | `address-map-field-renderer.tsx` | ✅ |
| MediaUploadFieldRenderer | `media-upload-field-renderer.tsx` | ✅ |
| RichTextFieldRenderer | `rich-text-field-renderer.tsx` | ✅ |
| LinkExternalFieldRenderer | `link-external-field-renderer.tsx` | ✅ |

#### Documentos do Processo
| Componente | Ficheiro | Estado |
|-----------|----------|:---:|
| ProcessDocumentsManager | `process-documents-manager.tsx` | ✅ |
| DocumentFolderCard | `document-folder-card.tsx` | ✅ |
| DocumentFileCard | `document-file-card.tsx` | ✅ |
| DocumentFileRow | `document-file-row.tsx` | ✅ |
| DocumentBreadcrumbNav | `document-breadcrumb-nav.tsx` | ✅ |
| DocumentPreviewDialog | `document-preview-dialog.tsx` | ✅ |

#### Proprietários do Processo
| Componente | Ficheiro | Estado |
|-----------|----------|:---:|
| ProcessOwnersTab | `process-owners-tab.tsx` | ✅ |
| ProcessOwnerCard | `process-owner-card.tsx` | ✅ |
| OwnerSelector | `owner-selector.tsx` | ✅ |
| OwnerEditSheet | `owner-edit-sheet.tsx` | ✅ |
| AddOwnerDialog | `add-owner-dialog.tsx` | ✅ |
| SpouseRegistrationDialog | `spouse-registration-dialog.tsx` | ✅ |
| OwnerTasksDropdown | `owner-tasks-dropdown.tsx` | ✅ |
| OwnershipSummaryBar | `ownership-summary-bar.tsx` | ✅ |

#### Chat e Actividades
| Componente | Ficheiro | Estado |
|-----------|----------|:---:|
| ProcessChat | `process-chat.tsx` | ✅ |
| ChatInput | `chat-input.tsx` | ✅ |
| ChatMessage | `chat-message.tsx` | ✅ |
| ChatAttachment | `chat-attachment.tsx` | ✅ |
| ChatReplyPreview | `chat-reply-preview.tsx` | ✅ |
| ChatReactions | `chat-reactions.tsx` | ✅ |
| VoiceRecorder | `voice-recorder.tsx` | ✅ |
| FloatingChat | `floating-chat.tsx` | ✅ |
| TaskActivityFeed | `task-activity-feed.tsx` | ✅ |
| TaskActivityTimeline | `task-activity-timeline.tsx` | ✅ |
| CommentInput | `comment-input.tsx` | ✅ |
| MediaImageCard | `media-image-card.tsx` | ✅ |

### 5.3. Hooks

| Hook | Ficheiro | Estado |
|------|----------|:---:|
| useProcessActivities | `hooks/use-process-activities.ts` | ✅ (com Realtime) |
| useProcessDocuments | `hooks/use-process-documents.ts` | ✅ |

### 5.4. Serviços e Utilitários

| Ficheiro | Descrição | Estado |
|----------|-----------|:---:|
| `lib/process-engine.ts` | autoCompleteTasks, recalculateProgress | ✅ |
| `lib/processes/activity-logger.ts` | Logger de actividades | ✅ |
| `lib/notifications/service.ts` | Serviço de notificações | ✅ |
| `lib/notifications/types.ts` | Tipos de notificação | ✅ |
| `lib/alerts/service.ts` | Serviço de alertas | ✅ |

---

## 6. O QUE ESTÁ DOCUMENTADO MAS NÃO IMPLEMENTADO

### 6.1. Da documentação M06 original

| Feature | Doc de Origem | Estado | Notas |
|---------|--------------|:---:|-------|
| Supabase Realtime para tarefas | SPEC-M06-PROCESSOS.md | ⚠️ Parcial | Realtime existe para actividades, não para tarefas |
| Kanban drag-and-drop entre fases | SPEC-REDESIGN-PROCESSO-DETALHE.md | ❌ | Componente existe mas sem DnD entre colunas |
| @mentions nos comentários | SPEC-ADHOC-TASKS-PROCESSOS.md | ❌ | CommentInput existe mas sem react-mentions |
| Histórico de edições de comentários | SPEC-ADHOC-TASKS-PROCESSOS.md | ❌ | Apenas CRUD básico |

### 6.2. Features planeadas mas não encontradas no código

| Feature | Descrição | Prioridade |
|---------|-----------|:---:|
| Typing indicators no chat | Broadcast Realtime de "está a escrever" | Baixa |
| Rich text no chat (Tiptap) | Editor WYSIWYG no input do chat | Baixa |
| Dashboard de delivery status | Painel de entrega de emails/SMS/WhatsApp | Média |
| Cálculos automáticos em campos FORM | Campos calculados em formulários dinâmicos | Baixa |
| Field dependencies (visibilidade condicional) | Campo A visível se B = X | Média |

---

## 7. O QUE ESTÁ IMPLEMENTADO MAS NÃO DOCUMENTADO

| Feature | Descrição |
|---------|-----------|
| Sistema de chat completo | 4 tabelas + 5 API routes + 8 componentes |
| Subtarefas (proc_subtasks) | 22 colunas, 104 registos, 6 tipos |
| Tarefas ad-hoc | Criar tarefas fora do template |
| Re-template | Reaplicar template diferente a processo activo |
| Cancelamento de processo | Endpoint dedicado |
| Formulários dinâmicos | 6 renderizadores de campo especializados |
| Multiplicação por proprietário | Tarefas duplicadas por cada owner |
| Activity logging | Sistema completo de auditoria por tarefa |
| Registo de cônjuges | Dialog especializado |
| Voice recorder | Gravação de áudio no chat |
| Dependências entre tarefas | is_blocked + dependency_proc_task_id |
| Soft delete de processos | deleted_at + deleted_by |
| Processo de negócio | process_type + negocio_id |
