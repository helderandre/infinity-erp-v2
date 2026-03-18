# SPEC-M15-CALENDARIO — Calendário Centralizado

**Versão:** 1.0
**Data:** 2026-03-15
**Estado:** Rascunho — aguardar aprovação antes de implementar

---

## 1. Objectivo

Criar um módulo de calendário centralizado que agregue **todos os eventos relevantes** do ERP num único local:

- **Eventos de processo** — datas de CPCV, escrituras, prazos de tarefas/subtarefas
- **Eventos de marketing** — campanhas agendadas, publicações, eventos
- **Eventos de empresa** — aniversários de colegas, férias, feriados, eventos internos
- **Eventos manuais** — criados livremente por qualquer utilizador

Cada função/role vê os eventos pertinentes ao seu trabalho por defeito, com filtros para expandir ou restringir a vista. **Sem RLS** — a filtragem é feita no frontend.

---

## 2. Fontes de Eventos

O calendário agrega dados de **duas origens**:

### 2.1 Eventos Automáticos (derivados de tabelas existentes)

| Fonte | Tabela | Campo(s) de data | Tipo de evento gerado |
|-------|--------|-------------------|-----------------------|
| Tarefas de processo | `proc_tasks` | `due_date` | `process_task` |
| Subtarefas de processo | `proc_subtasks` | `due_date` | `process_subtask` |
| Marcos de processo | `proc_instances` | `approved_at`, `completed_at` | `process_milestone` |
| Expiração de contrato | `dev_property_internal` | `contract_expiry` | `contract_expiry` |
| Expiração de lead | `leads` | `expires_at` | `lead_expiry` |
| Follow-up de lead | `leads` | `first_contacted_at` + SLA | `lead_followup` |

Estes eventos **não são copiados** para nenhuma tabela nova. São consultados em tempo real via query às tabelas de origem, filtrados por intervalo de datas.

### 2.2 Eventos Manuais (tabela nova)

Eventos que não existem em nenhuma tabela actual:
- Aniversários de colegas
- Férias / ausências
- Eventos de empresa (jantar de natal, team building, etc.)
- Eventos de marketing (sessão fotográfica, open house, etc.)
- Reuniões / lembretes livres

Estes são armazenados numa **tabela nova** `TEMP_calendar_events`.

---

## 3. Schema da Base de Dados

### 3.1 Tabela: `TEMP_calendar_events`

```sql
CREATE TABLE TEMP_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conteúdo
  title TEXT NOT NULL,
  description TEXT,

  -- Categorização
  category TEXT NOT NULL DEFAULT 'custom',
  -- Valores: 'birthday' | 'vacation' | 'company_event' | 'marketing_event' | 'meeting' | 'reminder' | 'custom'

  -- Datas
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,                    -- NULL = evento pontual (sem duração)
  all_day BOOLEAN NOT NULL DEFAULT false,

  -- Recorrência
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,                     -- 'yearly' | 'monthly' | 'weekly' | NULL
  -- Para aniversários: is_recurring = true, recurrence_rule = 'yearly'

  -- Relações (opcionais — ligação a entidades do ERP)
  user_id UUID REFERENCES dev_users(id),           -- colaborador associado (ex: aniversariante, pessoa de férias)
  property_id UUID REFERENCES dev_properties(id),  -- imóvel associado (ex: open house)
  lead_id UUID REFERENCES leads(id),               -- lead associado
  process_id UUID REFERENCES proc_instances(id),   -- processo associado

  -- Visibilidade
  visibility TEXT NOT NULL DEFAULT 'all',
  -- 'all' = visível para todos
  -- 'team' = visível para a equipa do criador
  -- 'private' = visível apenas para o criador e admins

  -- Cor customizada (opcional — se NULL, usa cor da categoria)
  color TEXT,

  -- Meta
  created_by UUID NOT NULL REFERENCES dev_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para queries por intervalo de datas
CREATE INDEX idx_temp_cal_events_start ON TEMP_calendar_events (start_date);
CREATE INDEX idx_temp_cal_events_end ON TEMP_calendar_events (end_date);
CREATE INDEX idx_temp_cal_events_category ON TEMP_calendar_events (category);
CREATE INDEX idx_temp_cal_events_user ON TEMP_calendar_events (user_id);
```

