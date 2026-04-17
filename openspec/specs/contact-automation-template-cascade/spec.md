# contact-automation-template-cascade Specification

## Purpose
TBD - created by archiving change add-fixed-contact-automations. Update Purpose after archive.
## Requirements
### Requirement: Template tables support scope and owner

`tpl_email_library` and `auto_wpp_templates` SHALL include a `scope` column (`'global' | 'consultant'`) and a `scope_id` column (nullable `uuid` referencing `dev_users.id`) so each template is either global or owned by one consultant.

#### Scenario: Existing template becomes global on migration

- **WHEN** the migration runs against the current database with N rows in `tpl_email_library`
- **THEN** every existing row SHALL have `scope='global'` and `scope_id=NULL`
- **AND** the CHECK `(scope='global' AND scope_id IS NULL) OR (scope='consultant' AND scope_id IS NOT NULL)` SHALL hold

#### Scenario: Consultant creates consultant-scoped template

- **WHEN** a consultant posts a new template via the "Os meus templates" tab with `scope='consultant'`
- **THEN** the row SHALL be inserted with `scope='consultant'` and `scope_id = user.id`
- **AND** the row SHALL be invisible to other consultants in their template pickers

### Requirement: Cascade resolution on every spawn

For each fixed event the system SHALL resolve the template in three layers, first match wins: (1) lead-assigned template via `contact_automation_lead_settings`, (2) consultant-scoped template matching `leads.agent_id` and the event category, (3) global template matching the event category.

#### Scenario: Lead assignment wins

- **WHEN** `contact_automation_lead_settings(lead_id=L, event_type='natal').email_template_id` points to a template T
- **AND** the consultant has a consultant-scoped natal template C
- **AND** a global natal template G exists
- **THEN** the resolver SHALL return T

#### Scenario: Consultant-scoped template wins over global

- **WHEN** no lead assignment exists for `(L, 'natal', 'email')`
- **AND** a template exists with `scope='consultant', scope_id=leads.agent_id, category='natal', is_active=true`
- **THEN** the resolver SHALL return that template
- **AND** SHALL NOT use the global template even if one exists

#### Scenario: Global fallback when consultant has no own template

- **WHEN** no lead assignment and no consultant-scoped template exist
- **AND** a template exists with `scope='global', category='natal', is_active=true`
- **THEN** the resolver SHALL return the global template

#### Scenario: Missing template blocks the channel

- **WHEN** none of the three layers yields a template for a channel
- **THEN** the spawner SHALL skip that channel for this event
- **AND** SHALL log `missing_template` in `auto_scheduler_log`

### Requirement: Consultant template deletion falls back automatically

The system SHALL route future sends to the global template when a consultant-scoped template is soft-deleted or deactivated, without any manual action from the consultant.

#### Scenario: Consultant deactivates own template

- **WHEN** the consultant sets `is_active=false` on their consultant-scoped natal template
- **AND** the next tick evaluates a lead assigned to that consultant
- **THEN** the cascade SHALL skip layer 2 and return the global template

#### Scenario: Consultant-scoped template hard-deleted

- **WHEN** a consultant deletes their consultant-scoped template via the UI
- **AND** a `contact_automation_lead_settings` row referenced it
- **THEN** the FK `ON DELETE SET NULL` SHALL null out that pointer
- **AND** the next tick SHALL resolve layer 2 or layer 3 as normal

### Requirement: Only active templates are used by the spawner

The spawner SHALL only consume templates with `is_active=true`. Inactive templates SHALL be treated as absent for the cascade.

#### Scenario: Inactive consultant template is ignored

- **WHEN** a consultant has a consultant-scoped natal template with `is_active=false`
- **AND** no other consultant-scoped natal template exists
- **AND** an active global natal template exists
- **THEN** the spawner SHALL use the global template

### Requirement: System templates are protected from deletion

Templates marked `is_system=true` SHALL NOT be deletable by any user through the UI or API.

#### Scenario: Attempt to delete a system template

- **WHEN** any user calls `DELETE` on a template where `is_system=true`
- **THEN** the database trigger SHALL reject the operation with a `system_template_protected` error
- **AND** the row SHALL remain intact

