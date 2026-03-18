# Referência Completa — Sistema de Calendário e Eventos

**Data:** 2026-03-16
**Estado:** Implementado e funcional

---

## 1. Visão Geral

O sistema de calendário agrega eventos de **duas fontes**:

| Fonte | Descrição | Tabela/Origem |
|-------|-----------|---------------|
| **Manual** | Eventos criados pelo utilizador (reuniões, aniversários, férias, lembretes) | `temp_calendar_events` |
| **Automático** | Eventos gerados a partir de dados operacionais | `dev_property_internal.contract_expiry`, `leads.expires_at` |

**Funcionalidades principais:**
- Vistas mês e semana (com slots horários 8h–20h)
- Eventos recorrentes (anual, mensal, semanal)
- Filtragem por 10 categorias e por pessoa
- Presets de filtros por role (Broker vê tudo, Consultor vê menos)
- Detalhe de evento com links para imóvel/lead associados
- Alerta visual de eventos em atraso (overdue)

---

## 2. Tabela de Base de Dados

### `temp_calendar_events`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID, PK | Identificador |
| `title` | text | Título do evento |
| `description` | text, nullable | Descrição |
| `category` | text | Categoria (birthday, vacation, company_event, marketing_event, meeting, reminder, custom) |
| `start_date` | timestamptz | Data/hora início |
| `end_date` | timestamptz, nullable | Data/hora fim |
| `all_day` | boolean | Evento de dia inteiro |
| `is_recurring` | boolean | Evento recorrente |
| `recurrence_rule` | text, nullable | Regra: yearly, monthly, weekly |
| `user_id` | UUID, FK → dev_users, nullable | Pessoa associada ao evento |
| `property_id` | UUID, FK → dev_properties, nullable | Imóvel associado |
| `lead_id` | UUID, FK → leads, nullable | Lead associado |
| `visibility` | text | Visibilidade: all, team, private |
| `color` | text, nullable | Cor custom |
| `created_by` | UUID, FK → dev_users | Criador do evento |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Data de última alteração |

### Fontes automáticas (não são tabelas separadas)

| Fonte | Tabela | Coluna | Categoria gerada |
|-------|--------|--------|------------------|
| Expiração de contratos | `dev_property_internal` | `contract_expiry` | `contract_expiry` |
| Expiração de leads | `leads` | `expires_at` | `lead_expiry` |

---

## 3. API Routes

### `GET /api/calendar/events`

**Ficheiro:** `app/api/calendar/events/route.ts`

**Query params:**
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `start` | ISO date string | Sim | Início do intervalo |
| `end` | ISO date string | Sim | Fim do intervalo |
| `categories` | string (comma-separated) | Não | Filtrar por categorias |
| `user_id` | UUID | Não | Filtrar por pessoa |

**Resposta:** `{ data: CalendarEvent[], total: number }`

**Lógica:**
1. Busca eventos manuais de `temp_calendar_events` no intervalo
2. Busca contratos a expirar de `dev_property_internal`
3. Busca leads a expirar de `leads`
4. Calcula ocorrências de eventos recorrentes (yearly/monthly/weekly)
5. Marca eventos como `is_overdue` se data < agora
6. Ordena por `start_date`

---

### `POST /api/calendar/events`

**Ficheiro:** `app/api/calendar/events/route.ts`

**Body:** Validado com `calendarEventSchema` (ver secção 6)

**Resposta:** `{ data: CalendarEvent }` (status 201)

---

### `GET /api/calendar/events/[id]`

**Ficheiro:** `app/api/calendar/events/[id]/route.ts`

Retorna evento manual com relações (creator, linked_user).

---

### `PUT /api/calendar/events/[id]`

**Ficheiro:** `app/api/calendar/events/[id]/route.ts`

Actualiza evento manual. Validado com `calendarEventSchema`.

---

### `DELETE /api/calendar/events/[id]`

**Ficheiro:** `app/api/calendar/events/[id]/route.ts`

Elimina evento manual (verifica existência primeiro).

---

## 4. Types

**Ficheiro:** `types/calendar.ts`

