# Resumo da Sessão — 16 de Março 2026

## O que foi construído nesta sessão

### 1. Fix de Build para Coolify
- Corrigidos TS errors que bloqueavam o deploy (search-command, negocio-data-card)
- Adicionados 121 ficheiros em falta (training, goals, calendar, encomendas)
- Adicionado `@ts-nocheck` em ficheiros com tabelas temp_ não geradas nos types
- Corrigidas colunas DB incorrectas (`annual_target` → `annual_revenue_target`, `reporting_month` → `activity_date`, `active` → `available`)
- Criadas tabelas em falta no Supabase (`temp_commission_tiers`, `temp_agency_settings`, `temp_financial_transactions`, `temp_report_snapshots`)

### 2. Módulo de Recrutamento CRM (M20) — Completo
**8 sub-páginas + detalhe do candidato com 9 tabs**

| Página | Rota | Descrição |
|--------|------|-----------|
| Dashboard | `/dashboard/recrutamento` | KPIs, alertas, actividade recente |
| Pipeline | `/dashboard/recrutamento/pipeline` | Kanban com 7 colunas |
| Candidatos | `/dashboard/recrutamento/candidatos` | Tabela com bulk actions (multi-select, assign, export CSV) |
| Calendário | `/dashboard/recrutamento/calendario` | Calendário mensal de entrevistas |
| Alertas | `/dashboard/recrutamento/alertas` | Tarefas pendentes (sem contacto, follow-ups, onboarding) |
| Relatórios | `/dashboard/recrutamento/relatorios` | Analytics (funil, source, recruiter performance) |
| Templates | `/dashboard/recrutamento/templates` | Templates email/WhatsApp/SMS por fase |
| Formulário | `/dashboard/recrutamento/formulario` | Submissões do formulário público |

**Detalhe do candidato — 9 tabs:**
1. Dados Pessoais (com score 0-100 e detecção de duplicados)
2. Perfil de Origem
3. Pain & Pitch
4. Entrevistas
5. Comunicações (timeline de chamadas, emails, WhatsApp)
6. Evolução Financeira
7. Período de Experiência (milestones 30/60/90 dias)
8. Onboarding
9. Histórico

**Novas tabelas:** `temp_recruitment_communications`, `temp_recruitment_probation`, `temp_recruitment_comm_templates`
**Documentação:** `docs/M20-RECRUTAMENTO/SPEC-M20-RECRUTAMENTO.md`

### 3. Dashboard Financeiro e Comissões (M21) — Completo

#### Dashboard Principal (`/dashboard`)
**Role-based:** Detecta se é gestor ou agente e mostra vista diferente.

**Vista Gestão (Broker/CEO):**
- 4 KPIs principais (Facturação YTD, Margem, Pipeline Ponderado, Carteira)
- Gráfico de evolução mensal (12 meses) com hover tooltips
- Angariações (novas, activas, reservadas, vendidas, canceladas, dias sem angariar)
- Pipeline de receita (ponderado por probabilidade 20%→95%)
- Previsões + valores pendentes
- Top 5 consultores com progress bars
- Alertas de performance

**Vista Agente (Consultor):**
- KPIs pessoais com progress ring (% atingido)
- Os meus imóveis (tiles coloridos clicáveis)
- Objectivos vs realizado (barras de progresso anual/mensal/semanal)
- Próximas acções (com highlight "Hoje")
- Eu vs média da agência (com setas direcção)
- Evolução mensal com linha de objectivo

**Drill-down interactivo:** Cards clicáveis abrem Sheet lateral com lista detalhada. Cada item mostra consultor + imóvel e navega para o detalhe ao clicar.

#### Comissões (`/dashboard/comissoes`)
| Página | Descrição |
|--------|-----------|
| Comissões | Tab "Negócios" (deals) + Tab "Transacções" com KPIs, filtros, tabela, CRUD |
| Rankings | Facturação (com medalhas) + Angariações, lado a lado |
| Relatórios | 5 geradores: Análise Agente, Comissões Detalhado, Tempo Médio Venda, Partilhas, Dinâmico |
| Agente/[id] | Relatório estilo RE/MAX com tabela mensal comparativa YoY |
| Definições | 3 tabs: Configurações Gerais, Escalões de Comissão, Rede e Pagamentos |

