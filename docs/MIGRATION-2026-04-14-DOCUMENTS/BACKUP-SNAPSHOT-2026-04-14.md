# Backup do estado actual antes da migration

**Data:** 2026-04-14
**Projecto:** umlndumjfamfsswwjgoo (ERP Infinity v2)
**Aplicado por:** Claude Code via Supabase MCP

## Resumo

| Objecto | Estado |
|---|---|
| `doc_types` | 31 linhas, 8 colunas |
| `lead_attachments` | **0 linhas** (tabela vazia), 5 colunas |
| `negocio_documents` | não existe |

**Fingerprint `doc_types` (pré-migration):** `05af3e0463767476c8e5394bc79add63`
**Fingerprint `lead_attachments` (pré-migration):** `null` (tabela vazia)

## Schema `doc_types` antes

| column | type | null | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | — |
| description | text | YES | — |
| default_validity_months | integer | YES | — |
| created_at | timestamptz | YES | now() |
| is_system | boolean | YES | false |
| category | text | YES | 'Geral' |
| allowed_extensions | text[] | YES | `{pdf,jpg,png,jpeg,doc,docx}` |

## Schema `lead_attachments` antes

| column | type | null | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| lead_id | uuid | NO | — |
| url | text | NO | — |
| name | text | YES | — |
| created_at | timestamptz | YES | now() |

## Categorias existentes em `doc_types`

| category | n |
|---|---|
| Contratual | 1 |
| Imóvel | 8 |
| Jurídico | 4 |
| Jurídico Especial | 3 |
| **Negócio** | 5 |
| Outro | 1 |
| Proprietário | 4 |
| Proprietário Empresa | 5 |

Nota: a categoria "Negócio" não estava no backfill inicial — migration ajustada para cobrir.

## Dump completo de `doc_types` (31 linhas)

Ver `BACKUP-doc-types.json` (preservado em separado se necessário).

## Acções se for preciso rollback

1. Correr `02-ROLLBACK.sql` via MCP ou SQL Editor.
2. `lead_attachments` fica inalterado (0 linhas, nenhuma perda de dados).
3. `doc_types` perde a coluna `applies_to` (backfill é descartável).
4. `negocio_documents` é dropped (desde que não tenha dados novos).

## Aplicação (2026-04-14)

**Status:** ✅ Aplicadas com sucesso via Supabase MCP.

**Verificação pós-migration:**
- `doc_types`: 31 linhas, fingerprint **`05af3e0463767476c8e5394bc79add63`** — idêntico ao pré-migration (zero perda de dados).
- `doc_types.applies_to` preenchido em 30/31 linhas; 1 linha ("Outro") ficou como `{}` (global — comportamento desejado).
- `lead_attachments`: nova coluna `doc_type_id` + 4 metadata columns criadas; índice `idx_lead_attachments_doc_type` criado.
- `negocio_documents`: tabela nova criada, trigger `trg_touch_negocio_documents_updated_at` activo, 3 índices.

**Breakdown de `applies_to` por categoria:**

| Categoria | Scope | n |
|---|---|---|
| Contratual | `{properties, negocios}` | 1 |
| Imóvel | `{properties}` | 8 |
| Jurídico | `{properties}` | 4 |
| Jurídico Especial | `{properties}` | 3 |
| Negócio | `{negocios}` | 5 |
| Outro | `{}` (global) | 1 |
| Proprietário | `{properties, leads, negocios}` | 4 |
| Proprietário Empresa | `{properties, leads, negocios}` | 5 |

**Nota técnica:** a regeneração de `types/database.ts` expôs ~94 erros TS pré-existentes em ficheiros não relacionados. Não é regressão; estavam escondidos pelo ficheiro corrompido anterior. Criar change separada `cleanup-types-after-db-regen` para limpar.
