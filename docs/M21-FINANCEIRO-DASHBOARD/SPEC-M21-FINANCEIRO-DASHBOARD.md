# SPEC-M21 — Dashboard Financeiro, Comissões e Relatórios

## Visão Geral

Módulo financeiro completo com 3 contextos distintos:

1. **Dashboard de Gestão** — Visão global para Broker/CEO com KPIs de toda a agência
2. **Dashboard do Agente** — Visão pessoal para cada consultor com os seus dados
3. **Relatórios Financeiros** — Geração dinâmica de relatórios detalhados (estilo "Análise Agentes" RE/MAX)

Integra dados de: `dev_properties`, `dev_property_internal`, `dev_consultant_private_data`, `proc_instances`, `temp_consultant_goals`, `temp_goal_activity_log`.

---

## 1. Dashboard de Gestão (Broker/CEO)

**Rota:** `/dashboard` (página principal, substituir o dashboard actual)
**Permissão:** `dashboard` (roles: Broker/CEO, Office Manager)

### 1.1 Previsões

Projecções baseadas no pipeline activo e objectivos dos consultores.

| KPI | Fonte | Cálculo |
|-----|-------|---------|
| Angariações Previstas | `temp_consultant_goals` | Soma de `sellers_funnel.annual.listings` de todos os consultores activos |
| Angariações a Entrar | `dev_properties` WHERE status='pending_approval' | COUNT |
| Negócios Previstos/a Fechar | `proc_instances` WHERE current_status IN ('in_progress','approved') | COUNT |
| Negócios a Decorrer | `proc_instances` WHERE current_status NOT IN ('completed','rejected','cancelled') | COUNT |
| Facturação Prevista | `temp_consultant_goals` | Soma de `annual_revenue_target` de todos os consultores |
| Margem Prevista | Facturação Prevista × taxa média de margem da agência | Configurável |

### 1.2 Angariações

Estado actual do portfólio de imóveis.

| KPI | Fonte | Cálculo |
|-----|-------|---------|
| Novas Este Mês | `dev_properties` WHERE created_at >= início do mês | COUNT |
| Activas | `dev_properties` WHERE status='active' | COUNT |
| Dias Sem Angariar | Dias desde a última angariação (created_at mais recente) | DIFF |
| Angariadas | `dev_properties` WHERE status IN ('active','sold','rented') AND created_at no período | COUNT |
| Reservadas | `dev_properties` WHERE business_status='reserved' | COUNT |
| Vendidas | `dev_properties` WHERE status='sold' AND updated_at no período | COUNT |
| Canceladas | `dev_properties` WHERE status='cancelled' AND updated_at no período | COUNT |

### 1.3 Reporting (Facturação)

Facturação real baseada em negócios fechados.

| KPI | Fonte | Cálculo |
|-----|-------|---------|
| Reportado Este Mês | `temp_goal_activity_log` WHERE activity_type IN ('sale_close','buyer_close') AND mês actual | SUM(revenue_amount) |
| Assinado por Reportar | Negócios com CPCV mas sem escritura (proc_instances com fase CPCV concluída mas não completado) | SUM(commission) |
| Reportado Este Ano | Mesmo que "Reportado Este Mês" mas para o ano todo | SUM(revenue_amount) |

### 1.4 Margem

| KPI | Fonte | Cálculo |
|-----|-------|---------|
| Margem Deste Mês | Facturação mês - custos operacionais mês | Facturação × % margem |
| Assinado por Receber | Comissões de deals assinados ainda não pagos | SUM via temp_financial_transactions WHERE status='pending' |
| Margem Deste Ano | Facturação ano × % margem | Acumulado |

### 1.5 Gráfico de Evolução

Gráfico de área com 2 séries (últimos 12-14 meses):
- **Report** — Facturação mensal (verde escuro)
- **Margem** — Margem mensal (verde claro)

Eixo X: meses (formato M/YYYY)
Eixo Y: valores em €

### 1.6 Imóveis em Carteira

| KPI | Cálculo |
|-----|---------|
| Volume dos Imóveis Activos | SUM(listing_price) WHERE status='active' |
| Facturação Potencial | SUM(commission_agreed ou listing_price × commission_rate%) WHERE status='active' |

### 1.7 Pipeline de Receita

Receita esperada ponderada pela probabilidade de fecho.

