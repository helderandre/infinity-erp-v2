## ADDED Requirements

### Requirement: Contact-state filter uses `leads.estado` labels minus "Lead"

The eligible-leads selector in the custom-event automation wizard SHALL expose a multi-select filter named **"Estado do contacto"** whose options are the entries of `LEAD_ESTADOS` in [`lib/constants.ts`](../../../../lib/constants.ts) **excluding** the value `'Lead'`. The selected values MUST be passed to `GET /api/automacao/custom-events/eligible-leads` as the `contact_estados` query parameter (comma-separated, URL-encoded). The server SHALL filter `leads.estado IN (<selected labels>)` using exact string match against the PT-PT labels stored in the column. When the filter is empty or absent the server SHALL NOT add any predicate on `leads.estado`.

The legacy `status` query parameter (with codes `new|contacted|qualified|archived|expired`) SHALL be removed from the endpoint — requests sending it MUST be ignored (parameter silently dropped, no error).

#### Scenario: Single contact-state value narrows results

- **WHEN** the user selects `Cliente Activo` in the "Estado do contacto" filter
- **AND** the wizard requests `GET /api/automacao/custom-events/eligible-leads?contact_estados=Cliente%20Activo&page=1&limit=30`
- **THEN** the response SHALL include only leads where `leads.agent_id = auth.user.id` AND `leads.estado = 'Cliente Activo'`
- **AND** `total` reflects the count under this predicate

#### Scenario: Multiple contact-state values combine with OR

- **WHEN** the user selects both `Qualificado` and `Potencial Cliente`
- **AND** the request carries `contact_estados=Qualificado,Potencial%20Cliente`
- **THEN** the server SHALL apply `leads.estado IN ('Qualificado', 'Potencial Cliente')`
- **AND** a lead with `estado='Perdido'` SHALL NOT appear

#### Scenario: "Lead" label is not offered in the filter

- **WHEN** the user opens the "Estado do contacto" dropdown
- **THEN** the options SHALL be `Contactado`, `Qualificado`, `Potencial Cliente`, `Cliente Activo`, `1 Negocio Fechado`, `Cliente Recorrente`, `Cliente Premium`, `Perdido`, `Inactivo` — in that order
- **AND** the value `Lead` SHALL NOT appear in the dropdown

#### Scenario: Legacy `status` param is silently ignored

- **WHEN** a caller sends `GET /api/automacao/custom-events/eligible-leads?status=contacted`
- **THEN** the server SHALL NOT filter by `leads.estado`
- **AND** the response SHALL be identical to the request without the `status` parameter

### Requirement: Pipeline-stage filter uses `negocios.pipeline_stage_id`

The wizard SHALL expose a second multi-select filter named **"Fase do pipeline"** whose options are all rows of `leads_pipeline_stages` (fetched via `GET /api/crm/pipeline-stages`), visually grouped by `pipeline_type` (`comprador`, `vendedor`, `arrendatario`, `arrendador`) and ordered within each group by `order_index`. Each option is identified by `leads_pipeline_stages.id` (UUID). Selected UUIDs MUST be passed to the eligible-leads endpoint as `pipeline_stage_ids` (comma-separated).

The server SHALL include a lead in the response when at least one row exists in `negocios` with `negocios.lead_id = leads.id` AND `negocios.pipeline_stage_id IN (<selected UUIDs>)`. When the filter is empty or absent, no predicate on `negocios` SHALL be added (leads without any negócio remain visible).

#### Scenario: Lead with a matching negócio is included

- **WHEN** the user selects the stage `Proposta` (pipeline_type=`comprador`)
- **AND** lead L has one `negocios` row with `pipeline_stage_id` equal to that stage's id
- **THEN** L SHALL appear in the response

#### Scenario: Lead without any negócio in the selected stage is excluded

- **WHEN** the user selects the stage `Visitas`
- **AND** lead L has a negócio but in stage `Contactado` instead
- **THEN** L SHALL NOT appear in the response

#### Scenario: Multiple stage ids combine with OR

- **WHEN** the user selects both `Visitas` and `Proposta` from the `comprador` group
- **AND** the request carries `pipeline_stage_ids=<uuid-visitas>,<uuid-proposta>`
- **THEN** a lead with a negócio in either stage SHALL appear
- **AND** a lead whose only negócio is in `CPCV` SHALL NOT appear

#### Scenario: Lead without any negócio is excluded when pipeline filter is active

- **WHEN** the user selects any pipeline stage
- **AND** lead L has zero rows in `negocios`
- **THEN** L SHALL NOT appear in the response

### Requirement: Filters combine with AND between groups