```typescript
// 10 categorias (3 auto + 7 manuais)
type CalendarCategory =
  | 'contract_expiry' | 'lead_expiry' | 'lead_followup'     // Auto
  | 'birthday' | 'vacation' | 'company_event'               // Manual
  | 'marketing_event' | 'meeting' | 'reminder' | 'custom'   // Manual

// Evento unificado (manual + auto)
interface CalendarEvent {
  id: string
  title: string
  description?: string
  category: CalendarCategory
  start_date: string
  end_date?: string
  all_day: boolean
  color?: string
  source: 'auto' | 'manual'
  is_recurring: boolean
  is_overdue: boolean
  status?: string
  user_id?: string
  user_name?: string
  property_id?: string
  property_title?: string
  lead_id?: string
  lead_name?: string
}

// Filtros
interface CalendarFilters {
  categories: CalendarCategory[]
  userId?: string
  teamOnly?: boolean
  propertyId?: string
}

// Input de criação
interface CreateCalendarEventInput { /* campos do form */ }
```

**Constantes exportadas:**
- `ALL_CATEGORIES` — todas as 10 categorias
- `MANUAL_CATEGORIES` — 7 categorias manuais
- `CALENDAR_CATEGORY_LABELS` — labels PT-PT
- `CALENDAR_CATEGORY_COLORS` — cores Tailwind (bg, text, dot)
- `CALENDAR_ROLE_PRESETS` — filtros default por role

---

## 5. Validações Zod

**Ficheiro:** `lib/validations/calendar.ts`

```typescript
calendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(['birthday','vacation','company_event','marketing_event','meeting','reminder','custom']),
  start_date: z.string().min(1),
  end_date: z.string().optional().nullable(),
  all_day: z.boolean().default(false),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.enum(['yearly','monthly','weekly']).optional().nullable(),
  user_id: UUID regex (optional),
  property_id: UUID regex (optional),
  lead_id: UUID regex (optional),
  visibility: z.enum(['all','team','private']).default('all'),
  color: z.string().max(30).optional().nullable(),
})
```

---

## 6. Hooks

### `useCalendarEvents`

**Ficheiro:** `hooks/use-calendar-events.ts`

| Param | Tipo | Descrição |
|-------|------|-----------|
| `start` | Date | Início do intervalo |
| `end` | Date | Fim do intervalo |
| `categories?` | CalendarCategory[] | Filtro de categorias |
| `userId?` | string | Filtro por pessoa |

| Retorno | Tipo | Descrição |
|---------|------|-----------|
| `events` | CalendarEvent[] | Lista de eventos |
| `isLoading` | boolean | Estado de carregamento |
| `error` | string \| null | Mensagem de erro |
| `refetch()` | function | Recarregar eventos |
| `createEvent(data)` | Promise<boolean> | Criar evento |
| `updateEvent(id, data)` | Promise<boolean> | Actualizar evento |
| `deleteEvent(id)` | Promise<boolean> | Eliminar evento |

---

### `useCalendarFilters`

**Ficheiro:** `hooks/use-calendar-filters.ts`

| Retorno | Tipo | Descrição |
|---------|------|-----------|
| `categories` | CalendarCategory[] | Categorias activas |
| `userId` | string \| undefined | Pessoa seleccionada |
| `filterSelf` | boolean | "Apenas os meus" |
| `toggleCategory(cat)` | function | Alternar categoria |
| `setCategories(cats)` | function | Definir categorias |
| `setUserId(id)` | function | Definir pessoa |
| `toggleFilterSelf()` | function | Alternar filtro pessoal |
| `resetToDefaults()` | function | Repor defaults do role |

---

## 7. Componentes

**Directório:** `components/calendar/`

| Ficheiro | Descrição |
|----------|-----------|
| `calendar-view.tsx` | Container principal — alterna entre vista mês/semana + skeleton loading |
| `calendar-month-grid.tsx` | Grelha mensal (7 colunas), mostra até 3 eventos/dia com "+N mais" |
| `calendar-week-view.tsx` | Vista semanal com slots horários (8h–20h) e secção all-day |
| `calendar-event-card.tsx` | Card compacto de evento com cor da categoria, hora e título |
| `calendar-event-detail.tsx` | Sheet lateral com detalhes completos, links, acções editar/eliminar |
| `calendar-event-form.tsx` | Dialog de criação/edição com React Hook Form + Zod |
| `calendar-toolbar.tsx` | Barra superior — navegação de datas, toggle mês/semana, botão "Novo Evento" |
| `calendar-filters.tsx` | Sidebar esquerda — toggles de categorias, filtro por pessoa |
| `calendar-sidebar.tsx` | Sidebar direita — mini calendário + próximos eventos (max 7) |