| Fase do Processo | Probabilidade | Cálculo |
|------------------|--------------|---------|
| Angariação aprovada | 20% | commission × 0.20 |
| Visitas agendadas | 35% | commission × 0.35 |
| Proposta apresentada | 50% | commission × 0.50 |
| CPCV assinado | 80% | commission × 0.80 |
| Escritura agendada | 95% | commission × 0.95 |

**Total Pipeline Ponderado** = Soma de todos os valores ponderados

### 1.8 Alertas de Performance

Flags automáticos para consultores abaixo dos objectivos:

| Alerta | Condição | Severidade |
|--------|----------|------------|
| Sem angariações este mês | 0 angariações no mês | Urgente |
| Facturação abaixo de 50% do target mensal | actual < target × 0.5 | Aviso |
| Sem actividade há >5 dias | Última actividade registada >5 dias | Aviso |
| Meta anual em risco | realityCheck.status = 'red' | Urgente |

### 1.9 Rankings

#### Ranking de Facturação
Tabela ordenada por facturação (desc):

| # | Consultor | Facturação YTD | Objectivo | % Atingido | Variação vs Mês Anterior |
|---|-----------|----------------|-----------|------------|--------------------------|

#### Ranking de Angariações
Tabela ordenada por nº de angariações (desc):

| # | Consultor | Angariações YTD | Novas Este Mês | Activas | Vendidas |
|---|-----------|-----------------|----------------|---------|----------|

### 1.10 Comissões Pendentes vs Pagas

| KPI | Cálculo |
|-----|---------|
| Comissões Pendentes | SUM(amount) WHERE status='pending' em temp_financial_transactions |
| Comissões Pagas Este Mês | SUM(amount) WHERE status='paid' AND paid_date no mês |
| Comissões Pagas YTD | SUM(amount) WHERE status='paid' AND paid_date no ano |

---

## 2. Dashboard do Agente (Consultor)

**Rota:** `/dashboard` (mesma rota, conteúdo diferente baseado no role)
**Permissão:** Todos os roles (cada um vê os seus próprios dados)

### 2.1 Resumo Pessoal

| KPI | Cálculo |
|-----|---------|
| Facturação YTD | SUM(revenue_amount) das actividades do consultor no ano |
| Facturação Este Mês | SUM(revenue_amount) do mês |
| Objectivo Anual | annual_revenue_target do goal activo |
| % Atingido | Facturação YTD / Objectivo × 100 |
| Posição no Ranking | Posição ordinal vs outros consultores |

### 2.2 Objectivos vs Realizado

Barras de progresso por período:

| Período | Target | Realizado | % | Status |
|---------|--------|-----------|---|--------|
| Anual | 50.000€ | 12.500€ | 25% | Verde/Amarelo/Vermelho |
| Mensal | 4.167€ | 3.200€ | 77% | |
| Semanal | 962€ | 800€ | 83% | |

Integra com o módulo de Objectivos (M16) — usa `calcFinancial()` e `calcRealityCheck()`.

### 2.3 Os Meus Imóveis

| KPI | Cálculo |
|-----|---------|
| Angariações Activas | COUNT WHERE consultant_id=me AND status='active' |
| Reservadas | COUNT WHERE status='reserved' |
| Vendidas Este Ano | COUNT WHERE status='sold' AND ano actual |
| Volume em Carteira | SUM(listing_price) WHERE active |

### 2.4 Próximas Acções

Lista de tarefas e eventos próximos do consultor:

| Tipo | Fonte | Exemplo |
|------|-------|---------|
| Visitas agendadas | Calendar events / proc_tasks | "Visita Rua das Flores 23 — Amanhã 15h" |
| CPCV próximos | proc_tasks com type='CPCV' | "CPCV Apt T2 Cascais — 20/03" |
| Escrituras agendadas | proc_tasks com type='ESCRITURA' | "Escritura Moradia Sintra — 25/03" |
| Contratos a expirar | dev_property_internal.contract_expiry | "Contrato Loja Expo expira em 15 dias" |
| Follow-ups leads | lead_activities com follow-up | "Follow-up João Silva — Hoje" |

### 2.5 Comparação com Média da Agência

Indicadores sem expor dados individuais de outros agentes:

| Métrica | Eu | Média Agência | Indicador |
|---------|----|---------------|-----------|
| Facturação Mensal | 3.200€ | 2.800€ | ↑ Acima |
| Angariações/Mês | 2 | 3.5 | ↓ Abaixo |
| Tempo Médio de Venda | 45d | 60d | ↑ Melhor |
| Taxa de Conversão | 15% | 12% | ↑ Acima |

### 2.6 Gráfico de Evolução Pessoal

Gráfico de barras mensais (últimos 12 meses):
- Facturação por mês
- Linha de objectivo mensal sobreposta

---

## 3. Relatórios Financeiros

**Rota:** `/dashboard/comissoes/relatorios`
**Permissão:** `financial` (Broker/CEO, Office Manager) ou relatórios pessoais para consultores

### 3.1 Relatório de Análise de Agente

Reproduz o formato "Análise Agentes" da imagem RE/MAX. Gerável por consultor + período.

#### Cabeçalho
- Nome do agente, agência, ID, data de entrada, escalão, posição no ranking

#### Objectivo para o Ano
| Campo | Cálculo |
|-------|---------|
| Facturação Prevista | annual_revenue_target do goal |
| Em Valor | Diferença vs facturado |
| Crescimento | % crescimento vs ano anterior |

#### Escalões de Comissão
Configurable commission tiers:

| Escalão | Intervalo | Taxa |
|---------|-----------|------|
| A | Venda < 20K | X% |
| B | Venda 20K-50K | Y% |
| C | Venda 50K-100K | Z% |
| D | Venda >= 100K | W% |
| Arrendamento | — | V% |

#### Tabela Mensal Comparativa (Ano actual vs Anterior)

| Mês | Facturação (N-1) | Facturação (N) | Ang Novas (N-1) | Ang Novas (N) | Total Ang (N-1) | Total Ang (N) | Produtividade (N-1) | Produtividade (N) | Trimestre Média | Transacções (N-1) | Transacções (N) |
|-----|------------------|----------------|-----------------|---------------|-----------------|---------------|---------------------|-------------------|-----------------|-------------------|-----------------|

#### Resumo Lateral
- Total Angariações (Venda + Arrendamento)
- Partilhas (Internas, Externas, Na Rede)
- YTD actual vs anterior com diferença
- Facturação Venda: Total Ang (valor + %), Total Vnd (valor + %)
- Facturação Arrendamento: idem

#### Indicadores de Tendência (N vs N-1)
- Facturação: ↑/↓ + valor absoluto
- Produtividade: ↑/↓ + valor
- Novas Angariações: ↑/↓/= + valor
- Total Angariações: ↑/↓ + valor

### 3.2 Relatório de Comissões Detalhado

Por deal, mostrando a decomposição:

| Imóvel | Ref | Tipo Negócio | Valor Venda | Comissão Agência (%) | Comissão Agência (€) | Split Consultor (%) | Comissão Consultor (€) | Partilha | Partilha (€) | Líquido Consultor |
|--------|-----|-------------|-------------|---------------------|---------------------|--------------------|-----------------------|---------|-------------|-------------------|

Filtros: consultor, período, tipo de negócio, estado de pagamento

### 3.3 Relatório de Tempo Médio de Venda

| Segmento | Nº Vendas | Tempo Médio (dias) | Mín | Máx | Mediana |
|----------|-----------|-------------------|-----|-----|---------|
| Por tipo de imóvel | | | | | |
| Por zona/cidade | | | | | |
| Por escalão de preço | | | | | |
| Por consultor | | | | | |

Cálculo: diferença entre `dev_properties.created_at` e data de mudança para status='sold' (via `proc_instances.completed_at` ou `log_audit`).

### 3.4 Relatório de Partilhas

| Tipo | Nº Deals | Volume Total | Comissão Total | % do Total |
|------|----------|-------------|---------------|-----------|
| Sem Partilha | | | | |
| Partilha Interna | | | | |
| Partilha Externa | | | | |
| Partilha na Rede | | | | |

Detalhe por deal: imóvel, agência parceira, % split, valores.

### 3.5 Gerador de Relatórios Dinâmico

Interface "query builder" que permite ao gestor criar relatórios customizados:

**Dimensões disponíveis:**
- Consultor
- Período (mês, trimestre, semestre, ano)
- Tipo de imóvel
- Tipo de negócio (venda, arrendamento, trespasse)
- Zona/Cidade
- Escalão de preço
- Estado do imóvel

