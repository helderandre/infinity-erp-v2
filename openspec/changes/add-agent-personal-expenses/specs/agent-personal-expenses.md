# Capability: agent-personal-expenses

## Resumo

Permite ao consultor (roles `Consultor`, `Consultora Executiva`, `Team Leader`) registar as suas despesas pessoais relacionadas com a actividade comercial — combustível, refeições com clientes, brindes, etc. — anexando fotos de recibos com extracção automática por IA. **As despesas digitalizadas substituem legalmente o arquivo em papel ao abrigo do art. 19.º do DL 28/2019** (autenticidade, integridade, legibilidade, pesquisabilidade, retenção 10 anos). As despesas são **estritamente privadas ao próprio**: gestão não tem acesso, não afectam a contabilidade da empresa, e não modificam os KPIs de `conta_corrente_transactions` ou `company_transactions`.

## Modelo de dados

### `agent_personal_expenses`

| Coluna | Tipo | Mutável | Notas |
|---|---|---|---|
| `id` | `uuid` | — | PK, default `gen_random_uuid()` |
| `agent_id` | `uuid` | ❌ | FK → `dev_users(id)` ON DELETE CASCADE, NOT NULL |
| `expense_date` | `date` | ✅ (grace) | Data do recibo, NOT NULL |
| `category` | `text` | ✅ | Livre, NOT NULL — ver `DEFAULT_PERSONAL_EXPENSE_CATEGORIES` |
| `description` | `text` | ✅ | Opcional |
| `vendor_name` | `text` | ✅ (grace) | Entidade emitente |
| `vendor_nif` | `text` | ✅ (grace) | NIF (PT) |
| `amount_gross` | `numeric(12,2)` | ✅ (grace) | Com IVA, NOT NULL |
| `amount_net` | `numeric(12,2)` | ✅ (grace) | Sem IVA, opcional |
| `vat_amount` | `numeric(12,2)` | ✅ (grace) | |
| `vat_pct` | `numeric(5,2)` | ✅ (grace) | Tipicamente 6, 13, 23 (PT) |
| `invoice_number` | `text` | ✅ (grace) | |
| `notes` | `text` | ✅ | Comentário do consultor (sempre editável) |
| `receipt_url` | `text` | ❌ | URL R2 da foto/PDF, NOT NULL |
| `receipt_mimetype` | `text` | ❌ | NOT NULL |
| `receipt_size_bytes` | `bigint` | ❌ | NOT NULL |
| `receipt_hash` | `text` | ❌ | SHA-256 hex do ficheiro original, NOT NULL |
| `receipt_width_px` | `int` | ❌ | Para validação de legibilidade |
| `receipt_height_px` | `int` | ❌ | |
| `ocr_confidence` | `numeric(3,2)` | ❌ | 0..1 |
| `ocr_field_confidences` | `jsonb` | ❌ | Por campo |
| `archived_at` | `timestamptz` | ❌ | NOT NULL DEFAULT now() |
| `archived_by` | `uuid` | ❌ | FK → `dev_users(id)`, NOT NULL |
| `archive_chain_hash` | `text` | ❌ | SHA-256 hex de (prev_chain_hash \|\| row_digest), NOT NULL |
| `archive_status` | `text` | sistema | CHECK ∈ {`pending`, `archived`, `invalidated`}, default `pending` |
| `archive_locked_at` | `timestamptz` | sistema | Quando o grace period termina |
| `created_at` | `timestamptz` | — | |
| `updated_at` | `timestamptz` | — | trigger |

**Coluna "Mutável"**:
- ✅ = sempre editável (mesmo após arquivo).
- ✅ (grace) = editável só durante grace period (até `archive_locked_at`).
- ❌ = imutável após INSERT (trigger bloqueia UPDATE).
- sistema = mutado apenas por endpoints internos / cron.

Index:
- `idx_agent_personal_expenses_agent_date (agent_id, expense_date DESC)`
- `idx_agent_personal_expenses_archived_at (agent_id, archived_at DESC)`

