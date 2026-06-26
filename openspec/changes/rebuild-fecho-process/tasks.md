# Tasks (ordered) — Fecho de Negócio hardcoded step-timeline

Design locked 2026-06-23 (6 phase-nodes; Encerramento keeps survey + Google + Remax). Greenfield — no backfill.

## 0. Locked decisions (no longer blocking)
- [x] Stepper = **6 phase-nodes** (A–F).
- [x] Encerramento **keeps** satisfaction survey + Google review + Remax Convictus email (optional steps).
- [x] Task skeleton stays **SQL-seeded** by `populate_process_tasks` (taskKind ↔ `proc_tasks.title`); registry hardcodes **subtasks** only — exactly like angariação.
- [x] Faturação amount truth = `deal_payments.amount` (total, nossa angariação) / `deal_payments.agency_amount` (nossa parte, externa); never `deals.agency_net`.
- [x] Faturação recipient: owner main contact (`property_owners→owners`) for nossa angariação; partner agency for `angariacao_externa`.

## 1. Schema (additive migration — write + apply)
- [ ] `deals.partner_agency_nif` (text, nullable).
- [ ] Widen `deal_clients`: `nif`, `birth_date`, `id_doc_type`, `id_doc_number`, `is_pep`, `funds_origin`, `beneficiaries jsonb`, `rcbe_code`, `country_of_incorporation`, `is_main_contact bool`.
- [ ] Verify ALTERs apply against the live schema via MCP (base tables created in-DB). No backfill.

## 2. Engine (`lib/processes/subtasks/`)
- [ ] `types.ts`: add `ClientRef`; extend `SubtaskContext` with `client?: ClientRef | null` + deal context (`dealId`, `dealType`, `businessType`, `partnerAgencyName/Nif`, `propertyId` nullable).
- [ ] `populate.ts`: negócio branch in `fetchProcessContext` (resolve deal via `deals.proc_instance_id`, nullable property); `fetchClients` from `deal_clients`; `repeatPerClient` expansion (config.client_id/name, not owner_id, filtered by personTypeFilter); `appliesWhen` evaluator (port the 6 predicates); mark zero-subtask tasks `is_bypassed`. Keep angariação path untouched (guard on processType).
- [ ] `registry.ts`: uncomment `negocio: negocioRules`.

## 3. Negócio rule registry (`lib/processes/subtasks/rules/negocio/`)
- [ ] Recolha & CPCV (A): pedido-doc email (scenario variants), guardar/verificar docs (repeatPerClient + Compliance KYC), criar/verificar CPCV, guardar CPCV, schedule CPCV.
- [ ] Assinatura CPCV (B): cpcv_signed confirm + ai_caption, moloni_invoice (CPCV).
- [ ] Pós-CPCV (C): recolher cópia+comprovativo (cpcv_received), supplier_invoice_intake, direitos de preferência (angariacao_interna), notas.
- [ ] Preparação escritura (D): distrate+APB email (mortgage+seller-ours), schedule escritura, enviar dados aos clientes, tracked_request condomínio+IMT/IS, pasta física.
- [ ] Dia da escritura (E): escritura_signed confirm + ai_caption, moloni_invoice (escritura).
- [ ] Encerramento (F): recolher escritura+comprovativos+supplier intake (escritura_received), email agradecimento, survey (opt), Google review (opt), Remax email (opt), close_deal.
- [ ] Barrel `index.ts` → `negocioRules`; assert key uniqueness vs angariação.

## 4. New subtask types
- [x] `moloni_invoice` card + `lib/processes/neg/derive-fatura-target.ts`; route in `subtask-card-list.tsx`. (card `subtask-card-moloni-invoice.tsx` embeds rascunho→finalizar→ver PDF→enviar email via the existing `moloni-actions.ts`; recipient/amount pre-filled from `GET /api/deals/[id]/fatura-target?moment=`; `neg_cpcv_fatura_emitida`/`neg_esc_fatura_emitida` promoted from `checklist`→`moloni_invoice` via `moloniInvoiceRule`; completer whitelist + completer accept `moloni_invoice`; finalize auto-completes the step.)
- [ ] `supplier_invoice_intake` card → `consultant_invoice_*` / `network_invoice_*` + `company_transactions` expense.
- [ ] `tracked_request` card (3-state).
- [ ] `note` card.
- [ ] Activate `schedule_cpcv` branch in `.../schedule-event/route.ts`.
- [ ] Email templates in `tpl_email_library` (pedido-doc fecho, dados-escritura, distrate/APB).

## 5. Submit wiring + bug fixes (`/api/deals`)
- [ ] `POST /api/deals/[id]/submit`: call `populateSubtasks(admin, procInstanceId, 'negocio')` after the RPC + `current_stage_id`; fold/replace `bypassNonApplicableNegTasks` + `repeatTasksPerClient`.
- [ ] Pre-fill `agency_invoice_recipient`/`_nif` on the relevant `deal_payments` via `deriveFaturaTarget`.
- [ ] FIX referral wiring (persist `deal_referrals` from the canonical form, or rewrite submit to read the deal referral columns).
- [ ] FIX `deal_clients` KYC drop in `PUT /api/deals/[id]` (persist the widened fields + `is_main_contact`).
- [ ] Resolve `deals.status` → `'active'`.

## 6. Step-panel UI (`components/processes/negocio-timeline/`)
- [ ] `negocio-steps.ts` (`NEGOCIO_PHASES`, extended `StepAction`).
- [ ] `negocio-process-panel.tsx` (phase stepper + detail sheet) — **wired to the real completer** (hooks fire), not the angariação mock.
- [ ] `GET /api/processes/[id]/negocio-overview`.
- [ ] Extend `<GroupedSubtasksView>` to group by `config.client_id`.
- [ ] Mount at the 3 surfaces with a Novo/Antigo toggle; tolerate null property_id.

## 7. Cleanup + docs
- [ ] Remove the dead `schedule_cpcv` placeholder comment once activated; confirm the 4 other `negocio` template rows are unused, then retire the declarative builder per `processes-restructure`.
- [ ] Retire the legacy `components/financial/deal-form.tsx` + `actions.ts createDeal` path (bypasses proc_instance) after confirming `comissoes/page.tsx` is the only consumer.
- [ ] SPEC doc under `docs/M06-PROCESSOS/`; update CLAUDE.md PROC-NEG section.

## Verify
- [ ] `npx tsc --noEmit` (compare to baseline) + `npx eslint`.
- [ ] E2E with synthetic deals across all 4 `deal_type` scenarios: draft → submit → subtasks populated → complete hooks → `deal_payments` flips → triggers → `company_transactions` → Moloni emit (demo company id 5) → supplier intake expense → `close_deal`.
- [ ] Adversarial review of `deriveFaturaTarget` (recipient + amount) per scenario; no regressions in the closing spine.

## Key references
- Pattern: `docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md`, `lib/processes/subtasks/`, `components/processes/angariacao-timeline/`, `scripts/backfill-angariacao-subtasks.ts`.
- Moloni: `lib/moloni/`, `app/dashboard/financeiro/deals/moloni-actions.ts`, `components/financial/sheets/{mapa-row-sheet,moloni-document-sheet}.tsx`.
- Closing spine + faturação model: CLAUDE.md PROC-NEG; memories `fecho-faturacao-scenarios`, `proc-neg-greenfield`, `fecho-audit-traps`, `processes-restructure`.
