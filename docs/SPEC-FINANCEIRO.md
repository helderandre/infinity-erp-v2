# SPEC — Modulo Financeiro

**Data:** 2026-03-23
**Versao:** 1.0

---

## 1. Visao Geral

O modulo financeiro unifica tres mapas que antes existiam como ferramentas separadas (folhas de calculo, Notion, etc.) numa unica experiencia integrada com os processos de negocio.

### Os Tres Pilares

| Pilar | Descricao | Fonte de Dados |
|-------|-----------|----------------|
| **Mapa de Gestao** | Acompanhamento operacional de cada negocio: assinatura, recebimento, facturacao, report, pagamento ao consultor | `deals` + `deal_payments` + `proc_instances` |
| **Contas Correntes** | Extracto individual de cada consultor: creditos (comissoes) + debitos (loja marketing, taxas, etc.) | `conta_corrente_transactions` + `conta_corrente_limits` |
| **Gestao da Empresa** | P&L da empresa: custos recorrentes (rendas, software, salarios) + custos pontuais (com OCR de recibos) + receitas (margem da agencia) | `company_transactions` (nova tabela) |

### Dashboard Financeiro

Agrega os tres pilares num painel unico com visao de saude financeira da empresa e dos consultores.

---

## 2. A Cadeia de Comissoes (Como o Dinheiro Flui)

### 2.1. Angariacao Nossa (pleno, comprador_externo, pleno_agencia)

```
Proprietario
  |
  |-- Convictus emite fatura ao Proprietario
  |-- Proprietario paga a Convictus
  |
  v
Convictus (recebe o total da comissao)
  |
  |-- Convictus fica com a sua percentagem (network fee)
  |-- Lecoqimmo (Infinity Group) emite fatura a Convictus
  |-- Convictus paga a Lecoqimmo
  |
  v
Lecoqimmo (recebe a sua parte = agency_margin)
  |
  |-- Consultor emite fatura a Lecoqimmo
  |-- Lecoqimmo paga ao Consultor
  |
  |-- Se partilha: parceiro envia fatura via Convictus
  |      Convictus paga ao parceiro
  |
  v
Consultor (recebe consultant_amount)
```

### 2.2. Angariacao Externa (angariacao_externa)

```
Proprietario
  |
  |-- Outra agencia/franchise cobra ao Proprietario
  |
  v
Convictus (recebe a parte do nosso lado — tipicamente 50%)
  |
  |-- Lecoqimmo emite fatura a Convictus
  |-- Convictus paga a Lecoqimmo
  |
  v
Lecoqimmo → Consultor (mesma cadeia)
```

### 2.3. Ciclo Semanal de Pagamentos

| Dia | Accao |
|-----|-------|
| **Segunda** | Convictus envia conta corrente (confirmacao do que foi assinado/recebido). Lecoqimmo avisa consultor para enviar fatura. |
| **Quinta** | Lecoqimmo emite fatura para Convictus. Convictus paga a Lecoqimmo. |
| **Sexta** | Lecoqimmo paga ao consultor (apos receber fatura dele). |

---

## 3. Momentos de Pagamento por Tipo de Negocio

| Tipo | Momentos | Notas |
|------|----------|-------|
| **Venda** | CPCV + Escritura | Se `cpcv_pct = 0`, apenas Escritura. Split tipico: 30/70 ou 50/50. |
| **Arrendamento** | Contrato unico (single) | Um unico momento de pagamento na assinatura do contrato. |
| **Trespasse** | Contrato unico (single) | Semelhante a arrendamento. |

Cada momento gera registos independentes em `deal_payments` com a distribuicao proporcional:
- `amount` (total da comissao neste momento)
- `network_amount` (Convictus)
- `agency_amount` (Lecoqimmo)
- `consultant_amount` (consultor)
- `partner_amount` (parceiro, se partilha)

---

## 4. Modelo de Dados

### 4.1. Tabelas Existentes (sem alteracoes estruturais)

- **`deals`** — Negocio completo com breakdown de comissao
- **`deal_payments`** — Momentos de pagamento com tracking de status (assinado, recebido, reportado, facturacao, pagamento consultor)
- **`deal_clients`** — Compradores/clientes do negocio
- **`deal_compliance`** — AML/KYC
- **`conta_corrente_transactions`** — Extracto do consultor
- **`conta_corrente_limits`** — Limites de credito