### Triggers

```sql
-- Bloqueia mutação de colunas de arquivo
CREATE TRIGGER trg_agent_personal_expenses_immutable
BEFORE UPDATE ON agent_personal_expenses
FOR EACH ROW
EXECUTE FUNCTION agent_personal_expenses_immutable_archive();

-- Bloqueia DELETE após grace period
CREATE TRIGGER trg_agent_personal_expenses_retention
BEFORE DELETE ON agent_personal_expenses
FOR EACH ROW
EXECUTE FUNCTION agent_personal_expenses_retention_lock();
```

Trigger `agent_personal_expenses_immutable_archive`:
- Compara OLD vs. NEW para todas as colunas com ❌ na tabela acima.
- Se diferentes → `RAISE EXCEPTION 'Colunas de arquivo são imutáveis (DL 28/2019)'`.
- Adicionalmente, durante grace period (`archive_status='pending'` AND `now() < archive_locked_at`), bloqueia mutação dos campos ✅(grace) **só** se a request vier de fora do whitelist de endpoints (controlado a nível aplicacional, não SQL).

Trigger `agent_personal_expenses_retention_lock`:
- Permite DELETE se `archive_status = 'pending'` AND `now() < archive_locked_at`.
- Permite DELETE se `archive_status = 'invalidated'` (purge manual após 10 anos).
- Caso contrário → `RAISE EXCEPTION 'Despesa arquivada — não pode ser eliminada antes dos 10 anos (DL 28/2019)'`.

### RLS

```sql
ALTER TABLE agent_personal_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_self_rw ON agent_personal_expenses
  FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());
```

**Não há excepção para gestão.** Acesso só via `service_role` em consultas SQL ad-hoc (e mesmo nesses casos o trigger de imutabilidade aplica-se).

### Categorias default

```typescript
export const DEFAULT_PERSONAL_EXPENSE_CATEGORIES = [
  'Deslocações & combustível',
  'Refeições com clientes',
  'Estacionamento & portagens',
  'Brindes & atenções',
  'Telemóvel & dados',
  'Marketing pessoal',
  'Material de escritório',
  'Subscrições & software',
  'Formação & eventos',
  'Outras',
] as const
```

### R2 Storage

- **Bucket dedicado**: `infinity-personal-expenses` (separado do `public`).
- **Object Lock activado** em modo COMPLIANCE com retention 10 anos.
- **Prefix structure**:
  - `personal-expenses-pending/{agent_id}/{ts}-{name}` — durante grace period (sem lock para permitir delete).
  - `personal-expenses-archive/{agent_id}/{yyyy}/{mm}/{hash[:8]}-{name}` — após confirm-archive ou auto-promote no end-of-grace (com Object Lock).
- **Permissões da role API**:
  - `s3:PutObject` em ambos os prefixes.
  - `s3:GetObject` em ambos os prefixes.
  - `s3:DeleteObject` **apenas** em `personal-expenses-pending/*`.

Endpoint de promote (`/[id]/confirm-archive`) faz `CopyObject` de pending → archive + `DeleteObject` no pending.

## Endpoints

### `POST /api/agent-personal-expenses/upload-receipt`

Upload multipart de uma foto/PDF do recibo.

- Auth: `requireAuth()`
- Body: `multipart/form-data` com campo `file`.
- Validação:
  - MIME ∈ `{image/jpeg, image/png, image/webp, image/heic, application/pdf}`.
  - Tamanho ≤ 10MB.
  - Imagens: `min(width, height) >= 1000` (legibilidade legal). PDFs isentos.
- Acção:
  - Calcula SHA-256 do stream.
  - Lê dimensões (image-size lib) — só para imagens.
  - Upload para `personal-expenses-pending/{auth.user.id}/{Date.now()}-{sanitize(name)}`.