**Métricas disponíveis:**
- Facturação
- Nº de transacções
- Nº de angariações
- Comissão (agência e consultor)
- Tempo médio de venda
- Volume em carteira
- Produtividade (facturação / nº meses activo)

**Saída:**
- Tabela dinâmica (pivot)
- Exportar CSV
- Exportar PDF (formato estilo imagem 2)

---

## 4. Secção de Pagamentos (Futura — M22)

Preparar a estrutura para conectar com o módulo de pagamentos futuro.

### Tipos de Transacção
- Comissões de venda/arrendamento
- Pagamentos de marketing (loja de materiais)
- Salários fixos
- Despesas operacionais
- Partilhas com outras agências

### Estado do Pagamento
- `pending` — Calculado, a aguardar aprovação
- `approved` — Aprovado, a aguardar pagamento
- `paid` — Pago
- `cancelled` — Cancelado

---

## 5. Tabelas de Base de Dados (prefixo temp_)

### temp_financial_transactions

Registo central de todas as transacções financeiras.

```sql
CREATE TABLE temp_financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID REFERENCES dev_users(id),
  property_id UUID REFERENCES dev_properties(id),
  proc_instance_id UUID REFERENCES proc_instances(id),

  -- Tipo e categorização
  transaction_type TEXT NOT NULL, -- 'commission_sale', 'commission_rent', 'commission_split', 'marketing_purchase', 'salary', 'expense'
  category TEXT, -- sub-categoria livre

  -- Valores
  deal_value NUMERIC, -- valor do negócio
  agency_commission_pct NUMERIC, -- % comissão agência
  agency_commission_amount NUMERIC, -- € comissão agência
  consultant_split_pct NUMERIC, -- % split do consultor
  consultant_commission_amount NUMERIC, -- € comissão consultor

  -- Partilhas
  is_shared_deal BOOLEAN DEFAULT false,
  share_type TEXT, -- 'internal', 'external', 'network', null
  share_agency_name TEXT, -- nome da agência parceira
  share_pct NUMERIC, -- % da partilha
  share_amount NUMERIC, -- € da partilha

  -- Estado
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'cancelled'
  approved_by UUID REFERENCES dev_users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT, -- referência do pagamento/transferência

  -- Datas
  transaction_date DATE NOT NULL, -- data do negócio/transacção
  reporting_month TEXT, -- 'YYYY-MM' para agrupamento

  -- Metadata
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_financial_transactions_consultant ON temp_financial_transactions(consultant_id);
CREATE INDEX idx_financial_transactions_status ON temp_financial_transactions(status);
CREATE INDEX idx_financial_transactions_date ON temp_financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_month ON temp_financial_transactions(reporting_month);
CREATE INDEX idx_financial_transactions_type ON temp_financial_transactions(transaction_type);
```

### temp_commission_tiers

Escalões de comissão configuráveis.

```sql
CREATE TABLE temp_commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 'Escalão A', 'Escalão B', etc.
  business_type TEXT NOT NULL, -- 'venda', 'arrendamento'
  min_value NUMERIC NOT NULL, -- valor mínimo do deal
  max_value NUMERIC, -- valor máximo (null = sem limite)
  agency_rate NUMERIC NOT NULL, -- % comissão agência
  consultant_rate NUMERIC NOT NULL, -- % split consultor (do que a agência recebe)
  is_active BOOLEAN DEFAULT true,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### temp_agency_settings

Configurações financeiras da agência.

```sql
CREATE TABLE temp_agency_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Valores iniciais:
-- margin_rate: '0.30' (30% margem sobre facturação)
-- vat_rate: '0.23' (23% IVA)
-- default_commission_sale: '0.05' (5% comissão venda por defeito)
-- default_commission_rent: '1.0' (1 renda de comissão arrendamento)
-- fiscal_year_start: '01' (Janeiro)
```

### temp_report_snapshots

Cache de relatórios gerados (para PDF export e histórico).

```sql
CREATE TABLE temp_report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL, -- 'agent_analysis', 'commission_detail', 'time_to_sale', 'shares', 'custom'
  consultant_id UUID REFERENCES dev_users(id), -- null para relatórios globais
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  parameters JSONB, -- filtros e dimensões usados
  data JSONB NOT NULL, -- dados do relatório
  generated_by UUID REFERENCES dev_users(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  pdf_url TEXT -- URL do PDF gerado (R2)
);