### 3.2 Tabela: `TEMP_calendar_event_attendees` (opcional — para eventos com convidados)

```sql
CREATE TABLE TEMP_calendar_event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES TEMP_calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'declined'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_temp_cal_attendees_user ON TEMP_calendar_event_attendees (user_id);
```

---

## 4. API Routes

### 4.1 Eventos agregados (leitura)

```
GET /api/calendar/events?start=2026-03-01&end=2026-03-31&categories=process_task,birthday&user_id=xxx
```

**Query params:**

| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `start` | ISO date | Sim | Início do intervalo |
| `end` | ISO date | Sim | Fim do intervalo |
| `categories` | string (csv) | Não | Filtro por categoria (ver lista abaixo) |
| `user_id` | UUID | Não | Filtro por utilizador atribuído / associado |
| `property_id` | UUID | Não | Filtro por imóvel |
| `process_id` | UUID | Não | Filtro por processo |

**Categorias disponíveis:**

| Categoria | Origem | Cor padrão |
|-----------|--------|------------|
| `process_task` | `proc_tasks.due_date` | `blue-500` |
| `process_subtask` | `proc_subtasks.due_date` | `blue-300` |
| `process_milestone` | `proc_instances.approved_at / completed_at` | `emerald-500` |
| `contract_expiry` | `dev_property_internal.contract_expiry` | `amber-500` |
| `lead_expiry` | `leads.expires_at` | `red-400` |
| `lead_followup` | Calculado: `first_contacted_at` + 7 dias | `yellow-500` |
| `birthday` | `TEMP_calendar_events` | `pink-500` |
| `vacation` | `TEMP_calendar_events` | `slate-400` |
| `company_event` | `TEMP_calendar_events` | `purple-500` |
| `marketing_event` | `TEMP_calendar_events` | `orange-500` |
| `meeting` | `TEMP_calendar_events` | `indigo-500` |
| `reminder` | `TEMP_calendar_events` | `cyan-500` |
| `custom` | `TEMP_calendar_events` | `gray-500` |

**Resposta:** Array unificado e ordenado por `start_date`:

```typescript
interface CalendarEvent {
  id: string                          // UUID real ou gerado (ex: "proc_task:{task_id}")
  title: string
  description?: string
  category: CalendarCategory
  start_date: string                  // ISO
  end_date?: string                   // ISO ou null
  all_day: boolean
  color: string                       // classe Tailwind (ex: "blue-500")

  // Relações (para navegação)
  user_id?: string
  user_name?: string                  // nome do consultor/colaborador
  property_id?: string
  property_title?: string
  lead_id?: string
  lead_name?: string
  process_id?: string
  process_ref?: string                // ex: "PROC-2026-0042"
  task_id?: string                    // para process_task / process_subtask
  task_title?: string

  // Meta
  source: 'auto' | 'manual'          // auto = derivado de tabela existente, manual = TEMP_calendar_events
  is_recurring: boolean
  is_overdue: boolean                 // start_date < now() && status != completed
  status?: string                     // status da tarefa/processo (para ícone/cor)
}
```

**Lógica do Route Handler:**

O handler executa **queries paralelas** a todas as fontes e unifica os resultados:

```
1. Query TEMP_calendar_events WHERE start_date BETWEEN :start AND :end
2. Query proc_tasks WHERE due_date BETWEEN :start AND :end (JOIN proc_instances, dev_properties, dev_users)
3. Query proc_subtasks WHERE due_date BETWEEN :start AND :end (JOIN proc_tasks, proc_instances)
4. Query proc_instances WHERE approved_at OR completed_at BETWEEN :start AND :end
5. Query dev_property_internal WHERE contract_expiry BETWEEN :start AND :end (JOIN dev_properties)
6. Query leads WHERE expires_at BETWEEN :start AND :end
7. Para recorrentes (aniversários): query WHERE recurrence_rule = 'yearly' e calcular ocorrência no mês
8. Unificar, ordenar por start_date, aplicar filtros de categoria
```

### 4.2 CRUD de eventos manuais

```
POST   /api/calendar/events          — Criar evento manual
PUT    /api/calendar/events/[id]     — Editar evento manual
DELETE /api/calendar/events/[id]     — Eliminar evento manual
GET    /api/calendar/events/[id]     — Detalhe de um evento manual
```

**Body do POST/PUT:**

```typescript
interface CreateCalendarEventInput {
  title: string                       // obrigatório, max 200 chars
  description?: string
  category: CalendarCategory          // obrigatório
  start_date: string                  // ISO, obrigatório
  end_date?: string                   // ISO, opcional
  all_day?: boolean                   // default false
  is_recurring?: boolean              // default false
  recurrence_rule?: 'yearly' | 'monthly' | 'weekly'
  user_id?: string                    // colaborador associado
  property_id?: string
  lead_id?: string
  process_id?: string
  visibility?: 'all' | 'team' | 'private'
  color?: string                      // override de cor
}
```

**Validação Zod:**

```typescript
// lib/validations/calendar.ts
const calendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(['birthday', 'vacation', 'company_event', 'marketing_event', 'meeting', 'reminder', 'custom']),
  start_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
  all_day: z.boolean().default(false),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.enum(['yearly', 'monthly', 'weekly']).optional(),
  user_id: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
  property_id: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
  lead_id: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
  process_id: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
  visibility: z.enum(['all', 'team', 'private']).default('all'),
  color: z.string().max(30).optional(),
})
```

---

## 5. Vistas por Role (Filtros Frontend por Defeito)

Cada role tem um **preset de categorias** activo por defeito quando abre o calendário. O utilizador pode alterar os filtros livremente a qualquer momento.

| Role | Categorias activas por defeito |
|------|-------------------------------|
| **Broker/CEO / Admin** | Todas (tudo visível) |
| **Consultor / Consultora Executiva** | `process_task`, `process_subtask`, `contract_expiry`, `birthday`, `vacation`, `company_event`, `meeting` — filtrado ao próprio `user_id` |
| **Team Leader** | Mesmo que consultor, mas inclui todos os membros da sua equipa |
| **Gestor Processual** | `process_task`, `process_subtask`, `process_milestone`, `contract_expiry`, `lead_expiry` — todos os processos |
| **Marketing** | `marketing_event`, `company_event`, `birthday`, `meeting` |
| **Office Manager** | Todas |
| **Recrutador** | `meeting`, `birthday`, `vacation`, `company_event`, `reminder` |
| **Intermediário Crédito** | `process_task`, `process_subtask`, `meeting`, `reminder` — filtrado a tarefas de crédito |

**Implementação:** Um objecto `CALENDAR_ROLE_PRESETS` em `lib/constants.ts`:

```typescript
export const CALENDAR_ROLE_PRESETS: Record<string, { categories: CalendarCategory[], filterSelf: boolean }> = {
  'Broker/CEO': { categories: ALL_CATEGORIES, filterSelf: false },
  'admin': { categories: ALL_CATEGORIES, filterSelf: false },
  'Office Manager': { categories: ALL_CATEGORIES, filterSelf: false },
  'Consultor': { categories: ['process_task', 'process_subtask', 'contract_expiry', 'birthday', 'vacation', 'company_event', 'meeting'], filterSelf: true },
  'Consultora Executiva': { categories: ['process_task', 'process_subtask', 'contract_expiry', 'birthday', 'vacation', 'company_event', 'meeting'], filterSelf: true },
  'team_leader': { categories: ['process_task', 'process_subtask', 'contract_expiry', 'birthday', 'vacation', 'company_event', 'meeting'], filterSelf: false },
  'Gestora Processual': { categories: ['process_task', 'process_subtask', 'process_milestone', 'contract_expiry', 'lead_expiry'], filterSelf: false },
  'Marketing': { categories: ['marketing_event', 'company_event', 'birthday', 'meeting'], filterSelf: false },
  'recrutador': { categories: ['meeting', 'birthday', 'vacation', 'company_event', 'reminder'], filterSelf: false },
  'intermediario_credito': { categories: ['process_task', 'process_subtask', 'meeting', 'reminder'], filterSelf: true },
}
```