- Resposta:
  ```json
  {
    "url": "https://archive.r2.dev/personal-expenses-pending/<uuid>/...",
    "mimetype": "image/jpeg",
    "size_bytes": 1234567,
    "hash": "ab12...ef89",
    "width_px": 1500,
    "height_px": 2000
  }
  ```
- Erros: `400` (validação), `413` (tamanho), `422` (dimensões), `500` (upload).

### `POST /api/agent-personal-expenses`

Cria despesa (entra em `archive_status='pending'` durante grace period de 30 dias).

- Auth: `requireAuth()`
- Body Zod:
  ```typescript
  z.object({
    expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.string().min(1).max(100),
    amount_gross: z.number().positive(),
    amount_net: z.number().nonnegative().optional(),
    vat_amount: z.number().nonnegative().optional(),
    vat_pct: z.number().min(0).max(100).optional(),
    vendor_name: z.string().max(200).optional(),
    vendor_nif: z.string().max(20).optional(),
    invoice_number: z.string().max(50).optional(),
    description: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
    // Archive fields (do upload anterior)
    receipt_url: z.string().url(),
    receipt_mimetype: z.string().max(50),
    receipt_size_bytes: z.number().int().positive(),
    receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    receipt_width_px: z.number().int().positive().optional(),
    receipt_height_px: z.number().int().positive().optional(),
    ocr_confidence: z.number().min(0).max(1).optional(),
    ocr_field_confidences: z.record(z.number()).optional(),
  })
  ```
- Pre-INSERT:
  1. Re-valida que o ficheiro existe no R2 e que `Content-MD5` (ou stream re-hash) bate com o `receipt_hash` reportado. **Defesa anti-tamper.**
  2. Lê última row deste `agent_id` ordenada por `archived_at DESC`. Se existe, usa `archive_chain_hash`; senão `'0' x 64`.
  3. `archived_at = now()` (server time, NÃO confiar em cliente).
  4. `row_digest = SHA-256(receipt_hash || expense_date_iso || amount_gross || (vendor_nif || '') || archived_at_iso)`.
  5. `archive_chain_hash = SHA-256(prev_chain_hash || row_digest)`.
  6. `archive_locked_at = archived_at + interval '30 days'`.
- `agent_id` e `archived_by` forçados a `auth.user.id` independentemente do body.
- Resposta: `201` + linha completa.
- Erros: `400` (validação), `409` (`receipt_url` já em uso noutra despesa), `422` (hash não bate).

### `GET /api/agent-personal-expenses`

Lista despesas do próprio.

- Query: `from` (ISO date), `to` (ISO date), `category` (string), `archive_status` (`pending|archived|all`), `page` (default 1), `limit` (default 30, max 50).
- Scope: forçado a `auth.user.id`. Se um broker/admin chamar com `?agent_id=other`, retorna `403`.
- Resposta: `{ data: [...], page, total, hasMore }`.

### `GET /api/agent-personal-expenses/[id]`

Detalhe de uma despesa. RLS bloqueia se não for o próprio. Inclui campo computed `is_editable: archive_status='pending' && now() < archive_locked_at`.

### `PUT /api/agent-personal-expenses/[id]`

Edita despesa. **Whitelist condicional**:
- Se `archive_status='pending'` e dentro do grace period: edita campos ✅(grace) — `expense_date`, `vendor_name`, `vendor_nif`, `amount_gross`, `amount_net`, `vat_amount`, `vat_pct`, `invoice_number`, `description`.
- Sempre: edita campos ✅ — `category`, `notes`.
- Nunca: campos ❌ (trigger bloqueia mesmo se passarem na whitelist da API).

Cada UPDATE escreve linha em `log_audit` (`entity_type='agent_personal_expense'`, `action='update'`, com `old_data`/`new_data` diff).

### `POST /api/agent-personal-expenses/[id]/confirm-archive`

Atalho para o consultor "selar" antes do grace period acabar.

