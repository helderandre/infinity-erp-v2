# SPEC — Comissões e Deals (Fluxo Completo)

## Visão Geral

Quando um negócio é fechado (venda, arrendamento ou trespasse), gera comissões que são divididas entre a rede RE/MAX, a agência e o consultor. O pagamento pode ocorrer em **1 ou 2 momentos** (CPCV e/ou Escritura), com percentagens configuráveis.

---

## 1. Fluxo de um Negócio (Venda)

```
Imóvel vendido
  │
  ├─ O negócio é registado com:
  │    - Valor da transacção (ex: 200.000€)
  │    - % comissão (ex: 5%)
  │    - Se há partilha com outra agência (e qual %)
  │
  ├─ O sistema calcula automaticamente:
  │    - Comissão total: 200.000 × 5% = 10.000€
  │    - Se partilha 50/50 → nossa parte = 5.000€
  │    - Rede RE/MAX (ex: 8%) → 5.000 × 8% = 400€
  │    - Margem agência: 5.000 - 400 = 4.600€
  │    - Consultor (ex: escalão 50%) → 4.600 × 50% = 2.300€
  │    - Líquido agência: 4.600 - 2.300 = 2.300€
  │
  ├─ Momentos de pagamento (configurável por deal):
  │    Opção A: Tudo no CPCV (100%)
  │    Opção B: Tudo na Escritura (100%)
  │    Opção C: Split (ex: 30% CPCV + 70% Escritura)
  │
  ├─ Para CADA momento:
  │    1. Assinatura → marcar como "Assinado"
  │    2. Recebimento → marcar como "Recebido"
  │    3. Report → marcar como "Reportado à rede"
  │    4. Facturação:
  │       - Agência emite factura ao cliente
  │       - Rede emite factura à agência
  │       - Consultor emite factura/recibo à agência
  │    5. Pagamento ao consultor → marcar como "Pago"
  │
  └─ Deal completo quando todos os momentos estão pagos
```

## 2. Fluxo de Arrendamento

O arrendamento é diferente:

```
Imóvel arrendado
  │
  ├─ Comissão = geralmente 1 renda (ou valor configurável)
  │    - Não há CPCV — é um único momento de pagamento
  │    - Pode ou não ter partilha
  │
  ├─ O sistema calcula:
  │    - Comissão total: valor da renda (ex: 800€)
  │    - Rede RE/MAX: 800 × 8% = 64€
  │    - Margem: 800 - 64 = 736€
  │    - Consultor: 736 × 50% = 368€
  │    - Agência: 368€
  │
  └─ Um único momento de pagamento (assinatura do contrato)
```

---

## 3. Tabelas de Base de Dados

### 3.1 `temp_deals` — O negócio fechado

Registo principal de cada deal. Criado quando um negócio é confirmado.

```sql
CREATE TABLE temp_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referências
  property_id UUID REFERENCES dev_properties(id),
  consultant_id UUID REFERENCES dev_users(id),
  proc_instance_id UUID,  -- processo associado (se existir)
  reference TEXT,          -- Refª interna do negócio
  pv_number TEXT,          -- PV nº (número processo venda)

  -- Tipo e valor
  deal_type TEXT NOT NULL,  -- 'venda' | 'arrendamento' | 'trespasse'
  deal_value NUMERIC NOT NULL,  -- valor da transacção
  deal_date DATE NOT NULL,       -- data do negócio

  -- Comissão total
  commission_pct NUMERIC NOT NULL,       -- % comissão (ex: 5)
  commission_total NUMERIC NOT NULL,     -- € = deal_value × commission_pct / 100

  -- Partilha (se aplicável)
  has_share BOOLEAN DEFAULT false,
  share_type TEXT,                -- 'internal' | 'external' | 'network'
  share_pct NUMERIC,             -- % que é nossa (ex: 50)
  share_amount NUMERIC,          -- € nossa parte após partilha
  partner_agency_name TEXT,      -- nome da agência parceira
  partner_contact TEXT,          -- contacto da agência parceira
  partner_amount NUMERIC,        -- € para parceiro

  -- Rede RE/MAX
  network_pct NUMERIC,           -- % da rede (vem das definições, ex: 8)
  network_amount NUMERIC,        -- € rede

  -- Margem agência
  agency_margin NUMERIC,         -- € margem = share_amount - network_amount
  consultant_pct NUMERIC,        -- % consultor (do escalão aplicável)
  consultant_amount NUMERIC,     -- € consultor
  agency_net NUMERIC,            -- € líquido agência = margin - consultant

  -- Momentos de pagamento
  payment_structure TEXT NOT NULL DEFAULT 'escritura',
    -- 'cpcv_only'    → 100% no CPCV
    -- 'escritura_only' → 100% na Escritura
    -- 'split'        → % CPCV + % Escritura
    -- 'single'       → para arrendamentos (momento único)
  cpcv_pct NUMERIC DEFAULT 0,         -- % paga no CPCV (ex: 30)
  escritura_pct NUMERIC DEFAULT 100,  -- % paga na Escritura (ex: 70)

  -- Estado global
  status TEXT DEFAULT 'draft',
    -- 'draft'      → rascunho, a preencher
    -- 'active'     → deal confirmado, a decorrer
    -- 'completed'  → todos os pagamentos concluídos
    -- 'cancelled'  → deal cancelado
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES dev_users(id)
);

CREATE INDEX idx_deals_property ON temp_deals(property_id);
CREATE INDEX idx_deals_consultant ON temp_deals(consultant_id);
CREATE INDEX idx_deals_status ON temp_deals(status);
CREATE INDEX idx_deals_date ON temp_deals(deal_date);
CREATE INDEX idx_deals_type ON temp_deals(deal_type);
```

