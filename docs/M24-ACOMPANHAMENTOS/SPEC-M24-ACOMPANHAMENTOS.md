# SPEC-M24 — Acompanhamentos de Comprador

## Visão Geral

Um **Acompanhamento** é o equivalente do lado do comprador a uma angariação do lado do vendedor. É uma camada activa que acompanha um comprador desde que é qualificado até à proposta concreta num imóvel.

O Acompanhamento **não duplica dados** — liga-se ao Negócio (tipo "Compra") que já tem o perfil de procura, e adiciona apenas: tracking de imóveis sugeridos, estado do acompanhamento e informação de crédito adicional.

```
Lead (contacto entra)
  → Negócio tipo "Compra" (perfil de procura: orçamento, zonas, tipologia, etc.)
    → Acompanhamento (camada activa: tracking de imóveis + crédito + estado)
      → Negócio de Compra (proposta concreta num imóvel específico)
```

---

## 1. Arquitectura de Dados

### O que vive onde

| Dados | Tabela | Duplicação |
|-------|--------|------------|
| Nome, email, telemóvel, origem | `leads` | Não — lido via join |
| Orçamento, localização, tipo imóvel, quartos, amenities, motivação, prazo | `negocios` | Não — lido via join |
| Crédito pré-aprovado, capital próprio, financiamento | `negocios` | Não — lido via join |
| **Estado do acompanhamento** (active, paused, converted, lost) | `temp_acompanhamentos` | Novo |
| **Intermediação de crédito** (entidade, montante, notas) | `temp_acompanhamentos` | Novo (extra) |
| **Imóveis sugeridos** (status pipeline por imóvel) | `temp_acompanhamento_properties` | Novo |
| **Notas de acompanhamento** | `temp_acompanhamentos` | Novo |

---

## 2. Tabelas

### `temp_acompanhamentos`

```sql
CREATE TABLE temp_acompanhamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES dev_users(id),

  status TEXT NOT NULL DEFAULT 'active',
  lost_reason TEXT,

  -- Credit (adicional ao negócio)
  pre_approval_amount NUMERIC,
  credit_intermediation BOOLEAN DEFAULT false,
  credit_entity TEXT,
  credit_notes TEXT,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES dev_users(id)
);
```

### `temp_acompanhamento_properties`

```sql
CREATE TABLE temp_acompanhamento_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acompanhamento_id UUID NOT NULL REFERENCES temp_acompanhamentos(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES dev_properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'suggested',
  sent_at TIMESTAMPTZ,
  visited_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(acompanhamento_id, property_id)
);
```

---

## 3. Fluxo

1. Lead existe com Negócio tipo "Compra" (já tem orçamento, zonas, quartos, etc.)
2. Consultor cria Acompanhamento ligado ao negócio
3. Matching automático encontra imóveis compatíveis (preço, localização, tipo, quartos)
4. Consultor adiciona imóveis → pipeline por imóvel: sugerido → enviado → visitado → interessado / descartado
5. Quando comprador quer fazer proposta → converte para Negócio de Compra concreto

---

## 4. Estados

| Estado | Label | Descrição |
|--------|-------|-----------|
| `active` | Em Acompanhamento | Activamente a procurar |
| `paused` | Pausado | Pausa temporária |
| `converted` | Convertido | Fez proposta → Negócio criado |
| `lost` | Perdido | Desistiu / comprou noutro lado |

### Estados dos imóveis sugeridos

| Estado | Label | Descrição |
|--------|-------|-----------|
| `suggested` | Sugerido | Adicionado ao dossier |
| `sent` | Enviado | Link/ficha enviada ao cliente |
| `visited` | Visitado | Visita realizada |
| `interested` | Interessado | Cliente demonstrou interesse |
| `discarded` | Descartado | Cliente descartou |

---

## 5. API Routes

```
GET    /api/acompanhamentos              — listagem com filtros
POST   /api/acompanhamentos              — criar (negocio_id + lead_id + consultant_id)
GET    /api/acompanhamentos/[id]         — detalhe com negócio, lead, properties
PUT    /api/acompanhamentos/[id]         — actualizar estado/credit/notes
DELETE /api/acompanhamentos/[id]         — eliminar

GET    /api/acompanhamentos/[id]/matches — matching automático (lê critérios do negócio)
POST   /api/acompanhamentos/[id]/properties — adicionar imóvel
PUT    /api/acompanhamentos/[id]/properties/[propId] — actualizar estado
DELETE /api/acompanhamentos/[id]/properties/[propId] — remover
```

---

## 6. Páginas

| Ficheiro | Descrição |
|----------|-----------|
| `app/dashboard/acompanhamentos/page.tsx` | Listagem de todos os acompanhamentos |
| `app/dashboard/leads/[id]/acompanhamentos/[acompId]/page.tsx` | Detalhe (2 colunas: sidebar + imóveis/matching) |

---

## 7. Sidebar

No grupo "Negócio", entre Leads e Visitas:
```typescript
{ title: 'Acompanhamentos', icon: UserCheck, href: '/dashboard/acompanhamentos', permission: 'leads' }
```