- `filterSelf: true` — por defeito filtra `user_id` ao utilizador logado (consultor vê apenas os seus)
- O utilizador pode desactivar este filtro para ver eventos de outros (se tiver permissão `calendar`)

---

## 6. Páginas e Componentes

### 6.1 Estrutura de Ficheiros

```
app/dashboard/calendario/
├── layout.tsx                          ← PermissionGuard module="calendar"
└── page.tsx                            ← página principal

components/calendar/
├── calendar-view.tsx                   ← componente principal (mês/semana/dia)
├── calendar-month-grid.tsx             ← grid mensal com dias e eventos
├── calendar-week-view.tsx              ← vista semanal com horas
├── calendar-day-view.tsx               ← vista diária detalhada
├── calendar-event-card.tsx             ← mini-card de evento (dentro de célula do dia)
├── calendar-event-detail.tsx           ← sheet/dialog com detalhe do evento
├── calendar-filters.tsx                ← painel lateral de filtros (categorias, pessoas, etc.)
├── calendar-toolbar.tsx                ← barra superior (navegação mês, toggle vista, botão criar)
├── calendar-event-form.tsx             ← formulário de criação/edição de evento manual
└── calendar-sidebar.tsx                ← mini calendário + lista de próximos eventos

hooks/
├── use-calendar-events.ts              ← fetch + cache de eventos por intervalo
└── use-calendar-filters.ts             ← estado dos filtros (zustand ou useState)

lib/validations/
└── calendar.ts                         ← schema Zod

types/
└── calendar.ts                         ← CalendarEvent, CalendarCategory, CalendarFilters
```

