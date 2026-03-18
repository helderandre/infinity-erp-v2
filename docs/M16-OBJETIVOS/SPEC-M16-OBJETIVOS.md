# SPEC-M16-OBJETIVOS — Quadro de Objetivos Multi-Temporal

## Visao Geral

Sistema de definicao e acompanhamento de objetivos para consultores imobiliarios, com desdobramento automatico de metas anuais em mensais, semanais e diarias. Separa objetivos por origem de negocio (vendedores vs compradores) e calcula KPIs de funil automaticamente.

**Principio base:** O utilizador define o objetivo anual e parametros de funil. O sistema desdobra tudo o resto.

---

## 1. Modelo de Dados

### 1.1 TEMP_consultant_goals (Configuracao Base + Objetivos Financeiros)

Uma linha por consultor por ano. Contem as 5 variaveis base e os parametros de funil.

```sql
TEMP_consultant_goals
├── id (UUID, PK)
├── consultant_id (UUID, FK → dev_users.id, NOT NULL)
├── year (int, NOT NULL) -- ex: 2026
├── -- CONFIGURACOES BASE --
├── annual_revenue_target (numeric, NOT NULL) -- Objetivo anual faturacao (€)
├── pct_sellers (numeric, NOT NULL, default 50) -- % negocio vendedores (0-100)
├── pct_buyers (numeric, NOT NULL, default 50) -- % negocio compradores (0-100)
├── working_weeks_year (int, NOT NULL, default 48) -- Semanas uteis/ano
├── working_days_week (int, NOT NULL, default 5) -- Dias uteis/semana
├── -- FUNIL VENDEDORES --
├── sellers_avg_sale_value (numeric) -- Valor medio de venda (€)
├── sellers_avg_commission_pct (numeric) -- Comissao media vendedores (%)
├── sellers_pct_listings_sold (numeric) -- % angariacoes vendidas
├── sellers_pct_visit_to_listing (numeric) -- % visita → angariacao
├── sellers_pct_lead_to_visit (numeric) -- % lead → visita
├── sellers_avg_calls_per_lead (numeric) -- Media chamadas por lead
├── -- FUNIL COMPRADORES --
├── buyers_avg_purchase_value (numeric) -- Valor medio de compra (€)
├── buyers_avg_commission_pct (numeric) -- Comissao media compradores (%)
├── buyers_close_rate (numeric) -- Taxa de fecho (ex: 16.67 = 1 em 6)
├── buyers_pct_lead_to_qualified (numeric) -- % lead → comprador qualificado
├── buyers_avg_calls_per_lead (numeric) -- Media chamadas por lead comprador
├── -- META --
├── is_active (boolean, default true)
├── created_at (timestamptz, default now())
├── updated_at (timestamptz, default now())
├── UNIQUE(consultant_id, year)
```

### 1.2 TEMP_goal_snapshots (Registo Periodico de Realizado)

Snapshots periodicos (diario/semanal) do progresso real do consultor. Alimentado por cron ou trigger.

```sql
TEMP_goal_snapshots
├── id (UUID, PK)
├── goal_id (UUID, FK → TEMP_consultant_goals.id, NOT NULL)
├── snapshot_date (date, NOT NULL)
├── period_type (text, NOT NULL) -- 'daily' | 'weekly' | 'monthly'
├── -- METRICAS REAIS VENDEDORES --
├── sellers_revenue (numeric, default 0) -- Faturacao vendedores no periodo
├── sellers_sales_count (int, default 0) -- Vendas fechadas
├── sellers_listings_count (int, default 0) -- Angariacoes feitas
├── sellers_visits_count (int, default 0) -- Visitas pre-angariacao
├── sellers_leads_count (int, default 0) -- Leads vendedores contactados
├── sellers_calls_count (int, default 0) -- Chamadas vendedores
├── -- METRICAS REAIS COMPRADORES --
├── buyers_revenue (numeric, default 0) -- Faturacao compradores no periodo
├── buyers_closes_count (int, default 0) -- Fechos compradores
├── buyers_qualified_count (int, default 0) -- Compradores qualificados
├── buyers_leads_count (int, default 0) -- Leads compradores contactados
├── buyers_calls_count (int, default 0) -- Chamadas compradores
├── -- META --
├── created_at (timestamptz, default now())
├── UNIQUE(goal_id, snapshot_date, period_type)
```

