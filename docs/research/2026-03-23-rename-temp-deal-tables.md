# PRD: Remover prefixo `temp_` das tabelas de Deals

**Data**: 2026-03-23
**Git Commit**: `7135f0e`
**Branch**: `master`

---

## Objectivo

Renomear 4 tabelas do schema público removendo o prefixo `temp_`:

| Tabela actual             | Novo nome           |
|---------------------------|---------------------|
| `temp_deals`              | `deals`             |
| `temp_deal_clients`       | `deal_clients`      |
| `temp_deal_compliance`    | `deal_compliance`   |
| `temp_deal_payments`      | `deal_payments`     |

---

## 1. Estado Actual da Base de Dados

### 1.1 Dados existentes

| Tabela                  | Registos |
|-------------------------|----------|
| `temp_deals`            | 4        |
| `temp_deal_clients`     | 2        |
| `temp_deal_compliance`  | 2        |
| `temp_deal_payments`    | 3        |

### 1.2 Foreign Keys (7 constraints)

| Constraint                                | Source → Target                              |
|-------------------------------------------|----------------------------------------------|
| `temp_deals_property_id_fkey`             | `temp_deals.property_id` → `dev_properties.id` |
| `temp_deals_consultant_id_fkey`           | `temp_deals.consultant_id` → `dev_users.id`  |
| `temp_deals_created_by_fkey`              | `temp_deals.created_by` → `dev_users.id`     |
| `temp_deals_internal_colleague_id_fkey`   | `temp_deals.internal_colleague_id` → `dev_users.id` |
| `temp_deal_clients_deal_id_fkey`          | `temp_deal_clients.deal_id` → `temp_deals.id` |
| `temp_deal_compliance_deal_id_fkey`       | `temp_deal_compliance.deal_id` → `temp_deals.id` |
| `temp_deal_payments_deal_id_fkey`         | `temp_deal_payments.deal_id` → `temp_deals.id` |

### 1.3 Indexes (17 indexes)

**temp_deals:**
- `temp_deals_pkey` (UNIQUE, id)
- `idx_deals_property` (property_id)
- `idx_deals_consultant` (consultant_id)
- `idx_deals_status` (status)
- `idx_deals_date` (deal_date)
- `idx_deals_type` (deal_type)

**temp_deal_clients:**
- `temp_deal_clients_pkey` (UNIQUE, id)

**temp_deal_compliance:**
- `temp_deal_compliance_pkey` (UNIQUE, id)
- `idx_deal_compliance_deal` (UNIQUE, deal_id)
- `idx_deal_compliance_status` (status)
- `idx_deal_compliance_quarter` (impic_quarter)
- `idx_deal_compliance_risk` (overall_risk_level)

**temp_deal_payments:**
- `temp_deal_payments_pkey` (UNIQUE, id)
- `idx_deal_payments_deal` (deal_id)
- `idx_deal_payments_moment` (payment_moment)
- `idx_deal_payments_signed` (is_signed)
- `idx_deal_payments_received` (is_received)

### 1.4 Triggers & Functions

- **Nenhum trigger** nestas 4 tabelas
- **Nenhuma function** referencia `temp_deal` no body

### 1.5 RLS Policies

- **Nenhuma policy** (RLS desactivado nestas tabelas)

### 1.6 Views

- **Nenhuma view** referencia estas tabelas

---

## 2. Ficheiros da Base de Código Afectados

### 2.1 API Routes (7 ficheiros)

#### `app/api/deals/route.ts`
- **L26**: `.from('temp_deals')` → `.from('deals')`
- **L77**: `.from('temp_deals')` → `.from('deals')`
- **L81**: `dev_users!temp_deals_consultant_id_fkey(...)` → `dev_users!deals_consultant_id_fkey(...)`

#### `app/api/deals/drafts/route.ts`
- **L14**: `.from('temp_deals')` → `.from('deals')`

#### `app/api/deals/[id]/submit/route.ts`
- **L19**: `.from('temp_deals')` → `.from('deals')`
- **L56**: `.from('temp_deals')` → `.from('deals')`

#### `app/api/deals/[id]/proposal-upload/route.ts`
- **L55**: `.from('temp_deals')` → `.from('deals')`