### 6.2 Layout da Página

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOOLBAR                                                             │
│  [< Fev]  Março 2026  [Abr >]    [Hoje]    [Mês | Semana | Dia]  [+ Novo Evento] │
├────────────┬─────────────────────────────────────────────────────────┤
│  FILTROS   │  CALENDÁRIO (Mês / Semana / Dia)                       │
│            │                                                         │
│ Categorias │  Seg  Ter  Qua  Qui  Sex  Sáb  Dom                    │
│ ☑ Processos│  ┌───┬───┬───┬───┬───┬───┬───┐                        │
│ ☑ CPCV     │  │   │   │ 1 │ 2 │ 3 │ 4 │ 5 │                        │
│ ☑ Escritura│  │   │   │   │●  │   │   │   │                        │
│ ☑ Marketing│  ├───┼───┼───┼───┼───┼───┼───┤                        │
│ ☑ Aniversá.│  │ 6 │ 7 │ 8 │ 9 │10 │11 │12 │                        │
│ ☑ Férias   │  │●● │   │●  │   │●  │   │   │                        │
│ ☑ Empresa  │  ├───┼───┼───┼───┼───┼───┼───┤                        │
│ ☑ Reuniões │  │13 │14 │15 │16 │17 │18 │19 │                        │
│ ☐ Lembretes│  │   │●● │◉  │●  │   │   │   │                        │
│            │  └───┴───┴───┴───┴───┴───┴───┘                        │
│ Pessoas    │                                                         │
│ ☑ Todos    │  ● = evento (cor por categoria)                        │
│ ○ Eu       │  ◉ = hoje                                              │
│ ○ Equipa   │                                                         │
│ ○ Pessoa X │                                                         │
│            │                                                         │
│ PRÓXIMOS   │                                                         │
│ 16 Mar ●   │                                                         │
│ CPCV Apt.. │                                                         │
│ 18 Mar ●   │                                                         │
│ Escritura. │                                                         │
│ 22 Mar ●   │                                                         │
│ Aniv. João │                                                         │
└────────────┴─────────────────────────────────────────────────────────┘
```

### 6.3 Interacções

| Acção | Comportamento |
|-------|---------------|
| **Clicar num dia** (vista mês) | Abre vista de dia OU popover com eventos desse dia |
| **Clicar num evento** | Abre Sheet lateral com detalhe do evento |
| **Clicar link no detalhe** | Navega para a entidade (processo, imóvel, lead) |
| **"+ Novo Evento"** | Abre Dialog com formulário de criação |
| **Arrastar evento** (stretch goal) | Altera `start_date` — só para eventos manuais |
| **Hover num evento** | HoverCard com título, hora, categoria, pessoa |
| **Toggle categorias** | Filtra/mostra eventos em tempo real (sem re-fetch se já em cache) |
| **Toggle pessoas** | Filtra por `user_id` (ou limpa filtro para ver todos) |

### 6.4 Componente: `calendar-event-card.tsx`

Mini-card renderizado dentro de cada célula do calendário:

```tsx
// Estrutura visual
<div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate cursor-pointer", colorClasses)}>
  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
  <span className="truncate">{event.title}</span>
  {event.is_overdue && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
</div>
```

- Cor de fundo e texto derivados da categoria (ver tabela de cores na secção 4.1)
- Eventos em atraso (`is_overdue`) mostram ícone de alerta
- Máximo **3 eventos visíveis** por célula na vista mensal; se houver mais, mostrar "+N mais"

### 6.5 Componente: `calendar-event-detail.tsx`

Sheet lateral que abre ao clicar num evento:

```
┌─────────────────────────────────┐
│ ● CPCV — Apartamento T3 Expo   │   ← título com dot de cor
│                                 │
│ 📅 16 Março 2026, 14:00 - 16:00│
│ 📋 Processo: PROC-2026-0042    │   ← link clicável → /dashboard/processos/[id]
│ 🏠 Imóvel: T3 Parque Nações    │   ← link clicável → /dashboard/imoveis/[id]
│ 👤 Consultor: João Silva       │
│ 📊 Estado: Em Progresso        │   ← badge com cor
│                                 │
│ Descrição:                      │
│ Assinatura do CPCV com o        │
│ comprador no escritório.        │
│                                 │
│ [Abrir Processo]  [Editar]      │   ← "Editar" só para eventos manuais
└─────────────────────────────────┘
```

- Eventos automáticos (`source: 'auto'`): só leitura, com links para entidades
- Eventos manuais (`source: 'manual'`): botões Editar e Eliminar

### 6.6 Componente: `calendar-event-form.tsx`

Dialog/Sheet para criar/editar evento manual:

**Campos:**

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| Título | Input text | Sim | Max 200 chars |
| Categoria | Select | Sim | Lista de categorias manuais |
| Data início | DatePicker + TimePicker | Sim | |
| Data fim | DatePicker + TimePicker | Não | Desactivado se `all_day` |
| Dia inteiro | Checkbox | Não | Se activo, esconde horas |
| Recorrência | Select | Não | Anual / Mensal / Semanal / Sem recorrência |
| Descrição | Textarea | Não | Max 2000 chars |
| Colaborador | Select (lista dev_users) | Não | Para aniversários, férias |
| Imóvel | Select/Search | Não | Para open houses, etc. |
| Visibilidade | RadioGroup | Não | Todos / Equipa / Privado |
| Cor | Color picker simples | Não | Override da cor da categoria |

**Comportamento da categoria:**
- Se `birthday` → pré-preenche `all_day: true`, `is_recurring: true`, `recurrence_rule: 'yearly'`
- Se `vacation` → pré-preenche `all_day: true`, mostra campo `end_date` obrigatório
- Se `meeting` → mostra campos de hora por defeito

---

## 7. Hook: `use-calendar-events.ts`

```typescript
interface UseCalendarEventsParams {
  start: Date
  end: Date
  categories?: CalendarCategory[]
  userId?: string
  propertyId?: string
  processId?: string
}

interface UseCalendarEventsReturn {
  events: CalendarEvent[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}
```

- Faz fetch a `GET /api/calendar/events` com os params
- Refaz fetch quando `start`/`end` mudam (navegação entre meses)
- Debounce nos filtros para evitar re-fetches excessivos
- Cache simples: se o intervalo já foi carregado e os filtros não mudaram, não refaz fetch

---

## 8. Sidebar: Navegação

Adicionar ao sidebar principal, entre **Documentos** e **Consultores**:

```typescript
{
  title: 'Calendário',
  icon: CalendarDays,       // lucide-react
  href: '/dashboard/calendario',
  permission: 'calendar',   // já existe no sistema de permissões
}
```

---

## 9. Tipos TypeScript

```typescript
// types/calendar.ts

export type CalendarCategory =
  // Automáticas
  | 'process_task'
  | 'process_subtask'
  | 'process_milestone'
  | 'contract_expiry'
  | 'lead_expiry'
  | 'lead_followup'
  // Manuais
  | 'birthday'
  | 'vacation'
  | 'company_event'
  | 'marketing_event'
  | 'meeting'
  | 'reminder'
  | 'custom'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  category: CalendarCategory
  start_date: string
  end_date?: string
  all_day: boolean
  color: string
  source: 'auto' | 'manual'
  is_recurring: boolean
  is_overdue: boolean
  status?: string

  // Relações
  user_id?: string
  user_name?: string
  property_id?: string
  property_title?: string
  lead_id?: string
  lead_name?: string
  process_id?: string
  process_ref?: string
  task_id?: string
  task_title?: string
}

export interface CalendarFilters {
  categories: CalendarCategory[]
  userId?: string           // filtrar por pessoa
  teamOnly?: boolean        // filtrar pela equipa do user logado
  propertyId?: string
  processId?: string
}

export const CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string> = {
  process_task: 'Tarefas de Processo',
  process_subtask: 'Subtarefas',
  process_milestone: 'Marcos de Processo',
  contract_expiry: 'Expiração Contrato',
  lead_expiry: 'Expiração Lead',
  lead_followup: 'Follow-up Lead',
  birthday: 'Aniversários',
  vacation: 'Férias / Ausências',
  company_event: 'Eventos Empresa',
  marketing_event: 'Marketing',
  meeting: 'Reuniões',
  reminder: 'Lembretes',
  custom: 'Outros',
}

export const CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, { bg: string; text: string; dot: string }> = {
  process_task:      { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  process_subtask:   { bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-300' },
  process_milestone: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  contract_expiry:   { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500' },
  lead_expiry:       { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-400' },
  lead_followup:     { bg: 'bg-yellow-100',  text: 'text-yellow-800',  dot: 'bg-yellow-500' },
  birthday:          { bg: 'bg-pink-100',    text: 'text-pink-800',    dot: 'bg-pink-500' },
  vacation:          { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  company_event:     { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-500' },
  marketing_event:   { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-500' },
  meeting:           { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-500' },
  reminder:          { bg: 'bg-cyan-100',    text: 'text-cyan-800',    dot: 'bg-cyan-500' },
  custom:            { bg: 'bg-gray-100',    text: 'text-gray-700',    dot: 'bg-gray-500' },
}
```

---

## 10. Constantes PT-PT

Adicionar a `lib/constants.ts`:

```typescript
export const CALENDAR_CATEGORY_OPTIONS = [
  { value: 'birthday',        label: 'Aniversário' },
  { value: 'vacation',        label: 'Férias / Ausência' },
  { value: 'company_event',   label: 'Evento de Empresa' },
  { value: 'marketing_event', label: 'Evento de Marketing' },
  { value: 'meeting',         label: 'Reunião' },
  { value: 'reminder',        label: 'Lembrete' },
  { value: 'custom',          label: 'Outro' },
] as const

export const CALENDAR_RECURRENCE_OPTIONS = [
  { value: 'yearly',  label: 'Anual' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'weekly',  label: 'Semanal' },
] as const

export const CALENDAR_VISIBILITY_OPTIONS = [
  { value: 'all',     label: 'Visível para todos' },
  { value: 'team',    label: 'Apenas a minha equipa' },
  { value: 'private', label: 'Apenas eu' },
] as const
```

---

## 11. Lógica do Route Handler — Detalhe de Agregação

### `GET /api/calendar/events`

```typescript
// Pseudo-código do handler

async function GET(request: Request) {
  const { start, end, categories, user_id } = parseParams(request)

  // Executar todas as queries em paralelo
  const results = await Promise.all([
    // 1. Eventos manuais
    fetchManualEvents(supabase, start, end, categories, user_id),

    // 2. Tarefas de processo (se categoria activa)
    categories.includes('process_task')
      ? fetchProcessTasks(supabase, start, end, user_id)
      : [],

    // 3. Subtarefas de processo
    categories.includes('process_subtask')
      ? fetchProcessSubtasks(supabase, start, end, user_id)
      : [],

    // 4. Marcos de processo
    categories.includes('process_milestone')
      ? fetchProcessMilestones(supabase, start, end)
      : [],

    // 5. Expiração de contrato
    categories.includes('contract_expiry')
      ? fetchContractExpiries(supabase, start, end)
      : [],

    // 6. Expiração de leads
    categories.includes('lead_expiry')
      ? fetchLeadExpiries(supabase, start, end, user_id)
      : [],

    // 7. Follow-up de leads (calculado)
    categories.includes('lead_followup')
      ? fetchLeadFollowups(supabase, start, end, user_id)
      : [],
  ])

  // Unificar e ordenar
  const events = results
    .flat()
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

  return NextResponse.json(events)
}
```

### Exemplo: `fetchProcessTasks`

```typescript
async function fetchProcessTasks(supabase, start: string, end: string, userId?: string) {
  let query = supabase
    .from('proc_tasks')
    .select(`
      id, title, status, due_date, completed_at,
      assigned_to,
      dev_users!proc_tasks_assigned_to_fkey(commercial_name),
      proc_instances!inner(
        id, external_ref, current_status,
        dev_properties(id, title)
      )
    `)
    .gte('due_date', start)
    .lte('due_date', end)
    .not('due_date', 'is', null)

  if (userId) {
    query = query.eq('assigned_to', userId)
  }

  const { data } = await query

  return (data || []).map(task => ({
    id: `proc_task:${task.id}`,
    title: task.title,
    category: 'process_task' as const,
    start_date: task.due_date,
    all_day: true,
    color: 'blue-500',
    source: 'auto' as const,
    is_recurring: false,
    is_overdue: task.status !== 'completed' && new Date(task.due_date) < new Date(),
    status: task.status,
    user_id: task.assigned_to,
    user_name: task.dev_users?.commercial_name,
    process_id: task.proc_instances?.id,
    process_ref: task.proc_instances?.external_ref,
    property_id: task.proc_instances?.dev_properties?.id,
    property_title: task.proc_instances?.dev_properties?.title,
    task_id: task.id,
    task_title: task.title,
  }))
}
```

### Recorrência de Aniversários

Para aniversários (`recurrence_rule = 'yearly'`):

```typescript
async function fetchRecurringEvents(supabase, start: string, end: string) {
  // Buscar todos os eventos recorrentes anuais
  const { data } = await supabase
    .from('TEMP_calendar_events')
    .select('*, dev_users(commercial_name)')
    .eq('is_recurring', true)
    .eq('recurrence_rule', 'yearly')

  const startDate = new Date(start)
  const endDate = new Date(end)

  return (data || []).flatMap(event => {
    // Calcular a ocorrência no ano do intervalo pedido
    const eventDate = new Date(event.start_date)
    const thisYearOccurrence = new Date(
      startDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate()
    )

    // Verificar se cai dentro do intervalo
    if (thisYearOccurrence >= startDate && thisYearOccurrence <= endDate) {
      return [{
        ...mapToCalendarEvent(event),
        start_date: thisYearOccurrence.toISOString(),
      }]
    }
    return []
  })
}
```

---

## 12. Dependências

Nenhuma dependência nova necessária. Tudo já instalado:
- `date-fns` — manipulação de datas, locale PT
- `react-day-picker` — widget de calendário (já usado no DatePicker)
- `react-hook-form` + `zod` — formulários
- `lucide-react` — ícones (`CalendarDays`, `Clock`, `MapPin`, `AlertCircle`, etc.)
- Componentes shadcn: `Calendar`, `DatePicker`, `Dialog`, `Sheet`, `Popover`, `HoverCard`, `Select`, `Checkbox`, `RadioGroup`, `Badge`, `Tabs`

---

## 13. Checklist de Implementação

### Fase A — Base de Dados
- [ ] Criar tabela `TEMP_calendar_events` (migration SQL)
- [ ] Criar tabela `TEMP_calendar_event_attendees` (migration SQL)
- [ ] Inserir dados de teste (aniversários dos consultores existentes)

### Fase B — Types, Validações, Constantes
- [ ] `types/calendar.ts` — CalendarEvent, CalendarCategory, CalendarFilters
- [ ] `lib/validations/calendar.ts` — schema Zod
- [ ] `lib/constants.ts` — CALENDAR_CATEGORY_OPTIONS, cores, labels, role presets

### Fase C — API Routes
- [ ] `GET /api/calendar/events` — agregação de todas as fontes
- [ ] `POST /api/calendar/events` — criar evento manual
- [ ] `PUT /api/calendar/events/[id]` — editar evento manual
- [ ] `DELETE /api/calendar/events/[id]` — eliminar evento manual

### Fase D — Hooks
- [ ] `hooks/use-calendar-events.ts` — fetch + filtros + cache
- [ ] `hooks/use-calendar-filters.ts` — estado local dos filtros

### Fase E — Componentes de Calendário
- [ ] `calendar-toolbar.tsx` — navegação temporal + toggle de vista + botão criar
- [ ] `calendar-filters.tsx` — painel lateral com checkboxes de categorias + filtro de pessoas
- [ ] `calendar-month-grid.tsx` — grid mensal
- [ ] `calendar-event-card.tsx` — mini-card dentro das células
- [ ] `calendar-event-detail.tsx` — Sheet com detalhe + links
- [ ] `calendar-event-form.tsx` — Dialog de criação/edição
- [ ] `calendar-sidebar.tsx` — mini-calendário + próximos eventos
- [ ] `calendar-view.tsx` — componente principal que orquestra tudo

### Fase F — Página + Navegação
- [ ] `app/dashboard/calendario/layout.tsx` — PermissionGuard
- [ ] `app/dashboard/calendario/page.tsx` — página principal
- [ ] Adicionar item ao sidebar (`components/layout/app-sidebar.tsx`)

### Fase G — Vistas Adicionais (stretch)
- [ ] `calendar-week-view.tsx` — vista semanal com slots de hora
- [ ] `calendar-day-view.tsx` — vista diária detalhada
- [ ] Drag-to-reschedule eventos manuais

---

## 14. Fora de Âmbito (v1)

- Sincronização com Google Calendar / Outlook
- Notificações push / email de lembretes
- Exportação .ics
- Vista de agenda (lista cronológica sem grid)
- Reserva de salas / recursos