### 1.3 TEMP_goal_activity_log (Log Granular de Acoes)

Registo individual de cada acao do consultor que conta para objetivos. Fonte de verdade para calcular snapshots.

```sql
TEMP_goal_activity_log
├── id (UUID, PK)
├── consultant_id (UUID, FK → dev_users.id, NOT NULL)
├── activity_date (date, NOT NULL, default CURRENT_DATE)
├── activity_type (text, NOT NULL)
│   -- 'call' | 'visit' | 'listing' | 'sale_close' | 'buyer_close'
│   -- 'lead_contact' | 'buyer_qualify' | 'follow_up'
├── origin (text, NOT NULL) -- 'sellers' | 'buyers'
├── revenue_amount (numeric) -- Valor associado (se aplicavel)
├── reference_id (UUID) -- ID da entidade relacionada (lead, property, negocio)
├── reference_type (text) -- 'lead' | 'property' | 'negocio'
├── notes (text)
├── created_at (timestamptz, default now())
├── created_by (UUID, FK → dev_users.id) -- Quem registou (pode ser admin)
```

---

## 2. Calculos Automaticos (Frontend — Sem Colunas Extra)

Todos os KPIs temporais sao **calculados no frontend/API** a partir dos campos da tabela `TEMP_consultant_goals`. Nao se guardam colunas derivadas.

### 2.1 Objetivos Financeiros

```
ANUAL:
  total           = annual_revenue_target
  vendedores      = annual_revenue_target * (pct_sellers / 100)
  compradores     = annual_revenue_target * (pct_buyers / 100)

MENSAL:
  total           = annual_revenue_target / 12
  vendedores      = vendedores_anual / 12
  compradores     = compradores_anual / 12

SEMANAL:
  total           = annual_revenue_target / working_weeks_year
  vendedores      = vendedores_anual / working_weeks_year
  compradores     = compradores_anual / working_weeks_year

DIARIO:
  total           = semanal / working_days_week
  vendedores      = vendedores_semanal / working_days_week
  compradores     = compradores_semanal / working_days_week
```

### 2.2 Funil de Vendedores

```
revenue_vendedores_anual = annual_revenue_target * (pct_sellers / 100)
comissao_media           = sellers_avg_sale_value * (sellers_avg_commission_pct / 100)

ANUAL:
  vendas           = revenue_vendedores_anual / comissao_media
  angariacoes      = vendas / (sellers_pct_listings_sold / 100)
  visitas          = angariacoes / (sellers_pct_visit_to_listing / 100)
  leads            = visitas / (sellers_pct_lead_to_visit / 100)
  chamadas         = leads * sellers_avg_calls_per_lead

MENSAL:  cada KPI anual / 12
SEMANAL: cada KPI anual / working_weeks_year
DIARIO:  cada KPI semanal / working_days_week
```

### 2.3 Funil de Compradores

```
revenue_compradores_anual = annual_revenue_target * (pct_buyers / 100)
comissao_media_comp       = buyers_avg_purchase_value * (buyers_avg_commission_pct / 100)

ANUAL:
  fechos           = revenue_compradores_anual / comissao_media_comp
  qualificados     = fechos / (buyers_close_rate / 100)
  leads            = qualificados / (buyers_pct_lead_to_qualified / 100)
  chamadas         = leads * buyers_avg_calls_per_lead

MENSAL:  cada KPI anual / 12
SEMANAL: cada KPI anual / working_weeks_year
DIARIO:  cada KPI semanal / working_days_week
```

---

## 3. KPI de Controlo de Realidade (Projecao)

O sistema compara realizado vs objetivo e projecta o resultado anual.

### 3.1 Formula de Projecao

```
dias_uteis_passados = contar dias uteis desde 1 Jan ate hoje
dias_uteis_total    = working_weeks_year * working_days_week

ritmo_diario_real   = total_realizado / dias_uteis_passados
projecao_anual      = ritmo_diario_real * dias_uteis_total

gap                 = annual_revenue_target - total_realizado
gap_percentual      = (total_realizado / objetivo_ate_hoje) * 100
```

### 3.2 Semaforo de Status