When both `pipeline_stage_ids` and `contact_estados` are non-empty, the server SHALL return leads that satisfy **both** predicates simultaneously: `leads.estado IN (<estados>)` AND `EXISTS(negocio with pipeline_stage_id IN (<stage-ids>))`. Within each group the logic is OR (as specified above); between groups the logic is AND.

#### Scenario: Pipeline + estado filters combined

- **WHEN** the user selects pipeline stage `Proposta` and contact estado `Cliente Activo`
- **THEN** a lead with `estado='Cliente Activo'` AND at least one negócio in `Proposta` SHALL appear
- **AND** a lead with `estado='Cliente Activo'` but only negócios in `Contactado` SHALL NOT appear
- **AND** a lead with a negócio in `Proposta` but `estado='Perdido'` SHALL NOT appear

### Requirement: No filters selected returns full consultant scope

When both `pipeline_stage_ids` and `contact_estados` are absent or empty, the endpoint SHALL behave exactly as the pre-existing baseline: return every `leads` row where `agent_id = auth.user.id`, ordered by `nome ASC`, paginated via `page`/`limit`, optionally narrowed by `search`.

#### Scenario: Empty filters return everything in consultant's scope

- **WHEN** the wizard opens the "Seleccionar contactos" step with no filters touched
- **AND** the request is `GET /api/automacao/custom-events/eligible-leads?page=1&limit=30`
- **THEN** the response SHALL contain every lead assigned to the consultant (paginated)
- **AND** no predicate on `leads.estado` or `negocios.pipeline_stage_id` SHALL be applied

#### Scenario: Only search provided behaves as today

- **WHEN** the consultant types `maria` in the search field with no filters active
- **AND** the request is `…?search=maria&page=1&limit=30`
- **THEN** the response SHALL match the current behaviour (ILIKE on nome/email/telemovel) with no filter predicates

### Requirement: Server enforces input limits on filter arrays

The endpoint SHALL cap each of `pipeline_stage_ids` and `contact_estados` to a maximum of **20 values**. Requests exceeding the cap SHALL be rejected with HTTP 400 and a JSON body `{ error: "Demasiados filtros (máximo 20 por grupo)" }`. Values in `contact_estados` that are not members of `LEAD_ESTADOS` SHALL be silently dropped (defence-in-depth against injection). Values in `pipeline_stage_ids` that are not valid UUIDs SHALL be silently dropped.

#### Scenario: Over-limit contact_estados array is rejected

- **WHEN** the request carries 21 comma-separated values in `contact_estados`
- **THEN** the server SHALL respond with HTTP 400 and body `{ error: "Demasiados filtros (máximo 20 por grupo)" }`

#### Scenario: Unknown estado label is dropped without error

- **WHEN** the request carries `contact_estados=Contactado,Inexistente`
- **THEN** the server SHALL filter using only `leads.estado IN ('Contactado')`
- **AND** SHALL NOT return an error

#### Scenario: Non-UUID pipeline id is dropped without error

- **WHEN** the request carries `pipeline_stage_ids=abc,<valid-uuid>`
- **THEN** the server SHALL filter using only the valid UUID
- **AND** SHALL NOT return an error

### Requirement: Wizard UI renders both filters with clear state

The "Seleccionar contactos" step of the custom-event wizard SHALL render both filters side by side above the leads list, each as a multi-select dropdown with chips for selected values and a "Limpar" action that resets only that filter. The existing search input and pagination controls SHALL remain. Changing any filter SHALL reset pagination to `page=1`.

The row badge that currently shows `STATUS_LABELS[lead.status]` SHALL be replaced by a badge that displays `lead.estado` verbatim (the PT-PT label stored in the column), hiding the badge when `estado` is null.

#### Scenario: Selecting a pipeline stage resets to page 1

- **WHEN** the user is on page 3 and selects a pipeline stage
- **THEN** the wizard SHALL issue a fresh request with `page=1`
- **AND** the displayed pagination footer SHALL show `Página 1 de N`

#### Scenario: "Limpar" removes only the target filter

- **WHEN** the user has selected both `Proposta` (pipeline) and `Cliente Activo` (estado)
- **AND** clicks "Limpar" on the pipeline dropdown
- **THEN** `pipeline_stage_ids` SHALL be cleared
- **AND** `contact_estados` SHALL still include `Cliente Activo`

#### Scenario: Row badge shows PT-PT estado verbatim

- **WHEN** a lead has `estado='Cliente Premium'`
- **THEN** the badge in its row SHALL display the text `Cliente Premium`
- **AND** SHALL NOT pass the value through any English-code lookup