### 4.2. Alteracoes a `deal_payments`

Adicionar campo para ligacao bidirecional com tarefas do processo:

```sql
ALTER TABLE deal_payments
  ADD COLUMN proc_task_id UUID REFERENCES proc_tasks(id),
  ADD COLUMN reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN consultant_invoice_requested_at TIMESTAMPTZ;
```

- `proc_task_id` — Liga este momento de pagamento a uma tarefa especifica do processo (para sync bidirecional)
- `reminder_sent_at` — Quando foi enviado o lembrete ao consultor para enviar fatura
- `consultant_invoice_requested_at` — Quando foi pedida a fatura ao consultor

### 4.3. Alteracoes a `tpl_tasks` (config de eventos financeiros)

O campo `config` (jsonb) das tarefas de template passa a suportar:

```jsonc
{
  "action_type": "FINANCIAL_EVENT",
  "financial_event": {
    "type": "cpcv_signed" | "cpcv_received" | "cpcv_reported" |
            "escritura_signed" | "escritura_received" | "escritura_reported" |
            "single_signed" | "single_received" | "single_reported" |
            "agency_invoice_issued" | "consultant_invoice_received" |
            "consultant_paid" | "partner_invoice_received",
    "payment_moment": "cpcv" | "escritura" | "single",
    "requires_date": true,     // pede data real do evento
    "requires_upload": false,  // pede upload de documento
    "auto_email": false        // envia email automatico
  }
}
```

Quando uma tarefa com `financial_event` e completada:
1. Actualiza o campo correspondente em `deal_payments`
2. Se o campo ja estava preenchido (sync reverso), a tarefa ja aparece completa

### 4.4. Nova Tabela: `company_transactions`

```sql
CREATE TABLE company_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  subcategory TEXT,
  entity_name TEXT,                    -- fornecedor/entidade
  entity_nif TEXT,                     -- NIF do fornecedor
  description TEXT NOT NULL,
  amount_net NUMERIC NOT NULL,         -- valor sem IVA
  amount_gross NUMERIC,                -- valor com IVA
  vat_amount NUMERIC,                  -- valor do IVA
  vat_pct NUMERIC DEFAULT 23,         -- taxa de IVA
  invoice_number TEXT,                 -- numero da fatura
  invoice_date DATE,
  payment_date DATE,                   -- data de pagamento efectivo
  payment_method TEXT,                 -- transferencia, cheque, cartao, etc.
  due_date DATE,                       -- data de vencimento
  is_recurring BOOLEAN DEFAULT false,
  recurring_template_id UUID REFERENCES company_recurring_templates(id),
  receipt_url TEXT,                     -- URL do recibo/fatura (R2)
  receipt_file_name TEXT,
  ai_extracted BOOLEAN DEFAULT false,  -- dados extraidos por IA?
  ai_confidence NUMERIC,               -- confianca da extraccao (0-1)
  reference_type TEXT,                 -- 'deal_payment', 'marketing_order', etc.
  reference_id UUID,                   -- FK generico
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.5. Nova Tabela: `company_recurring_templates`

```sql
CREATE TABLE company_recurring_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                  -- ex: "Renda escritorio Benfica"
  category TEXT NOT NULL,
  subcategory TEXT,
  entity_name TEXT,
  entity_nif TEXT,
  description TEXT,
  amount_net NUMERIC NOT NULL,
  vat_pct NUMERIC DEFAULT 23,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  day_of_month INT DEFAULT 1,         -- dia do mes para gerar
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.6. Nova Tabela: `company_categories`

```sql
CREATE TABLE company_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- ex: "Rendas"
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  icon TEXT,                           -- nome do icone lucide
  color TEXT,                          -- cor para dashboards
  order_index INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,     -- categorias do sistema nao editaveis
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categorias iniciais (seed)
INSERT INTO company_categories (name, type, icon, color, is_system, order_index) VALUES
  ('Comissoes Agencia', 'income', 'Euro', 'emerald', true, 1),
  ('Loja Marketing', 'income', 'ShoppingBag', 'blue', true, 2),
  ('Rendas', 'expense', 'Building', 'red', true, 3),
  ('Software & Subscricoes', 'expense', 'Monitor', 'purple', true, 4),
  ('Salarios', 'expense', 'Users', 'amber', true, 5),
  ('Portais Imobiliarios', 'expense', 'Globe', 'blue', true, 6),
  ('Ofertas Consultores', 'expense', 'Gift', 'pink', true, 7),
  ('Material Fisico', 'expense', 'Package', 'slate', true, 8),
  ('Servicos Profissionais', 'expense', 'Briefcase', 'indigo', true, 9),
  ('Outros', 'both', 'MoreHorizontal', 'slate', false, 99);
```

