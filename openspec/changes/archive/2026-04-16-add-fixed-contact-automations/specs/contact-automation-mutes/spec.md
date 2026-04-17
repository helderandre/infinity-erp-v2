## ADDED Requirements

### Requirement: Combinatorial mute table

The system SHALL provide a single `contact_automation_mutes` table with four nullable discriminator columns (`consultant_id`, `lead_id`, `event_type`, `channel`) where `NULL` means "all". A lead-event-channel triple is muted when any row matches under null-as-wildcard semantics.

#### Scenario: Consultant mutes everything

- **WHEN** a row exists with `consultant_id=X, lead_id=NULL, event_type=NULL, channel=NULL`
- **THEN** for every lead where `leads.agent_id=X` and every event and every channel the mute check SHALL return `true`

#### Scenario: Consultant mutes only New Year emails globally

- **WHEN** a row exists with `consultant_id=X, lead_id=NULL, event_type='ano_novo', channel='email'`
- **THEN** for every lead of consultant X the email channel of `ano_novo` SHALL be muted
- **AND** the WhatsApp channel of `ano_novo` and all channels of `natal` SHALL NOT be muted by this row

#### Scenario: Lead-level mute on one event one channel

- **WHEN** a row exists with `consultant_id=NULL, lead_id=L, event_type='aniversario_contacto', channel='whatsapp'`
- **THEN** only the WhatsApp channel of the birthday event for lead L SHALL be muted
- **AND** the email channel of the birthday event SHALL continue to fire

#### Scenario: Mute row must have at least one discriminator

- **WHEN** a client attempts to insert a row with all four columns `NULL`
- **THEN** the CHECK constraint SHALL reject the insert
- **AND** the API SHALL return 400 with a validation error

### Requirement: Spawner applies mute filter per channel independently

The spawner SHALL evaluate the mute predicate separately for each `(lead, event_type, channel)` triple and produce runs only for channels that are not muted.

#### Scenario: Email muted and WhatsApp allowed

- **WHEN** a consultant-global mute row exists for `event_type='natal', channel='email'`
- **AND** the consultant has both an active SMTP account and a connected WhatsApp instance
- **THEN** the spawner SHALL produce a run with only the WhatsApp step
- **AND** SHALL NOT produce the email step

### Requirement: Mute management is scoped per consultant in the hub

A consultant SHALL be able to create, list, and delete only mutes they own (`muted_by = user.id` AND `consultant_id IN (NULL, user.id)` AND `lead_id IN consultant's leads`). Brokers/CEO SHALL see and manage all mutes.

#### Scenario: Consultant lists own mutes

- **WHEN** a consultant calls `GET /api/contact-automation-mutes`
- **THEN** the response SHALL include only rows where `muted_by = user.id` OR the targeted lead belongs to the consultant

#### Scenario: Consultant attempts to delete another consultant's mute

- **WHEN** a consultant calls `DELETE /api/contact-automation-mutes/[id]` for a row where `muted_by != user.id`
- **THEN** the endpoint SHALL return 403
