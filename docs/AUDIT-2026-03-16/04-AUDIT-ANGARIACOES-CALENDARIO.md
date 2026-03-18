# AUDIT — Angariações e Calendário

**Data da auditoria:** 2026-03-16
**Âmbito:** Sub-módulos que suportam o fluxo de processos

---

## 1. SISTEMA DE ANGARIAÇÕES (M09)

### 1.1. Estado: ✅ IMPLEMENTADO (módulo separado, ligado a M06)

O módulo de angariações é o **ponto de entrada** para processos. Uma angariação multi-step cria um `proc_instances` com status `draft` e avança até `pending_approval`.

### 1.2. Fluxo

```
Angariação Multi-Step (5 passos)
  Step 1: Dados básicos do imóvel
  Step 2: Localização (Mapbox)
  Step 3: Proprietários (KYC singular/colectiva)
  Step 4: Contrato (regime, comissão, termos)
  Step 5: Documentos (uploads ou diferidos)
    │
    ▼ [finalize]
  proc_instances.current_status = 'pending_approval'
    │
    ▼ [approve com template]
  proc_instances.current_status = 'active'
  → populate_process_tasks() via RPC
```

### 1.3. API Routes (7 route.ts files)

| Método | Rota | Funcionalidade |
|--------|------|---------------|
| POST | `/api/acquisitions` | Criar angariação (draft) |
| GET | `/api/acquisitions/drafts` | Listar rascunhos |
| GET | `/api/acquisitions/draft` | Obter rascunho actual |
| GET/PUT/DELETE | `/api/acquisitions/[id]` | CRUD de angariação |
| POST | `/api/acquisitions/[id]/finalize` | Validar e transitar draft → pending_approval |
| POST | `/api/acquisitions/[id]/step/[stepNumber]` | Persistência por step (1-5) |
| POST | `/api/acquisitions/fill-from-voice` | Preenchimento por voz (IA) |

### 1.4. Validação (lib/validations/acquisition.ts)

Schema Zod com validação **por step**:

| Step | Campos Principais |
|------|------------------|
| 1 | title, property_type, business_type, listing_price, property_condition |
| 2 | address_street, city, postal_code, latitude, longitude (Mapbox) |
| 3 | owners[] com KYC completo (singular: birth_date, id_doc, is_pep, profession, marital_regime, funds_origin; colectiva: company_object, legal_nature, cae_code, beneficiaries[]) |
| 4 | contract_regime, commission_agreed, commission_type, contract_term |
| 5 | documents[] (uploads) |

### 1.5. Utilitários

| Ficheiro | Descrição |
|----------|-----------|
| `lib/acquisitions/documents.ts` | Gestão de documentos na angariação |
| `lib/acquisitions/owners.ts` | Gestão de proprietários na angariação |
| `lib/utils/negocio-to-acquisition.ts` | Converter negócio em angariação |

### 1.6. O Que Falta

| Feature | Prioridade | Notas |
|---------|:---:|-------|
| UI de wizard multi-step | ⚠️ Verificar | Existe `AcquisitionDialog` referenciado na listagem de processos |
| Integração com negócios (converter negócio → angariação) | Média | Utilitário existe, UI por confirmar |

---

## 2. SISTEMA DE CALENDÁRIO

### 2.1. Estado: ✅ IMPLEMENTADO

Sistema de calendário com vistas mensal e semanal, eventos CRUD, categorias e filtros.

### 2.2. Base de Dados

**Nota:** A tabela usa prefixo `temp_` — `temp_calendar_events` (18 colunas).

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid | PK |
| title | text | |
| description | text | |
| category | text | Categoria do evento |
| start_date | timestamptz | |
| end_date | timestamptz | |
| all_day | boolean | |
| is_recurring | boolean | |
| recurrence_rule | text | Regra de recorrência |
| user_id | uuid | FK → dev_users (proprietário do evento) |
| property_id | uuid | FK → dev_properties |
| lead_id | uuid | FK → leads |
| process_id | uuid | FK → proc_instances |
| visibility | text | all/team/private |
| color | text | |
| created_by | uuid | FK → dev_users |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Tabela auxiliar:** `temp_calendar_event_attendees` (participantes do evento).

### 2.3. API Routes

| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET | `/api/calendar/events` | Listar eventos (filtro por intervalo + categorias) |
| POST | `/api/calendar/events` | Criar evento |
| GET | `/api/calendar/events/[id]` | Detalhe do evento |
| PUT | `/api/calendar/events/[id]` | Actualizar evento |
| DELETE | `/api/calendar/events/[id]` | Eliminar evento |