---

## 5. Ponte Processo ↔ Financeiro (Sync Bidirecional)

### 5.1. Principio

Cada tarefa de processo com `financial_event` no config esta ligada a um campo em `deal_payments`. A sincronizacao e bidirecional:

**Processo → Financeiro:**
Quando uma tarefa com `financial_event` e completada no pipeline:
1. Identificar o `deal_payment` correspondente (via `deal.proc_instance_id` + `payment_moment`)
2. Actualizar o campo correspondente (ex: `is_signed = true`, `signed_date = <data fornecida>`)
3. Se `type = consultant_paid`, criar CREDIT na `conta_corrente_transactions`

**Financeiro → Processo:**
Quando um campo de `deal_payments` e actualizado directamente (via Mapa de Gestao ou API):
1. Encontrar a `proc_task` com o `financial_event` correspondente
2. Se a tarefa ainda esta `pending`, marca-la como `completed`
3. Recalcular progresso do processo

### 5.2. Mapeamento de Eventos

| financial_event | Campo deal_payments | Tipo de Accao no Processo |
|----------------|--------------------|-----------------------------|
| `cpcv_signed` | `is_signed` + `signed_date` (moment=cpcv) | UPLOAD (documento CPCV assinado) + DATA (data real) |
| `cpcv_received` | `is_received` + `received_date` (moment=cpcv) | MANUAL (confirmar recebimento bancario) |
| `cpcv_reported` | `is_reported` + `reported_date` (moment=cpcv) | MANUAL (confirmar report a RE/MAX) |
| `escritura_signed` | `is_signed` + `signed_date` (moment=escritura) | UPLOAD (escritura) + DATA |
| `escritura_received` | `is_received` + `received_date` (moment=escritura) | MANUAL (confirmar recebimento) |
| `escritura_reported` | `is_reported` + `reported_date` (moment=escritura) | MANUAL (confirmar report) |
| `agency_invoice_issued` | `agency_invoice_*` fields | GENERATE_DOC (gerar fatura) + EMAIL (enviar) |
| `consultant_invoice_received` | `consultant_invoice_*` fields | UPLOAD (fatura do consultor) |
| `consultant_paid` | `consultant_paid` + `consultant_paid_date` | MANUAL (confirmar pagamento) → auto-CREDIT em conta corrente |

### 5.3. Tarefas com Data Real

Muitas accoes financeiras acontecem antes de serem registadas no sistema (ex: CPCV assinado ha 3 dias, so hoje fazem upload). Por isso, tarefas com `requires_date: true` pedem sempre:
- **Data real do evento** (campo date picker, pre-filled com hoje)
- **Upload opcional** (se `requires_upload: true`)

A `completed_at` da tarefa reflecte quando foi registada no sistema. A data real vai para o campo correspondente em `deal_payments` (ex: `signed_date`).

---

## 6. Mapa de Gestao (Redesenho)

### 6.1. Estrutura da Pagina

```
/dashboard/comissoes
├── Tab: Mapa de Gestao (default)
├── Tab: Contas Correntes
├── Tab: Gestao da Empresa
└── Tab: Dashboard
```

### 6.2. Mapa de Gestao — Layout

**Hero Header** (estilo loja/dark):
- Titulo: "Mapa de Gestao"
- Subtitulo: Mes/Ano seleccionado
- KPIs inline: Report total | Margem | A receber

**Filtros** (pill bar):
- Periodo (mes selector com setas < >)
- Consultor (select com avatar)
- Estado (Todos | Pendente | Em curso | Concluido)
- Tipo (Venda | Arrendamento | Trespasse)
- Cenario (Pleno | Partilha | etc.)

**Tabela Principal:**

Cada linha e um negocio. As colunas agrupam-se logicamente:

