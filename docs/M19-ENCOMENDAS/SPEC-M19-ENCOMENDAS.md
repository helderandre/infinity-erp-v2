# M19 — Encomendas (Materiais Fisicos & Stock)

## Visao Geral

Sistema interno de requisicao, gestao de stock e rastreio de encomendas de materiais fisicos para a imobiliaria. Os consultores requisitam materiais (placas, cartoes de visita, flyers, brindes, roll-ups, etc.), a equipa de marketing/office manager gere o stock, encomendas a fornecedores, e entregas. Os custos sao debitados na **conta corrente** do consultor (integracao com o sistema existente `conta_corrente_transactions`).

---

## 1. Conceitos Chave

| Conceito | Descricao |
|----------|-----------|
| **Produto** | Item fisico no catalogo (placa de venda, cartao de visita, flyer A4, brinde) |
| **Variante** | Variacao de um produto (ex: placa "Vende-se" vs "Arrenda-se", cartao com foto A vs foto B) |
| **Fornecedor** | Empresa que produz/fornece os materiais |
| **Stock** | Quantidade disponivel em armazem/escritorio |
| **Requisicao** | Pedido de um consultor para obter material |
| **Encomenda ao Fornecedor** | Pedido feito ao fornecedor para reabastecer stock |
| **Personalizavel** | Item que precisa de customizacao (nome do consultor, foto, dados do imovel) |

---

## 2. Fluxo Principal

```
Consultor cria Requisicao
       |
       v
  [Aprovacao necessaria?]
       |           |
      Sim         Nao (auto-approve)
       |           |
       v           v
  Manager aprova   |
       |           |
       v           v
  [Ha stock?] <----+
       |           |
      Sim         Nao
       |           |
       v           v
  Reserva stock   Cria encomenda ao fornecedor
       |           |
       v           v
  Prepara entrega  Fornecedor entrega
       |           |
       v           v
  Entrega ao      Recepcao + actualiza stock
  consultor        |
       |           v
       v        Reserva stock → Entrega
  Debita conta corrente
```

---

## 3. Base de Dados — Tabelas (prefixo TEMP)

### 3.1 TEMP_product_categories

Categorias de produtos fisicos.

```sql
CREATE TABLE TEMP_product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- ex: "Placas", "Cartoes de Visita", "Flyers", "Brindes", "Sinaletica", "Roll-ups"
  description TEXT,
  icon TEXT,                           -- nome do icone Lucide (ex: "signpost", "credit-card", "file-text")
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 TEMP_suppliers

Fornecedores de materiais.

```sql
CREATE TABLE TEMP_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,                   -- pessoa de contacto
  email TEXT,
  phone TEXT,
  website TEXT,
  nif TEXT UNIQUE,                     -- NIF do fornecedor
  address TEXT,
  city TEXT,
  postal_code TEXT,
  notes TEXT,                          -- notas internas (ex: "entrega em 3 dias uteis para placas")
  average_delivery_days INT,           -- prazo medio de entrega
  payment_terms TEXT,                  -- ex: "30 dias", "pagamento imediato", "transferencia a 15 dias"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 TEMP_products

Catalogo de produtos fisicos.

```sql
CREATE TABLE TEMP_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES TEMP_product_categories(id),
  supplier_id UUID REFERENCES TEMP_suppliers(id),         -- fornecedor preferencial
  name TEXT NOT NULL,                  -- ex: "Placa Vende-se Standard"
  description TEXT,
  sku TEXT UNIQUE,                     -- codigo interno (ex: "PLC-VEND-STD")
  unit_cost NUMERIC(10,2),             -- custo unitario ao fornecedor (preco de compra)
  sell_price NUMERIC(10,2) NOT NULL,   -- preco cobrado ao consultor (debitado na conta corrente)
  thumbnail_url TEXT,                  -- foto do produto
  is_personalizable BOOLEAN DEFAULT false,  -- requer personalizacao (nome, foto, dados imovel)
  personalization_fields JSONB,        -- campos de personalizacao: [{ "key": "consultant_name", "label": "Nome do Consultor", "type": "text", "required": true }]
  is_property_linked BOOLEAN DEFAULT false, -- requer associacao a um imovel (ex: placa com ref do imovel)
  requires_approval BOOLEAN DEFAULT false,  -- requisicao precisa de aprovacao antes de processar
  approval_threshold NUMERIC(10,2),    -- valor acima do qual requer aprovacao (null = usa requires_approval)
  min_stock_alert INT DEFAULT 0,       -- limiar para alerta de stock baixo (0 = sem alerta)
  is_returnable BOOLEAN DEFAULT false, -- pode ser devolvido ao stock (ex: placas)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 TEMP_product_variants

Variantes de um produto (tamanhos, cores, tipos).

```sql
CREATE TABLE TEMP_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES TEMP_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- ex: "Vende-se", "Arrenda-se", "Vendido", "Tamanho A3", "Tamanho A4"
  sku_suffix TEXT,                     -- concatenado ao SKU do produto (ex: produto "PLC" + variante "VEND" = "PLC-VEND")
  additional_cost NUMERIC(10,2) DEFAULT 0, -- custo adicional sobre o preco base
  thumbnail_url TEXT,                  -- imagem especifica da variante
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 TEMP_stock