- Auth: `requireAuth()` + ownership check.
- Pré-condição: `archive_status='pending'`.
- Acção:
  1. `CopyObject` no R2: `personal-expenses-pending/...` → `personal-expenses-archive/{yyyy}/{mm}/{hash[:8]}-{name}`.
  2. UPDATE row: `archive_status='archived'`, `archive_locked_at=now()`, `receipt_url=<new_archive_url>` (esta mutação é EXCEPCIONALMENTE permitida pelo trigger via session var `app.confirm_archive=true`).
  3. `DeleteObject` no R2 do path pending.
- Resposta: linha actualizada.
- Erros: `400` (já archived), `500` (R2 fail; row preservada em pending).

### `POST /api/agent-personal-expenses/[id]/invalidate`

Purge manual após 10 anos (consultor invoca explicitamente).

- Auth: `requireAuth()` + ownership.
- Pré-condição: `archive_status='archived'` AND `archived_at < now() - interval '10 years'`.
- Acção: `archive_status='invalidated'`. Subsequente DELETE permitido.
- Resposta: linha actualizada com aviso "Pode agora apagar definitivamente."

### `DELETE /api/agent-personal-expenses/[id]`

Apaga linha + ficheiro R2.

- Auth: `requireAuth()` + ownership.
- Pré-condições (qualquer uma):
  - `archive_status='pending'` AND `now() < archive_locked_at`.
  - `archive_status='invalidated'` (após purge manual).
- Trigger SQL bloqueia se nenhuma se aplicar.
- Acção: `DeleteObjectCommand` no R2 + `DELETE FROM agent_personal_expenses`.
- Erros: `409` (despesa arquivada e dentro do retention) — mensagem clara.

### `GET /api/agent-personal-expenses/integrity-check`

Verifica chain hash de todas as linhas do consultor.

- Auth: `requireAuth()`.
- Acção:
  1. SELECT `id, receipt_hash, expense_date, amount_gross, vendor_nif, archived_at, archive_chain_hash` ORDER BY `archived_at ASC`.
  2. Walk linear: para cada linha, recalcula `row_digest` + `archive_chain_hash` esperado e compara.
- Resposta:
  ```json
  {
    "verified": true,
    "total_rows": 42,
    "checked_at": "2026-06-07T12:00:00Z"
  }
  ```
  ou em caso de falha:
  ```json
  {
    "verified": false,
    "broken_at_id": "uuid",
    "broken_at_index": 17,
    "total_rows": 42,
    "checked_at": "2026-06-07T12:00:00Z"
  }
  ```
- Cache: `Cache-Control: private, max-age=300` (5 min).

### `GET /api/agent-personal-expenses/summary?from=&to=`

Agregados para os KPIs do tab.

- Resposta:
  ```json
  {
    "total_amount": 1234.56,
    "count": 42,
    "by_category": [
      { "category": "Deslocações & combustível", "amount": 567.89, "count": 15 }
    ]
  }
  ```

### `GET /api/agent-personal-expenses/export-archive?from=&to=`

Gera ZIP AT-ready do período.

- Auth: `requireAuth()`.
- Acção:
  1. SELECT despesas do período.
  2. Corre `integrity-check` no momento.
  3. Gera ZIP em memória (max 100MB; senão erro com instrução de filtrar período mais curto):
     - `manifest.csv` — colunas: `id, expense_date, category, vendor_name, vendor_nif, invoice_number, amount_gross, amount_net, vat_amount, vat_pct, description, notes, receipt_filename, receipt_hash, archive_chain_hash, archived_at, archive_status`.
     - `integrity-report.txt` — texto com resultado da verificação + nota legal.
     - `receipts/{YYYY-MM-DD}_{NIF}_{NUM}.{ext}` — todos os recibos renomeados (sanitização de NIF/NUM ausentes para `unknown`).
     - `LEIA-ME.txt` — referência ao art. 19.º DL 28/2019, instruções para a AT verificar manualmente o hash de qualquer ficheiro (`shasum -a 256 receipts/...`), contacto da empresa.
  4. Stream do ZIP como response com `Content-Disposition: attachment; filename="despesas-{from}-{to}.zip"`.