| Grupo | Colunas |
|-------|---------|
| Identificacao | ID/Ref, Consultor (avatar + nome), PV, Data Negocio |
| Assinatura | Tipo (50% Escritura / 100% Escritura / Split), Assinado ✓ (com data) |
| Valores | Valor Negocio, Comissao %, Report (total), Margem, % Consultor, A receber consultor, Convictus, Total Parceiros |
| Facturacao Agencia | Data fatura, N.o fatura Convictus, Destinatario, Valor s/IVA, Valor c/IVA |
| Facturacao Network | Mapa comissoes Remax, Data fatura (Mapa %), N.o FACT. Lecoqimmo |
| Facturacao Consultor | Data fatura consultor %, N.o fatura consultor, Pago ✓ |
| Estado | Ass ✓, Rec ✓, Rep ✓ (3 checkboxes visuais com cores) |

**Cada celula de estado (Ass/Rec/Rep):**
- Vazio: circulo cinzento outline
- Preenchido: circulo preenchido verde com ✓
- Ao clicar: abre popover com date picker para registar data
- Se a accao correspondente foi feita via processo, aparece com badge "via processo"

**Linha expandivel:**
Ao clicar numa linha, expande para mostrar:
- Timeline visual do pagamento (Assinado → Recebido → Fatura emitida → Reportado → Consultor pago)
- Se CPCV + Escritura: duas timelines lado a lado
- Link rapido para o processo associado
- Link para o detalhe do deal (`/comissoes/deals/[id]`)

**Funnel de Totais (abaixo da tabela):**
Cards empilhados (estilo actual mas modernizado):

```
┌─────────────────────────────────────────────┐
│  Report                      34 200,00 EUR  │  ← bg-neutral-900 text-white
├───────────────────────────────────────┐      │
│  A Receber Consultor   5 075,00 EUR  │      │  ← bg-neutral-700 text-white
├─────────────────────────────────┐     │      │
│  Convictus        9 302,40 EUR  │     │      │  ← bg-neutral-500 text-white
├───────────────────────────┐     │     │      │
│  Margem    19 822,60 EUR  │     │     │      │  ← bg-neutral-400 text-white
└───────────────────────────┘     │     │      │
                                  │     │      │
└─────────────────────────────────┘     │      │
                                        │      │
└───────────────────────────────────────┘      │
                                               │
└─────────────────────────────────────────────┘
```

Cards separados abaixo: Total Parceiros | Mapa Comissoes Remax

### 6.3. Accoes na Tabela

Cada linha tem menu de accoes (`...`):
- **Ver processo** → navega para `/dashboard/processos/[proc_id]`
- **Ver negocio** → navega para `/comissoes/deals/[deal_id]`
- **Marcar como recebido** → popover com data
- **Emitir fatura** → abre pre-fill de fatura (futuro: gera PDF)
- **Pedir fatura ao consultor** → envia email pre-preenchido
- **Marcar consultor como pago** → confirma + cria entrada na conta corrente

### 6.4. Design Language

- Tabela com `rounded-2xl border bg-card/30 backdrop-blur-sm`
- Headers `text-[11px] uppercase tracking-wider font-semibold bg-muted/30`
- Rows `hover:bg-muted/30 transition-colors duration-200`
- Checkboxes de estado como circulos coloridos (nao checkboxes nativas)
- Status badges `rounded-full text-[10px] font-medium`
- Valores monetarios `tabular-nums font-semibold`
- Consultor com avatar pequeno (h-6 w-6) + nome

---

## 7. Contas Correntes (Expansao)

### 7.1. O Que Muda

Actualmente a conta corrente so tem **debitos** (compras na loja, taxas). Precisamos de adicionar **creditos** automaticos quando o consultor e pago.

### 7.2. Fluxo de Credito Automatico

Quando `deal_payments.consultant_paid = true`:

```typescript
// Pseudo-codigo do handler
async function onConsultantPaid(dealPayment: DealPayment, deal: Deal) {
  // 1. Buscar saldo actual do consultor
  const currentBalance = await getAgentBalance(deal.consultant_id)

  // 2. Inserir credito
  await insertContaCorrenteTransaction({
    agent_id: deal.consultant_id,
    date: dealPayment.consultant_paid_date,
    type: 'CREDIT',
    category: 'commission_payment',
    amount: dealPayment.consultant_amount,
    description: `Comissao ${deal.reference || ''} — ${
      dealPayment.payment_moment === 'cpcv' ? 'CPCV' :
      dealPayment.payment_moment === 'escritura' ? 'Escritura' : 'Pagamento'
    }`,
    reference_id: dealPayment.id,
    reference_type: 'deal_payment',
    balance_after: currentBalance + dealPayment.consultant_amount,
  })
}
```

