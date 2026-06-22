# Tasks (ordered)

## 0. Confirm before coding
- [ ] **Amount per scenario** for the outgoing fatura: "comissão total" = `deal_payments.amount`? "nossa parte" = `deal_payments.agency_amount`? Lock in `deriveFaturaTarget` (design §3 ⚠).
- [ ] Recipient NIF sources: owner = `property_owners` main contact `owners.nif`; partner agency = need `deals.partner_agency_nif`? (migration if missing).

## 1. Hardcoded subtasks layer for 'negocio'
- [ ] `lib/processes/subtasks/rules/negocio/` + barrel; register in `registry.ts` (`getRulesFor('negocio')`).
- [ ] Port existing PROC-NEG tasks/subtasks → rules, **preserving**: hooks (`cpcv_signed/received`, `escritura_signed/received`, `close_deal`), per-client repeat (`repeat_per_client`), `applies_when` bypass, `schedule_event`, `ai_caption` (marketing moments), `email` steps, satisfaction survey.
- [ ] `POST /api/processes/[id]/subtasks/populate-negocio` (idempotent) + wire into `/api/deals/[id]/submit`.
- [ ] Backfill script (mirror `scripts/backfill-angariacao-subtasks.ts`).

## 2. Step-based UI
- [ ] `components/processes/negocio-process-panel.tsx` (clone `angariacao-process-panel.tsx`).
- [ ] Grouped view for per-buyer doc groups (`<GroupedSubtasksView>` + title whitelist).
- [ ] Mount in negócio detail Processo tab + `/dashboard/negocios/[id]`.

## 3. Faturação derivation + emit subtask
- [ ] `lib/processes/neg/derive-fatura-target.ts` (`deal_type → { recipientName, nif, amountNet, source }`).
- [ ] Subtask type `moloni_invoice`: card reuses `moloni-actions.ts` + `<MoloniDocumentSheet>` + Moloni block; pre-fills recipient/amount; `complete()` on `moloni_status=1`. One per payment moment.
- [ ] Routing in `subtask-card-list.tsx` (case `'moloni_invoice'`).

## 4. Supplier-fatura intake
- [ ] Subtask type `supplier_invoice_intake`: form (number/date/amount) → `consultant_invoice_*` / `network_invoice_*` + `company_transactions` expense row.
- [ ] One per consultor split + one for buyer's agency (`comprador_externo`).
- [ ] (Phase 2) push as Moloni supplier invoices for input-VAT.

## 5. Cleanup + docs
- [ ] Retire declarative `tpl_processes 'negocio'` + builder (per `processes-restructure`) once hardcoded covers it.
- [ ] SPEC doc under `docs/M06-PROCESSOS/`; update CLAUDE.md PROC-NEG section.

## Verify
- [ ] `npx tsc --noEmit` (compare to baseline error count) + `npx eslint`.
- [ ] Adversarial review workflow: fiscal correctness of `deriveFaturaTarget` (recipient + amount) across the 4 `deal_type` scenarios; no regressions in the closing spine.
- [ ] E2E in the **demo Moloni company (id 5)** across all 4 scenarios: emit → finalizar → recibo/NC/re-emissão; supplier-fatura intake → expense booked.

## Key references
- Angariação pattern: `docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md`, `lib/processes/subtasks/`, `angariacao-process-panel.tsx`, `backfill-angariacao-subtasks.ts`.
- Moloni machine: `lib/moloni/`, `app/dashboard/financeiro/deals/moloni-actions.ts`, `components/financial/sheets/{mapa-row-sheet,moloni-document-sheet}.tsx`, CLAUDE.md "Moloni — Faturação".
- Faturação model: memory `fecho-faturacao-scenarios`; CLAUDE.md PROC-NEG "4 cenários".
- Closing spine to preserve: CLAUDE.md PROC-NEG (deal_events, hooks, close_deal, marketing moments, survey).
