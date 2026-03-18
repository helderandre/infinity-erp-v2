# SPEC-M23 — Parceiros

## Visão Geral

Sistema de gestão de parceiros de negócio da imobiliária (advogados, notários, bancos, fotógrafos, empreiteiros, etc.) com controlo de visibilidade: parceiros **públicos** visíveis por todos e parceiros **privados** restritos à administração e gestão.

---

## 1. Conceitos

### Parceiro
Uma entidade (pessoa ou empresa) que presta serviços ou colabora com a imobiliária.

```
Parceiro = Identificação + Contacto + Info Profissional + Visibilidade + Avaliação
```

### Visibilidade
| Nível | Quem vê | Descrição |
|-------|---------|-----------|
| `public` | Todos os utilizadores | Parceiros acessíveis a todos os consultores |
| `private` | Broker/CEO, Office Manager, Gestora Processual, Team Leader | Parceiros restritos à administração e gestão |

### Categorias
| Categoria | Label PT-PT |
|-----------|-------------|
| `lawyer` | Advogado |
| `notary` | Notário |
| `bank` | Banco |
| `photographer` | Fotógrafo |
| `constructor` | Empreiteiro / Construção |
| `insurance` | Seguros |
| `energy_cert` | Certificação Energética |
| `cleaning` | Limpezas |
| `moving` | Mudanças |
| `appraiser` | Avaliador |
| `architect` | Arquitecto |
| `home_staging` | Home Staging |
| `credit_broker` | Intermediário de Crédito |
| `interior_design` | Design de Interiores |
| `marketing` | Marketing / Publicidade |
| `other` | Outro |

---

## 2. Tabela: `temp_partners`

```sql
CREATE TABLE temp_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  name TEXT NOT NULL,
  person_type TEXT NOT NULL DEFAULT 'coletiva',  -- 'singular' | 'coletiva'
  nif TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT 'other',
  visibility TEXT NOT NULL DEFAULT 'public',  -- 'public' | 'private'

  -- Contacto
  email TEXT,
  phone TEXT,
  phone_secondary TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  contact_person TEXT,  -- pessoa de contacto (se empresa)

  -- Profissional
  specialties TEXT[],  -- tags livres
  service_areas TEXT[],  -- zonas de actuação
  commercial_conditions TEXT,  -- condições comerciais (texto livre)
  payment_method TEXT,  -- 'transfer' | 'check' | 'cash' | 'other'

  -- Avaliação
  rating_avg NUMERIC(2,1) DEFAULT 0,  -- calculado da média
  rating_count INT DEFAULT 0,
  is_recommended BOOLEAN DEFAULT false,
  internal_notes TEXT,  -- visível apenas para gestão

  -- Estado
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES dev_users(id)
);

-- Tabela de avaliações individuais
CREATE TABLE temp_partner_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES temp_partners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Funcionalidades

### 3.1 Listagem de Parceiros

**Página:** `/dashboard/parceiros`

**Design:** Segue o padrão da loja/conta corrente:
- Hero section escuro com título "Parceiros" e breve descrição
- KPI cards: Total Parceiros, Activos, Recomendados, Categorias
- Filtros: categoria, visibilidade (se admin), estado, pesquisa
- Pill tabs para filtrar por categoria
- Cards em grid responsivo (1/2/3/4 colunas)

**Regras de visibilidade:**
- Consultores/agentes: vêem apenas `visibility = 'public'` e campos `internal_notes` e `commercial_conditions` ficam ocultos
- Admin/gestão: vêem tudo, incluindo parceiros `private`

### 3.2 Card de Parceiro

Cada card mostra:
- Nome + badge de categoria
- Contacto principal (telefone, email)
- Zona de actuação (tags)
- Rating (estrelas)
- Badge "Recomendado" se `is_recommended = true`
- Badge "Privado" se `visibility = 'private'`
- Estado activo/inactivo

### 3.3 Detalhe / Edição

**Dialog ou sheet** com:
- Todos os dados do parceiro
- Histórico de avaliações
- Botões: Editar, Desactivar, Eliminar (admin only)

### 3.4 Criar Parceiro

**Dialog** com formulário:
- Identificação (nome, tipo, NIF, categoria, visibilidade)
- Contacto (email, telefone, website, morada, pessoa de contacto)
- Profissional (especialidades, zonas, condições, método pagamento)
- Avaliação (recomendado, notas internas)

### 3.5 Avaliar Parceiro

Qualquer utilizador pode avaliar um parceiro público:
- Rating 1-5 estrelas
- Comentário opcional
- A média é recalculada automaticamente

---

## 4. Permissões

| Acção | Quem pode |
|-------|-----------|
| Ver parceiros públicos | Todos |
| Ver parceiros privados | Broker/CEO, Office Manager, Gestora Processual, Team Leader |
| Ver notas internas e condições comerciais | Broker/CEO, Office Manager, Gestora Processual |
| Criar parceiro | Broker/CEO, Office Manager |
| Editar parceiro | Broker/CEO, Office Manager |
| Eliminar parceiro | Broker/CEO |
| Avaliar parceiro | Todos (parceiros públicos) |

---

## 5. Sidebar

Adicionar "Parceiros" ao grupo "Pessoas":
```typescript
{ title: 'Parceiros', icon: Handshake, href: '/dashboard/parceiros', permission: 'partners' }
```

---

## 6. API Routes

```
GET    /api/partners           — listagem com filtros + controlo de visibilidade
POST   /api/partners           — criar parceiro (admin only)
GET    /api/partners/[id]      — detalhe
PUT    /api/partners/[id]      — editar (admin only)
DELETE /api/partners/[id]      — eliminar (admin only)
POST   /api/partners/[id]/rate — avaliar parceiro
```

---

## 7. Types

```typescript
// types/partner.ts
export type PartnerCategory = 'lawyer' | 'notary' | 'bank' | 'photographer' | 'constructor' | 'insurance' | 'energy_cert' | 'cleaning' | 'moving' | 'appraiser' | 'architect' | 'home_staging' | 'credit_broker' | 'interior_design' | 'marketing' | 'other'
export type PartnerVisibility = 'public' | 'private'
export type PersonType = 'singular' | 'coletiva'
export type PaymentMethod = 'transfer' | 'check' | 'cash' | 'other'
```

---

## 8. Ligações com Outros Módulos

| Módulo | Ligação |
|--------|---------|
| **Processos (M06)** | Tarefas podem referenciar parceiro (ex: "Enviar documentos ao notário X") |
| **Proprietários (M04)** | Parceiros advogados/notários ligados a processos de proprietários |
| **Dashboard** | KPI "Parceiros Activos" |