### 7.3. Vista do Consultor

A pagina de conta corrente do consultor (`/comissoes/conta-corrente`) ja existe e esta moderna. Adicionamos:

**KPI cards expandidos:**
- Saldo actual (ja existe)
- Total creditos (comissoes recebidas) ← **novo**
- Total debitos (compras + taxas)
- Comissoes pendentes (assinado mas ainda nao pago) ← **novo**

**Tabela de movimentos:**
- Ja existe, mas agora mostra tambem CREDITs com:
  - Descricao: "Comissao REF-2026-001 — CPCV"
  - Categoria: `commission_payment`
  - Link para o negocio/processo

**Mini-card "Proximos recebimentos":**
- Lista de deal_payments onde `is_received = true AND consultant_paid = false`
- Com valor estimado e data provavel (proxima sexta)

---

## 8. Gestao da Empresa

### 8.1. Estrutura da Pagina

**Hero Header:**
- Titulo: "Gestao da Empresa"
- Mes actual
- KPIs: Total Receitas | Total Despesas | Resultado Liquido

**Duas vistas** (toggle):
- **Tabela** (mensal, tipo Mapa de Responsabilidades actual)
- **Categorias** (cards por rubrica com totais)

### 8.2. Vista Tabela

| Linha | Entidade | Vencimento | N.o Fatura | Valor s/IVA | Valor c/IVA | Pagamento | Data Pagamento | Descricao | Rubrica |
|-------|----------|------------|------------|-------------|-------------|-----------|----------------|-----------|---------|

- Linhas pre-preenchidas para despesas recorrentes (rendas, salarios, etc.)
- Botao "+ Adicionar" para despesas pontuais
- Botao "Digitalizar Recibo" para upload + OCR

### 8.3. Vista Categorias

Cards (estilo loja) por rubrica:

```
┌─────────────────────────┐
│ 📦 Rendas               │
│ 1 200,00 EUR / mes      │
│ ───────────────────────  │
│ Escritorio Benfica       │
│ Armazem Amadora          │
│                          │
│ Status: Pago ✓           │
└─────────────────────────┘
```

### 8.4. Receitas Automaticas

Quando `deal_payments.is_received = true` (banco confirmou recebimento):
- Cria `company_transactions` com:
  - `type = 'income'`
  - `category = 'Comissoes Agencia'`
  - `amount_net = agency_amount` (a parte da Lecoqimmo)
  - `reference_type = 'deal_payment'`
  - `reference_id = deal_payment.id`

### 8.5. AI Receipt Scanner

**Fluxo:**
1. Utilizador clica "Digitalizar Recibo"
2. Upload de foto (camera ou ficheiro)
3. Imagem enviada para `POST /api/financial/scan-receipt`
4. GPT-4o analisa e extrai:
   - `entity_name` (fornecedor)
   - `entity_nif` (NIF do fornecedor)
   - `amount_net` + `amount_gross` + `vat_amount`
   - `invoice_number`
   - `invoice_date`
   - `description` (descricao do servico/produto)
   - `category` (sugestao baseada no fornecedor/descricao)
5. Retorna dados pre-preenchidos com `ai_confidence`
6. Utilizador revisa e confirma
7. Cria `company_transactions` com `ai_extracted = true`

**Prompt GPT-4o:**
```
Analisa esta imagem de uma fatura/recibo portuguesa e extrai:
- Nome do fornecedor
- NIF do fornecedor
- Valor sem IVA
- Valor com IVA
- Valor do IVA
- Taxa de IVA (%)
- Numero da fatura
- Data da fatura
- Descricao dos servicos/produtos
- Categoria sugerida: [Rendas, Software & Subscricoes, Salarios, Portais Imobiliarios,
  Ofertas Consultores, Material Fisico, Servicos Profissionais, Outros]

Responde em JSON. Se nao conseguires ler um campo, coloca null.
Inclui um campo "confidence" de 0 a 1 com a tua confianca geral na extraccao.
```

---

## 9. Dashboard Financeiro

### 9.1. Layout

Reutiliza o design do dashboard existente (bento cards) mas com dados financeiros completos.

**Seccao 1: Visao Geral da Empresa**

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Facturacao   │ │ Despesas    │ │ Resultado   │ │ Margem      │
│ 34 200 EUR  │ │  8 450 EUR  │ │ 25 750 EUR  │ │ Liquida 75% │
│ este mes     │ │ este mes    │ │ este mes    │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