Inventario actual por produto/variante.

```sql
CREATE TABLE TEMP_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES TEMP_products(id),
  variant_id UUID REFERENCES TEMP_product_variants(id),
  location TEXT DEFAULT 'escritorio',  -- local de armazenamento (ex: "escritorio", "armazem")
  quantity_available INT NOT NULL DEFAULT 0,   -- disponivel para requisicao
  quantity_reserved INT NOT NULL DEFAULT 0,    -- reservado para requisicoes pendentes
  quantity_on_order INT NOT NULL DEFAULT 0,    -- encomendado ao fornecedor (em transito)
  last_restock_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, variant_id, location)
);
```

### 3.6 TEMP_stock_movements

Historico de todos os movimentos de stock (auditoria completa).

```sql
CREATE TABLE TEMP_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES TEMP_stock(id),
  movement_type TEXT NOT NULL,         -- 'in_purchase' | 'in_return' | 'in_adjustment' | 'out_requisition' | 'out_damage' | 'out_adjustment'
  quantity INT NOT NULL,               -- positivo = entrada, negativo = saida
  reference_type TEXT,                 -- 'requisition' | 'supplier_order' | 'return' | 'manual'
  reference_id UUID,                   -- ID da requisicao, encomenda ao fornecedor, etc.
  notes TEXT,
  performed_by UUID NOT NULL REFERENCES dev_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.7 TEMP_requisitions

Requisicoes de material feitas pelos consultores.

```sql
CREATE TABLE TEMP_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE,               -- auto-gerado: REQ-YYYY-XXXX
  agent_id UUID NOT NULL REFERENCES dev_users(id),          -- consultor que pede
  property_id UUID REFERENCES dev_properties(id),           -- imovel associado (se aplicavel)
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending'         → aguarda aprovacao ou processamento
    -- 'approved'        → aprovada, a preparar
    -- 'rejected'        → rejeitada pelo manager
    -- 'in_production'   → em producao (item personalizado enviado ao fornecedor)
    -- 'ready'           → pronto para entrega/recolha
    -- 'delivered'       → entregue ao consultor
    -- 'cancelled'       → cancelada pelo consultor ou manager
    -- 'partially_delivered' → entrega parcial
  priority TEXT DEFAULT 'normal',      -- 'low' | 'normal' | 'high' | 'urgent'
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- total a debitar na conta corrente
  delivery_type TEXT DEFAULT 'pickup', -- 'pickup' (recolha no escritorio) | 'delivery' (entrega em morada)
  delivery_address TEXT,               -- morada de entrega (se delivery_type = 'delivery')
  delivery_notes TEXT,                 -- instrucoes de entrega
  requested_delivery_date DATE,        -- data pretendida de entrega
  actual_delivery_date DATE,           -- data efectiva de entrega
  rejection_reason TEXT,
  cancellation_reason TEXT,
  approved_by UUID REFERENCES dev_users(id),
  approved_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES dev_users(id),
  internal_notes TEXT,                 -- notas internas (so visiveis para gestao)
  conta_corrente_tx_id UUID REFERENCES conta_corrente_transactions(id), -- transaccao de debito
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.8 TEMP_requisition_items

Itens individuais de cada requisicao.

```sql
CREATE TABLE TEMP_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES TEMP_requisitions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES TEMP_products(id),
  variant_id UUID REFERENCES TEMP_product_variants(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,   -- preco unitario no momento da requisicao
  subtotal NUMERIC(10,2) NOT NULL,     -- quantity * unit_price
  personalization_data JSONB,          -- dados de personalizacao preenchidos pelo consultor
  status TEXT DEFAULT 'pending',       -- 'pending' | 'reserved' | 'in_production' | 'ready' | 'delivered' | 'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.9 TEMP_supplier_orders

Encomendas feitas aos fornecedores para reabastecer stock.

```sql
CREATE TABLE TEMP_supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE,               -- auto-gerado: ENC-YYYY-XXXX
  supplier_id UUID NOT NULL REFERENCES TEMP_suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft',
    -- 'draft'           → rascunho, ainda nao enviada
    -- 'sent'            → enviada ao fornecedor
    -- 'confirmed'       → fornecedor confirmou
    -- 'in_production'   → em producao
    -- 'shipped'         → expedida
    -- 'partially_received' → recepcao parcial
    -- 'received'        → totalmente recebida
    -- 'cancelled'       → cancelada
  total_cost NUMERIC(10,2) DEFAULT 0,  -- custo total da encomenda
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  invoice_reference TEXT,              -- referencia da factura do fornecedor
  invoice_url TEXT,                    -- ficheiro da factura (R2)
  notes TEXT,
  ordered_by UUID NOT NULL REFERENCES dev_users(id),
  received_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.10 TEMP_supplier_order_items