```
🟢 Verde:    realizado >= 100% do objetivo do periodo
🟠 Laranja:  realizado >= 75% e < 100% do objetivo do periodo
🔴 Vermelho: realizado < 75% do objetivo do periodo
```

### 3.3 Mensagem Automatica

```
"Se continuares neste ritmo, vais fechar {projecao_anual}€ este ano"
"Estas {gap}€ abaixo do objetivo — precisas de mais {X} vendas ate ao fim do mes"
```

---

## 4. API Routes

### 4.1 Configuracao de Objetivos

```
GET    /api/goals                     -- Listar objetivos (filtro: year, consultant_id)
POST   /api/goals                     -- Criar objetivo anual para consultor
GET    /api/goals/[id]                -- Detalhe com KPIs calculados
PUT    /api/goals/[id]                -- Editar parametros
DELETE /api/goals/[id]                -- Eliminar (soft: is_active = false)
```

### 4.2 Actividades (Registo de Realizado)

```
GET    /api/goals/[id]/activities     -- Listar actividades (filtro: date range, type, origin)
POST   /api/goals/[id]/activities     -- Registar actividade
DELETE /api/goals/activities/[actId]  -- Eliminar actividade
```

### 4.3 Dashboard / KPIs

```
GET    /api/goals/[id]/dashboard      -- KPIs calculados + realizado + projecao + semaforo
GET    /api/goals/[id]/progress       -- Progresso por periodo (daily/weekly/monthly)
GET    /api/goals/compare             -- Comparar consultores (admin) — query: year, period
```

### 4.4 Responses Tipo

**GET /api/goals/[id]/dashboard**

```json
{
  "goal": { /* TEMP_consultant_goals row */ },
  "financial": {
    "annual": { "total": 400000, "sellers": 200000, "buyers": 200000 },
    "monthly": { "total": 33333, "sellers": 16667, "buyers": 16667 },
    "weekly": { "total": 8333, "sellers": 4167, "buyers": 4167 },
    "daily": { "total": 1667, "sellers": 833, "buyers": 833 }
  },
  "funnel_sellers": {
    "annual": { "sales": 8, "listings": 36, "visits": 144, "leads": 720, "calls": 2160 },
    "monthly": { "sales": 0.67, "listings": 3, "visits": 12, "leads": 60, "calls": 180 },
    "weekly": { "sales": 0.17, "listings": 0.75, "visits": 3, "leads": 15, "calls": 45 },
    "daily": { "sales": 0.03, "listings": 0.15, "visits": 0.6, "leads": 3, "calls": 9 }
  },
  "funnel_buyers": {
    "annual": { "closes": 6, "qualified": 36, "leads": 180, "calls": 540 },
    "monthly": { "closes": 0.5, "qualified": 3, "leads": 15, "calls": 45 },
    "weekly": { "closes": 0.13, "qualified": 0.75, "leads": 3.75, "calls": 11.25 },
    "daily": { "closes": 0.03, "qualified": 0.15, "leads": 0.75, "calls": 2.25 }
  },
  "reality_check": {
    "total_realized": 87500,
    "target_to_date": 100000,
    "pct_achieved": 87.5,
    "projected_annual": 350000,
    "gap": 50000,
    "status": "orange",
    "message": "Se continuares neste ritmo, vais fechar 350.000€ este ano"
  },
  "today": {
    "leads_to_contact": 4,
    "calls_minimum": 11,
    "visits_to_schedule": 1,
    "listings_in_progress": 2,
    "active_buyers": 5,
    "status": { "leads": "green", "calls": "red", "visits": "orange" }
  }
}
```

---

## 5. Frontend — Paginas e Componentes

### 5.1 Paginas

```
app/dashboard/objetivos/page.tsx              -- Lista de consultores com resumo
app/dashboard/objetivos/[id]/page.tsx         -- Dashboard do consultor (detalhe)
app/dashboard/objetivos/novo/page.tsx         -- Criar objetivo anual
app/dashboard/objetivos/[id]/editar/page.tsx  -- Editar parametros
```

### 5.2 Componentes

