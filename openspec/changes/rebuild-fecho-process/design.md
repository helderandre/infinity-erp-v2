# Design — Fecho de Negócio (PROC-NEG) hardcoded step-timeline

> **Status:** design locked with stakeholder 2026-06-23.
> Stepper = **6 phase-nodes** (A–F). Encerramento **keeps** the satisfaction
> survey + Google review + Remax Convictus email as optional final steps.

## 0. Ground truth (from the 2026-06-23 audit)
- **Greenfield:** 0 live `proc_instances` are PROC-NEG (all 85 are PROC-ANG). No backfill. Validate with synthetic deals across the 4 `deal_type` scenarios. (memory `proc-neg-greenfield`)
- **The angariação step panel is a preview shell** — `angariacao-process-panel.tsx` `completeCurrent` only mutates local state; the real work + persistence happen in `ProcessPipelinePanel → SubtaskCardList`. The negócio step panel MUST route completion through the **real completer** so the closing hooks actually fire. (memory `fecho-audit-traps`)
- **Three live wiring bugs to fix in the same pass** (memory `fecho-audit-traps`): referral splits dead (canonical `deal-form.tsx` writes referral *columns*; submit reads `deal_referrals`); rich KYC dropped on `PUT /api/deals/[id]`; `deals.status` ends `'submitted'` while the instance is `'active'`.
- **The current declarative NEG template already covers ~26 of the 23 steps** (5 stages / 31 tasks / ~57 subtasks). The rebuild re-expresses that closing spine as a hardcoded step-timeline; it does NOT invent new closing logic.

## 1. Mirror the angariação hardcoded pattern
Reference: `docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md`, `lib/processes/subtasks/` (types, populate, registry, rules/angariacao/), `<GroupedSubtasksView>`, `components/processes/angariacao-timeline/`.

- **Rules**: `lib/processes/subtasks/rules/negocio/` — one `SubtaskRule` per fecho subtask. `taskKind` matched against `proc_tasks.title` (the existing 31 NEG task titles — the task skeleton stays SQL-seeded by the `populate_process_tasks` RPC, exactly like angariação). Barrel `index.ts`; register via `getRulesFor('negocio')` in `registry.ts` (uncomment the line). Keys globally unique (no collision with the 43 angariação keys).
- **Populate**: extend `populateSubtasks(supabase, processId, 'negocio')`:
  - `fetchProcessContext` branch: `proc_instances.property_id` nullable; the deal is resolved via `deals.proc_instance_id`; consultant from `deals.consultant_id`; carry `deal_type`, `business_type`, `partner_agency_*`.
  - People come from **`deal_clients`** (not `property_owners`). Implement `repeatPerClient` (write `config.client_id`/`config.client_name`, NOT `owner_id` — FK→`owners`), filtered by `personTypeFilter`.
  - Implement `appliesWhen` (port the 6-predicate evaluator from `lib/processes/neg/bypass-non-applicable-tasks.ts`); rules whose predicates fail do not materialize, and a task left with **zero** surviving subtasks is marked `is_bypassed` (folds the old post-processor into populate).
  - Idempotency (`proc_subtasks_dedup` + bulk-then-row-by-row 23505 fallback) and config markers unchanged.
- **Invoke** from `POST /api/deals/[id]/submit` after the `populate_process_tasks` RPC + `current_stage_id` set (mirrors `auto-activate` ordering; the negócio submit is NOT `autoActivateProcess`). The existing `bypassNonApplicableNegTasks` + `repeatTasksPerClient` post-processors are folded into populate.
- **No backfill** (greenfield).

## 2. The 6 phases (stepper nodes) and their steps
Stepper shows phases A–F. Each phase opens a detail sheet listing its steps; each step is a hardcoded subtask rendered by the existing card stack. Scenario branch-points are marked ⎇.

**A — Recolha & CPCV**
1. Pedido de documentação — `email` ⎇ (pleno/pleno_agencia: aos compradores · comprador_externo: à agência do comprador · angariacao_externa: docs do imóvel à agência angariadora + enviar-lhes docs dos nossos compradores)
2. Guardar & verificar documentação — `upload`, per-comprador (grouped) + Compliance KYC
3. Criar / verificar CPCV + enviar — `generate_doc`/`email` ⎇ (nossa: criar e enviar · externa: verificar recebido + enviar aos nossos compradores)
4. Guardar CPCV confirmado — `upload`
5. Registar data/hora/local do CPCV — `schedule_event` (**activates `schedule_cpcv`** → `deal_events`)

**B — Assinatura do CPCV**
6. Assinatura do CPCV (+ fotos do momento) — `confirm` (hook `cpcv_signed`) + `ai_caption`; auto-email consultor (handled later)
7. Pedido de fatura (CPCV) — `moloni_invoice` ⎇ (externa: ao colega/parte nossa · resto: ao cliente/total)