Itens de cada encomenda ao fornecedor.

```sql
CREATE TABLE TEMP_supplier_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id UUID NOT NULL REFERENCES TEMP_supplier_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES TEMP_products(id),
  variant_id UUID REFERENCES TEMP_product_variants(id),
  quantity_ordered INT NOT NULL,
  quantity_received INT DEFAULT 0,     -- actualizado na recepcao
  unit_cost NUMERIC(10,2) NOT NULL,    -- custo unitario ao fornecedor
  subtotal NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.11 TEMP_returns

Devolucoes de material ao stock (ex: placa recuperada apos venda).

```sql
CREATE TABLE TEMP_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_item_id UUID REFERENCES TEMP_requisition_items(id),
  product_id UUID NOT NULL REFERENCES TEMP_products(id),
  variant_id UUID REFERENCES TEMP_product_variants(id),
  agent_id UUID NOT NULL REFERENCES dev_users(id),
  quantity INT NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'good', -- 'good' (reutilizavel) | 'damaged' | 'destroyed'
  refund_amount NUMERIC(10,2) DEFAULT 0,  -- valor a creditar na conta corrente (0 se danificado)
  reason TEXT,                         -- motivo da devolucao
  processed_by UUID REFERENCES dev_users(id),
  processed_at TIMESTAMPTZ,
  conta_corrente_tx_id UUID REFERENCES conta_corrente_transactions(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.12 TEMP_product_templates

Ficheiros de design/artwork associados a produtos (templates Canva, PDFs, etc.).

```sql
CREATE TABLE TEMP_product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES TEMP_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- ex: "Template Cartao v3 - Novo Branding"
  file_url TEXT NOT NULL,              -- URL do ficheiro (R2 ou link externo Canva)
  file_type TEXT,                      -- 'pdf' | 'canva' | 'ai' | 'psd' | 'figma' | 'other'
  is_current BOOLEAN DEFAULT true,     -- versao activa (so uma por produto activa)
  version TEXT,                        -- ex: "v3", "2026-Q1"
  notes TEXT,
  uploaded_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Diagrama de Relacoes

```
TEMP_product_categories
  └── 1:N → TEMP_products
                ├── 1:N → TEMP_product_variants
                ├── 1:N → TEMP_product_templates
                ├── 1:1 → TEMP_stock (por variante/localizacao)
                │           └── 1:N → TEMP_stock_movements
                ├── N:1 → TEMP_suppliers (fornecedor preferencial)
                ├── via TEMP_requisition_items → TEMP_requisitions → dev_users (agent)
                └── via TEMP_supplier_order_items → TEMP_supplier_orders → TEMP_suppliers

TEMP_suppliers
  └── 1:N → TEMP_supplier_orders
                └── 1:N → TEMP_supplier_order_items

TEMP_requisitions
  ├── N:1 → dev_users (agent_id)
  ├── N:1 → dev_properties (property_id)
  ├── N:1 → conta_corrente_transactions (debito)
  └── 1:N → TEMP_requisition_items
                └── 1:N → TEMP_returns

conta_corrente_transactions ← integra debitos de requisicoes e creditos de devolucoes
```

---

## 5. Referencias Auto-Geradas (Triggers)

```sql
-- Requisicoes: REQ-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_requisition_ref()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
  year_str TEXT := to_char(now(), 'YYYY');
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'REQ-' || year_str || '-(\d+)') AS INT)
  ), 0) + 1
  INTO next_num
  FROM TEMP_requisitions
  WHERE reference LIKE 'REQ-' || year_str || '-%';

  NEW.reference := 'REQ-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_requisition_ref
BEFORE INSERT ON TEMP_requisitions
FOR EACH ROW WHEN (NEW.reference IS NULL)
EXECUTE FUNCTION generate_requisition_ref();

-- Encomendas a fornecedores: ENC-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_supplier_order_ref()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
  year_str TEXT := to_char(now(), 'YYYY');
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'ENC-' || year_str || '-(\d+)') AS INT)
  ), 0) + 1
  INTO next_num
  FROM TEMP_supplier_orders
  WHERE reference LIKE 'ENC-' || year_str || '-%';

  NEW.reference := 'ENC-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_supplier_order_ref
BEFORE INSERT ON TEMP_supplier_orders
FOR EACH ROW WHEN (NEW.reference IS NULL)
EXECUTE FUNCTION generate_supplier_order_ref();
```

---

## 6. Status Flows

### 6.1 Requisicao (TEMP_requisitions)

```
pending ──→ approved ──→ ready ──→ delivered
   │            │           │
   │            │           └──→ partially_delivered ──→ delivered
   │            │
   │            └──→ in_production ──→ ready ──→ delivered
   │
   ├──→ rejected
   └──→ cancelled