CREATE INDEX idx_report_snapshots_type ON temp_report_snapshots(report_type);
CREATE INDEX idx_report_snapshots_consultant ON temp_report_snapshots(consultant_id);
```

---

## 6. Sub-Páginas e Navegação

### Para Gestores (role: Broker/CEO, Office Manager)

O dashboard principal (`/dashboard`) mostra a visão de gestão com todos os KPIs.

A secção Comissões (`/dashboard/comissoes`) tem sub-páginas:

| Página | Rota | Descrição |
|--------|------|-----------|
| Resumo | `/dashboard/comissoes` | KPIs de comissões, pendentes vs pagas |
| Transacções | `/dashboard/comissoes/transaccoes` | Lista de todas as transacções financeiras |
| Relatórios | `/dashboard/comissoes/relatorios` | Gerador de relatórios |
| Análise Agente | `/dashboard/comissoes/relatorios/agente/[id]` | Relatório individual estilo RE/MAX |
| Rankings | `/dashboard/comissoes/rankings` | Ranking facturação + angariações |
| Escalões | `/dashboard/comissoes/escaloes` | Configuração de escalões de comissão |
| Definições | `/dashboard/comissoes/definicoes` | Taxas, margens, configurações |

### Para Consultores

O dashboard principal mostra a visão pessoal do agente.

Os consultores acedem a `/dashboard/comissoes` e vêem apenas as suas transacções e relatórios pessoais.

---

## 7. Server Actions Necessárias

### Dashboard de Gestão
- `getManagementDashboard(period?)` — Todos os KPIs agregados
- `getRevenueChart(months?)` — Dados para gráfico de evolução
- `getPerformanceAlerts()` — Alertas de performance dos consultores
- `getAgentRankings(metric, period)` — Rankings por facturação ou angariações
- `getRevenuePipeline()` — Pipeline ponderado por probabilidade

### Dashboard do Agente
- `getAgentDashboard(consultantId, period?)` — KPIs pessoais
- `getAgentUpcomingActions(consultantId)` — Próximas acções
- `getAgentVsAverage(consultantId)` — Comparação com média
- `getAgentEvolutionChart(consultantId, months?)` — Gráfico pessoal

### Transacções Financeiras
- `getTransactions(filters)` — Listar transacções
- `createTransaction(data)` — Registar transacção
- `updateTransactionStatus(id, status)` — Aprovar/pagar/cancelar
- `bulkApproveTransactions(ids)` — Aprovar em massa

### Relatórios
- `generateAgentReport(consultantId, year, month?)` — Relatório estilo RE/MAX
- `generateCommissionReport(filters)` — Relatório de comissões detalhado
- `generateTimeToSaleReport(filters)` — Tempo médio de venda
- `generateSharesReport(filters)` — Relatório de partilhas
- `generateCustomReport(dimensions, metrics, filters)` — Relatório dinâmico
- `exportReportPdf(reportId)` — Gerar PDF

### Configuração
- `getCommissionTiers()` — Listar escalões
- `upsertCommissionTier(data)` — Criar/editar escalão
- `getAgencySettings()` — Obter configurações
- `updateAgencySetting(key, value)` — Actualizar configuração

---

## 8. Tipos TypeScript

```typescript
// types/financial.ts

export type TransactionType =
  | 'commission_sale'
  | 'commission_rent'
  | 'commission_split'
  | 'marketing_purchase'
  | 'salary'
  | 'expense'

export type TransactionStatus = 'pending' | 'approved' | 'paid' | 'cancelled'

export type ShareType = 'internal' | 'external' | 'network'

export interface FinancialTransaction {
  id: string
  consultant_id: string
  property_id: string | null
  proc_instance_id: string | null
  transaction_type: TransactionType
  category: string | null
  deal_value: number | null
  agency_commission_pct: number | null
  agency_commission_amount: number | null
  consultant_split_pct: number | null
  consultant_commission_amount: number | null
  is_shared_deal: boolean
  share_type: ShareType | null
  share_agency_name: string | null
  share_pct: number | null
  share_amount: number | null
  status: TransactionStatus
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  payment_reference: string | null
  transaction_date: string
  reporting_month: string
  description: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joins
  consultant?: { id: string; commercial_name: string } | null
  property?: { id: string; title: string; external_ref: string; listing_price: number } | null
}

