# SPEC-M27 — Tarefas & Feedback (Tickets + Ideias)

**Data:** 2026-03-29
**Estado:** Implementado

---

## 1. Visão Geral

Dois módulos complementares:

1. **Tarefas** — sistema de gestão de tarefas estilo Todoist para a equipa. Permite ao Broker/CEO atribuir tarefas a consultores, acompanhar prazos, e manter visibilidade sobre o que está pendente. Inclui sub-tarefas, recorrência, comentários e anexos.

2. **Feedback (Tickets + Ideias)** — canal para consultores reportarem problemas (tickets) ou sugerirem melhorias (ideias) à equipa técnica, via texto ou voz (transcrição com IA). Pipeline Kanban para a equipa técnica gerir e priorizar.

---

## 2. Módulo de Tarefas

### 2.1 Base de Dados

#### Tabela `tasks`

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | Identificador |
| title | TEXT NOT NULL | Título da tarefa |
| description | TEXT | Descrição opcional |
| parent_task_id | UUID FK → tasks | Sub-tarefa (hierarquia) |
| assigned_to | UUID FK → dev_users | Quem executa |
| created_by | UUID FK → dev_users | Quem criou |
| priority | INT (1-4) | 1=Urgente, 2=Alta, 3=Média, 4=Normal |
| due_date | TIMESTAMPTZ | Data limite |
| is_recurring | BOOLEAN | Se é recorrente |
| recurrence_rule | TEXT | Regra iCal RRULE (ex: `FREQ=WEEKLY;BYDAY=MO`) |
| is_completed | BOOLEAN | Estado de conclusão |
| completed_at | TIMESTAMPTZ | Quando foi concluída |
| completed_by | UUID FK → dev_users | Quem concluiu |
| entity_type | TEXT | Link polimórfico: property, lead, process, owner, negocio |
| entity_id | UUID | ID da entidade associada |
| order_index | INT | Ordenação |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Auto-actualizado por trigger |

#### Tabela `task_comments`

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| task_id | UUID FK → tasks | CASCADE on delete |
| user_id | UUID FK → dev_users | Autor |
| content | TEXT NOT NULL | Conteúdo |
| created_at | TIMESTAMPTZ | |

#### Tabela `task_attachments`

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| task_id | UUID FK → tasks | CASCADE on delete |
| uploaded_by | UUID FK → dev_users | |
| file_name | TEXT | Nome original |
| file_url | TEXT | URL pública (R2) |
| file_size | INT | Bytes |
| mime_type | TEXT | |
| created_at | TIMESTAMPTZ | |

#### RLS

- Service role: acesso total
- Autenticados: vêem tarefas que lhes são atribuídas ou que criaram
- Inserção: apenas o próprio como `created_by` / `user_id` / `uploaded_by`
- Eliminação de anexos: apenas o uploader

#### Indexes

- `(assigned_to, is_completed)` WHERE NOT is_completed — tarefas pendentes por utilizador
- `(entity_type, entity_id)` WHERE entity_type IS NOT NULL — tarefas por entidade
- `(parent_task_id)` WHERE NOT NULL — sub-tarefas
- `(due_date)` WHERE NOT NULL AND NOT is_completed — overdue/upcoming
- `(created_by)` — "as minhas tarefas criadas"
- `task_comments(task_id)`, `task_attachments(task_id)`

### 2.2 API Routes

| Rota | Métodos | Descrição |
|---|---|---|
| `/api/tasks` | GET, POST | Listagem com filtros (assigned_to, priority, is_completed, overdue, entity_type, entity_id, search) + paginação. Criação com notificação ao assignee |
| `/api/tasks/[id]` | GET, PUT, DELETE | Detalhe com sub-tarefas/counts. Actualização com lógica de conclusão, recorrência e notificações |
| `/api/tasks/[id]/comments` | GET, POST | Thread de comentários. Notifica assignee + creator |
| `/api/tasks/[id]/attachments` | GET, POST | Upload de ficheiros ao R2 (path: `task-attachments/{taskId}/`) |
| `/api/tasks/attachments/[attachmentId]` | DELETE | Eliminar do R2 + DB |
| `/api/tasks/stats` | GET | Contagens: pending, overdue, completed_today, urgent + 5 próximas tarefas |

### 2.3 Lógica de Recorrência

