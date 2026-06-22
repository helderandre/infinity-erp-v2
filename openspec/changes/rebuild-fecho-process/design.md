# Design

## 1. Mirror the angariação hardcoded pattern
Reference: `docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md`, `lib/processes/subtasks/` (types, populate, registry, rules/angariacao/), `<GroupedSubtasksView>`, `angariacao-process-panel.tsx`.

- **Rules**: `lib/processes/subtasks/rules/negocio/` — one `SubtaskRule` per fecho subtask (`key`, `taskKind` matched against `proc_tasks.title`, `repeatPerOwner`/per-client, `dueRule`, `Component`, `complete(ctx)`). Barrel `index.ts`; register via `getRulesFor('negocio')` in `registry.ts`.
- **Populate**: idempotent `INSERT … ON CONFLICT DO NOTHING` keyed by `proc_subtasks.subtask_key` (+ owner/client id). Endpoint `POST /api/processes/[id]/subtasks/populate-negocio` (or generalize the angariação one); call it in `/api/deals/[id]/submit` after the `proc_instance` + `populate_process_tasks()` (the submit endpoint already does both — see CLAUDE.md PROC-NEG).
- **Backfill**: script mirroring `scripts/backfill-angariacao-subtasks.ts` for in-flight `proc_instances` (`external_ref LIKE 'PROC-NEG-%'`, not completed).
- **UI**: `components/processes/negocio-process-panel.tsx` cloned from `angariacao-process-panel.tsx` (vista de passos). Grouped view for per-buyer document groups (reuse `<GroupedSubtasksView>` + whitelist of group titles). Mount in the negócio detail Processo tab.
- Once the hardcoded layer covers PROC-NEG, retire the declarative `tpl_processes 'negocio'` + builder (per `processes-restructure`). `proc_subtasks.tpl_subtask_id` is `ON DELETE SET NULL`; legacy rows keep `legacy_*` keys.

## 2. Stages
Recolha Documental → CPCV → Pré-Escritura → Escritura/Contrato Final → **Faturação & Encerramento**. (Existing 5 stages, with faturação emphasised in Encerramento — preserve current task set + hooks.)

## 3. Faturação derivation (the new financial logic)
`lib/processes/neg/derive-fatura-target.ts`:

```
deriveFaturaTarget(deal, payment) -> { recipientName, nif, amountNet, source: 'owner' | 'partner_agency' }
```
- **Angariação nossa** (`deal_type ∈ {pleno, pleno_agencia, comprador_externo}`):
  - recipient = **property owner main contact** (`property_owners.is_main_contact` → `owners.name/nif`) of `deals.property_id`.
  - amount = **comissão total** for that payment moment = `deal_payments.amount` (the full commission of the moment) — NOT `agency_amount`. ⚠ confirm with stakeholder which field = "comissão total" before coding (likely `amount`; `agency_amount` is our margin).
- **Angariação externa** (`deal_type = angariacao_externa`):
  - recipient = **partner agency** (`deals.partner_agency_name` + a NIF field — may need to add `deals.partner_agency_nif`).
  - amount = **a nossa parte** = our agency share for the moment (`deal_payments.agency_amount` / `deals.agency_net` proportion).

Feeds `issueMoloniDraft(paymentId, { recipient, recipient_nif, amount_net })` — already built. The faturação subtask auto-fills these instead of manual entry.

## 4. New subtask types
- **`moloni_invoice`** — card embeds the Moloni emit flow (reuse `moloni-actions.ts` + `<MoloniDocumentSheet>` + the Moloni block from `mapa-row-sheet.tsx`). On open, pre-fills recipient/amount via `deriveFaturaTarget`. `complete()` when `moloni_status=1` (finalizada). One per payment moment (cpcv/escritura/single).
- **`supplier_invoice_intake`** — form to mark a **received** consultant/agency fatura (number, date, amount) → writes `deal_payment_splits.consultant_invoice_*` (consultor) or `deal_payments.network_invoice_*` (agência) AND a `company_transactions` **expense** row (category `Comissões a pagar - <consultor|agência>`). One per split (consultor) + one for the buyer's agency in `comprador_externo`.

## 5. Data touchpoints (reuse, don't recreate)
- `deals`: `deal_type`, `partner_agency_name`, `commission_total`, `agency_amount/agency_net/network_amount/consultant_amount`.
- `deal_payments`: `agency_invoice_recipient/nif` + `moloni_*` (Moloni machine), `consultant_invoice_*`, `network_invoice_*`, `amount`/`agency_amount`.
- `deal_payment_splits`: per-agent `consultant_invoice_*`.
- `property_owners` + `owners`: recipient name/NIF derivation.
- `company_transactions`: income (auto via `propagate_deal_payment_received` trigger) + **expense** (supplier faturas, new).

## 6. Risks
- **Amount semantics** per scenario must be exact — see ⚠ in §3. Get stakeholder to confirm `amount` vs `agency_amount`.
- Possibly add `deals.partner_agency_nif` (migration) for the angariacao_externa recipient.
- **Don't lose the closing spine** (hooks signed/received/close_deal, deal_events, marketing moments, survey).
- Backfill/re-template in-flight proc_instances.
