# Rebuild Fecho de Negócio (PROC-NEG) — hardcoded design + financial/faturação wiring

> **Design locked 2026-06-23** (see design.md): a **6 phase-node** step-timeline (A Recolha&CPCV → B Assinatura CPCV → C Pós-CPCV → D Preparação escritura → E Dia da escritura → F Agradecimentos). Encerramento **keeps** the satisfaction survey + Google review + Remax Convictus email as optional steps.
> **Greenfield:** the fecho process has 0 live `proc_instances` (all 85 are PROC-ANG) — no backfill; the rebuild can restructure the submit/template flow freely. (memory `proc-neg-greenfield`)

## Why
- PROC-NEG (processo de fecho de negócio) still runs on the **legacy declarative template engine** (`tpl_processes` `process_type='negocio'` + `tpl_stages`/`tpl_tasks`/`tpl_subtasks`). Project direction (memory `processes-restructure`): angariação is already hardcoded; **PROC-NEG → rebuild hardcoded; kill the declarative engine/builder**.
- Angariação got a new UX: **step-based process panel** (`components/processes/angariacao-timeline/angariacao-process-panel.tsx`, "vista de processo em passos") + the **hardcoded subtasks layer** (`lib/processes/subtasks/`) + `<GroupedSubtasksView>`. PROC-NEG should match.
- The **Moloni faturação integration is built** (CLAUDE.md "Moloni — Faturação": emit rascunho→finalizar, recibo, NC/anular, email, re-emissão + history ledger). The fecho process must **connect to it**: emit the agency commission fatura to the right recipient/amount per `deals.deal_type`, and **intake the supplier faturas we receive**.

## What
1. **Rebuild PROC-NEG on the hardcoded-subtasks pattern** (mirror angariação): a `SubtaskRule` registry for `'negocio'`, idempotent populate on deal submit, a step-based `<NegocioProcessPanel>` (6 phase-nodes), grouped views for per-buyer doc groups. Preserve the existing closing spine. Also fix three live wiring bugs in the same pass: dead referral splits, dropped KYC on save, `deals.status` mismatch (memory `fecho-audit-traps`).
2. **Faturação steps wired to Moloni**:
   - Emit agency fatura (rascunho → finalizar) to the **deal_type-derived recipient/amount** (auto-fills `agency_invoice_recipient`/NIF).
   - **Intake incoming supplier faturas** (consultores, agências) — record as expense (and, phase 2, as Moloni supplier invoices for input-VAT).
3. **Keep the existing closing spine** — do NOT lose: `deal_events`, `deal_payments` hooks (signed/received), `close_deal` hook, per-client task repeat, `applies_when` bypass, marketing moments (`ai_caption`), satisfaction survey, schedule_event.

## Confirmed faturação model (memory `fecho-faturacao-scenarios`)
- **Angariação nossa** (`pleno`, `pleno_agencia`, `comprador_externo`): fatura → **proprietário**, **comissão TOTAL**; recebemos faturas dos consultores (+ da agência do comprador no `comprador_externo`).
- **Angariação externa** (`angariacao_externa`): fatura → **agência parceira**, **só a NOSSA parte**; recebemos a fatura do nosso consultor.

## Scope / non-goals
- **In:** hardcoded PROC-NEG + step UI; `deal_type → fatura recipient/amount` derivation; faturação emit subtask (Moloni); supplier-fatura intake subtask.
- **Out (later):** retenção na fonte parametrizável; Moloni auto-emission/cron; pushing supplier faturas to Moloni for input-VAT (phase 1 records them in `company_transactions` only).