### 3.2 `temp_deal_payments` — Momentos de pagamento

Cada deal tem 1 ou 2 registos (CPCV e/ou Escritura). Para arrendamento, tem 1 registo (single).

```sql
CREATE TABLE temp_deal_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES temp_deals(id) ON DELETE CASCADE,

  -- Momento
  payment_moment TEXT NOT NULL,
    -- 'cpcv' | 'escritura' | 'single' (arrendamento)
  payment_pct NUMERIC NOT NULL,     -- % do total (ex: 30 para CPCV)
  amount NUMERIC NOT NULL,          -- € deste momento

  -- Split deste momento
  network_amount NUMERIC,
  agency_amount NUMERIC,
  consultant_amount NUMERIC,
  partner_amount NUMERIC,

  -- ── Estados ──
  is_signed BOOLEAN DEFAULT false,    -- Assinado
  signed_date DATE,
  is_received BOOLEAN DEFAULT false,  -- Pagamento recebido
  received_date DATE,
  is_reported BOOLEAN DEFAULT false,  -- Reportado à rede
  reported_date DATE,

  -- ── Factura Agência (emitida ao cliente) ──
  agency_invoice_number TEXT,         -- N. FACT. da agência
  agency_invoice_date DATE,
  agency_invoice_recipient TEXT,      -- Destinatário (comprador/vendedor)
  agency_invoice_recipient_nif TEXT,  -- NIF do destinatário
  agency_invoice_amount_net NUMERIC,  -- valor sem IVA
  agency_invoice_amount_gross NUMERIC,-- valor com IVA
  agency_invoice_id TEXT,             -- ID no sistema de facturação externo

  -- ── Factura Rede (emitida pela rede à agência) ──
  network_invoice_number TEXT,        -- N. FACT. Lecoqimmo/RE/MAX
  network_invoice_date DATE,

  -- ── Factura/Recibo Consultor (emitida pelo consultor à agência) ──
  consultant_invoice_number TEXT,     -- Nº factura ou recibo verde
  consultant_invoice_date DATE,
  consultant_invoice_type TEXT,       -- 'factura' | 'recibo_verde' | 'recibo'
  consultant_paid BOOLEAN DEFAULT false,
  consultant_paid_date DATE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_payments_deal ON temp_deal_payments(deal_id);
CREATE INDEX idx_deal_payments_moment ON temp_deal_payments(payment_moment);
CREATE INDEX idx_deal_payments_signed ON temp_deal_payments(is_signed);
CREATE INDEX idx_deal_payments_received ON temp_deal_payments(is_received);
```

### 3.3 Actualizar `temp_agency_settings` — Novas definições

Adicionar às definições financeiras existentes:

```sql
INSERT INTO temp_agency_settings (key, value, description) VALUES
  ('network_name', 'RE/MAX', 'Nome da rede imobiliária'),
  ('network_pct', '8', 'Percentagem fixa da rede sobre o report (%)'),
  ('default_cpcv_pct', '30', 'Percentagem padrão paga no CPCV (%)'),
  ('default_escritura_pct', '70', 'Percentagem padrão paga na Escritura (%)'),
  ('default_rent_commission', '1', 'Nº de rendas de comissão no arrendamento'),
  ('vat_rate_services', '23', 'Taxa IVA para serviços de mediação (%)')
ON CONFLICT (key) DO NOTHING;
```

---

## 4. Cálculo Automático da Comissão

Quando o utilizador preenche o deal, o sistema calcula automaticamente:

```typescript
function calculateDealCommission(input: {
  deal_value: number
  commission_pct: number
  has_share: boolean
  share_pct: number       // % nossa (ex: 50)
  network_pct: number     // % rede (ex: 8) — das definições
  consultant_pct: number  // % consultor — do escalão aplicável
}) {
  // 1. Comissão total
  const commission_total = input.deal_value * (input.commission_pct / 100)

  // 2. Partilha
  const share_amount = input.has_share
    ? commission_total * (input.share_pct / 100)
    : commission_total
  const partner_amount = commission_total - share_amount

  // 3. Rede
  const network_amount = share_amount * (input.network_pct / 100)

  // 4. Margem agência
  const agency_margin = share_amount - network_amount

  // 5. Consultor
  const consultant_amount = agency_margin * (input.consultant_pct / 100)

  // 6. Líquido agência
  const agency_net = agency_margin - consultant_amount

  return {
    commission_total,
    share_amount,
    partner_amount,
    network_amount,
    agency_margin,
    consultant_amount,
    agency_net,
  }
}
```

### Determinação automática do escalão

```typescript
function getConsultantTier(
  deal_value: number,
  deal_type: 'venda' | 'arrendamento',
  tiers: CommissionTier[]
): CommissionTier | null {
  const applicable = tiers
    .filter(t => t.business_type === deal_type && t.is_active)
    .sort((a, b) => a.order_index - b.order_index)

  return applicable.find(t =>
    deal_value >= t.min_value &&
    (t.max_value === null || deal_value < t.max_value)
  ) || null
}
```

---

## 5. Geração dos Momentos de Pagamento

Quando o deal é criado/confirmado, o sistema gera automaticamente os registos de `temp_deal_payments`:

```typescript
function generatePayments(deal: Deal) {
  const payments = []

  if (deal.deal_type === 'arrendamento') {
    // Arrendamento: momento único
    payments.push({
      payment_moment: 'single',
      payment_pct: 100,
      amount: deal.commission_total,
      network_amount: deal.network_amount,
      agency_amount: deal.agency_net,
      consultant_amount: deal.consultant_amount,
      partner_amount: deal.partner_amount,
    })
  } else if (deal.payment_structure === 'cpcv_only') {
    payments.push({
      payment_moment: 'cpcv',
      payment_pct: 100,
      amount: deal.commission_total,
      // ... split completo
    })
  } else if (deal.payment_structure === 'escritura_only') {
    payments.push({
      payment_moment: 'escritura',
      payment_pct: 100,
      amount: deal.commission_total,
      // ... split completo
    })
  } else {
    // Split CPCV + Escritura
    const cpcvAmount = deal.commission_total * (deal.cpcv_pct / 100)
    const escrituraAmount = deal.commission_total - cpcvAmount

    payments.push(
      {
        payment_moment: 'cpcv',
        payment_pct: deal.cpcv_pct,
        amount: cpcvAmount,
        network_amount: deal.network_amount * (deal.cpcv_pct / 100),
        agency_amount: deal.agency_net * (deal.cpcv_pct / 100),
        consultant_amount: deal.consultant_amount * (deal.cpcv_pct / 100),
        partner_amount: deal.partner_amount * (deal.cpcv_pct / 100),
      },
      {
        payment_moment: 'escritura',
        payment_pct: deal.escritura_pct,
        amount: escrituraAmount,
        network_amount: deal.network_amount * (deal.escritura_pct / 100),
        agency_amount: deal.agency_net * (deal.escritura_pct / 100),
        consultant_amount: deal.consultant_amount * (deal.escritura_pct / 100),
        partner_amount: deal.partner_amount * (deal.escritura_pct / 100),
      }
    )
  }

  return payments
}
```