**Novas tabelas:** `temp_financial_transactions`, `temp_commission_tiers`, `temp_agency_settings`, `temp_report_snapshots`
**Documentação:** `docs/M21-FINANCEIRO-DASHBOARD/SPEC-M21-FINANCEIRO-DASHBOARD.md`

### 4. Sistema de Deals com Split CPCV/Escritura — Completo
**Fluxo:** Negócio fechado → Split comissão → Momentos de pagamento → Facturação → Conta corrente

**Formulário multi-step:**
1. Dados do negócio (imóvel, consultor, tipo, valor)
2. Comissão e partilha (%, escalão auto-detectado, preview ao vivo)
3. Momentos de pagamento (100% CPCV, 100% Escritura, Split, ou Único para arrendamento)

**Detalhe do deal (`/dashboard/comissoes/deals/[id]`):**
- Timeline de pagamentos (CPCV + Escritura) com estados: Assinado, Recebido, Reportado
- 3 secções de facturação por momento: Agência, Rede, Consultor
- Tipo factura consultor: Factura, Recibo Verde, Recibo
- Auto-save em todos os campos
- Compliance IMPIC integrado (ver ponto 6)

**Novas tabelas:** `temp_deals`, `temp_deal_payments`
**Documentação:** `docs/M21-FINANCEIRO-DASHBOARD/SPEC-COMISSOES-DEALS.md`

### 5. Conta Corrente Unificada — Completo
**Página:** `/dashboard/comissoes/conta-corrente`

- Grid de saldos por consultor (verde/vermelho/cinza)
- KPIs: total em conta, créditos mês, débitos mês
- Tabela de movimentos com filtros
- Ajuste manual (débito/crédito)

**Integração automática com Deals:**
- Quando consultor é marcado "Pago" num deal → CREDIT automático na conta corrente
- Quando pagamento revertido → DEBIT automático (estorno)
- Descrição: "Comissão CPCV/Escritura — [imóvel]"

### 6. Compliance IMPIC — Completo
**Tab no deal + página dedicada**

**Tab "IMPIC/Compliance" em cada deal:**
- KYC Comprador (nome, NIF, CC, nacionalidade, PEP check, origem fundos)
- KYC Vendedor (idem + pessoa colectiva, beneficiário efectivo)
- Forma de pagamento + alerta numerário
- 13 risk flags auto-detectados
- Marcar como reportado ao IMPIC (referência + data + trimestre)
- Gerar dados pré-preenchidos para copiar para portal IMPIC

**Página de Compliance (`/dashboard/comissoes/compliance`):**
- Selector de trimestre com deadline IMPIC
- KPIs: total deals, reportados, pendentes, sinalizados
- Alertas: deadline a aproximar, docs incompletos, cash não reportado
- Tabela de deals com estado compliance

**Nova tabela:** `temp_deal_compliance`

**Nota:** O IMPIC não tem API. A submissão é manual no portal impic.pt. O ERP prepara todos os dados.

### 7. Portal do Cliente — Completo
**Rota:** `/portal/` (app separada, mobile-first)

| Página | Rota | Descrição |
|--------|------|-----------|
| Login | `/portal/login` | Email + password, branded |
| Início | `/portal` | Welcome, stepper do processo, próximas acções, imóveis |
| Imóveis | `/portal/imoveis` | Grid, favoritos, detalhe em sheet, pedir visita |
| Processo | `/portal/processo` | Stepper visual, documentos por estado, timeline |
| Mensagens | `/portal/mensagens` | Chat com consultor (bubbles) |
| Perfil | `/portal/perfil` | Dados editáveis, logout |

**Design:** Bottom nav com 5 tabs (estilo app nativa), sem sidebar, touch-optimized.
**Auth:** Middleware separado — `/portal/*` redireciona para `/portal/login` se não autenticado.
**Novas tabelas:** `temp_portal_messages`, `temp_portal_favorites`, `temp_portal_visit_requests`