Quando uma tarefa recorrente é concluída:
1. Parser de RRULE calcula a próxima data (`lib/tasks/recurrence.ts`)
2. Cria nova cópia da tarefa com a nova `due_date`
3. Suporta: DAILY, WEEKLY (com BYDAY), MONTHLY, YEARLY, INTERVAL

**Presets disponíveis:**
- Diariamente, Dias úteis, Semanalmente, Quinzenalmente, Mensalmente, Trimestralmente, Anualmente

### 2.4 Notificações

Integra com o sistema existente (`lib/notifications/service.ts`):

| Evento | Destinatário | Tipo |
|---|---|---|
| Tarefa atribuída | Assignee | `task_assigned` |
| Tarefa concluída | Creator (ou assignee se diferente) | `task_completed` |
| Novo comentário | Assignee + Creator (excepto autor) | `task_comment` |
| Reatribuição | Novo assignee | `task_assigned` |

### 2.5 Frontend

**Página:** `/dashboard/tarefas`

- 4 cards de stats: Pendentes, Em atraso, Concluídas hoje, Urgentes
- Barra de filtros: pesquisa, atribuído a, prioridade, estado (pendentes/concluídas/em atraso/todas)
- Lista de tarefas com checkbox, prioridade (dot colorido), due date (vermelho se overdue), assignee, contagem de sub-tarefas/comentários/anexos, ícone de recorrência
- Dialog de criação: título, descrição, assignee, prioridade, data limite, recorrência, link a entidade
- Sheet de detalhe: info completa, sub-tarefas com checkbox, comentários (thread com envio), anexos (upload/download/delete), botão eliminar com confirmação

**Componentes:**
- `components/tasks/task-filters.tsx`
- `components/tasks/task-form.tsx`
- `components/tasks/task-list-item.tsx`
- `components/tasks/task-detail-sheet.tsx`
- `components/tasks/task-dashboard-widget.tsx`

**Hook:** `hooks/use-tasks.ts` — `useTasks()`, `useTaskStats()`, `useTaskMutations()`

**Sidebar:** "Tarefas" adicionado a "O Meu Espaço" (ícone CheckSquare)

**Dashboard Widget:** `<TaskDashboardWidget />` — card com pendentes, em atraso e 5 próximas tarefas

---

## 3. Módulo de Feedback (Tickets + Ideias)

### 3.1 Base de Dados

#### Tabela `feedback_submissions`

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| type | TEXT NOT NULL | `ticket` (bug) ou `ideia` (feature request) |
| title | TEXT NOT NULL | Título |
| description | TEXT | Descrição detalhada |
| voice_url | TEXT | URL da gravação de voz (R2) |
| images | TEXT[] | URLs das imagens anexadas (R2) |
| status | TEXT | Pipeline: novo → em_analise → em_desenvolvimento → concluido / rejeitado |
| priority | INT (1-4) | Definido pela equipa técnica |
| submitted_by | UUID FK → dev_users | Quem submeteu |
| tech_notes | TEXT | Notas internas da equipa técnica |
| assigned_to | UUID FK → dev_users | Membro técnico responsável |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### RLS

- Service role: acesso total
- Autenticados: inserir (como `submitted_by = auth.uid()`), ver os próprios
- A pipeline page usa `createAdminClient()` para ver todos (apenas acessível a admins via sidebar)

### 3.2 API Routes

| Rota | Métodos | Descrição |
|---|---|---|
| `/api/feedback` | GET, POST | Listagem com filtros (type, status, submitted_by) + criação |
| `/api/feedback/[id]` | GET, PUT, DELETE | Detalhe, actualizar (status, priority, assignee, tech_notes), eliminar |
| `/api/feedback/upload` | POST | Upload de imagens ao R2 (path: `feedback/{userId}/{timestamp}.webp`) |
| `/api/transcribe` | POST | Transcrição de áudio via OpenAI Whisper (standalone, reutilizável) |

### 3.3 Transcrição por Voz

**Fluxo:**
1. Utilizador clica "Gravar" → browser captura áudio via `MediaRecorder` (WebM)
2. Clica "Parar" → áudio enviado a `POST /api/transcribe`
3. Servidor envia ao OpenAI Whisper (`whisper-1`, idioma: `pt`)
4. Texto transcrito preenche automaticamente:
   - **Título:** primeira frase
   - **Descrição:** restante texto

**Componente:** `components/feedback/voice-recorder.tsx`