---

## 6. Interface — Páginas e Componentes

### 6.1 Criar Deal (Dialog ou página dedicada)

**Acesso:** Botão "Registar Negócio" na página de Comissões, ou a partir do detalhe do imóvel.

**Formulário em steps:**

**Step 1 — Dados do negócio:**
- Imóvel (select com autocomplete)
- Consultor (auto-preenchido se vem do imóvel)
- Tipo (Venda / Arrendamento / Trespasse)
- Valor da transacção
- Data do negócio
- Referência / PV nº

**Step 2 — Comissão e partilha:**
- % Comissão (ou valor fixo)
- Tem partilha? (toggle)
  - Se sim: tipo (interna/externa/rede), % nossa, nome parceiro
- Escalão (auto-detectado, editável)
- % Consultor (do escalão, editável)

→ **Preview ao vivo** com todos os valores calculados:
```
┌─────────────────────────────────────────┐
│  Comissão total:         10.000€        │
│  Nossa parte (50%):       5.000€        │
│  Parceiro:                5.000€        │
│  ────────────────────────────────        │
│  Rede RE/MAX (8%):          400€        │
│  Margem agência:          4.600€        │
│  Consultor (50%):         2.300€        │
│  Líquido agência:         2.300€        │
└─────────────────────────────────────────┘
```

**Step 3 — Momentos de pagamento:**
- Estrutura: (radio)
  - 100% CPCV
  - 100% Escritura
  - Split CPCV/Escritura (inputs para %)
  - Momento único (arrendamento — auto-seleccionado)

→ **Preview dos momentos:**
```
┌─────────────────────────────────────────┐
│  CPCV (30%):              3.000€        │
│    Rede: 120€ | Agência: 690€           │
│    Consultor: 690€ | Parceiro: 1.500€   │
│  ────────────────────────────────        │
│  Escritura (70%):         7.000€        │
│    Rede: 280€ | Agência: 1.610€         │
│    Consultor: 1.610€ | Parceiro: 3.500€ │
└─────────────────────────────────────────┘
```

### 6.2 Detalhe do Deal

**Rota:** `/dashboard/comissoes/deals/[id]`

Layout com 3 secções:

**Cabeçalho:** Imóvel, consultor, tipo, valor, refª, estado global

**Secção central — Timeline de pagamentos:**
Cada momento (CPCV / Escritura / Single) como um card expandível com:

```
┌──────────────────────────────────────────────────┐
│  CPCV — 3.000€ (30%)                    [badge]  │
│  ─────────────────────────────────────────────    │
│  ☑ Assinado      12/03/2026                      │
│  ☐ Recebido      —                               │
│  ☐ Reportado     —                               │
│  ─────────────────────────────────────────────    │
│  Factura Agência                                  │
│    Nº: [input]  Data: [date]                     │
│    Destinatário: [input]  NIF: [input]           │
│    Valor s/IVA: 2.439€  c/IVA: 3.000€           │
│  ─────────────────────────────────────────────    │
│  Factura Rede                                     │
│    Nº: [input]  Data: [date]                     │
│  ─────────────────────────────────────────────    │
│  Factura Consultor                                │
│    Tipo: [Factura ▾]  Nº: [input]  Data: [date]  │
│    ☐ Pago ao consultor  Data: [date]             │
└──────────────────────────────────────────────────┘
```

**Secção lateral — Resumo financeiro:**
Todos os valores do split (commission, partilha, rede, margem, consultor, agência)

### 6.3 Lista de Deals na página Comissões

Adicionar uma tab ou secção "Negócios" na página principal de comissões com:
- Tabela de deals com filtros (consultor, tipo, estado, período)
- Colunas: Data, Imóvel, Consultor, Tipo, Valor, Comissão, Estado, Momentos (badges CPCV/Escritura com estado)
- Click → abre detalhe

### 6.4 Definições (adicionar à página existente)

Nova tab "Rede e Comissões" nas definições financeiras:
- Nome da rede (text)
- % Rede (number)
- % CPCV padrão (number)
- % Escritura padrão (number)
- Comissão arrendamento padrão (number — nº de rendas)
- Taxa IVA mediação (number)

---