- **Facturacao**: SUM de `deal_payments.amount WHERE is_received = true` no periodo
- **Despesas**: SUM de `company_transactions.amount_gross WHERE type = 'expense'` no periodo
- **Resultado**: Facturacao - Despesas - Comissoes Consultores
- **Margem Liquida**: Resultado / Facturacao * 100

**Seccao 2: Pipeline Financeiro**

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Assinado por│ │ Recebido por│ │ A pagar     │
│ receber     │ │ reportar    │ │ consultores │
│ 18 363 EUR  │ │  5 200 EUR  │ │  3 100 EUR  │
└─────────────┘ └─────────────┘ └─────────────┘
```

- `Assinado por receber`: `deal_payments WHERE is_signed AND NOT is_received`
- `Recebido por reportar`: `deal_payments WHERE is_received AND NOT is_reported`
- `A pagar consultores`: `deal_payments WHERE is_received AND NOT consultant_paid`

**Seccao 3: Grafico Evolucao**

Grafico de area (estilo actual) com duas series:
- Report (facturacao total)
- Margem (agency_net)

Periodo: ultimos 12 meses.

**Seccao 4: Previsoes**

Cards baseados no pipeline de processos activos:
- Negocios previstos / a fechar
- Facturacao prevista (com probabilidades por fase)
- Margem prevista

**Seccao 5: Imobiliario em Carteira**

- Volume dos imoveis activos
- Facturacao potencial (volume * comissao media)

### 9.2. Vista por Consultor

Quando filtrado por consultor:
- KPIs: Facturacao do consultor | Comissoes recebidas | Comissoes pendentes | Saldo conta corrente
- Tabela: negocios do consultor com status de pagamento
- Grafico: evolucao mensal

---

## 10. API Routes

### 10.1. Novas Routes

```
POST /api/financial/scan-receipt
  Body: { image: base64 }
  Response: { entity_name, entity_nif, amount_net, amount_gross, vat_amount,
              invoice_number, invoice_date, description, category, confidence }

GET /api/financial/company-transactions
  Query: month, year, category, type, status
  Response: CompanyTransaction[]

POST /api/financial/company-transactions
  Body: CompanyTransactionInput
  Response: CompanyTransaction

PUT /api/financial/company-transactions/[id]
  Body: Partial<CompanyTransactionInput>

DELETE /api/financial/company-transactions/[id]

GET /api/financial/company-categories
  Response: CompanyCategory[]

POST /api/financial/company-categories
  Body: { name, type, icon?, color? }

GET /api/financial/recurring-templates
  Response: CompanyRecurringTemplate[]

POST /api/financial/recurring-templates
  Body: RecurringTemplateInput

PUT /api/financial/recurring-templates/[id]

DELETE /api/financial/recurring-templates/[id]

POST /api/financial/recurring-templates/generate
  Body: { month, year }
  Response: { generated: number }
  Nota: Gera transaccoes para o mes a partir dos templates activos

GET /api/financial/dashboard
  Query: month?, year?, consultant_id?
  Response: FinancialDashboardData

GET /api/financial/mapa-gestao
  Query: month, year, consultant_id?, status?, deal_type?
  Response: MapaGestaoRow[]