- Erros: `413` (ZIP excede 100MB), `500` (geração).

## Modificações a `/api/financial/scan-receipt`

- **Antes**: `requirePermission('financial')`.
- **Depois**: `requireAuth()`.
- Adicionar:
  - Insert em `log_audit` (`entity_type='ocr_scan'`, `action='scan_receipt'`, `user_id=auth.user.id`).
  - Guard 429 se `count(*) FROM log_audit WHERE entity_type='ocr_scan' AND user_id=auth.user.id AND created_at > now() - interval '24 hours'` > 100.

## UI

### Tab "Despesas pessoais" em `<ConsultorResumo>`

Quarta tab após "Histórico":

```tsx
<TabsTrigger value="despesas-pessoais">
  <span className="sm:hidden">Pessoais</span>
  <span className="hidden sm:inline">Despesas pessoais</span>
</TabsTrigger>
<TabsContent value="despesas-pessoais">
  <PersonalExpensesTab agentId={agentId} />
</TabsContent>
```

Deep-link `?tab=despesas-pessoais` resolve no `defaultValue` via `searchParams`.

### `<PersonalExpensesTab>`

Estrutura:

1. **Banner legal dismissível** (primeira visita): "Os recibos digitalizados aqui substituem o arquivo em papel ao abrigo do art. 19.º do DL 28/2019. Podes destruir os originais." Persistido em `localStorage` com chave `personal-expenses-banner-dismissed-v1`.

2. **Cabeçalho com 3 KPIs + integrity badge**:
   - Total mês (cor: vermelha-suave; ícone: `ArrowDownRight`).
   - Total YTD.
   - Líquido após despesas pessoais (mês) = `kpis.liquido_mes − total_pessoais_mes` — hint inline: "Cálculo apenas para a tua visão pessoal."
   - **`<ArchiveIntegrityBadge>`** à direita: "✓ Arquivo íntegro · 42 recibos" (clicável → modal explicativo).

3. **Botões de acção**:
   - "📷 Tirar foto de recibo" (primário, abre `<ReceiptCaptureDialog>`).
   - "Exportar para contabilista" (secundário, dispara `/export-archive` com período actual).

4. **Filtros**: período + categoria + status (`todos` / `editáveis` / `arquivados`).

5. **Lista**: paginada. Cada `<PersonalExpenseRow>` mostra:
   - Thumbnail 48×48 do recibo (fallback ícone PDF se mimetype="application/pdf").
   - Entidade + valor à direita em destaque.
   - Categoria como chip pequeno + data formatada PT.
   - **Status badge**: 🟡 "Editável até DD/MM" (calculado de `archive_locked_at`) ou 🔒 "Arquivado".
   - Click abre `<PersonalExpenseDetailSheet>` lateral.

6. **Empty state**: ícone Receipt + texto "Sem despesas registadas. Tira foto do primeiro recibo para começar."

### `<ReceiptCaptureDialog>`

Dois steps:

**Step 1 — Captura + OCR**
- File picker / camera (mobile usa `capture="environment"`).
- Compressão client-side (max 1.5MB, longest side 2048px) — mantém >1000px exigido.
- Cálculo client-side de SHA-256 em paralelo com upload (UI feedback "Hash: ab12…").
- Loading state: "A ler o recibo..." com Skeleton de form.
- Chamada paralela: upload R2 + scan IA. Aguarda ambos.

**Step 2 — Review**
- Preview da foto (clicável para zoom full-screen).
- Form Zod com campos pré-preenchidos pela IA, todos editáveis.
- Badges de confiança baixa (`<70%`): warning amber junto ao campo "Verifica este valor".
- Texto pequeno em rodapé: "Hash do ficheiro: `ab12…ef89` · Arquivo conforme art. 19.º DL 28/2019."
- Botão "Guardar (arquivo digital)" → `POST /api/agent-personal-expenses` → fecha dialog → invalida lista.
- Botão "Cancelar" → confirma se descarta o upload (se sim, `DELETE` ao R2 pending).