## 7. Integração com Sistema de Facturação

### Fase 1 — Dados de facturação no ERP (agora)

O ERP guarda todos os dados necessários para a factura:
- Nº, data, destinatário, NIF, valor sem/com IVA
- O utilizador preenche manualmente o nº de factura após emiti-la no software externo
- O ERP mostra quais facturas estão por emitir

### Fase 2 — Integração API (futuro)

Preparar a estrutura para ligar a um software de facturação via API.

**Campos já preparados na tabela:**
- `agency_invoice_id` — ID da factura no sistema externo
- Todos os dados necessários para criar a factura via API

**Fluxo futuro com API:**
```
Deal payment recebido
  │
  ├─ Botão "Emitir Factura" no ERP
  │    ↓
  ├─ ERP chama API do software (Moloni / InvoiceXpress / etc.)
  │    - Envia: destinatário, NIF, valor, IVA, descrição
  │    ↓
  ├─ Software devolve: nº factura, PDF
  │    ↓
  ├─ ERP guarda nº e link do PDF
  │    ↓
  └─ Factura disponível para download no ERP
```

**Campos a adicionar na integração futura:**
```sql
-- Na tabela temp_agency_settings:
-- billing_provider: 'moloni' | 'invoicexpress' | 'manual'
-- billing_api_key: encrypted
-- billing_api_url: endpoint

-- Na tabela temp_deal_payments:
-- agency_invoice_pdf_url: link para o PDF
-- network_invoice_pdf_url
-- consultant_invoice_pdf_url
```

### Software compatíveis em Portugal

| Software | API | Adequação | Notas |
|----------|-----|-----------|-------|
| Moloni | REST | Muito boa | Popular em imobiliárias, SAFT-PT nativo |
| InvoiceXpress | REST | Boa | Simples, bom preço, API bem documentada |
| Jasmin (Primavera) | REST | Boa | Mais empresarial |
| PHC GO | REST | Média | Mais complexo |
| Sage | REST | Média | Menos usado em PMEs |

---

## 8. Server Actions Necessárias

### Deals CRUD
```typescript
getDeals(filters?) → lista com joins (property, consultant, payments)
getDeal(id) → deal completo com payments e toda a info
createDeal(data) → cria deal + gera payments automaticamente
updateDeal(id, data) → actualiza (recalcula se valores mudaram)
cancelDeal(id) → cancela deal e payments
```

### Payments
```typescript
updatePaymentStatus(id, field, value) → toggle signed/received/reported
updatePaymentInvoice(id, invoiceData) → preenche dados de factura
markConsultantPaid(id, date) → marca como pago ao consultor
```

### Cálculos
```typescript
calculateDealPreview(input) → preview dos valores sem guardar
getApplicableTier(dealValue, dealType) → escalão aplicável
```

### Dashboard KPIs (actualizar existentes)
```typescript
// Actualizar getManagementDashboard para usar temp_deals em vez de temp_financial_transactions
// para os KPIs de reporting e margem
```

---

## 9. Relação com Módulos Existentes

### → Imóveis (M03)
- Quando um imóvel é vendido/arrendado, criar deal a partir do detalhe do imóvel
- Tab "Negócio" no detalhe do imóvel mostra o deal associado

### → Processos (M06)
- O deal pode estar ligado a um proc_instance
- Quando o processo chega à fase de CPCV/Escritura, sugerir criar deal payment

### → Objectivos (M16)
- Quando um deal é confirmado, registar actividade no goal_activity_log
- Revenue do deal alimenta os KPIs de facturação do consultor

### → Dashboard (M21)
- KPIs de facturação/margem/pendentes calculados a partir de temp_deals
- Ranking de consultores baseado em deals confirmados

---

## 10. Tipos TypeScript