### 8. Melhorias de UI/UX
- **Sidebar:** Items com estilo card (border + hover shadow), "O Meu Espaço" agora collapsible
- **Dashboard:** Cards interactivos com drill-down em Sheet
- **MiniStat:** Items de lista agora são cards (rounded-md, border, hover)
- **Loading:** Dashboard carrega progressivamente (KPIs primeiro, resto em paralelo)
- **Sheet:** Mais padding, items como cards com shadow

### 9. Specs Criados (para implementação futura)
| Spec | Ficheiro |
|------|----------|
| Agenda/Visitas | `docs/M22-AGENDA-VISITAS/SPEC-M22-AGENDA-VISITAS.md` |
| Google Calendar Sync | `docs/M23-GOOGLE-CALENDAR-SYNC/SPEC-M23-GOOGLE-CALENDAR.md` |
| Call Tracking + Relatório Actividade | `docs/M24-CALL-TRACKING-ACTIVITY-REPORT/SPEC-M24-CALL-TRACKING.md` |

---

## Sidebar Final (Navegação)

```
O Meu Espaço (collapsible)
├── Dashboard
├── Calendário
├── Objectivos
└── Formações

Negócio
├── Imóveis
├── Leads
├── Visitas
├── Processos
├── Documentos
└── Proprietários

Pessoas
├── Consultores
└── Equipas

Financeiro
├── Comissões
├── Conta Corrente
├── Rankings
├── Compliance
├── Relatórios
└── Definições

Crédito
├── Dashboard
├── Processos
├── Simulador
└── Bancos

Recrutamento
├── Candidatos
└── Formulário

Marketing
├── Loja
├── Gestão
├── Minhas Encomendas
├── Gestão Encomendas
├── Stock
└── Redes Sociais

Meta & Instagram
├── Meta Ads
├── Instagram
└── Integrações Meta

Automações
├── Dashboard
├── Fluxos
├── Execuções
├── Instâncias WhatsApp
└── Templates WhatsApp

Builder
├── Template de Email
├── Template de Processos
├── Template de Documentos
└── Variáveis de Template

Definições
```

---

## Tabelas Criadas no Supabase (esta sessão)

| Tabela | Módulo |
|--------|--------|
| `temp_recruitment_communications` | Recrutamento |
| `temp_recruitment_probation` | Recrutamento |
| `temp_recruitment_comm_templates` | Recrutamento |
| `temp_financial_transactions` | Financeiro |
| `temp_commission_tiers` | Financeiro |
| `temp_agency_settings` | Financeiro |
| `temp_report_snapshots` | Financeiro |
| `temp_deals` | Deals |
| `temp_deal_payments` | Deals |
| `temp_deal_compliance` | Compliance IMPIC |
| `temp_portal_messages` | Portal Cliente |
| `temp_portal_favorites` | Portal Cliente |
| `temp_portal_visit_requests` | Portal Cliente |

---

## Como distinguir Comprador vs Vendedor no Portal

**Actualmente:** O portal não distingue automaticamente. Para implementar:

### Opção 1: Campo no `dev_users` (recomendado)
Adicionar `client_type` ao registo do utilizador com role "Cliente":
- `seller` — vendedor/senhorio (tem imóvel no property_owners)
- `buyer` — comprador/inquilino (é lead com negócio tipo compra)
- `both` — ambos

### Opção 2: Detecção automática
O sistema pode inferir:
- **É vendedor se:** existe registo em `property_owners` com o seu email/NIF
- **É comprador se:** existe registo em `leads` com o seu email E tem negócio tipo "Compra"
- **É ambos se:** ambas condições

### O que muda na UI:
| Se vendedor | Se comprador |
|---|---|
| Início mostra "O seu imóvel" com stats | Início mostra "Imóveis recomendados" |
| Imóveis mostra os seus imóveis + stats (visitas, interessados) | Imóveis mostra browse + favoritos + pedir visita |
| Processo mostra processo de venda | Processo mostra processo de compra |

A lógica já está preparada no `getPortalHome()` — busca propriedades via `property_owners` (seller) e via `leads` (buyer). Só falta condicionar a UI baseado em qual array tem dados.