export interface CommissionTier {
  id: string
  name: string
  business_type: 'venda' | 'arrendamento'
  min_value: number
  max_value: number | null
  agency_rate: number
  consultant_rate: number
  is_active: boolean
  order_index: number
}

export interface AgencySetting {
  id: string
  key: string
  value: string
  description: string | null
}

// ─── Dashboard Types ────────────────────────────────────────────────────────

export interface ManagementDashboard {
  forecasts: {
    expected_acquisitions: number
    pending_acquisitions: number
    expected_deals: number
    active_deals: number
    expected_revenue: number
    expected_margin: number
  }
  acquisitions: {
    new_this_month: number
    active: number
    days_without_acquisition: number
    acquired: number
    reserved: number
    sold: number
    cancelled: number
  }
  reporting: {
    reported_this_month: number
    signed_pending: number
    reported_this_year: number
  }
  margin: {
    margin_this_month: number
    pending_collection: number
    margin_this_year: number
  }
  portfolio: {
    active_volume: number
    potential_revenue: number
  }
  pipeline: {
    stage: string
    probability: number
    total_value: number
    weighted_value: number
  }[]
  performance_alerts: PerformanceAlert[]
}

export interface PerformanceAlert {
  consultant_id: string
  consultant_name: string
  type: 'no_acquisitions' | 'below_target' | 'no_activity' | 'annual_risk'
  severity: 'warning' | 'urgent'
  message: string
  value?: number
  target?: number
}

export interface AgentDashboard {
  revenue_ytd: number
  revenue_this_month: number
  annual_target: number
  pct_achieved: number
  ranking_position: number
  total_agents: number
  my_properties: {
    active: number
    reserved: number
    sold_year: number
    volume: number
  }
  upcoming_actions: UpcomingAction[]
  vs_average: {
    metric: string
    my_value: number
    agency_avg: number
    direction: 'above' | 'below' | 'equal'
  }[]
  monthly_evolution: {
    month: string
    revenue: number
    target: number
  }[]
}

export interface UpcomingAction {
  type: 'visit' | 'cpcv' | 'escritura' | 'contract_expiry' | 'lead_followup'
  title: string
  date: string
  property_ref?: string
  link?: string
}

export interface AgentRanking {
  position: number
  consultant_id: string
  consultant_name: string
  value: number
  target: number | null
  pct_achieved: number | null
  variation_vs_previous: number | null
  // For angariações ranking:
  new_this_month?: number
  active?: number
  sold?: number
}

// ─── Report Types ───────────────────────────────────────────────────────────

export interface AgentAnalysisReport {
  agent: {
    name: string
    agency: string
    id_number: string
    entry_date: string
    tier: string
    ranking_position: number
  }
  objective: {
    forecast: number
    in_value: number
    growth_pct: number
  }
  monthly_comparison: {
    month: string
    billing_prev: number
    billing_curr: number
    new_acq_prev: number
    new_acq_curr: number
    total_acq_prev: number
    total_acq_curr: number
    productivity_prev: number
    productivity_curr: number
    quarter_avg: number
    transactions_prev: number
    transactions_curr: number
  }[]
  totals: {
    billing_prev: number
    billing_curr: number
    new_acq_prev: number
    new_acq_curr: number
    total_acq_prev: number
    total_acq_curr: number
    productivity_prev: number
    productivity_curr: number
    transactions_prev: number
    transactions_curr: number
  }
  summary: {
    total_acquisitions: number
    sale_count: number
    rent_count: number
    internal_shares_pct: number
    external_shares_pct: number
    network_shares_pct: number
    ytd_current: number
    ytd_previous: number
    ytd_diff: number
    sale_acq_amount: number
    sale_acq_pct: number
    sale_sold_amount: number
    sale_sold_pct: number
  }
  trends: {
    billing: { direction: 'up' | 'down'; value: number }
    productivity: { direction: 'up' | 'down'; value: number }
    new_acquisitions: { direction: 'up' | 'down' | 'equal'; value: number }
    total_acquisitions: { direction: 'up' | 'down'; value: number }
  }
}