```typescript
// types/deal.ts

export type DealType = 'venda' | 'arrendamento' | 'trespasse'
export type DealStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type PaymentStructure = 'cpcv_only' | 'escritura_only' | 'split' | 'single'
export type PaymentMoment = 'cpcv' | 'escritura' | 'single'
export type ShareType = 'internal' | 'external' | 'network'
export type ConsultantInvoiceType = 'factura' | 'recibo_verde' | 'recibo'

export interface Deal {
  id: string
  property_id: string | null
  consultant_id: string
  proc_instance_id: string | null
  reference: string | null
  pv_number: string | null
  deal_type: DealType
  deal_value: number
  deal_date: string
  commission_pct: number
  commission_total: number
  has_share: boolean
  share_type: ShareType | null
  share_pct: number | null
  share_amount: number | null
  partner_agency_name: string | null
  partner_contact: string | null
  partner_amount: number | null
  network_pct: number | null
  network_amount: number | null
  agency_margin: number | null
  consultant_pct: number | null
  consultant_amount: number | null
  agency_net: number | null
  payment_structure: PaymentStructure
  cpcv_pct: number
  escritura_pct: number
  status: DealStatus
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Joins
  property?: { id: string; title: string; external_ref: string } | null
  consultant?: { id: string; commercial_name: string } | null
  payments?: DealPayment[]
}

export interface DealPayment {
  id: string
  deal_id: string
  payment_moment: PaymentMoment
  payment_pct: number
  amount: number
  network_amount: number | null
  agency_amount: number | null
  consultant_amount: number | null
  partner_amount: number | null
  is_signed: boolean
  signed_date: string | null
  is_received: boolean
  received_date: string | null
  is_reported: boolean
  reported_date: string | null
  agency_invoice_number: string | null
  agency_invoice_date: string | null
  agency_invoice_recipient: string | null
  agency_invoice_recipient_nif: string | null
  agency_invoice_amount_net: number | null
  agency_invoice_amount_gross: number | null
  agency_invoice_id: string | null
  network_invoice_number: string | null
  network_invoice_date: string | null
  consultant_invoice_number: string | null
  consultant_invoice_date: string | null
  consultant_invoice_type: ConsultantInvoiceType | null
  consultant_paid: boolean
  consultant_paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DealCommissionPreview {
  commission_total: number
  share_amount: number
  partner_amount: number
  network_amount: number
  agency_margin: number
  consultant_amount: number
  agency_net: number
  tier_name: string | null
  payments: {
    moment: PaymentMoment
    pct: number
    amount: number
    network: number
    agency: number
    consultant: number
    partner: number
  }[]
}

// Constants

export const DEAL_TYPES: Record<DealType, string> = {
  venda: 'Venda',
  arrendamento: 'Arrendamento',
  trespasse: 'Trespasse',
}

export const DEAL_STATUSES: Record<DealStatus, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  active: { label: 'Activo', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
}

export const PAYMENT_STRUCTURES: Record<PaymentStructure, string> = {
  cpcv_only: '100% no CPCV',
  escritura_only: '100% na Escritura',
  split: 'Split CPCV / Escritura',
  single: 'Momento Único',
}

export const PAYMENT_MOMENTS: Record<PaymentMoment, string> = {
  cpcv: 'CPCV',
  escritura: 'Escritura',
  single: 'Pagamento Único',
}

export const CONSULTANT_INVOICE_TYPES: Record<ConsultantInvoiceType, string> = {
  factura: 'Factura',
  recibo_verde: 'Recibo Verde',
  recibo: 'Recibo',
}
```

---

## 11. Ficheiros a Criar

| Ficheiro | Descrição |
|----------|-----------|
| `types/deal.ts` | Todos os tipos |
| `app/dashboard/comissoes/deals/actions.ts` | Server actions para deals |
| `app/dashboard/comissoes/deals/[id]/page.tsx` | Detalhe do deal |
| `components/financial/deal-form.tsx` | Formulário multi-step de criação |
| `components/financial/deal-preview.tsx` | Preview de cálculo ao vivo |
| `components/financial/deal-payment-card.tsx` | Card de momento de pagamento |
| `components/financial/deal-summary.tsx` | Resumo financeiro lateral |
| `lib/financial/calculations.ts` | Funções de cálculo de comissão |

---

## 12. Migração dos Dados do Glide

Se os dados do Glide precisarem de ser migrados:

1. Exportar CSV do Glide
2. Mapear campos:
   - `ID` → `property_id` (lookup por external_ref)
   - `Consultor` → `consultant_id` (lookup por nome)
   - `Valor` → `deal_value`
   - `%` → `commission_pct`
   - `Partilha` → `share_pct`
   - `% Consultor` → `consultant_pct`
   - Etc.
3. Script de importação que cria deals + payments
4. Validar totais antes/depois