### 2.4. Componentes Frontend (9 ficheiros)

| Componente | Ficheiro | Descrição |
|-----------|----------|-----------|
| CalendarView | `calendar-view.tsx` | Container principal (month/week switch) |
| CalendarMonthGrid | `calendar-month-grid.tsx` | Grelha mensal 7x5 |
| CalendarWeekView | `calendar-week-view.tsx` | Vista semanal com slots horários (06:00-22:00) |
| CalendarToolbar | `calendar-toolbar.tsx` | Navegação (prev/next, today) |
| CalendarSidebar | `calendar-sidebar.tsx` | Lista lateral de eventos |
| CalendarEventForm | `calendar-event-form.tsx` | Formulário criar/editar evento |
| CalendarEventCard | `calendar-event-card.tsx` | Card compacto de evento |
| CalendarEventDetail | `calendar-event-detail.tsx` | Sheet de detalhe do evento |
| CalendarFilters | `calendar-filters.tsx` | Filtros por categoria |

### 2.5. Hooks

| Hook | Ficheiro | Descrição |
|------|----------|-----------|
| useCalendarEvents | `hooks/use-calendar-events.ts` | CRUD com AbortController para race conditions |
| useCalendarFilters | `hooks/use-calendar-filters.ts` | Estado de filtros com presets por role |

### 2.6. Types e Validação

**types/calendar.ts** (131 linhas):
- `CalendarEvent` — tipo principal
- `CalendarCategory` — categorias com labels e cores (dark mode safe)
- `CalendarFilters` — estado de filtros
- `CreateCalendarEventInput` — input de criação
- Presets de categorias por role

**lib/validations/calendar.ts** (22 linhas):
- `calendarEventSchema` — validação Zod com UUID regex

### 2.7. Categorias de Eventos

| Categoria | Descrição |
|-----------|-----------|
| reuniao | Reuniões |
| visita | Visitas a imóveis |
| tarefa | Tarefas |
| prazo | Prazos legais |
| formacao | Formação |
| pessoal | Eventos pessoais |
| outro | Outros |

### 2.8. O Que Falta

| Feature | Prioridade | Notas |
|---------|:---:|-------|
| Página dedicada `/dashboard/calendario` | Alta | Componentes existem mas **não há página route** |
| Criação automática de eventos a partir de SLA de tarefas | Média | process_id existe na tabela |
| Notificações/lembretes de eventos | Média | |
| Arrastar eventos no calendário (DnD) | Baixa | |
| Sincronização com Google Calendar | Baixa | |
| Remover prefixo `temp_` das tabelas | Baixa | Quando estabilizar |

---

## 3. MOTOR DE PROCESSO (lib/process-engine.ts)

### 3.1. Estado: ✅ IMPLEMENTADO

| Função | Descrição | Estado |
|--------|-----------|:---:|
| autoCompleteTasks() | Auto-completar tarefas UPLOAD quando docs existem | ✅ |
| recalculateProgress() | Recalcular percent_complete baseado em subtasks | ✅ |
| Avanço de current_stage_id | Move para próxima fase quando todas as tarefas da actual estão concluídas | ✅ |

### 3.2. Motor de Templates (lib/template-engine.ts)

| Função | Descrição | Estado |
|--------|-----------|:---:|
| Mapeamento IDs locais → DB | Resolução na criação/edição | ✅ |
| Resolução de dependências | task→task, subtask→subtask/task | ✅ |
| Inserção nested | stages → tasks → subtasks em sequência | ✅ |
| Migration legacy action_type | Backward compatible | ✅ |

---

## 4. NODE PROCESSORS (lib/node-processors/)

### 4.1. Estado: ✅ IMPLEMENTADO (sistema de automação)

Processadores modulares para fluxos automatizados:

| Processador | Ficheiro | Descrição |
|------------|----------|-----------|
| condition | `condition.ts` | Avaliação de condições |
| delay | `delay.ts` | Atraso temporizado |
| email | `email.ts` | Envio de email |
| http-request | `http-request.ts` | Chamada HTTP externa |
| notification | `notification.ts` | Notificação in-app |
| set-variable | `set-variable.ts` | Definir variável |
| supabase-query | `supabase-query.ts` | Query à base de dados |
| task-lookup | `task-lookup.ts` | Consultar estado de tarefa |
| webhook-response | `webhook-response.ts` | Resposta a webhook |
| whatsapp | `whatsapp.ts` | Envio WhatsApp |

Estes processadores fazem parte do módulo M10 (Automações) mas interagem directamente com processos.