export interface CustomReportConfig {
  dimensions: ('consultant' | 'month' | 'quarter' | 'year' | 'property_type' | 'business_type' | 'city' | 'price_tier')[]
  metrics: ('revenue' | 'transactions' | 'acquisitions' | 'commission_agency' | 'commission_consultant' | 'time_to_sale' | 'volume' | 'productivity')[]
  filters: {
    consultant_id?: string
    date_from?: string
    date_to?: string
    business_type?: string
    property_type?: string
    city?: string
    status?: string
  }
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}
```

---

## 9. Ficheiros a Criar

### Páginas
| Ficheiro | Descrição |
|----------|-----------|
| `app/dashboard/page.tsx` | Dashboard (gestão ou agente baseado no role) |
| `app/dashboard/comissoes/page.tsx` | Resumo de comissões |
| `app/dashboard/comissoes/transaccoes/page.tsx` | Lista de transacções |
| `app/dashboard/comissoes/relatorios/page.tsx` | Gerador de relatórios |
| `app/dashboard/comissoes/relatorios/agente/[id]/page.tsx` | Relatório individual |
| `app/dashboard/comissoes/rankings/page.tsx` | Rankings |
| `app/dashboard/comissoes/escaloes/page.tsx` | Escalões de comissão |
| `app/dashboard/comissoes/definicoes/page.tsx` | Configurações financeiras |

### Server Actions
| Ficheiro | Descrição |
|----------|-----------|
| `app/dashboard/comissoes/actions.ts` | Todas as server actions financeiras |

### Types
| Ficheiro | Descrição |
|----------|-----------|
| `types/financial.ts` | Todos os tipos financeiros |

### Components
| Ficheiro | Descrição |
|----------|-----------|
| `components/financial/management-kpis.tsx` | Cards de KPIs para gestão |
| `components/financial/agent-kpis.tsx` | Cards de KPIs para agente |
| `components/financial/revenue-chart.tsx` | Gráfico de evolução |
| `components/financial/ranking-table.tsx` | Tabela de ranking |
| `components/financial/pipeline-chart.tsx` | Pipeline de receita |
| `components/financial/performance-alerts.tsx` | Alertas de performance |
| `components/financial/transaction-table.tsx` | Tabela de transacções |
| `components/financial/commission-detail.tsx` | Detalhe de comissão |
| `components/financial/report-builder.tsx` | Query builder dinâmico |
| `components/financial/agent-report.tsx` | Relatório estilo RE/MAX |
| `components/financial/upcoming-actions.tsx` | Próximas acções do agente |
| `components/financial/vs-average.tsx` | Comparação com média |

---

## 10. Dependências

### Existentes (já instaladas)
- `date-fns` — manipulação de datas
- `recharts` ou div-based charts — gráficos (verificar se recharts está instalado, senão usar divs)
- `sonner` — toasts
- `react-hook-form` + `zod` — formulários

### A instalar (se necessário)
- `@react-pdf/renderer` ou `jspdf` — geração de PDF client-side
- Alternativa: gerar PDF server-side via edge function ou API

---

## 11. Notas Técnicas

1. **Role-based dashboard** — O `/dashboard` detecta o role do utilizador e renderiza o componente de gestão ou de agente. Usar `useUser()` + `usePermissions()`.

2. **Dados financeiros são calculados, não stored** — Os KPIs do dashboard são calculados em tempo real a partir das tabelas existentes. Apenas as transacções financeiras (comissões) são registadas em `temp_financial_transactions`.

3. **Relatórios podem ser cached** — O `temp_report_snapshots` guarda relatórios gerados para não recalcular. TTL de 24h para relatórios do mês corrente.

4. **Escalões de comissão** — Configuráveis pelo Broker/CEO. O sistema aplica automaticamente o escalão correcto baseado no valor do negócio.

5. **Conexão com Pagamentos (M22)** — A tabela `temp_financial_transactions` já tem campos `status`, `paid_at`, `payment_reference` prontos para integrar com o módulo de pagamentos futuro.

6. **Partilhas** — Os campos `is_shared_deal`, `share_type`, `share_pct`, `share_amount` permitem registar deals partilhados com outras agências (internas, externas, ou na rede).

7. **Prefixo temp_** — Todas as tabelas novas usam prefixo `temp_` pois não existem ainda no schema gerado do Supabase.