```

### 10.2. Alteracoes a Routes Existentes

**`PUT /api/deals/[id]/payments/[paymentId]`** (ou criar se nao existe):
- Ao actualizar `consultant_paid = true`:
  - Inserir CREDIT na `conta_corrente_transactions`
  - Inserir receita em `company_transactions` (se `is_received` tambem true)
- Ao actualizar `is_signed`, `is_received`, `is_reported`:
  - Sincronizar com `proc_tasks` correspondente (se existir ligacao)

**`PUT /api/processes/[id]/tasks/[taskId]`**:
- Se tarefa tem `financial_event` no config:
  - Ao completar: actualizar `deal_payments` correspondente
  - Guardar data real fornecida (nao apenas `completed_at`)

---

## 11. Componentes UI

### 11.1. Novos Componentes

```
components/
├── financial/
│   ├── mapa-gestao-table.tsx          ← Tabela principal do mapa
│   ├── mapa-gestao-funnel.tsx         ← Funnel de totais (Report → Margem)
│   ├── mapa-gestao-row-detail.tsx     ← Linha expandivel com timeline
│   ├── payment-timeline.tsx           ← Timeline visual de um momento de pagamento
│   ├── payment-status-dot.tsx         ← Circulo de estado (vazio/preenchido/verde)
│   ├── financial-dashboard.tsx        ← Dashboard principal
│   ├── financial-kpi-cards.tsx        ← Cards de KPI financeiro
│   ├── financial-pipeline-cards.tsx   ← Pipeline (assinado/recebido/a pagar)
│   ├── company-transaction-form.tsx   ← Formulario de transaccao empresa
│   ├── company-transactions-table.tsx ← Tabela de transaccoes empresa
│   ├── company-categories-grid.tsx    ← Grid de categorias com totais
│   ├── recurring-template-form.tsx    ← Formulario de template recorrente
│   ├── receipt-scanner.tsx            ← Upload + preview + resultado OCR
│   └── receipt-scanner-result.tsx     ← Formulario pre-preenchido pos-OCR
```

### 11.2. Patterns de Design

Todos os componentes seguem o design language da loja:

**Cards:** `rounded-2xl border bg-card/50 backdrop-blur-sm hover:shadow-md transition-all duration-300`

**Headers de seccao:** Dark hero com `bg-neutral-900 rounded-2xl` e texto branco

**Tabelas:** `rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm`

**Botoes:** `rounded-full` (pill style)

**Status dots (Payment Timeline):**
```tsx
// Vazio (pendente)
<div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />

// Em progresso (parcial)
<div className="h-5 w-5 rounded-full border-2 border-amber-500 bg-amber-500/20" />

// Concluido
<div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
  <Check className="h-3 w-3 text-white" />
</div>
```

**Payment Timeline:**
```
○────────○────────○────────○────────●
Assinado  Recebido  Fatura   Report   Pago
                    emitida           consultor
```

Pontos ligados por linha. Cor muda de cinzento (pendente) para verde (concluido) da esquerda para a direita.

**Funnel Chart:**
Cards empilhados com largura decrescente, tons de `neutral-900` a `neutral-400`, com `rounded-2xl` e valores em `text-xl font-bold`.

**Receipt Scanner:**
1. Dropzone com icone de camera (`rounded-2xl border-dashed border-2`)
2. Preview da imagem ao lado do formulario extraido
3. Campos pre-preenchidos com badge "IA" se extraidos automaticamente
4. Barra de confianca colorida (verde >0.8, amarelo >0.5, vermelho <0.5)

---

## 12. Paginas

### 12.1. Estrutura de Navegacao

```
/dashboard/comissoes/                      ← Hub com tabs
  Tab: Mapa de Gestao                      ← Tabela de negocios + funnel
  Tab: Contas Correntes                    ← Ja existe (expandir com creditos)
  Tab: Gestao da Empresa                   ← Novo: P&L empresa
  Tab: Dashboard                           ← Novo: visao global

/dashboard/comissoes/deals/[id]            ← Ja existe (detalhe do deal)
/dashboard/comissoes/conta-corrente        ← Ja existe (extracto consultor)
/dashboard/comissoes/relatorios            ← Ja existe (relatorios)
/dashboard/comissoes/compliance            ← Ja existe (AML/KYC)
/dashboard/comissoes/definicoes            ← Ja existe (tiers, settings)
```

### 12.2. Pagina: Mapa de Gestao

**Ficheiro:** `components/financial/mapa-gestao-tab.tsx`

**Seccoes:**
1. Hero header com mes + KPIs
2. Filtros (pill bar)
3. Tabela com scroll horizontal
4. Funnel de totais
5. Cards: Total Parceiros | Mapa Comissoes Remax

### 12.3. Pagina: Gestao da Empresa

**Ficheiro:** `components/financial/company-management-tab.tsx`

**Seccoes:**
1. Hero header com KPIs (Receitas | Despesas | Resultado)
2. Toggle: Tabela / Categorias
3. Accoes: + Adicionar | Digitalizar Recibo | Gerar Recorrentes
4. Tabela ou grid de categorias

### 12.4. Pagina: Dashboard

**Ficheiro:** `components/financial/financial-dashboard-tab.tsx`

**Seccoes:**
1. KPIs globais
2. Pipeline financeiro
3. Grafico evolucao 12 meses
4. Previsoes
5. Portfolio imobiliario

---

## 13. Integracao com Processos de Negocio

### 13.1. Sidebar "Financeiro" no Processo

Para processos de tipo `negocio`, adicionar seccao "Financeiro" no sidebar:

```typescript
// Sidebar item
{ key: 'financeiro', label: 'Financeiro', icon: Euro }
```

**Conteudo:**
- Card com resumo do deal (valor, comissao, cenario)
- Payment timeline(s) — uma por momento de pagamento
- Link rapido para `/comissoes/deals/[deal_id]`
- Mini Mapa de Gestao: os campos Ass/Rec/Rep/Pago como dots clicaveis

### 13.2. Template Tasks Financeiras

Ao criar templates para processos de negocio, o builder permite configurar tarefas com `action_type = 'FINANCIAL_EVENT'` e escolher o tipo de evento. Isto cria a ligacao automatica.

**Exemplo de template "Processo de Venda":**

```
Fase 1: CPCV
  ├── Tarefa: CPCV Assinado          → financial_event: cpcv_signed
  ├── Tarefa: Confirmar Recebimento   → financial_event: cpcv_received
  ├── Tarefa: Emitir Fatura Agencia   → financial_event: agency_invoice_issued (moment=cpcv)
  └── Tarefa: Reportar                → financial_event: cpcv_reported

