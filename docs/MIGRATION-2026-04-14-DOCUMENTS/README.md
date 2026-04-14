# Migration 2026-04-14 — Documents folder UI

Supporting SQL for the openspec change [add-document-folders-ui](../../openspec/changes/add-document-folders-ui/).

## O que muda

| Objecto | Alteração | Risco |
|---|---|---|
| `doc_types.applies_to text[]` | **ADD** — permite filtrar tipos por domínio (`properties`, `leads`, `negocios`, `processes`). Backfill por categoria. | Baixo — aditivo |
| `lead_attachments.doc_type_id uuid` | **ADD** — FK opcional → `doc_types(id)`. | Baixo — aditivo, NULL por defeito |
| `lead_attachments.{file_size,mime_type,valid_until,notes}` | **ADD** — metadata opcional usado pelo novo upload multipart. | Baixo — aditivo |
| `negocio_documents` | **CREATE** — tabela nova para documentos de negócios. | Zero — tabela nova |

Nenhuma coluna existente é alterada ou removida.

## Ordem de execução

1. **`00-BACKUP-SNAPSHOT.sql`** — tira snapshot do estado actual (schema + dados + fingerprints). Guarda os resultados localmente (CSV/JSON) antes de prosseguir.
2. **`01-APPLY-MIGRATIONS.sql`** — aplica as 3 migrations numa única transacção com verificações internas. Se qualquer verificação falhar, faz ROLLBACK automático.
3. (Opcional) **`02-ROLLBACK.sql`** — desfaz tudo caso surja um problema depois do commit. **Destrutivo** para `negocio_documents` — perde dados inseridos entretanto.

## Como correr

**Via Supabase Studio:**
1. Abrir SQL Editor em https://supabase.com/dashboard/project/umlndumjfamfsswwjgoo/sql
2. Colar `00-BACKUP-SNAPSHOT.sql`, executar, exportar cada resultado como CSV.
3. Colar `01-APPLY-MIGRATIONS.sql`, executar. Se vires `RAISE EXCEPTION`, o rollback foi automático.
4. Comparar os fingerprints pós-migration com os do backup — devem bater.

**Via CLI local (se `supabase link` estiver configurado):**
```bash
supabase db push   # aplica os ficheiros em supabase/migrations/
```
Os 3 ficheiros `20260414_*.sql` estão em [supabase/migrations/](../../supabase/migrations/).

## Depois de aplicar

Regenerar os types TypeScript:
```bash
npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts
```

Validar em staging:
- Leads → tab Anexos → upload de um PDF num tipo de doc (e.g. "Cartão de Cidadão") → confirmar que entra na pasta certa.
- Negócios → nova tab Documentos → upload + download em lote.
- Imóveis → tab Documentos (vista "Pastas") continua a funcionar.