---

## 8. Páginas

### `/dashboard/calendario`

**Ficheiro:** `app/dashboard/calendario/page.tsx`

Página principal do calendário. Orquestra todos os componentes:
- Toolbar (navegação + toggle vista)
- Filters sidebar (categorias + pessoa)
- Calendar view (mês ou semana)
- Right sidebar (mini calendário + próximos)
- Event detail sheet (ao clicar num evento)
- Event form dialog (criar/editar)

**Layout:** `app/dashboard/calendario/layout.tsx` — `PermissionGuard` para módulo `calendar`

---

### `/dashboard/recrutamento/calendario`

**Ficheiro:** `app/dashboard/recrutamento/calendario/page.tsx`

Calendário separado para recrutamento (entrevistas + follow-ups). **Não partilha** componentes com o calendário principal.

---

## 9. Constantes

**Ficheiro:** `lib/constants.ts`

| Constante | Descrição |
|-----------|-----------|
| `CALENDAR_CATEGORY_OPTIONS` | Options para Select (7 categorias manuais com labels PT-PT) |
| `CALENDAR_RECURRENCE_OPTIONS` | Options de recorrência (Anual, Mensal, Semanal) |
| `CALENDAR_VISIBILITY_OPTIONS` | Options de visibilidade (Todos, Equipa, Privado) |

Módulo `calendar` incluído em `PERMISSION_MODULES` (grupo "Sistema").

---

## 10. Navegação

- **Sidebar:** Secção "O Meu Espaço" → ícone `CalendarDays` → `/dashboard/calendario`
- **Permissão:** Módulo `calendar` na tabela `roles.permissions`

---

## 11. Correlações com Outros Módulos

| Módulo | Relação | Descrição |
|--------|---------|-----------|
| **Imóveis** | `property_id` FK | Eventos podem estar associados a um imóvel; contratos a expirar geram eventos automáticos |
| **Leads** | `lead_id` FK | Eventos podem estar associados a um lead; leads a expirar geram eventos automáticos |
| **Consultores** | `user_id` FK | Eventos podem ser atribuídos a um consultor; filtro "Apenas os meus" |
| **Permissões** | `calendar` module | Acesso ao calendário controlado por role |
| **Recrutamento** | Separado | Calendário próprio em `/dashboard/recrutamento/calendario` |

---

## 12. Inventário de Ficheiros

```
app/
├── api/calendar/
│   └── events/
│       ├── route.ts              ← GET (listar) + POST (criar)
│       └── [id]/route.ts         ← GET + PUT + DELETE
├── dashboard/calendario/
│   ├── page.tsx                  ← Página principal
│   └── layout.tsx                ← PermissionGuard

components/calendar/
├── calendar-view.tsx             ← Container mês/semana
├── calendar-month-grid.tsx       ← Grelha mensal
├── calendar-week-view.tsx        ← Vista semanal com horários
├── calendar-event-card.tsx       ← Card compacto
├── calendar-event-detail.tsx     ← Sheet de detalhes
├── calendar-event-form.tsx       ← Dialog de criação/edição
├── calendar-toolbar.tsx          ← Barra de navegação
├── calendar-filters.tsx          ← Sidebar de filtros
└── calendar-sidebar.tsx          ← Mini calendário + próximos

hooks/
├── use-calendar-events.ts       ← CRUD + fetch de eventos
└── use-calendar-filters.ts      ← Estado de filtros com presets por role

types/
└── calendar.ts                  ← Types, categorias, cores, presets

lib/
├── validations/calendar.ts      ← Schema Zod
└── constants.ts                 ← Options PT-PT (categorias, recorrência, visibilidade)
```

**Total: 16 ficheiros dedicados ao calendário**