#### `app/api/deals/[id]/route.ts`
- **L18**: `.from('temp_deals')` → `.from('deals')`
- **L22**: `dev_users!temp_deals_consultant_id_fkey(...)` → `dev_users!deals_consultant_id_fkey(...)`
- **L23**: `dev_users!temp_deals_internal_colleague_id_fkey(...)` → `dev_users!deals_internal_colleague_id_fkey(...)`
- **L34**: `.from('temp_deal_clients')` → `.from('deal_clients')`
- **L93**: `.from('temp_deals')` → `.from('deals')`
- **L104**: `.from('temp_deal_clients')` → `.from('deal_clients')`
- **L118**: `.from('temp_deal_clients')` → `.from('deal_clients')`
- **L146**: `.from('temp_deals')` → `.from('deals')`

#### `app/api/properties/[id]/route.ts`
- **L140**: `.from('temp_deals').update({ property_id: null }).eq('property_id', id)` → `.from('deals')...`

#### `app/api/properties/[id]/impic/route.ts`
- **L14**: `.from('temp_deals')` → `.from('deals')`
- **L17**: `dev_users!temp_deals_consultant_id_fkey(...)` → `dev_users!deals_consultant_id_fkey(...)`
- **L33**: `.from('temp_deal_compliance')` → `.from('deal_compliance')`

### 2.2 Server Actions (2 ficheiros)

#### `app/dashboard/comissoes/deals/actions.ts`
- **L27**: `.from('temp_deals')` → `.from('deals')`
- **L29**: `dev_properties!temp_deals_property_id_fkey(...)` + `dev_users!temp_deals_consultant_id_fkey(...)`
- **L100**: `.from('temp_deals')` → `.from('deals')`
- **L102**: mesmas FK references
- **L181**: `.from('temp_deals')` → `.from('deals')`
- **L226**: `.from('temp_deal_payments')` → `.from('deal_payments')`
- **L231**: `.from('temp_deals')` → `.from('deals')`
- **L281**: `.from('temp_deals')` → `.from('deals')`
- **L304**: `.from('temp_deals')` → `.from('deals')`
- **L360-361**: `.from('temp_deals')` + FK references
- **L427**: `.from('temp_deal_payments')` → `.from('deal_payments')`
- **L438**: `.from('temp_deals')` → `.from('deals')`
- **L502**: `.from('temp_deals')` → `.from('deals')`
- **L521**: `.from('temp_deal_payments')` → `.from('deal_payments')`

#### `app/dashboard/comissoes/compliance/actions.ts`
- **L21, 53, 78**: `.from('temp_deal_compliance')` → `.from('deal_compliance')`
- **L131, 210, 273, 327, 428**: `.from('temp_deals')` → `.from('deals')`
- **L227, 255, 318, 416**: `.from('temp_deal_compliance')` → `.from('deal_compliance')`

### 2.3 Types (1 ficheiro — auto-gerado)

#### `types/database.ts`
- **L7706**: `temp_deal_clients: {` → `deal_clients: {`
- **L7739**: `foreignKeyName: "temp_deal_clients_deal_id_fkey"` → `"deal_clients_deal_id_fkey"`
- **L7742**: `referencedRelation: "temp_deals"` → `"deals"`
- **L7747**: `temp_deal_compliance: {` → `deal_compliance: {`
- **L7888-7891**: FK references
- **L7896**: `temp_deal_payments: {` → `deal_payments: {`
- **L8001-8004**: FK references
- **L8009**: `temp_deals: {` → `deals: {`
- **L8210-8231**: 4 FK references

> **Nota**: Este ficheiro é auto-gerado. Após o rename no DB, regenerar com:
> ```bash
> npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts
> ```

### 2.4 Documentação (4 ficheiros — não afectam runtime)

- `docs/FECHO-NEGOCIO/SPEC-FECHO-NEGOCIO.md`
- `docs/SESSION-SUMMARY-2026-03-16.md`
- `docs/M21-FINANCEIRO-DASHBOARD/SPEC-COMISSOES-DEALS.md`
- `docs/M24-CALL-TRACKING-ACTIVITY-REPORT/SPEC-M24-CALL-TRACKING.md`

---

## 3. Resumo de Impacto

| Camada           | Itens afectados | Risco |
|------------------|-----------------|-------|
| DB: Tabelas      | 4 renames       | Baixo (poucos dados) |
| DB: FK constraints | 7 (renomeados automaticamente pelo ALTER TABLE) | Baixo |
| DB: Indexes      | 4 PKs renomeados auto + 13 custom (nomes sem `temp_`, não precisam mudar) | Baixo |
| DB: Triggers     | 0               | Nenhum |
| DB: Functions    | 0               | Nenhum |
| DB: RLS Policies | 0               | Nenhum |
| DB: Views        | 0               | Nenhum |
| API Routes       | 7 ficheiros     | Médio |
| Server Actions   | 2 ficheiros     | Médio |
| Types            | 1 ficheiro (auto-gerado) | Baixo |
| Docs             | 4 ficheiros     | Nenhum |