```
components/goals/
├── goal-config-form.tsx           -- Formulario das 5 variaveis base + funis
├── goal-financial-cards.tsx       -- Cards 4 niveis (anual/mensal/semanal/diario)
├── goal-funnel-table.tsx          -- Tabela funil vendedores OU compradores
├── goal-daily-actions.tsx         -- Painel de acoes diarias com semaforos
├── goal-reality-check.tsx         -- Projecao + gap + mensagem motivacional
├── goal-progress-chart.tsx        -- Grafico realizado vs objetivo (por semana/mes)
├── goal-compare-table.tsx         -- Tabela comparativa de consultores (admin)
├── goal-activity-form.tsx         -- Formulario de registo de actividade
├── goal-activity-timeline.tsx     -- Timeline de actividades do consultor
└── goal-status-indicator.tsx      -- Componente semaforo (🔴🟠🟢)
```

### 5.3 Hooks

```
hooks/
├── use-goals.ts                   -- CRUD + listagem de objetivos
├── use-goal-dashboard.ts          -- KPIs calculados + realizado + projecao
├── use-goal-activities.ts         -- CRUD actividades
└── use-goal-compare.ts            -- Comparacao admin
```

### 5.4 Types

```typescript
// types/goal.ts

interface ConsultantGoal {
  id: string
  consultant_id: string
  year: number
  // Base config
  annual_revenue_target: number
  pct_sellers: number
  pct_buyers: number
  working_weeks_year: number
  working_days_week: number
  // Seller funnel
  sellers_avg_sale_value: number | null
  sellers_avg_commission_pct: number | null
  sellers_pct_listings_sold: number | null
  sellers_pct_visit_to_listing: number | null
  sellers_pct_lead_to_visit: number | null
  sellers_avg_calls_per_lead: number | null
  // Buyer funnel
  buyers_avg_purchase_value: number | null
  buyers_avg_commission_pct: number | null
  buyers_close_rate: number | null
  buyers_pct_lead_to_qualified: number | null
  buyers_avg_calls_per_lead: number | null
  // Meta
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  consultant?: { id: string; commercial_name: string; profile_photo_url?: string }
}

interface GoalActivity {
  id: string
  consultant_id: string
  activity_date: string
  activity_type: 'call' | 'visit' | 'listing' | 'sale_close' | 'buyer_close' | 'lead_contact' | 'buyer_qualify' | 'follow_up'
  origin: 'sellers' | 'buyers'
  revenue_amount: number | null
  reference_id: string | null
  reference_type: 'lead' | 'property' | 'negocio' | null
  notes: string | null
  created_at: string
  created_by: string | null
}

type GoalPeriod = 'annual' | 'monthly' | 'weekly' | 'daily'
type GoalStatus = 'green' | 'orange' | 'red'

interface FinancialTargets {
  total: number
  sellers: number
  buyers: number
}

interface SellerFunnelTargets {
  sales: number
  listings: number
  visits: number
  leads: number
  calls: number
}

interface BuyerFunnelTargets {
  closes: number
  qualified: number
  leads: number
  calls: number
}

interface GoalDashboard {
  goal: ConsultantGoal
  financial: Record<GoalPeriod, FinancialTargets>
  funnel_sellers: Record<GoalPeriod, SellerFunnelTargets>
  funnel_buyers: Record<GoalPeriod, BuyerFunnelTargets>
  reality_check: {
    total_realized: number
    target_to_date: number
    pct_achieved: number
    projected_annual: number
    gap: number
    status: GoalStatus
    message: string
  }
  today: {
    leads_to_contact: number
    calls_minimum: number
    visits_to_schedule: number
    listings_in_progress: number
    active_buyers: number
    status: Record<string, GoalStatus>
  }
}
```

### 5.5 Validacoes Zod

