# SPEC — Melhorias ao Modulo de Despesas da Empresa

**Data:** 2026-03-29
**Versao:** 1.0
**Modulo:** M28 — Despesas (Melhorias)
**Dependencias:** M21 (Financeiro Dashboard), M23 (Parceiros)

---

## 1. Visao Geral

Conjunto de melhorias ao modulo de Gestao da Empresa (despesas/receitas) para tornar o registo de despesas mais robusto, auditavel e integrado com o resto do ERP. Foco em seis areas:

| Area | Descricao |
|------|-----------|
| **Armazenamento de Recibos** | Imagens de recibos comprimidas e guardadas na base de dados (nao em storage publico) |
| **Confianca IA por Campo** | Cada campo extraido pela IA tem uma pontuacao de confianca individual, com destaque visual |
| **Deteccao de Duplicados** | Aviso automatico quando se tenta registar uma fatura ja existente |
| **Trilho de Auditoria** | Registo de todas as edicoes e cancelamentos de transaccoes confirmadas/pagas |
| **Ligacao a Parceiros** | Associar despesas a parceiros existentes no sistema |
| **Cron Despesas Recorrentes** | Geracao automatica diaria de despesas recorrentes |

---

## 2. Armazenamento de Recibos

### 2.1. Problema

Anteriormente, o recibo era enviado para a IA, os dados extraidos eram guardados, mas a imagem original era descartada. O campo `receipt_url` existia na tabela mas nunca era populado. O R2 (Cloudflare) e publico, logo nao adequado para documentos financeiros sensiveis.

### 2.2. Solucao

- A imagem e comprimida **client-side** antes de envio:
  - Formato: WebP
  - Dimensao maxima: 1200px (largura ou altura)
  - Tamanho maximo: ~300KB
  - Qualidade progressivamente reduzida (80% → 30%) ate ficar abaixo do limite
- A imagem comprimida (base64 data URL) e guardada no campo `receipt_url` da tabela `company_transactions`
- Armazenamento dentro do PostgreSQL (Supabase) — privado, sem exposicao publica

### 2.3. Fluxo

```
Utilizador selecciona imagem
  |
  v (em paralelo)
Preview exibido imediatamente (FileReader)
Compressao WebP em background (Canvas API)
  |
  v
Utilizador clica "Extrair dados com IA"
  |
  v
Imagem comprimida enviada ao GPT-4o-mini
  |
  v
Dados extraidos + confianca por campo retornados
  |
  v
Utilizador revisa/corrige campos
  |
  v
"Confirmar e Guardar"
  |
  v
POST /api/financial/company-transactions
  body inclui receipt_url (base64 data URL comprimido)
  |
  v
Transaccao guardada com recibo na BD
```

### 2.4. Visualizacao

- Na tabela de transaccoes, transaccoes com recibo mostram um icone de ficheiro (FileImage) junto ao nome da entidade
- Clicar no icone abre um dialog com a imagem do recibo em tamanho completo

### 2.5. Ficheiros Alterados

- `components/financial/receipt-scanner.tsx` — funcao `compressImage()`, estado `compressedImage`, passagem de `receiptImageBase64` no `onConfirm`
- `components/financial/company-management-tab.tsx` — envio de `receipt_url` no POST, dialog de preview, icone na tabela

---

## 3. Confianca IA por Campo

### 3.1. Problema

A IA retornava apenas uma pontuacao de confianca global. Nao era possivel saber quais campos especificos eram pouco fiaveis.

### 3.2. Solucao

#### Prompt IA Actualizado

O prompt do GPT-4o-mini agora pede adicionalmente:
```
field_confidences: Objecto com confianca por campo (0.0 a 1.0)
Exemplo: { "entity_name": 0.95, "entity_nif": 0.9, "amount_net": 0.85, ... }
Se o campo for null, a confianca deve ser 0.0.
```

#### UI — Indicadores de Confianca

