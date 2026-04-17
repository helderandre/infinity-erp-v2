## ADDED Requirements

### Requirement: Per-lead override table

The system SHALL provide a `contact_automation_lead_settings` table with `(lead_id, event_type)` unique, carrying optional overrides for `email_template_id`, `wpp_template_id`, `smtp_account_id`, `wpp_instance_id` and `send_hour`. Any subset of overrides SHALL be accepted; unset columns fall through to cascade defaults.

#### Scenario: Row exists with only send_hour set

- **WHEN** a row exists for `(lead_id=L, event_type='aniversario_contacto')` with `send_hour=10` and all other override columns null
- **THEN** the spawner SHALL compute the trigger at 10:00 `Europe/Lisbon`
- **AND** the template SHALL resolve via cascade layer 2 or 3 (consultant or global)
- **AND** the account SHALL resolve via the consultant's first-created active account

#### Scenario: Row exists with full override set

- **WHEN** a row has all five override columns populated
- **THEN** the spawner SHALL use each override directly
- **AND** SHALL NOT consult the cascade for those dimensions

### Requirement: Overrides accept only consultant-accessible resources

The API SHALL reject overrides that reference templates, SMTP accounts or WhatsApp instances not accessible to the lead's consultant.

#### Scenario: Consultant tries to assign another consultant's template

- **WHEN** consultor A calls `POST /api/leads/[id]/automation-settings` with `email_template_id` pointing to a template where `scope='consultant' AND scope_id != A.id`
- **THEN** the endpoint SHALL return 400 with code `template_not_accessible`

#### Scenario: Consultant assigns a global template

- **WHEN** the override's `email_template_id` points to a template with `scope='global', is_active=true`
- **THEN** the insert SHALL succeed

#### Scenario: Override points to an SMTP account of another consultant

- **WHEN** `smtp_account_id` references `consultant_email_accounts` where `consultant_id != leads.agent_id`
- **THEN** the endpoint SHALL return 400 with code `account_not_owned`

### Requirement: Deletion of referenced resource nulls the override

The `contact_automation_lead_settings` columns `email_template_id`, `wpp_template_id`, `smtp_account_id`, `wpp_instance_id` SHALL have `ON DELETE SET NULL` so the override row survives with remaining overrides intact when a referenced resource is deleted.

#### Scenario: Consultant deletes own template referenced by a lead override

- **WHEN** a consultant deletes their consultant-scoped email template
- **AND** a `contact_automation_lead_settings` row referenced that template
- **THEN** the `email_template_id` column in the override row SHALL become `NULL`
- **AND** the row SHALL remain (other overrides preserved)

### Requirement: Override edits take effect on the next tick

Changes to `contact_automation_lead_settings` SHALL apply to the next spawner tick without requiring row updates elsewhere.

#### Scenario: Consultant changes the SMTP account mid-cycle

- **WHEN** the consultant updates `smtp_account_id` for a lead
- **AND** the next scheduled occurrence of a fixed event has not yet fired
- **THEN** the run fired at that occurrence SHALL use the new account
- **AND** no other rows need to be updated