```

**Regras:**
- `pending → approved`: requer `approved_by` + `approved_at`
- `pending → rejected`: requer `rejection_reason`
- Se produto `requires_approval = false` e valor < `approval_threshold`: auto-approve (pending → approved)
- `approved → ready`: quando stock reservado e itens preparados
- `approved → in_production`: quando item personalizado enviado ao fornecedor
- `delivered`: debita conta corrente do consultor (cria `conta_corrente_transactions` com category = `physical_material`)
- `cancelled`: apenas se status < `ready`, liberta stock reservado

### 6.2 Encomenda ao Fornecedor (TEMP_supplier_orders)

```
draft ──→ sent ──→ confirmed ──→ in_production ──→ shipped ──→ received
                                                        │
                                                        └──→ partially_received ──→ received
   └──→ cancelled (qualquer estado antes de shipped)
```

**Regras:**
- `received`: actualiza `TEMP_stock.quantity_available` e `quantity_on_order`, cria `TEMP_stock_movements`
- `partially_received`: actualiza quantidades parciais nos itens

---

## 7. Integracao com Conta Corrente

### 7.1 Debito (na entrega da requisicao)

Quando uma requisicao passa a `delivered`:

```typescript
// Criar transaccao na conta corrente
{
  agent_id: requisition.agent_id,
  date: new Date().toISOString(),
  type: 'DEBIT',
  category: 'physical_material',
  amount: requisition.total_amount,
  description: `Encomenda ${requisition.reference} — ${itemsSummary}`,
  reference_id: requisition.id,
  reference_type: 'requisition'
}
```

### 7.2 Credito (na devolucao)

Quando uma devolucao com `refund_amount > 0` e processada:

```typescript
{
  agent_id: return.agent_id,
  date: new Date().toISOString(),
  type: 'CREDIT',
  category: 'refund',
  amount: return.refund_amount,
  description: `Devolucao de ${productName} — REQ ${requisitionRef}`,
  reference_id: return.id,
  reference_type: 'return'
}
```

---

## 8. Alertas e Notificacoes

### 8.1 Stock Baixo

Verificacao periodica (ou via trigger apos stock_movement):

```sql
-- Produtos com stock abaixo do limiar
SELECT p.id, p.name, p.sku, s.quantity_available, p.min_stock_alert
FROM TEMP_products p
JOIN TEMP_stock s ON s.product_id = p.id
WHERE p.min_stock_alert > 0
  AND s.quantity_available <= p.min_stock_alert
  AND p.is_active = true;
```

Notificacao para: Office Manager, Marketing (via tabela `notifications` existente).

### 8.2 Notificacoes ao Consultor

| Evento | Destinatario | Mensagem |
|--------|-------------|----------|
| Requisicao aprovada | Consultor | "A sua requisicao REQ-2026-0042 foi aprovada." |
| Requisicao rejeitada | Consultor | "A sua requisicao REQ-2026-0042 foi rejeitada: {motivo}" |
| Requisicao pronta | Consultor | "A sua encomenda REQ-2026-0042 esta pronta para recolha." |
| Requisicao entregue | Consultor | "A sua encomenda REQ-2026-0042 foi entregue. Valor debitado: {valor} EUR." |
| Devolucao processada | Consultor | "Devolucao processada. Credito de {valor} EUR na sua conta corrente." |

### 8.3 Notificacoes a Gestao

| Evento | Destinatario | Mensagem |
|--------|-------------|----------|
| Nova requisicao (requer aprovacao) | Manager | "Nova requisicao de {consultor}: {items}. Valor: {total} EUR." |
| Stock baixo | Office Manager | "Stock baixo: {produto} — {qty} unidades restantes (minimo: {min})." |
| Encomenda recebida do fornecedor | Office Manager | "Encomenda ENC-2026-0015 recebida de {fornecedor}." |

---

## 9. API Routes

### 9.1 Produtos & Catalogo (Admin)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/encomendas/products` | Listar produtos (com filtros: category, active, search) |
| POST | `/api/encomendas/products` | Criar produto |
| GET | `/api/encomendas/products/[id]` | Detalhe do produto (com variantes, templates, stock) |
| PUT | `/api/encomendas/products/[id]` | Editar produto |
| DELETE | `/api/encomendas/products/[id]` | Desactivar produto (is_active = false) |
| POST | `/api/encomendas/products/[id]/variants` | Criar variante |
| PUT | `/api/encomendas/products/[id]/variants/[variantId]` | Editar variante |
| DELETE | `/api/encomendas/products/[id]/variants/[variantId]` | Desactivar variante |
| POST | `/api/encomendas/products/[id]/templates` | Upload template de design |
| DELETE | `/api/encomendas/products/[id]/templates/[templateId]` | Remover template |

