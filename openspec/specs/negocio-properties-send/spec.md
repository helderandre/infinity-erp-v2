# negocio-properties-send Specification

## Purpose
TBD - created by archiving change send-negocio-properties. Update Purpose after archive.
## Requirements
### Requirement: Multi-select of properties on Negócio detail
The Negócio detail page (`/dashboard/leads/[id]/negocios/[negocioId]`) SHALL allow the consultant to select one or more properties from the **Imóveis** and **Matching** tabs and trigger a send action. Selection state SHALL persist while the user switches between those two tabs and SHALL reset when the page unmounts or when a send completes successfully.

#### Scenario: Selecting properties in the Imóveis tab
- **WHEN** the consultant checks the checkbox on 2 property cards in the Imóveis tab
- **THEN** a floating action bar appears showing "2 imóveis selecionados" and an "Enviar selecionados" button

#### Scenario: Selection persists across tab switch
- **WHEN** the consultant selects 1 card in Imóveis and switches to Matching
- **THEN** the previously selected item remains counted in the floating action bar and its checkbox remains checked on return to Imóveis

#### Scenario: "Seleccionar todos" toggle
- **WHEN** the consultant clicks "Seleccionar todos" in the Imóveis tab header
- **THEN** every visible property card in that tab is selected; clicking again deselects them all

#### Scenario: Matching item not yet in dossier
- **WHEN** the consultant selects a property from the Matching tab that is not yet in `negocio_properties`
- **THEN** the system silently inserts it into the dossier (`POST /api/negocios/[id]/properties`) before opening the send dialog and shows a toast "X imóveis adicionados ao dossier"

### Requirement: Send dialog with Email and WhatsApp channels
Clicking "Enviar selecionados" SHALL open a dialog that presents Email and WhatsApp as two independent channels with toggle switches. Each channel SHALL have its own recipient list, account/instance selector, subject/message inputs, and preview. The dialog SHALL prevent submission when neither channel is enabled or when any enabled channel has zero recipients.

#### Scenario: Defaults pre-filled from the lead
- **WHEN** the dialog opens
- **THEN** the Email recipients pre-populate with `lead.email` (if present) and WhatsApp recipients pre-populate with `lead.telemovel_primario` and `lead.telemovel_secundario` (if present), each rendered as removable chips

#### Scenario: Consultant has no email accounts
- **WHEN** the consultant has zero active entries in `consultant_email_accounts`
- **THEN** the Email toggle is disabled with a tooltip "Configure uma conta em Definições → Email" and the dialog remains usable for WhatsApp only

#### Scenario: Submission blocked without any channel
- **WHEN** both Email and WhatsApp toggles are off
- **THEN** the "Enviar" button is disabled with a tooltip "Active pelo menos um canal"

#### Scenario: Ad-hoc recipient addition
- **WHEN** the consultant types `carla@example.com` into the Email recipient input and presses Enter
- **THEN** the address is validated (via `lib/documents/email-validate.ts`), added as a chip, and included in the send batch; invalid addresses show an inline error and are not added

### Requirement: Property link resolution
For each property being sent, the CTA link SHALL resolve to `https://infinitygroup.pt/property/{slug}` when the item has `property_id`, and to `external_url` when the item is an external link. The base URL SHALL be read from `NEXT_PUBLIC_WEBSITE_URL` with a fallback constant in `lib/constants.ts`.

#### Scenario: System property uses slug
- **WHEN** the selected item has `property_id` pointing to a property with `slug='apartamento-t2-parque-das-nacoes'`
- **THEN** the rendered CTA href is `https://infinitygroup.pt/property/apartamento-t2-parque-das-nacoes`

#### Scenario: External link uses external_url as-is
- **WHEN** the selected item has `property_id=null` and `external_url='https://idealista.pt/imovel/123'`
- **THEN** the rendered CTA href is exactly `https://idealista.pt/imovel/123`

### Requirement: Cover image resolution
For system properties, the card image SHALL be the media row with `is_cover=true`; if none exists, the card SHALL use the first media row by `order_index`. If the property has no media or is an external item without an uploaded image, the card SHALL render without an image (showing a placeholder block with a house icon) rather than a broken `<img>` tag.

