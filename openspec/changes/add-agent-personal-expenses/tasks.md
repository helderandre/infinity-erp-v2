## Pré-requisitos (operacionais, antes do dev)

- [ ] Criar bucket R2 dedicado `infinity-personal-expenses` com **ObjectLockEnabledForBucket=true**.
- [ ] Configurar default Object Lock retention: COMPLIANCE mode, 10 anos.
- [ ] Criar API token R2 com permissões scoped: `s3:PutObject`, `s3:GetObject`, `s3:CopyObject` em ambos os prefixes; `s3:DeleteObject` **apenas** em `personal-expenses-pending/*`.
- [ ] Adicionar variáveis ao `.env.local` e Coolify:
  ```
  R2_ARCHIVE_BUCKET=infinity-personal-expenses
  R2_ARCHIVE_ACCESS_KEY_ID=<token>
  R2_ARCHIVE_SECRET_ACCESS_KEY=<secret>
  R2_ARCHIVE_PUBLIC_DOMAIN=<custom-domain or pub-xxx.r2.dev>
  R2_ARCHIVE_RETENTION_YEARS=10
  ```
- [ ] Confirmar lifecycle do bucket: zero expiration, sem auto-delete.

## Backend / DB

- [ ] Migration `20260607_agent_personal_expenses_table.sql`: tabela completa com 27 colunas, RLS, 2 índices.
- [ ] Migration `20260607_agent_personal_expenses_triggers.sql`: funções + triggers de imutabilidade e retenção.
- [ ] Verificar que a RLS bloqueia mesmo Broker/CEO via API normal (testar com `set role authenticated; set local request.jwt.claims = ...`).
- [ ] Confirmar que o trigger `updated_at` é aplicado.
- [ ] Testar trigger de imutabilidade: tentar UPDATE em `receipt_url` → expect exception.
- [ ] Testar trigger de retention: criar row, expirar grace period (manual via UPDATE de `archive_locked_at` em SQL), tentar DELETE → expect exception.

## Endpoints

- [ ] `POST /api/agent-personal-expenses/upload-receipt`
  - Multipart com Stream → SHA-256 server-side.
  - Validação MIME + tamanho + dimensões (lib `image-size`).
  - Upload ao R2 archive bucket no prefix `personal-expenses-pending/{agent_id}/...`.
  - Devolve `{ url, mimetype, size_bytes, hash, width_px, height_px }`.
- [ ] `POST /api/agent-personal-expenses`
  - Zod schema completa (incluindo archive fields).
  - Re-fetch do R2 para verificar hash bate (anti-tamper).
  - Lookup da última linha para obter `prev_chain_hash`.
  - Cálculo de `row_digest` + `archive_chain_hash` server-side.
  - Define `archive_locked_at = now() + interval '30 days'`.
  - Força `agent_id` e `archived_by` a `auth.user.id`.
- [ ] `GET /api/agent-personal-expenses` — paginado, filters, scope self.
- [ ] `GET /api/agent-personal-expenses/[id]` — devolve detalhe + computed `is_editable`.
- [ ] `PUT /api/agent-personal-expenses/[id]` — whitelist condicional baseada em `archive_status` + `archive_locked_at`. Audit log com diff.
- [ ] `POST /api/agent-personal-expenses/[id]/confirm-archive`
  - Verifica `archive_status='pending'`.
  - `CopyObject` pending → archive (com Object Lock metadata: `x-amz-object-lock-retain-until-date`, `x-amz-object-lock-mode=COMPLIANCE`).
  - UPDATE row (com session var `app.confirm_archive=true` para bypass do trigger): `archive_status='archived'`, `archive_locked_at=now()`, `receipt_url=<new>`.
  - `DeleteObject` no pending.
- [ ] `POST /api/agent-personal-expenses/[id]/invalidate` — após 10 anos, marca `archive_status='invalidated'`.
- [ ] `DELETE /api/agent-personal-expenses/[id]` — só permitido em `pending+grace` ou `invalidated`. Apaga R2.
- [ ] `GET /api/agent-personal-expenses/integrity-check` — walk linear + comparação.
- [ ] `GET /api/agent-personal-expenses/summary` — agregados.
- [ ] `GET /api/agent-personal-expenses/export-archive` — ZIP streaming com manifest CSV + integrity report + recibos renomeados + LEIA-ME.

## OCR

- [ ] Relaxar `/api/financial/scan-receipt`: trocar `requirePermission('financial')` por `requireAuth()`.
- [ ] Adicionar telemetria: insert em `log_audit` (`entity_type='ocr_scan'`).
- [ ] Adicionar guard 429 se >100 chamadas nas últimas 24h pelo mesmo `user_id`.
- [ ] Estender o endpoint para aceitar `application/pdf` em base64; verificar suporte do GPT-4o-mini; fallback: rejeitar com 415 se PDF não funcionar.

## Cron / job

- [ ] Job opcional (não-bloqueante) que migra automaticamente rows de `pending` → `archived` quando `now() >= archive_locked_at`. Implementação: scheduled task no Coolify a correr 1×/dia que chama `POST /api/agent-personal-expenses/auto-archive` (endpoint admin protegido por `CRON_SECRET`). Lê `pending` com lock vencido, faz CopyObject + UPDATE em batch.
- [ ] Rate-limit do auto-archive: max 200 rows por execução para evitar timeout.

## UI — componentes novos