### 9.2 Categorias

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/encomendas/categories` | Listar categorias |
| POST | `/api/encomendas/categories` | Criar categoria |
| PUT | `/api/encomendas/categories/[id]` | Editar categoria |

### 9.3 Fornecedores (Admin)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/encomendas/suppliers` | Listar fornecedores |
| POST | `/api/encomendas/suppliers` | Criar fornecedor |
| GET | `/api/encomendas/suppliers/[id]` | Detalhe (com historico de encomendas) |
| PUT | `/api/encomendas/suppliers/[id]` | Editar fornecedor |

### 9.4 Requisicoes (Consultores + Admin)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/encomendas/requisitions` | Listar requisicoes (filtros: status, agent, date range) |
| POST | `/api/encomendas/requisitions` | Criar requisicao (consultor) |
| GET | `/api/encomendas/requisitions/[id]` | Detalhe da requisicao |
| POST | `/api/encomendas/requisitions/[id]/approve` | Aprovar requisicao |
| POST | `/api/encomendas/requisitions/[id]/reject` | Rejeitar (com motivo) |
| POST | `/api/encomendas/requisitions/[id]/cancel` | Cancelar requisicao |
| POST | `/api/encomendas/requisitions/[id]/ready` | Marcar como pronta |
| POST | `/api/encomendas/requisitions/[id]/deliver` | Marcar como entregue (debita conta corrente) |
| GET | `/api/encomendas/my-requisitions` | Requisicoes do consultor autenticado |

### 9.5 Stock (Admin)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/encomendas/stock` | Visao geral do stock (com alertas) |
| PUT | `/api/encomendas/stock/[id]/adjust` | Ajuste manual de stock (com motivo) |
| GET | `/api/encomendas/stock/movements` | Historico de movimentos |
| GET | `/api/encomendas/stock/alerts` | Produtos com stock baixo |

### 9.6 Encomendas ao Fornecedor (Admin)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/encomendas/supplier-orders` | Listar encomendas a fornecedores |
| POST | `/api/encomendas/supplier-orders` | Criar encomenda ao fornecedor |
| GET | `/api/encomendas/supplier-orders/[id]` | Detalhe |
| PUT | `/api/encomendas/supplier-orders/[id]` | Actualizar estado |
| POST | `/api/encomendas/supplier-orders/[id]/receive` | Registar recepcao (actualiza stock) |

### 9.7 Devolucoes

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/encomendas/returns` | Registar devolucao |
| GET | `/api/encomendas/returns` | Listar devolucoes |
| POST | `/api/encomendas/returns/[id]/process` | Processar devolucao (actualiza stock + conta corrente) |

### 9.8 Relatorios

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/encomendas/reports/costs-by-agent` | Custos por consultor (periodo) |
| GET | `/api/encomendas/reports/costs-by-product` | Custos por produto (periodo) |
| GET | `/api/encomendas/reports/stock-valuation` | Valor total do stock |

---

## 10. Paginas & UI

### 10.1 Estrutura de Paginas

```
app/dashboard/encomendas/
├── page.tsx                          → redirect para /catalogo
├── layout.tsx                        → permission guard (marketing module)
├── catalogo/page.tsx                 → catalogo de produtos (consultor)
├── minhas/page.tsx                   → minhas requisicoes (consultor)
├── gestao/page.tsx                   → gestao de requisicoes (admin)
├── stock/page.tsx                    → gestao de stock (admin)
├── fornecedores/page.tsx             → gestao de fornecedores (admin)
├── fornecedores/[id]/page.tsx        → detalhe fornecedor
├── encomendas-fornecedor/page.tsx    → encomendas a fornecedores (admin)
└── relatorios/page.tsx               → relatorios de custos e stock
```

### 10.2 Tab "Catalogo" (Consultor)

- Grid de produtos agrupados por categoria
- Card por produto: thumbnail, nome, preco, badge "Personalizavel" se aplicavel
- Filtro por categoria, search por nome
- Clicar no produto → dialog de requisicao:
  1. Seleccionar variante (se existir)
  2. Quantidade
  3. Preencher dados de personalizacao (se personalizavel)
  4. Seleccionar imovel (se is_property_linked)
  5. Tipo de entrega (recolha / entrega em morada)
  6. Data pretendida
  7. Resumo com total → confirmar
- Carrinho (opcional MVP): permitir adicionar varios itens antes de submeter

### 10.3 Tab "Minhas Requisicoes" (Consultor)

- Lista das requisicoes do consultor com:
  - Referencia (REQ-YYYY-XXXX)
  - Data, status (badge com cor), total
  - Itens (resumo)
- Filtro por status
- Detalhe expandivel com timeline de estados
- Accao "Cancelar" (se status = pending)

### 10.4 Tab "Gestao de Requisicoes" (Admin)