---

## 4. Estratégia de Migração — `ALTER TABLE ... RENAME TO`

### 4.1 Padrão PostgreSQL (documentação oficial)

O PostgreSQL suporta `ALTER TABLE ... RENAME TO` que:
- Preserva **todos os dados**
- Preserva **todas as colunas, tipos, defaults**
- **Indexes** são mantidos (apenas PKs com nome auto-derivado são renomeados)
- **Foreign keys** continuam a funcionar (referências internas são actualizadas automaticamente)
- **Sequences** mantêm-se
- **RLS policies** seriam mantidas (não existem neste caso)
- **Triggers** seriam mantidos (não existem neste caso)

Ref: https://www.postgresql.org/docs/current/sql-altertable.html

```sql
ALTER TABLE temp_deals RENAME TO deals;
-- FKs que apontam para temp_deals (de deal_clients, deal_compliance, deal_payments)
-- continuam a funcionar automaticamente.
```

### 4.2 Ordem de Execução (importante para FKs)

As child tables referenciam `temp_deals`. O PostgreSQL lida com isso automaticamente ao renomear, mas por clareza:

```sql
-- 1. Renomear tabelas filhas primeiro (que referenciam temp_deals)
ALTER TABLE temp_deal_clients RENAME TO deal_clients;
ALTER TABLE temp_deal_compliance RENAME TO deal_compliance;
ALTER TABLE temp_deal_payments RENAME TO deal_payments;

-- 2. Renomear tabela pai
ALTER TABLE temp_deals RENAME TO deals;
```

### 4.3 Renomear FK Constraints (opcional mas recomendado)

O `ALTER TABLE RENAME TO` **não** renomeia automaticamente os nomes dos constraints. Os nomes antigos (`temp_deals_property_id_fkey`) continuariam a funcionar, mas o código Supabase referencia-os explicitamente nos selects com `!fkey_name`.

**Tem de se renomear** para manter consistência com o código:

```sql
-- FKs da tabela deals (ex-temp_deals)
ALTER TABLE deals RENAME CONSTRAINT temp_deals_property_id_fkey TO deals_property_id_fkey;
ALTER TABLE deals RENAME CONSTRAINT temp_deals_consultant_id_fkey TO deals_consultant_id_fkey;
ALTER TABLE deals RENAME CONSTRAINT temp_deals_created_by_fkey TO deals_created_by_fkey;
ALTER TABLE deals RENAME CONSTRAINT temp_deals_internal_colleague_id_fkey TO deals_internal_colleague_id_fkey;

-- FKs das tabelas filhas
ALTER TABLE deal_clients RENAME CONSTRAINT temp_deal_clients_deal_id_fkey TO deal_clients_deal_id_fkey;
ALTER TABLE deal_compliance RENAME CONSTRAINT temp_deal_compliance_deal_id_fkey TO deal_compliance_deal_id_fkey;
ALTER TABLE deal_payments RENAME CONSTRAINT temp_deal_payments_deal_id_fkey TO deal_payments_deal_id_fkey;
```

### 4.4 Renomear PK Indexes (opcional, cosmético)

```sql
ALTER INDEX temp_deals_pkey RENAME TO deals_pkey;
ALTER INDEX temp_deal_clients_pkey RENAME TO deal_clients_pkey;
ALTER INDEX temp_deal_compliance_pkey RENAME TO deal_compliance_pkey;
ALTER INDEX temp_deal_payments_pkey RENAME TO deal_payments_pkey;
```

> Os indexes custom (`idx_deals_property`, `idx_deal_compliance_deal`, etc.) já não têm `temp_` no nome — não precisam de ser renomeados.

---

## 5. Migração SQL Completa