```typescript
// lib/validations/goal.ts

const goalConfigSchema = z.object({
  consultant_id: z.string().regex(/^[0-9a-f-]{36}$/),
  year: z.number().int().min(2024).max(2050),
  annual_revenue_target: z.number().positive(),
  pct_sellers: z.number().min(0).max(100),
  pct_buyers: z.number().min(0).max(100),
  working_weeks_year: z.number().int().min(1).max(52).default(48),
  working_days_week: z.number().int().min(1).max(7).default(5),
  // Seller funnel
  sellers_avg_sale_value: z.number().positive().nullable().optional(),
  sellers_avg_commission_pct: z.number().min(0).max(100).nullable().optional(),
  sellers_pct_listings_sold: z.number().min(0).max(100).nullable().optional(),
  sellers_pct_visit_to_listing: z.number().min(0).max(100).nullable().optional(),
  sellers_pct_lead_to_visit: z.number().min(0).max(100).nullable().optional(),
  sellers_avg_calls_per_lead: z.number().min(0).nullable().optional(),
  // Buyer funnel
  buyers_avg_purchase_value: z.number().positive().nullable().optional(),
  buyers_avg_commission_pct: z.number().min(0).max(100).nullable().optional(),
  buyers_close_rate: z.number().min(0).max(100).nullable().optional(),
  buyers_pct_lead_to_qualified: z.number().min(0).max(100).nullable().optional(),
  buyers_avg_calls_per_lead: z.number().min(0).nullable().optional(),
}).refine(
  (data) => data.pct_sellers + data.pct_buyers === 100,
  { message: 'A soma das percentagens vendedores + compradores deve ser 100%' }
)

const goalActivitySchema = z.object({
  activity_date: z.string().date(),
  activity_type: z.enum(['call', 'visit', 'listing', 'sale_close', 'buyer_close', 'lead_contact', 'buyer_qualify', 'follow_up']),
  origin: z.enum(['sellers', 'buyers']),
  revenue_amount: z.number().nullable().optional(),
  reference_id: z.string().nullable().optional(),
  reference_type: z.enum(['lead', 'property', 'negocio']).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})
```

---

## 6. UI — Layout das Paginas

### 6.1 Dashboard do Consultor (pagina principal)

```
┌─────────────────────────────────────────────────────────┐
│  📊 Objetivos 2026 — João Silva                        │
│  Objetivo Anual: 400.000€  |  Gap: -50.000€  | 🟠     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  ANUAL   │ │  MENSAL  │ │ SEMANAL  │ │  DIARIO  │  │
│  │ 400.000€ │ │ 33.333€  │ │ 8.333€   │ │ 1.667€   │  │
│  │ Real:    │ │ Real:    │ │ Real:    │ │ Real:    │  │
│  │ 87.500€  │ │ 12.000€  │ │ 3.200€   │ │ 800€     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
├─ TABS ──────────────────────────────────────────────────┤
│  [Acoes Hoje] [Vendedores] [Compradores] [Progresso]   │
│                                                         │
│  Tab: Acoes Hoje                                        │
│  ┌────────────────┬──────────┬──────────┬──────────┐   │
│  │ Metrica        │ Objetivo │ Feito    │ Status   │   │
│  ├────────────────┼──────────┼──────────┼──────────┤   │
│  │ Leads          │ 4        │ 2        │ 🔴       │   │
│  │ Chamadas       │ 11       │ 8        │ 🟠       │   │
│  │ Visitas (sem)  │ 3        │ 3        │ 🟢       │   │
│  │ Follow-ups     │ 2        │ 1        │ 🟠       │   │
│  └────────────────┴──────────┴──────────┴──────────┘   │
│                                                         │
│  💬 "Se continuares neste ritmo, vais fechar 350.000€   │
│      este ano. Precisas de +2 vendas ate fim do mes."   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [+ Registar Actividade]                                │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Tab Vendedores / Compradores

```
┌────────────────────────────────────────────────────────┐
│  FUNIL VENDEDORES — 50% do objetivo (200.000€)         │
├────────────────┬────────┬────────┬────────┬────────────┤
│ KPI            │ Anual  │ Mensal │ Semanal│ Diario     │
├────────────────┼────────┼────────┼────────┼────────────┤
│ Faturacao      │200.000 │16.667  │ 4.167  │ 833        │
│ Vendas         │ 8      │ 0.67   │ 0.17   │ 0.03       │
│ Angariacoes    │ 36     │ 3      │ 0.75   │ 0.15       │
│ Visitas        │ 144    │ 12     │ 3      │ 0.6        │
│ Leads          │ 720    │ 60     │ 15     │ 3          │
│ Chamadas       │ 2160   │ 180    │ 45     │ 9          │
└────────────────┴────────┴────────┴────────┴────────────┘
│                                                         │
│  Parametros do Funil  [Editar]                          │
│  Valor medio venda: 250.000€                            │
│  Comissao media: 3%                                     │
│  % angariacoes vendidas: 22%                            │
│  % visita → angariacao: 25%                             │
│  % lead → visita: 20%                                   │
│  Chamadas por lead: 3                                   │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Dashboard Admin — Comparacao