- Tabela com todas as requisicoes
- Filtros: status, consultor, data, prioridade
- Accoes em batch: aprovar multiplas, marcar como prontas
- Detalhe com:
  - Dados do consultor e imovel
  - Itens com dados de personalizacao
  - Botoes: Aprovar, Rejeitar, Marcar Pronta, Marcar Entregue
  - Notas internas
  - Timeline de estados

### 10.5 Tab "Stock" (Admin)

- Tabela de inventario: produto, variante, localizacao, disponivel, reservado, em encomenda
- Badge vermelho nos produtos abaixo do min_stock_alert
- Accao "Ajustar stock" (dialog com quantidade e motivo)
- Accao "Encomendar ao fornecedor" (pre-preenche encomenda)
- Historico de movimentos (filtro por produto, tipo, data)

### 10.6 Tab "Fornecedores" (Admin)

- Listagem com search
- Card/linha: nome, contacto, telefone, email, prazo medio
- Detalhe: dados completos + historico de encomendas + total gasto

### 10.7 Tab "Encomendas a Fornecedores" (Admin)

- Listagem de encomendas com status, fornecedor, data, total
- Criar nova encomenda: seleccionar fornecedor → adicionar itens → enviar
- Registar recepcao: marcar quantidades recebidas por item → actualiza stock

### 10.8 Tab "Relatorios" (Admin)

- Custos por consultor (periodo): tabela + grafico barras
- Custos por produto (periodo): tabela + grafico pizza
- Valor total do stock actual

---

## 11. Componentes

```
components/encomendas/
├── product-catalog-grid.tsx          → grid de produtos para consultor
├── product-card.tsx                  → card individual de produto
├── product-form-dialog.tsx           → criar/editar produto (admin)
├── variant-management.tsx            → gerir variantes de um produto
├── requisition-form-dialog.tsx       → formulario de requisicao (consultor)
├── requisition-cart.tsx              → carrinho de compras (se MVP incluir)
├── requisition-detail.tsx            → detalhe da requisicao
├── requisition-timeline.tsx          → timeline de estados da requisicao
├── requisitions-table.tsx            → tabela de requisicoes (admin)
├── stock-table.tsx                   → tabela de inventario
├── stock-adjust-dialog.tsx           → ajuste manual de stock
├── stock-alert-badge.tsx             → badge de stock baixo
├── supplier-form-dialog.tsx          → criar/editar fornecedor
├── supplier-order-form.tsx           → criar encomenda ao fornecedor
├── supplier-order-receive.tsx        → registar recepcao de encomenda
├── return-form-dialog.tsx            → registar devolucao
├── cost-report-chart.tsx             → grafico de custos
└── personalization-fields.tsx        → renderizador dinamico de campos de personalizacao
```

---

## 12. Hooks

```
hooks/
├── use-encomenda-products.ts         → CRUD de produtos com filtros
├── use-encomenda-requisitions.ts     → requisicoes (consultor e admin)
├── use-encomenda-stock.ts            → stock e movimentos
├── use-encomenda-suppliers.ts        → fornecedores
├── use-encomenda-supplier-orders.ts  → encomendas a fornecedores
├── use-encomenda-returns.ts          → devolucoes
└── use-encomenda-reports.ts          → relatorios e metricas
```

---

## 13. Types

```typescript
// types/encomenda.ts

export type RequisitionStatus = 'pending' | 'approved' | 'rejected' | 'in_production' | 'ready' | 'delivered' | 'cancelled' | 'partially_delivered'

export type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent'

export type DeliveryType = 'pickup' | 'delivery'

export type SupplierOrderStatus = 'draft' | 'sent' | 'confirmed' | 'in_production' | 'shipped' | 'partially_received' | 'received' | 'cancelled'

export type StockMovementType = 'in_purchase' | 'in_return' | 'in_adjustment' | 'out_requisition' | 'out_damage' | 'out_adjustment'

export type ReturnCondition = 'good' | 'damaged' | 'destroyed'

export type PersonalizationFieldType = 'text' | 'textarea' | 'select' | 'image'

export interface PersonalizationField {
  key: string
  label: string
  type: PersonalizationFieldType
  required: boolean
  options?: string[]          // para tipo 'select'
  placeholder?: string
}
```

---

## 14. Constantes & Labels PT-PT