```sql
-- ============================================
-- Migration: Remove temp_ prefix from deal tables
-- ============================================

BEGIN;

-- 1. Rename tables (children first)
ALTER TABLE temp_deal_clients RENAME TO deal_clients;
ALTER TABLE temp_deal_compliance RENAME TO deal_compliance;
ALTER TABLE temp_deal_payments RENAME TO deal_payments;
ALTER TABLE temp_deals RENAME TO deals;

-- 2. Rename FK constraints (required — code references these by name)
ALTER TABLE deals RENAME CONSTRAINT temp_deals_property_id_fkey TO deals_property_id_fkey;
ALTER TABLE deals RENAME CONSTRAINT temp_deals_consultant_id_fkey TO deals_consultant_id_fkey;
ALTER TABLE deals RENAME CONSTRAINT temp_deals_created_by_fkey TO deals_created_by_fkey;
ALTER TABLE deals RENAME CONSTRAINT temp_deals_internal_colleague_id_fkey TO deals_internal_colleague_id_fkey;
ALTER TABLE deal_clients RENAME CONSTRAINT temp_deal_clients_deal_id_fkey TO deal_clients_deal_id_fkey;
ALTER TABLE deal_compliance RENAME CONSTRAINT temp_deal_compliance_deal_id_fkey TO deal_compliance_deal_id_fkey;
ALTER TABLE deal_payments RENAME CONSTRAINT temp_deal_payments_deal_id_fkey TO deal_payments_deal_id_fkey;

-- 3. Rename PK indexes (cosmetic)
ALTER INDEX temp_deals_pkey RENAME TO deals_pkey;
ALTER INDEX temp_deal_clients_pkey RENAME TO deal_clients_pkey;
ALTER INDEX temp_deal_compliance_pkey RENAME TO deal_compliance_pkey;
ALTER INDEX temp_deal_payments_pkey RENAME TO deal_payments_pkey;

COMMIT;
```

---

## 6. Substituições no Código (Find & Replace)

Após executar a migração SQL, aplicar as seguintes substituições nos **9 ficheiros de código** + regenerar types:

### 6.1 Nomes de tabelas (`.from(...)`)

| Find                        | Replace                  |
|-----------------------------|--------------------------|
| `'temp_deals'`              | `'deals'`                |
| `'temp_deal_clients'`       | `'deal_clients'`         |
| `'temp_deal_compliance'`    | `'deal_compliance'`      |
| `'temp_deal_payments'`      | `'deal_payments'`        |

### 6.2 Nomes de FK constraints (nos selects Supabase `!fkey_name`)

| Find                                        | Replace                                  |
|----------------------------------------------|------------------------------------------|
| `temp_deals_consultant_id_fkey`              | `deals_consultant_id_fkey`               |
| `temp_deals_property_id_fkey`                | `deals_property_id_fkey`                 |
| `temp_deals_internal_colleague_id_fkey`      | `deals_internal_colleague_id_fkey`       |
| `temp_deals_created_by_fkey`                 | `deals_created_by_fkey`                  |
| `temp_deal_clients_deal_id_fkey`             | `deal_clients_deal_id_fkey`              |
| `temp_deal_compliance_deal_id_fkey`          | `deal_compliance_deal_id_fkey`           |
| `temp_deal_payments_deal_id_fkey`            | `deal_payments_deal_id_fkey`             |

### 6.3 Regenerar types

```bash
npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts
```

---

## 7. Checklist de Execução

- [ ] **1. Executar migração SQL** (secção 5) no Supabase
- [ ] **2. Verificar** que tabelas foram renomeadas: `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'deal%';`
- [ ] **3. Substituir** nomes de tabelas nos 9 ficheiros de código (secção 6.1)
- [ ] **4. Substituir** nomes de FK constraints nos 5 ficheiros com FK hints (secção 6.2)
- [ ] **5. Regenerar** `types/database.ts` (secção 6.3)
- [ ] **6. Actualizar docs** (opcional — 4 ficheiros de documentação)
- [ ] **7. Testar** localmente: `npm run dev` + testar CRUD de deals
- [ ] **8. Commit** com mensagem descritiva

---

## 8. Padrões Existentes no Projecto (Referência)

O projecto já seguiu um padrão similar com o prefixo `dev_` nas tabelas principais:
- `dev_properties` (não `properties`)
- `dev_users` (não `users`)
- `dev_property_specifications`, `dev_property_internal`, `dev_property_media`
- `dev_consultant_profiles`, `dev_consultant_private_data`

A diferença é que `dev_` é um prefixo intencional de namespace, enquanto `temp_` é um prefixo temporário que deveria ter sido removido. As tabelas de deals são as únicas com `temp_` que estão activamente em uso no código.

---

## 9. Riscos e Mitigação

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Downtime durante migração | Baixa | `ALTER TABLE RENAME` é instantâneo (metadata-only, sem cópia de dados) |
| Código com referência antiga | Média | Find & replace global + testes manuais |
| FK hint errado no Supabase select | Alta se esquecido | Renomear constraints É obrigatório (secção 4.3) |
| Types desactualizados | Baixa | Regenerar automaticamente |