### `<PersonalExpenseDetailSheet>`

Sheet lateral (right desktop, bottom mobile):

- Header: data + entidade + valor + status badge.
- Foto full-size (clicável para zoom).
- Form edit inline. Campos imutáveis estão visualmente marcados (locked icon + tooltip "Imutável após arquivo").
- Bloco "Detalhes do arquivo" (expansível):
  - Hash SHA-256 truncado (clicável copia full).
  - `archived_at` formatado.
  - Chain hash (truncado).
  - Status + `archive_locked_at` se pending.
- Botões:
  - Se `is_editable=true`: "Guardar alterações" + "Eliminar" (AlertDialog) + "Confirmar arquivo agora" (sela antes do grace period acabar).
  - Se `is_editable=false`: só "Guardar" para campos sempre-editáveis (notes/category).
- Após 10 anos: botão extra "Permitir purga" → `/invalidate`.

### `<ArchiveIntegrityBadge>`

- Default state: "✓ Arquivo íntegro · {count} recibos" em verde com ícone `ShieldCheck`.
- Loading: skeleton.
- Erro state: "⚠ Verifica integridade" em amber.
- Click abre `<IntegrityModal>`:
  - Explicação curta: "O ERP guarda um hash criptográfico (SHA-256) de cada recibo no momento do arquivo, e cada novo recibo é encadeado com o anterior. Qualquer alteração posterior é imediatamente detectada — o que torna o arquivo defensável numa fiscalização da AT ao abrigo do art. 19.º do DL 28/2019."
  - Resultado da última verificação + botão "Verificar agora" (re-corre `/integrity-check`).
  - Link "Saber mais sobre o DL 28/2019" → external link Diário da República.

### `<LegalArchiveDisclaimerBanner>`

- Banner discreto no topo da tab quando o consultor entra pela primeira vez ou após muito tempo.
- Texto: "Os recibos digitalizados aqui substituem o arquivo em papel ao abrigo do art. 19.º do DL 28/2019. Podes destruir os originais. [Saber mais →]"
- Botão `X` para dismissar (persistência em `localStorage`).

## Garantias de privacidade + integridade

1. RLS self-only sem excepção (verificado em §RLS).
2. Endpoints rejeitam `?agent_id=X` se X ≠ self com 403, mesmo para Broker/CEO.
3. Os totais não são somados ao `liquido_mes` da Visão geral existente — KPI da empresa fica intocado.
4. **Imutabilidade SQL**: trigger BEFORE UPDATE bloqueia mutação de colunas de arquivo.
5. **Imutabilidade R2**: Object Lock COMPLIANCE com 10 anos retention bloqueia delete absoluto no prefix archive.
6. **Detecção de tamper**: chain hash entre linhas; falha em qualquer linha quebra a verificação para todas as posteriores.
7. **Audit trail**: cada UPDATE (mesmo nos campos editáveis) regista linha em `log_audit`.
8. **Retenção 10 anos**: trigger BEFORE DELETE bloqueia delete após grace period; purge só após 10 anos via `/invalidate`.
9. **Defesa anti-tamper no INSERT**: re-hash do ficheiro server-side antes de aceitar a linha.

## Não-objectivos (out-of-scope desta change)

- Aprovação por gestão (não há aprovação; é silo pessoal).
- Reembolso pela empresa (despesas pessoais não viram a `company_transactions`).
- **Emissão** de facturas (a feature é de **arquivo**, não emissão; emissão precisa de software certificado AT — out-of-scope absoluto).
- Submit automático ao e-Fatura da AT (precisa de autenticação CC / chave móvel digital pessoal — não automatizamos).
- Categorias geridas pela empresa (default fixo no client; não há tabela).
- Visualização cruzada por gestão (mesmo Broker/CEO não tem UI para ver isto).
- TSA externa RFC 3161 (timestamp do servidor + chain hash é suficiente para v1; reavaliar se houver fiscalização).
