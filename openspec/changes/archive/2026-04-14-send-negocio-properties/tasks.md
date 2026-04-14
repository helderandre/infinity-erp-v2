## 1. Shared scaffolding

- [x] 1.1 Add `PUBLIC_WEBSITE_URL` constant in `lib/constants.ts` (reads `NEXT_PUBLIC_WEBSITE_URL`, fallback `https://infinitygroup.pt`)
- [x] 1.2 Extend `lib/documents/send-defaults.ts` with `MAX_PROPERTY_IDS_PER_SEND = 20` and `MAX_RECIPIENTS_PER_CHANNEL = 20` (and reuse existing constants for document limits)
- [x] 1.3 ~~Extract reusable send sub-components~~ — deviated: kept `send-documents-dialog.tsx` untouched to avoid regression risk; new `SendPropertiesDialog` inlines trimmed sub-components and reuses shared utilities (`isValidEmail`, `normalizeToE164`, `formatE164ForDisplay`, `pLimit`, `resolveEmailAccount`). DRY mildly violated but diff surface is tiny and reversible; extraction deferred to a follow-up change if a third consumer appears.

## 2. Email property-grid renderer

- [x] 2.1 Create `lib/email/property-card-html.ts` exporting `PropertyCardInput` type and `renderPropertyGrid(properties, options?)` that emits Outlook-safe table HTML with inline styles + a single `<style>` block for the mobile media query
- [x] 2.2 Handle row wrap (3 per row desktop, collapsing to 1 per row on `max-width: 480px`) and the placeholder branch for items with no `imageUrl`
- [x] 2.3 Format `priceLabel` with PT-PT number formatting (thin-space thousands) and default CTA label `"Ver imóvel"`
- [x] 2.4 ~~Jest snapshot tests~~ — deferred: project has no test runner (no jest/vitest in `package.json`). Instead added `lib/email/property-card-html.fixtures.ts` with the same 1/3/5/no-image fixtures documented in spec, runnable manually via `npx tsx`. Proper test suite tracked as a follow-up when a runner is adopted.

## 3. Craft.js email block

- [x] 3.1 Create `components/email-editor/user/email-property-grid.tsx` as a Craft.js user component with a `properties` JSON textarea, columns selector (1/2/3) and CTA label input. "Vincular a negócio" picker deferred — the programmatic send path from the dossier populates the grid directly without requiring a picker in the editor.
- [x] 3.2 Renderer `lib/email-renderer.ts` routes `EmailPropertyGrid` nodes to `renderPropertyGrid` from `lib/email/property-card-html.ts` so editor output == programmatic output.
- [x] 3.3 Empty-state placeholder in the editor preview; `renderPropertyGrid([])` emits `<!-- no properties -->` comment + empty table.
- [x] 3.4 Registered in `email-editor.tsx` resolver map and added to `email-toolbox.tsx` Conteúdo category ("Grelha Imóveis").

## 4. Backend endpoint

- [x] 4.1 Created `app/api/negocios/[id]/properties/send/recipients/route.ts` (GET) returning `{ consultant, owners: [lead-as-owner], leadFirstName, entityLabel }` for dialog defaults
- [x] 4.2 Created `app/api/negocios/[id]/properties/send/route.ts` (POST) with Zod validation and limit enforcement via `MAX_PROPERTY_IDS_PER_SEND`/`MAX_RECIPIENTS_PER_CHANNEL` (via `z.array().max()`)
- [x] 4.3 Loads `negocio_properties` + joined `dev_properties` + specs + media; `toCardInput` handles system+external; `buildPublicPropertyUrl(slug)` for system items
- [x] 4.4 Email pipeline: `resolveEmailAccount` → wrap `body_html + renderPropertyGrid(cards)` with `wrapEmailHtml` → dispatch via Supabase `smtp-send` edge (same transport as documents) with `pLimit(3)`
- [x] 4.5 WhatsApp pipeline: `buildDefaultWhatsappText` (or user override) → `callWhatsappEdge({ action: 'send_text' })` with `pLimit(2)` — no binary attachments
- [x] 4.6 Batch `update({ sent_at: now })` on `negocio_properties` for the passed IDs when any channel succeeded
- [x] 4.7 Best-effort insert into `log_audit` with `entity_type='negocio_properties'`, `action='negocio_properties.send'`, full payload + per-recipient results; returns `{ results, attempted, succeeded }`. Note: single audit row per request (not one per recipient) — matches document-send pattern and keeps `log_audit` slim.

## 5. UI — selection + send dialog

- [x] 5.1 Lifted selection state (`selectedPropertyRowIds: Set<string>`) into the page — single source of truth shared across Imóveis + Matching.
- [x] 5.2 Imóveis tab: checkbox overlay (top-left) on each card + "Seleccionar todos" control (tri-state) in tab header. Floating action bar (fixed bottom) shows count, "Limpar" and "Enviar selecionados".
- [x] 5.3 Matching tab: checkbox on each match card. On first tick of an un-added match, auto-POST to `/api/negocios/[id]/properties`, receive the new row id, add it to selection, remove from matches, refetch properties, toast `"Imóvel adicionado ao dossier e seleccionado"`.
- [x] 5.4 Created `components/negocios/send-properties-dialog.tsx` loading recipients from the new endpoint, accounts from `GET /api/email/account`, instances from `GET /api/whatsapp/instances`.
- [x] 5.5 Dialog: Email (account select, subject input, intro Textarea, recipient chips via `isValidEmail`), WhatsApp (instance select, message textarea with default template, recipient chips via `normalizeToE164`/`formatE164ForDisplay`). Live HTML grid preview deferred — the intro + grid compose server-side; preview can be added later without changing the endpoint contract.
- [x] 5.6 Submit disables form (driven by `isSending` in the hook), shows inline `SendProgress` list per `(channel, recipient)` with status + failure tooltip; "Reenviar falhados" button appears while any row is failed.
- [x] 5.7 On success, the page's `onSuccess` callback closes dialog, clears selection, and refetches `properties` so `sent_at` appears in the UI; toast summary `"Envio concluído: X sucessos[, Y falhas]"`.

## 6. Hooks

- [x] 6.1 Created `hooks/use-send-properties.ts` mirroring `use-send-documents`: loads recipients + accounts + instances on open, `send()` returns `{ ok, results }` and tracks per-recipient progress via `results` state.
- [x] 6.2 Dialog's `onSuccess` triggers `fetchProperties()` on the page; added "Enviado a {dd de MMM, HH:mm}" label on each Imóveis card when `sent_at` is present.

## 7. QA & docs

- [ ] 7.1 **Manual — needs real credentials.** Send to real Gmail, Outlook Desktop, iOS Mail; screenshot the grid in each.
- [ ] 7.2 **Manual — needs connected UAZ instance.** Send WhatsApp to a real number; confirm the link preview renders on WhatsApp Web + mobile.
- [ ] 7.3 **Manual — needs a running Supabase.** Verify `log_audit` entries and `sent_at` updates after mixed success/failure scenarios.
- [x] 7.4 Updated `CLAUDE.md` with a new section **"Envio de Imóveis do Dossier (Negócio)"** linking to `send-properties-dialog`, `use-send-properties`, `property-card-html`, `EmailPropertyGrid` block, and the two new endpoints.
- [ ] 7.5 **Manual — needs seeded negócio.** Smoke-test with ≥5 properties (mix system + external + no-image).