- **Threshold:** 70% (constante `LOW_CONFIDENCE_THRESHOLD`)
- Campos com confianca **< 70%**:
  - Borda amber (`ring-2 ring-amber-400/60`)
  - Fundo amber subtil (`bg-amber-50/50`)
  - Icone de aviso (triangulo amber) com tooltip mostrando a percentagem
- Campos com confianca **>= 70%**:
  - Percentagem verde subtil junto ao label
- Banner global quando confianca geral e baixa: "Revise os campos destacados"

#### Armazenamento

- Campo `field_confidences` (JSONB) adicionado a `company_transactions`
- Guardado junto com a transaccao para referencia futura

### 3.3. Ficheiros Alterados

- `app/api/financial/scan-receipt/route.ts` — prompt actualizado, `max_tokens` aumentado para 1500
- `types/financial.ts` — interface `FieldConfidences`, adicionada a `ReceiptScanResult` e `CompanyTransaction`
- `lib/validations/financial.ts` — campo `field_confidences` no schema Zod
- `components/financial/receipt-scanner.tsx` — componente `ConfidenceField`, logica de `fieldStyle()`

---

## 4. Deteccao de Duplicados

### 4.1. Problema

Nada impedia o utilizador de registar o mesmo recibo duas vezes, criando transaccoes duplicadas.

### 4.2. Solucao

- Antes de guardar uma despesa digitalizada, o frontend consulta as transaccoes do mes/ano actual
- Verifica se ja existe uma transaccao com o mesmo `invoice_number` + `entity_nif` e status != `cancelled`
- Se encontrar: mostra `toast.warning` com aviso de possivel duplicado
- **Nao bloqueia** — o utilizador pode guardar na mesma (pode ser intencional)

### 4.3. Ficheiros Alterados

- `components/financial/company-management-tab.tsx` — logica em `handleScanConfirm()`

---

## 5. Trilho de Auditoria

### 5.1. Problema

Edicoes a transaccoes confirmadas ou pagas nao eram registadas. Impossivel saber quem alterou o que e quando.

### 5.2. Solucao

#### Tabela `company_transaction_audit`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | UUID PK | Identificador unico |
| `transaction_id` | UUID FK → company_transactions | Transaccao afectada |
| `user_id` | UUID FK → dev_users | Utilizador que fez a alteracao |
| `action` | TEXT | Tipo: `update`, `status_change`, `cancel` |
| `old_data` | JSONB | Estado anterior completo da transaccao |
| `new_data` | JSONB | Estado novo (completo ou parcial) |
| `created_at` | TIMESTAMPTZ | Data/hora da alteracao |

#### Quando e Registado

- **PUT** em transaccoes com status `confirmed` ou `paid` → accao `update` ou `status_change`
- **DELETE** (soft delete → cancelled) → accao `cancel`
- Transaccoes em `draft` **nao** geram auditoria (sao rascunhos)

### 5.3. Ficheiros Alterados

- `app/api/financial/company-transactions/[id]/route.ts` — logica de auditoria no PUT e DELETE
- `supabase/migrations/20260329_expense_improvements.sql` — criacao da tabela e indice

---

## 6. Ligacao a Parceiros

### 6.1. Problema

Despesas registavam `entity_name` e `entity_nif` como texto livre, sem ligacao a entidades existentes no sistema. Impossivel agregar gastos por parceiro.

### 6.2. Solucao

- Campo `partner_id` (UUID, FK → `temp_partners`) adicionado a `company_transactions`
- Dropdown "Parceiro" no dialog de adicionar transaccao manual
- Seleccionar um parceiro auto-preenche `entity_name` e `entity_nif`
- Parceiros carregados via `GET /api/partners?is_active=true&limit=200`

### 6.3. Ficheiros Alterados

- `components/financial/company-management-tab.tsx` — estado `partners`, dropdown `Select`, auto-fill, envio de `partner_id`
- `lib/validations/financial.ts` — campo `partner_id` no schema
- `types/financial.ts` — campo `partner_id` na interface `CompanyTransaction`
- `supabase/migrations/20260329_expense_improvements.sql` — coluna + indice