```typescript
// Adicionar a lib/constants.ts

export const REQUISITION_STATUS = {
  pending:              { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500',   label: 'Pendente' },
  approved:             { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500',    label: 'Aprovada' },
  rejected:             { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500',     label: 'Rejeitada' },
  in_production:        { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-500',  label: 'Em Producao' },
  ready:                { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Pronta' },
  delivered:            { bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-500',   label: 'Entregue' },
  cancelled:            { bg: 'bg-slate-100',   text: 'text-slate-800',   dot: 'bg-slate-500',   label: 'Cancelada' },
  partially_delivered:  { bg: 'bg-teal-100',    text: 'text-teal-800',    dot: 'bg-teal-500',    label: 'Entrega Parcial' },
} as const

export const SUPPLIER_ORDER_STATUS = {
  draft:                { bg: 'bg-slate-100',   text: 'text-slate-800',   dot: 'bg-slate-400',   label: 'Rascunho' },
  sent:                 { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500',    label: 'Enviada' },
  confirmed:            { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-500',  label: 'Confirmada' },
  in_production:        { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-500',  label: 'Em Producao' },
  shipped:              { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500',   label: 'Expedida' },
  partially_received:   { bg: 'bg-teal-100',    text: 'text-teal-800',    dot: 'bg-teal-500',    label: 'Recepcao Parcial' },
  received:             { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Recebida' },
  cancelled:            { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500',     label: 'Cancelada' },
} as const

export const REQUISITION_PRIORITY = {
  low:    { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Baixa' },
  normal: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Normal' },
  high:   { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alta' },
  urgent: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Urgente' },
} as const

export const DELIVERY_TYPE_LABELS = {
  pickup:   'Recolha no Escritorio',
  delivery: 'Entrega em Morada',
} as const

export const RETURN_CONDITION_LABELS = {
  good:      'Bom Estado (Reutilizavel)',
  damaged:   'Danificado',
  destroyed: 'Destruido',
} as const

export const STOCK_MOVEMENT_LABELS = {
  in_purchase:     'Entrada (Compra)',
  in_return:       'Entrada (Devolucao)',
  in_adjustment:   'Entrada (Ajuste Manual)',
  out_requisition: 'Saida (Requisicao)',
  out_damage:      'Saida (Dano/Perda)',
  out_adjustment:  'Saida (Ajuste Manual)',
} as const
```

---

## 15. Validacoes Zod

```typescript
// lib/validations/encomenda.ts

import { z } from 'zod'

export const createProductSchema = z.object({
  category_id: z.string().min(1, 'Categoria obrigatoria'),
  supplier_id: z.string().optional(),
  name: z.string().min(1, 'Nome obrigatorio').max(200),
  description: z.string().optional(),
  sku: z.string().optional(),
  unit_cost: z.number().min(0).optional(),
  sell_price: z.number().min(0, 'Preco obrigatorio'),
  is_personalizable: z.boolean().default(false),
  personalization_fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'textarea', 'select', 'image']),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
  })).optional(),
  is_property_linked: z.boolean().default(false),
  requires_approval: z.boolean().default(false),
  approval_threshold: z.number().min(0).optional(),
  min_stock_alert: z.number().int().min(0).default(0),
  is_returnable: z.boolean().default(false),
})

export const createRequisitionSchema = z.object({
  property_id: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().min(1),
    variant_id: z.string().optional(),
    quantity: z.number().int().min(1, 'Quantidade minima: 1'),
    personalization_data: z.record(z.any()).optional(),
    notes: z.string().optional(),
  })).min(1, 'Adicione pelo menos 1 item'),
  delivery_type: z.enum(['pickup', 'delivery']).default('pickup'),
  delivery_address: z.string().optional(),
  delivery_notes: z.string().optional(),
  requested_delivery_date: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
})

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  contact_name: z.string().optional(),
  email: z.string().email('Email invalido').optional().or(z.literal('')),
  phone: z.string().optional(),
  nif: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  notes: z.string().optional(),
  average_delivery_days: z.number().int().min(0).optional(),
  payment_terms: z.string().optional(),
})

export const createSupplierOrderSchema = z.object({
  supplier_id: z.string().min(1, 'Fornecedor obrigatorio'),
  items: z.array(z.object({
    product_id: z.string().min(1),
    variant_id: z.string().optional(),
    quantity_ordered: z.number().int().min(1),
    unit_cost: z.number().min(0),
  })).min(1, 'Adicione pelo menos 1 item'),
  expected_delivery_date: z.string().optional(),
  notes: z.string().optional(),
})

export const stockAdjustSchema = z.object({
  quantity: z.number().int(),         // positivo = adicionar, negativo = remover
  reason: z.string().min(1, 'Motivo obrigatorio'),
})

export const createReturnSchema = z.object({
  requisition_item_id: z.string().optional(),
  product_id: z.string().min(1),
  variant_id: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  condition: z.enum(['good', 'damaged', 'destroyed']),
  reason: z.string().optional(),
})
```

---

## 16. Permissoes

Utiliza o modulo de permissoes existente (`roles.permissions`):

| Accao | Permissao |
|-------|-----------|
| Ver catalogo + requisitar | `marketing` (qualquer consultor com acesso ao modulo) |
| Ver minhas requisicoes | Qualquer utilizador autenticado (filtra por agent_id) |
| Gerir catalogo (CRUD produtos) | `marketing` + role Office Manager / Broker |
| Gerir fornecedores | `marketing` + role Office Manager / Broker |
| Aprovar/rejeitar requisicoes | `marketing` + role Office Manager / Broker / Team Leader |
| Gerir stock | `marketing` + role Office Manager / Broker |
| Gerir encomendas a fornecedores | `marketing` + role Office Manager / Broker |
| Ver relatorios | `marketing` + role Broker / Gestora Processual |