**C — Pós-CPCV**
8. Recolher cópia CPCV + comprovativo — `upload` (hook `cpcv_received`)
9. Pagar às partes envolvidas — `supplier_invoice_intake`
10. Pedir direitos de preferência — `external_form`/`confirm` (`applies_when angariacao_interna`)
11. Notas para a escritura — `note`

**D — Preparação da escritura**
12. Aviso distrate hipoteca + protocolo APB — `email` (só vendedor nosso + `property_has_mortgage`)
13. Registar data/hora/local da escritura — `schedule_event` (hook `schedule_escritura`)
14. Enviar dados da escritura aos clientes — `email`
15. Decl. condomínio + guias IMT/Imposto de Selo — `tracked_request` (por pedir → pedido → recebido; condomínio `applies_when property_has_condominium`)
16. Preparar pasta física — `confirm`

**E — Dia da escritura** (análogo ao CPCV)
17. Assinatura da escritura (+ fotos) — `confirm` (hook `escritura_signed`) + `ai_caption`
18. Pedido de fatura (escritura) — `moloni_invoice` ⎇ (same as #7)

**F — Agradecimentos / Encerramento**
19. Recolher escritura + comprovativos + pagar às partes — `upload` + `supplier_invoice_intake` (hook `escritura_received`)
20. Email de agradecimento aos clientes (escritura em anexo) — `email`
21. Inquérito de satisfação — *optional* (existing survey card)
22. Pedido de review Google — *optional* (existing, gated to promoters)
23. Email à Remax Convictus — *optional* (`neg-fecho-rede` template)
→ completing the phase fires `close_deal`.

## 3. Faturação derivation (the new financial logic)
`lib/processes/neg/derive-fatura-target.ts`:
```
deriveFaturaTarget(deal, payment) -> { recipientName, nif, amountNet, source: 'owner' | 'partner_agency' }
```
- **Angariação nossa** (`deal_type ∈ {pleno, pleno_agencia, comprador_externo}`): recipient = property owner main contact (`property_owners.is_main_contact` → `owners.name/nif` of `deals.property_id`); amount = **comissão total** of the moment = `deal_payments.amount`.
- **Angariação externa** (`angariacao_externa`): recipient = partner agency (`deals.partner_agency_name` + **new** `deals.partner_agency_nif`); amount = **a nossa parte** = `deal_payments.agency_amount`.
- **Amount truth lives on `deal_payments` per moment** (`amount` = full slice; `agency_amount` = our margin, equal on no-share deals) and `deal_payment_splits` per agent — NEVER `deals.agency_net` (NULL in practice; verified). Feeds the existing `issueMoloniDraft(paymentId, { recipient, recipient_nif, amount_net })`.

## 4. New subtask types (the only net-new building blocks, ~5)
- **`moloni_invoice`** — card embeds the Moloni emit flow. **Implemented by extracting the Mapa de Gestão interaction into a shared `<MoloniInvoicePanel>`** (`components/financial/sheets/moloni-invoice-panel.tsx`: factura-da-agência fields + full Moloni block — rascunho → finalizar → recibo/NC/anular → email → histórico + `<MoloniDocumentSheet>` preview). `mapa-row-sheet.tsx` now consumes the same panel (single source of truth). The fecho card (`subtask-card-moloni-invoice.tsx`) resolves the moment's `deal_payment` + recipient/amount via `GET /api/deals/[id]/fatura-target?moment=` (→ `deriveFaturaTarget`), feeds them as the panel's pre-fill, and `complete()`s when the panel reports finalize (`moloni_status=1`). Steps 7, 18.
- **`pay_parties`** — **Implemented.** "Pagar às partes" card showing the per-party payout breakdown ("quem recebe o quê") with the EXACT Mapa de Gestão maths. The split computation was extracted into a shared helper (`lib/financial/build-mapa-rows.ts` → `buildMapaRowsFromPayment`), now the single source for `mapa-gestao`, `…/mapa-row` and the new `GET /api/deals/[id]/payout-breakdown?moment=`. The card (`subtask-card-pay-parties.tsx`) renders tiles (Total · Convictus/rede · Margem agência = `agency_amount − Σ split` · Agência parceira) + one row per consultor with a **Pago** toggle (`updateSplitPaid`, gated to `financial`); completing marks the step done. Steps 9, 19.
- **`supplier_invoice_intake`** — form (number/date/amount) to record a received consultor/colega fatura → `deal_payment_splits.consultant_invoice_*` (consultor) / `deal_payments.network_invoice_*` (agência) AND a `company_transactions` **expense** row (category `Comissões a pagar - <consultor|agência>`). (Complementa o `pay_parties`: este regista a despesa fiscal da fatura recebida.) Steps 9, 19.
- **`tracked_request`** — 3-state tracker (por pedir → pedido → recebido) for condomínio + guias IMT/IS. Step 15.
- **`note`** — free-text note step. Step 11.
- **`schedule_cpcv`** — activate the currently-dead branch in `.../schedule-event/route.ts` so the CPCV gets its own date/time/local (step 5). Escritura schedule already exists.
- A few **email templates** (pedido-doc fecho, dados-escritura, distrate/APB) added to `tpl_email_library`.

`ai_caption` (marketing moments), `schedule_event` (escritura), `email`, `upload`, `confirm` all already exist and are reused unchanged.

## 5. Data touchpoints (reuse, don't recreate)
- `deals`: `deal_type`, `partner_agency_name`, **+`partner_agency_nif` (new)**, `consultant_id`, `business_type`, `proc_instance_id`.
- `deal_payments`: `amount`/`agency_amount`, `is_signed`/`is_received`, `agency_invoice_recipient`/`_nif`, full `moloni_*`, `network_invoice_*`.
- `deal_payment_splits`: per-agent `consultant_invoice_*`, `role`.
- `deal_clients`: **widen** to persist the KYC the form already collects (nif, is_pep, funds_origin, beneficiaries, rcbe, id-doc, `is_main_contact`).
- `property_owners` + `owners`: faturação recipient name/NIF (nossa angariação).
- `company_transactions`: income (auto via `propagate_deal_payment_received` trigger) + **expense** (supplier faturas, new).

## 6. Step-panel UI
Clone `components/processes/angariacao-timeline/` → `components/processes/negocio-timeline/`:
- `negocio-steps.ts` — `NEGOCIO_PHASES` (6 phase-nodes) each with its steps (`StepAction` enum extended: `+ moloni_invoice | supplier_invoice | tracked_request | note | schedule_event`).
- `negocio-process-panel.tsx` — phase stepper; clicking a phase opens a detail sheet listing its steps. **Completion routes through the real completer** (PUT legacy completer for hybrid cards / `POST /complete` for rules with Components) so `cpcv_signed/received`, `escritura_signed/received`, `close_deal` fire — NOT the angariação mock pattern.
- `GET /api/processes/[id]/negocio-overview` — phase/step progress (mirror `/angariacao-overview` STEP_MAP, keyed by negócio `subtask_key`s), + `deal_clients`, payment moments, scenario.
- Mount at the 3 surfaces (negócio detail Processo tab, deal detail Processo tab, imóvel 'venda' sub-tab) with a Novo/Antigo toggle (Antigo = `ProcessPipelinePanel`). Tolerate `property_id = null` (angariacao_externa).
- Grouped per-buyer doc view: extend `<GroupedSubtasksView>` to group by `config.client_id` (in addition to `owner_id`).

## 7. Preserve checklist (closing spine — do NOT lose)
- `deal_payments` triggers `propagate_deal_payment_signed()` / `propagate_deal_payment_received()` (migration 20260518) — **keep verbatim** (origin-agnostic financial backbone: signed → `deal_events`/`deals.*_actual_date`; received → ONE idempotent `company_transactions` income draft).
- The 6 hooks: `cpcv_signed`, `cpcv_received`, `schedule_escritura` (+ new `schedule_cpcv`), `escritura_signed`, `escritura_received`, `close_deal`.
- `close_deal` side-effects (`lib/processes/neg/close-deal-hook.ts`): deal→completed, negócio→won terminal stage, `syncLeadEstado`.
- `payment_moment → event_type` mapping (cpcv→cpcv; escritura→escritura; single→contrato_arrendamento if arrendamento else escritura).
- `deal_events` rows + `idx_deal_events_upcoming` (−20d alert cron).
- `proc_subtasks_dedup` index + bulk-then-row-by-row dedup; config markers (`hardcoded`, `process_type`, `rule_key`, `hint`).
- Per-client repeat semantics (`config.client_id`, not `owner_id`); `applies_when` predicates (permissive-on-null).
- `ai_caption` marketing moments; satisfaction survey; owner submission review triggers; the 27 `doc_types` + 4 PROC-NEG email templates.
- `deals.proc_instance_id ↔ proc_instances` 1:1; UI mount contracts (related endpoint, toolbar portal, refetch callback).

## 8. Risks / open items
- `taskKind ↔ proc_tasks.title` string coupling is load-bearing — a typo silently yields zero subtasks. Keep an inventory + a CI/test assert.
- `appliesWhen` property predicates are permissive-on-null → for `angariacao_externa` (no property) mortgage/condominium steps are not auto-bypassed; gate them on the seller-is-ours scenario explicitly.
- `repeatPerClient` is one-shot at submit (buyers added later go stale) — documented limitation; decide re-run trigger later.
- Faturação owner identity for `angariacao_externa` has no internal property → relies on `partner_agency_name` + new `partner_agency_nif`.
- Other 4 `process_type='negocio'` template rows (Negócio Pleno/Partilha/2× Comprador Externo) — confirm unused before retiring the declarative builder.