```
┌──────────────────────────────────────────────────────────┐
│  📊 Quadro de Objetivos — Semana 11/2026                 │
├───────────────┬────────┬────────┬────────┬────────┬──────┤
│ Consultor     │ Obj.   │ Real.  │ Leads  │ Cham.  │ St.  │
├───────────────┼────────┼────────┼────────┼────────┼──────┤
│ Joao Silva    │ 8.333  │ 3.200  │ 8/15   │ 20/45  │ 🔴   │
│ Ana Costa     │ 6.250  │ 7.100  │ 12/10  │ 35/30  │ 🟢   │
│ Pedro Santos  │ 10.417 │ 9.800  │ 14/18  │ 50/54  │ 🟠   │
└───────────────┴────────┴────────┴────────┴────────┴──────┘
│                                                           │
│  Filtros: [Ano ▼] [Periodo: Semanal ▼] [Equipa ▼]       │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Permissoes

| Accao                              | Consultor | Team Leader | Broker/CEO |
|------------------------------------|-----------|-------------|------------|
| Ver proprios objetivos             | ✅         | ✅           | ✅          |
| Ver objetivos da equipa            | ❌         | ✅           | ✅          |
| Ver todos os objetivos             | ❌         | ❌           | ✅          |
| Criar/editar proprios objetivos    | ❌         | ❌           | ✅          |
| Criar/editar objetivos da equipa   | ❌         | ✅           | ✅          |
| Registar actividades proprias      | ✅         | ✅           | ✅          |
| Ver dashboard comparativo          | ❌         | ✅           | ✅          |

---

## 8. Sidebar

Novo item no sidebar:
- **Objetivos** — icone: `Target` (lucide-react)
- Posicao: entre "Comissoes" e "Marketing" (ou apos Dashboard)
- Permissao: modulo `goals`

---

## 9. Constantes PT-PT

```typescript
// Em lib/constants.ts

export const GOAL_ACTIVITY_TYPES = {
  call: 'Chamada',
  visit: 'Visita',
  listing: 'Angariacao',
  sale_close: 'Fecho Venda',
  buyer_close: 'Fecho Comprador',
  lead_contact: 'Contacto Lead',
  buyer_qualify: 'Qualificacao Comprador',
  follow_up: 'Follow-up',
} as const

export const GOAL_ORIGINS = {
  sellers: 'Vendedores',
  buyers: 'Compradores',
} as const

export const GOAL_STATUS_COLORS = {
  green: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', label: 'Acima do objetivo' },
  orange: { bg: 'bg-amber-500/15', text: 'text-amber-500', label: 'No limite' },
  red: { bg: 'bg-red-500/15', text: 'text-red-500', label: 'Abaixo do minimo' },
} as const

export const GOAL_PERIOD_LABELS = {
  annual: 'Anual',
  monthly: 'Mensal',
  weekly: 'Semanal',
  daily: 'Diario',
} as const
```

---

## 10. Dependencias

Nenhuma dependencia nova necessaria. Usa:
- `recharts` ou similar para graficos de progresso (se nao instalado, instalar)
- Todos os componentes shadcn/ui ja existentes (Card, Table, Tabs, Badge, Progress, etc.)

---

## 11. Ordem de Implementacao

1. **Backend:** Criar tabelas TEMP no Supabase
2. **Backend:** API routes (CRUD goals + activities + dashboard)
3. **Frontend:** Types + validacoes Zod + constantes
4. **Frontend:** Hooks (use-goals, use-goal-dashboard, use-goal-activities)
5. **Frontend:** Formulario de configuracao (goal-config-form)
6. **Frontend:** Dashboard do consultor (cards + funis + acoes diarias)
7. **Frontend:** Registo de actividades (formulario + timeline)
8. **Frontend:** Reality check + projecao
9. **Frontend:** Dashboard admin (comparacao)
10. **Frontend:** Sidebar + permissoes