#### Scenario: Property has cover
- **WHEN** the property has `dev_property_media` with `is_cover=true, url='https://cdn.r2/cover.webp'`
- **THEN** the card renders `<img src="https://cdn.r2/cover.webp">`

#### Scenario: External item with no image
- **WHEN** the item has `property_id=null` and no `external_image_url`
- **THEN** the card renders a placeholder block (no `<img>` tag) with neutral background

### Requirement: Email delivery via consultant SMTP
The `POST /api/negocios/[id]/properties/send` endpoint SHALL resolve the SMTP account via `resolveEmailAccount(account_id)`, render the email body using `renderPropertyGrid` from `lib/email/property-card-html.ts` placed below the consultant's intro text, and dispatch emails with concurrency limited to 3 via `pLimit`. Failures per recipient SHALL not abort the batch.

#### Scenario: Successful email send
- **WHEN** the endpoint receives `{ channels: { email: { account_id, recipients: ['a@x.pt'], subject: 'Selecção', intro: 'Olá' } }, property_ids: [id1, id2] }`
- **THEN** the server sends 1 email to `a@x.pt` via the resolved SMTP, with HTML body containing the intro followed by a 2-card grid, and returns per-recipient status `success`

#### Scenario: Partial failure
- **WHEN** one of three recipients has an invalid SMTP address or temporary 5xx
- **THEN** the other two succeed and the failed recipient is reported with `status='failed'` + error message in the response

### Requirement: WhatsApp delivery as text message
The endpoint SHALL send WhatsApp as a single text message per recipient, formatted as:
```
Olá {lead_first_name}, partilho os imóveis:

1. {title} — {priceLabel}
   {href}

2. ...
```
Concurrency SHALL be limited to 2 via `pLimit`. No binary attachments SHALL be sent; WhatsApp generates its own OpenGraph preview for the public site.

#### Scenario: Two-property WhatsApp message
- **WHEN** the endpoint receives 2 properties and 1 WhatsApp recipient
- **THEN** a single text message is dispatched via `callWhatsappEdge` with `action='send_text'` containing the formatted list and CTA URLs on separate lines

### Requirement: Progress reporting in the UI
The dialog SHALL display, while sending, a list with one line per `(channel, recipient)` pair and a live status column (`pending` → `sending` → `success` | `failed`). A failed line SHALL expose the provider error via tooltip. After completion, a "Reenviar falhados" button SHALL appear if any line failed, which re-invokes the endpoint with only the failed subset.

#### Scenario: Mixed outcome reporting
- **WHEN** the batch has 3 email recipients and 2 WhatsApp recipients, with 1 email failing
- **THEN** the progress list shows 5 lines with 4 `success` and 1 `failed`, and the "Reenviar falhados" button is visible

### Requirement: Persistence and audit
On a successful delivery of at least one channel for a given `negocio_property_id`, the endpoint SHALL update `negocio_properties.sent_at = now()`. Regardless of outcome, one `log_audit` row SHALL be written per `(channel, recipient)` pair with `action='negocio_properties.send'`, `entity_type='negocio_properties'`, and `new_data` containing channel, recipient, property_ids, status and, when failed, the error message.

#### Scenario: Audit trail for failed WhatsApp
- **WHEN** a WhatsApp send fails because the instance is disconnected
- **THEN** a `log_audit` row is created with `status='failed'` and `new_data.error='instance not connected'`, and `negocio_properties.sent_at` is NOT updated for any row unless another channel succeeded

### Requirement: Rate limits
Per invocation of `POST /api/negocios/[id]/properties/send`, the endpoint SHALL reject payloads that exceed **20 property_ids** or **20 recipients per channel** with HTTP 400 and a PT-PT error message. These limits SHALL be centralised in `lib/documents/send-defaults.ts` alongside the existing document limits.

#### Scenario: Too many recipients
- **WHEN** the payload contains 25 WhatsApp recipients
- **THEN** the endpoint returns HTTP 400 with `{ error: 'Máximo de 20 destinatários por canal' }`