---

## 7. Cron de Despesas Recorrentes

### 7.1. Problema

As despesas recorrentes so eram geradas quando alguem clicava manualmente "Gerar Recorrentes" na UI. Se ninguem visitasse a pagina no inicio do mes, as despesas nao apareciam.

### 7.2. Solucao

- Endpoint cron: `GET /api/cron/generate-recurring-expenses`
- Autenticacao via `CRON_SECRET` (query param `key`)
- Usa `createAdminClient()` (service role, sem RLS)
- Idempotente: verifica se ja foram geradas para o mes corrente antes de criar
- Respeita frequencia de cada template (mensal, trimestral, anual)

### 7.3. Configuracao Coolify

```
Nome: Generate recurring expenses
Comando: wget -qO- "https://app.infinitygroup.pt/api/cron/generate-recurring-expenses"
Frequencia: 0 2 1 * * (1o dia de cada mes as 02:00)
Timeout: 30
```

**Nota:** `curl` nao esta disponivel no container Next.js do Coolify. Usar `wget` ou `node -e "fetch(...)"`.

### 7.4. Ficheiros Criados

- `app/api/cron/generate-recurring-expenses/route.ts`

---

## 8. Migracao de Base de Dados

### Ficheiro

`supabase/migrations/20260329_expense_improvements.sql`

### SQL

```sql
ALTER TABLE company_transactions
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES temp_partners(id) ON DELETE SET NULL;

ALTER TABLE company_transactions
  ADD COLUMN IF NOT EXISTS field_confidences JSONB DEFAULT NULL;

CREATE TABLE IF NOT EXISTS company_transaction_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES company_transactions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_audit_transaction ON company_transaction_audit(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_partner ON company_transactions(partner_id);
```

### Como Aplicar

Executar no Supabase SQL Editor (Dashboard → SQL Editor → colar → Run).

---

## 9. Resumo de Ficheiros

### Criados
| Ficheiro | Descricao |
|----------|-----------|
| `app/api/cron/generate-recurring-expenses/route.ts` | Cron diario para gerar despesas recorrentes |
| `supabase/migrations/20260329_expense_improvements.sql` | Migracao: partner_id, field_confidences, audit table |
| `docs/M28-DESPESAS-MELHORIAS/SPEC-M28-DESPESAS-MELHORIAS.md` | Esta especificacao |

### Alterados
| Ficheiro | Alteracoes |
|----------|------------|
| `app/api/financial/scan-receipt/route.ts` | Prompt IA com field_confidences, max_tokens 1500 |
| `app/api/financial/company-transactions/[id]/route.ts` | Auditoria no PUT e DELETE |
| `components/financial/receipt-scanner.tsx` | Compressao WebP, confianca por campo, armazenamento imagem |
| `components/financial/company-management-tab.tsx` | Parceiros, duplicados, preview recibo, sr-only DialogTitles |
| `types/financial.ts` | FieldConfidences, partner_id, field_confidences na CompanyTransaction |
| `lib/validations/financial.ts` | field_confidences (z.record), partner_id (z.uuid) |

---

## 10. Melhorias Futuras (Diferidas)

| Melhoria | Prioridade | Notas |
|----------|-----------|-------|
| Ligacao de despesa a imovel/deal | Media | Adicionar `property_id` / `deal_id` para P&L por negocio |
| Orcamento por categoria | Media | Budget vs actual com alertas |
| Exportacao CSV para contabilista | Media | IVA mensal, totais por categoria |
| Reconciliacao bancaria | Baixa | Import de extracto bancario + matching automatico |
| Digitalizacao em lote | Baixa | Fila de multiplos recibos com revisao batch |
| Relatorios IVA/IRC | Baixa | Gerador de declaracoes fiscais |