### 3.4 Upload de Imagens

- Máximo 5 imagens por submissão
- Compressão client-side via `browser-image-compression` (WebP, max 0.3MB, max 1920px)
- Upload individual ao R2 via `/api/feedback/upload`
- Previews com thumbnails e botão de remover

### 3.5 Frontend

**Quick Actions (topbar):**
Acções rápidas actualizadas (`components/layout/quick-actions.tsx`):
- Novo Contacto
- Nova Angariação
- Novo Fecho
- **Nova Tarefa** ← novo
- **Reportar Problema** ← novo (abre dialog ticket com voz + imagens)
- **Sugerir Ideia** ← novo (abre dialog ideia com voz + imagens)
- ~~Novo Template~~ ← removido

**Dialog de Feedback:** `components/feedback/feedback-dialog.tsx`
- Gravação de voz com transcrição automática
- Campo de título e descrição
- Upload de imagens com compressão e previews
- Configuração diferente para ticket vs ideia (ícones, textos, placeholders)

**Pipeline Tech:** `/dashboard/tech`
- Kanban com 5 colunas: Novo → Em Análise → Em Desenvolvimento → Concluído → Rejeitado
- Filtro por tipo (Todos / Tickets / Ideias) via tabs
- Cards com tipo (ícone), título, descrição preview, submitter, data, prioridade
- Sheet de detalhe para equipa técnica: alterar status, prioridade, atribuir, notas técnicas, ver imagens, eliminar

**Sidebar:** "Tech > Pipeline" adicionado (visível apenas para roles com permissão `settings` — admin/Broker)

**Componentes:**
- `components/feedback/feedback-dialog.tsx`
- `components/feedback/feedback-card.tsx`
- `components/feedback/feedback-detail-sheet.tsx`
- `components/feedback/voice-recorder.tsx`

---

## 4. Ficheiros Criados/Modificados

### Novos (34 ficheiros)

**Migrations:**
- `supabase/migrations/20260329_task_management.sql`
- `supabase/migrations/20260329_feedback_submissions.sql`
- `supabase/migrations/20260329_feedback_images.sql`

**Types & Validations:**
- `types/task.ts`, `types/feedback.ts`
- `lib/validations/task.ts`, `lib/validations/feedback.ts`

**Lib:**
- `lib/tasks/recurrence.ts`

**API Routes:**
- `app/api/tasks/route.ts`
- `app/api/tasks/[id]/route.ts`
- `app/api/tasks/[id]/comments/route.ts`
- `app/api/tasks/[id]/attachments/route.ts`
- `app/api/tasks/attachments/[attachmentId]/route.ts`
- `app/api/tasks/stats/route.ts`
- `app/api/transcribe/route.ts`
- `app/api/feedback/route.ts`
- `app/api/feedback/[id]/route.ts`
- `app/api/feedback/upload/route.ts`

**Hooks:**
- `hooks/use-tasks.ts`

**Components:**
- `components/tasks/task-filters.tsx`
- `components/tasks/task-form.tsx`
- `components/tasks/task-list-item.tsx`
- `components/tasks/task-detail-sheet.tsx`
- `components/tasks/task-dashboard-widget.tsx`
- `components/feedback/feedback-dialog.tsx`
- `components/feedback/feedback-card.tsx`
- `components/feedback/feedback-detail-sheet.tsx`
- `components/feedback/voice-recorder.tsx`

**Pages:**
- `app/dashboard/tarefas/page.tsx`
- `app/dashboard/tech/page.tsx`

### Modificados

- `components/layout/app-sidebar.tsx` — Infinity icon, Tarefas entry, Tech section
- `components/layout/quick-actions.tsx` — Nova Tarefa, Reportar Problema, Sugerir Ideia
- `lib/notifications/types.ts` — adicionados entity types `task`, `task_comment`

---

## 5. Dependências

Nenhuma nova dependência. Reutiliza:
- `openai` — transcrição Whisper
- `browser-image-compression` — compressão de imagens
- `@aws-sdk/client-s3` — upload R2
- `react-hook-form` + `zod` — formulários
- `sonner` — toasts
- `date-fns` — formatação de datas

---

## 6. Variáveis de Ambiente Necessárias

Todas já existentes:
- `OPENAI_API_KEY` — transcrição de voz
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` — upload de ficheiros e imagens