---

## 17. Sidebar Navigation

Adicionar sub-item dentro do menu Marketing existente, ou como modulo separado:

```typescript
{
  title: 'Encomendas',
  url: '/dashboard/encomendas/catalogo',
  icon: Package,  // lucide-react
  permission: 'marketing',
}
```

---

## 18. Seed Data (Produtos Iniciais)

```sql
-- Categorias
INSERT INTO TEMP_product_categories (name, icon, sort_order) VALUES
  ('Placas', 'signpost', 1),
  ('Cartoes de Visita', 'credit-card', 2),
  ('Flyers & Brochuras', 'file-text', 3),
  ('Brindes', 'gift', 4),
  ('Sinaletica', 'flag', 5),
  ('Roll-ups & Banners', 'presentation', 6),
  ('Papelaria', 'pen-tool', 7);

-- Produtos exemplo
INSERT INTO TEMP_products (category_id, name, sku, sell_price, unit_cost, is_personalizable, is_property_linked, is_returnable, min_stock_alert) VALUES
  -- Placas (reutilizaveis)
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Placas'), 'Placa Vende-se Standard', 'PLC-VEND-STD', 15.00, 8.50, false, true, true, 10),
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Placas'), 'Placa Arrenda-se Standard', 'PLC-ARR-STD', 15.00, 8.50, false, true, true, 10),
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Placas'), 'Placa Vendido', 'PLC-VENDIDO', 15.00, 8.50, false, true, true, 5),

  -- Cartoes de Visita (personalizaveis)
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Cartoes de Visita'), 'Cartao de Visita (500 unidades)', 'CV-500', 35.00, 18.00, true, false, false, 0),

  -- Flyers
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Flyers & Brochuras'), 'Flyer A5 Imovel (100 unidades)', 'FLY-A5-100', 25.00, 12.00, true, true, false, 0),
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Flyers & Brochuras'), 'Brochura A4 Tri-fold (50 unidades)', 'BROC-A4-50', 45.00, 22.00, true, true, false, 0),

  -- Brindes
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Brindes'), 'Caneta Infinity (unidade)', 'BRND-CAN', 2.50, 0.80, false, false, false, 50),
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Brindes'), 'Saco Infinity (unidade)', 'BRND-SACO', 3.00, 1.20, false, false, false, 30),
  ((SELECT id FROM TEMP_product_categories WHERE name = 'Brindes'), 'Bloco de Notas Infinity', 'BRND-BLOC', 4.00, 1.50, false, false, false, 30);
```

---

## 19. Regras de Negocio (Resumo)

1. **Debito so na entrega** — A conta corrente so e debitada quando a requisicao e marcada como `delivered`, nao na criacao.
2. **Reserva de stock** — Ao aprovar requisicao, o stock e reservado (`quantity_reserved += qty`). Ao entregar, move para saida real.
3. **Auto-approve** — Produtos com `requires_approval = false` e valor total abaixo de `approval_threshold` saltam directamente para `approved`.
4. **Personalizacao** — Campos de personalizacao sao definidos no produto e preenchidos pelo consultor na requisicao. Itens personalizaveis vao para `in_production`.
5. **Devolucoes** — So para produtos com `is_returnable = true`. Condicao `good` volta ao stock; `damaged`/`destroyed` e abate.
6. **Credito na devolucao** — O valor de credito pode ser parcial ou total, definido pelo admin ao processar.
7. **Stock baixo** — Alerta automatico quando `quantity_available <= min_stock_alert`.
8. **Cancellation** — Consultores podem cancelar requisicoes em status `pending`. Admin pode cancelar ate `ready`.
9. **Historico completo** — Todos os movimentos de stock sao registados em `TEMP_stock_movements` para auditoria.
10. **Precos congelados** — O `unit_price` na `TEMP_requisition_items` e capturado no momento da requisicao. Alteracoes futuras ao catalogo nao afectam requisicoes existentes.

---

## 20. Prioridades de Implementacao

### Fase 1 — MVP
1. Tabelas base: categorias, produtos, variantes, stock
2. Fornecedores (CRUD)
3. Requisicoes (criar, aprovar, entregar)
4. Integracao conta corrente (debito na entrega)
5. Catalogo para consultor + "Minhas Requisicoes"
6. Gestao de requisicoes (admin)
7. Gestao de stock basica

### Fase 2 — Completo
1. Encomendas a fornecedores com recepcao
2. Devolucoes
3. Alertas de stock baixo
4. Relatorios
5. Templates de design
6. Carrinho de compras
7. Accoes em batch