Fase 2: Escritura
  ├── Tarefa: Escritura Celebrada     → financial_event: escritura_signed
  ├── Tarefa: Confirmar Recebimento   → financial_event: escritura_received
  ├── Tarefa: Emitir Fatura Agencia   → financial_event: agency_invoice_issued (moment=escritura)
  └── Tarefa: Reportar                → financial_event: escritura_reported

Fase 3: Pagamento Consultor
  ├── Tarefa: Pedir Fatura Consultor  → email pre-preenchido
  ├── Tarefa: Receber Fatura          → financial_event: consultant_invoice_received
  └── Tarefa: Pagar Consultor         → financial_event: consultant_paid
```

---

## 14. Lembretes e Automacoes

### 14.1. Lembretes Semanais (Baseados no Ciclo)

| Dia | Accao Automatica |
|-----|------------------|
| Segunda 09:00 | Verificar `deal_payments WHERE is_signed AND NOT consultant_invoice_requested_at` → Enviar email ao consultor a pedir fatura |
| Quinta 09:00 | Verificar `deal_payments WHERE is_received AND NOT agency_invoice_*` → Lembrete para emitir fatura a Convictus |
| Sexta 09:00 | Verificar `deal_payments WHERE consultant_invoice_number IS NOT NULL AND NOT consultant_paid` → Lembrete para pagar consultor |

### 14.2. Geracao Automatica de Recorrentes

No inicio de cada mes, um cron job (ou accao manual) gera `company_transactions` a partir de `company_recurring_templates` activos.

---

## 15. Ordem de Implementacao

### Sprint 1: Fundacao
1. Migracao DB: `company_transactions`, `company_recurring_templates`, `company_categories`, alteracoes a `deal_payments`
2. API routes basicas: CRUD company transactions, categories, recurring templates
3. Tipos TypeScript + validacoes Zod

### Sprint 2: Mapa de Gestao
4. `GET /api/financial/mapa-gestao` — query agregada
5. Componente `mapa-gestao-tab.tsx` com tabela + funnel
6. Accoes inline (marcar assinado/recebido/reportado com data)
7. Linha expandivel com payment timeline

### Sprint 3: Ponte Processo ↔ Financeiro
8. Logica de sync bidirecional (tarefa ↔ deal_payment)
9. `action_type = 'FINANCIAL_EVENT'` no template builder
10. Seccao "Financeiro" no sidebar do processo de negocio

### Sprint 4: Conta Corrente (creditos)
11. Auto-CREDIT quando `consultant_paid = true`
12. KPIs expandidos (creditos + pendentes)
13. Card "Proximos recebimentos"

### Sprint 5: Gestao da Empresa
14. CRUD company transactions (UI)
15. Gestao de templates recorrentes
16. Geracao automatica mensal
17. `POST /api/financial/scan-receipt` (OCR com GPT-4o)
18. Componente receipt-scanner

### Sprint 6: Dashboard
19. `GET /api/financial/dashboard`
20. Dashboard com KPIs, pipeline, grafico, previsoes
21. Vista por consultor

### Sprint 7: Automacoes
22. Lembretes semanais (emails)
23. Emails pre-preenchidos para facturacao
24. Notificacoes in-app para eventos financeiros