- [ ] `<PersonalExpensesTab agentId>` em `components/financial/consultor/personal-expenses-tab.tsx`. Header com KPIs + integrity badge + botões CTA, banner legal dismissível, filtros, lista paginada.
- [ ] `<ReceiptCaptureDialog>` em `components/financial/consultor/receipt-capture-dialog.tsx`. Dois steps com hash truncado visível.
- [ ] `<PersonalExpenseRow>` em `components/financial/consultor/personal-expense-row.tsx`. Item com status badge.
- [ ] `<PersonalExpenseDetailSheet>` em `components/financial/consultor/personal-expense-detail-sheet.tsx`. Bloco de detalhes do arquivo expansível.
- [ ] `<ArchiveIntegrityBadge>` em `components/financial/consultor/archive-integrity-badge.tsx`. Modal explicativo + verificação on-demand.
- [ ] `<LegalArchiveDisclaimerBanner>` em `components/financial/consultor/legal-archive-disclaimer-banner.tsx`. Persistência em localStorage.

## UI — hooks

- [ ] `usePersonalExpenses({ from, to, category, archive_status })` em `hooks/use-personal-expenses.ts`.
- [ ] `usePersonalExpensesSummary(period)` em `hooks/use-personal-expenses-summary.ts`.
- [ ] `usePersonalExpensesIntegrity()` em `hooks/use-personal-expenses-integrity.ts` — cache 5 min.
- [ ] `useReceiptScan()` em `hooks/use-receipt-scan.ts` — wrap do `/api/financial/scan-receipt`.
- [ ] `useReceiptUpload()` em `hooks/use-receipt-upload.ts` — wrap upload + cálculo de hash client-side (Web Crypto API) + reconciliação com hash server.

## UI — wiring

- [ ] Adicionar quarta `<TabsTrigger value="despesas-pessoais">` em `consultor-resumo.tsx`.
- [ ] Renderizar `<PersonalExpensesTab agentId={agentId} />`.
- [ ] Suportar `?tab=despesas-pessoais` no deep-link inicial.

## Categorias

- [ ] Constante `DEFAULT_PERSONAL_EXPENSE_CATEGORIES` em `lib/financial/personal-expense-categories.ts`.
- [ ] `<Combobox creatable>` no form (verificar se já existe um componente equivalente; senão adaptar `<Command>` com input livre).

## QA

- [ ] Smoke test mobile: tirar foto de talão real (almoço, bomba), validar OCR, gravar.
- [ ] Smoke test desktop: upload PDF de e-fatura, OCR, gravar.
- [ ] **Teste de integridade**: criar 5 despesas, depois forçar UPDATE em `receipt_hash` via SQL service_role → re-correr `/integrity-check` → confirmar que devolve `verified: false` com `broken_at_index` correcto.
- [ ] **Teste de imutabilidade**: tentar PUT em `receipt_url` via API normal → expect 400 + log no Postgres.
- [ ] **Teste de retenção**: criar despesa, manualmente avançar `archive_locked_at` para o passado via SQL, tentar DELETE → expect 409 da API.
- [ ] **Teste de Object Lock R2**: usar credenciais service_role para tentar `DeleteObject` no prefix archive → expect 403 do R2.
- [ ] **Teste de hash anti-tamper**: enviar `receipt_hash` falso no `POST /agent-personal-expenses` → expect 422.
- [ ] Confirmar que outro consultor não consegue ver via DevTools (URL manipulation).
- [ ] Confirmar que Broker/CEO no `/api/agent-personal-expenses?agent_id=<other>` recebe 403.
- [ ] Validar export ZIP com 100+ despesas → tamanho do ficheiro, integrity report correcto.
- [ ] Verificar que `<PersonalExpensesTab>` carrega em <500ms com 200+ recibos.
- [ ] Validar com 5-10 talões reais de bombas/restaurantes para fixar threshold de 1000px (ajustar se rejeições legítimas).

## T&C / Disclaimer legal

- [ ] Texto do `<LegalArchiveDisclaimerBanner>` revisto por jurista (idealmente).
- [ ] Antes do primeiro `/confirm-archive` o consultor confirma um modal com T&C: "Confirmas que estes recibos cobrem despesas pessoais tuas e que assumes a responsabilidade fiscal pelos mesmos. O ERP é uma ferramenta de arquivo conforme art. 19.º DL 28/2019; a obrigação fiscal mantém-se contigo."
- [ ] Aceitação do T&C registada em `log_audit` com `action='accept_personal_expenses_tc'`.

## Documentação

- [ ] Adicionar entrada no [CLAUDE.md](CLAUDE.md) na secção "Estado Actual do Projecto" com ✅ + bullet points dos endpoints, RLS, triggers, R2 archive bucket, integrity check, export ZIP.
- [ ] Documentar variáveis novas no `.env.example`.
- [ ] Pequena nota interna para o contabilista da empresa: como interpretar o ZIP exportado (manifest, integrity report, formato dos ficheiros).

## Deploy

- [ ] Criar bucket R2 + token (operacional, antes do deploy do código).
- [ ] Aplicar migrations em local (Supabase MCP).
- [ ] Deploy Coolify com novas vars de ambiente.
- [ ] Aplicar migrations em prod.
- [ ] Validar com 1-2 consultores piloto durante 30 dias antes de anunciar a toda a equipa (cobre o ciclo completo de grace period).
- [ ] Avaliar com contabilista da empresa o formato do export ZIP antes de prometer "AT-ready" oficialmente.
