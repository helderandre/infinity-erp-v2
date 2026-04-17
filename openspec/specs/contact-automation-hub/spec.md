# contact-automation-hub Specification

## Purpose
TBD - created by archiving change add-fixed-contact-automations. Update Purpose after archive.
## Requirements
### Requirement: Hub page at /dashboard/crm/automatismos-contactos

The system SHALL provide a CRM hub page at `/dashboard/crm/automatismos-contactos` accessible to any authenticated user with `permissions.leads`, organised in four tabs: Agendados, Runs falhados, Os meus templates, Mutes globais.

#### Scenario: User opens the hub

- **WHEN** a user with `permissions.leads` navigates to `/dashboard/crm/automatismos-contactos`
- **THEN** the page SHALL render the four tabs
- **AND** default the view to the Agendados tab

#### Scenario: User without permission attempts to access

- **WHEN** a user lacking `permissions.leads` navigates to the hub
- **THEN** the middleware or layout SHALL redirect to the dashboard home with a toast "Sem permissão"

### Requirement: Agendados tab combines virtual and manual tracks

The Agendados tab SHALL display every upcoming (lead, event_type) pair from both the virtual track and the `contact_automations` manual track, paginated server-side, with columns `lead | consultor | evento | próximo envio | canais | estado`.

#### Scenario: Consultant sees own leads only

- **WHEN** a consultant loads the Agendados tab
- **THEN** the rows SHALL be filtered to `leads.agent_id = user.id`
- **AND** the rows SHALL include the three fixed events per lead plus any manual rows

#### Scenario: Broker sees all consultants

- **WHEN** a user with broker/CEO role loads the Agendados tab
- **THEN** no `agent_id` filter SHALL apply by default
- **AND** a consultant filter selector SHALL be visible

#### Scenario: Filters combine additively

- **WHEN** the user applies filters `consultor=X, evento=natal, estado=skipped_no_channel`
- **THEN** the query SHALL return only rows matching all three filters

### Requirement: Bulk actions on selected rows in Agendados

The Agendados tab SHALL support selecting multiple rows and applying one of: mute, change SMTP account, change WhatsApp instance, change send_hour. Each bulk action SHALL translate to batched writes on `contact_automation_mutes` or `contact_automation_lead_settings`.

#### Scenario: Bulk mute 20 leads for Natal email

- **WHEN** the user selects 20 rows and clicks "Silenciar email"
- **THEN** the action SHALL insert 20 rows into `contact_automation_mutes` with `lead_id=X, event_type=natal, channel='email'`
- **AND** each row SHALL have `muted_by=user.id`
- **AND** the UI SHALL refresh showing the updated `estado` column

#### Scenario: Bulk change SMTP account

- **WHEN** the user selects 5 rows and picks an SMTP account from a dropdown
- **THEN** the action SHALL upsert 5 rows in `contact_automation_lead_settings` setting `smtp_account_id`

### Requirement: Runs falhados tab shows retry controls

The Runs falhados tab SHALL list every `contact_automation_runs` with `status='failed'` in the last 30 days (scoped by permission) and expose per-row and bulk "Reexecutar agora" and "Reagendar para…" buttons.

#### Scenario: Consultant retries three failed runs individually

- **WHEN** the consultant clicks "Reexecutar agora" on three rows sequentially
- **THEN** each click SHALL call `POST /api/automacao/runs/[id]/retry`
- **AND** the row SHALL disappear from the failed list on the next refetch

#### Scenario: Bulk reschedule

- **WHEN** the consultant selects 10 failed rows and picks a future datetime via datepicker
- **THEN** a single `POST /api/automacao/runs/reschedule-batch` call SHALL dispatch

### Requirement: Os meus templates tab offers consultant-scoped CRUD

The "Os meus templates" tab SHALL allow the current user to create, edit, publish and deactivate templates with `scope='consultant', scope_id=user.id` for each of the three fixed event categories, in both email and WhatsApp channels.

#### Scenario: Consultant creates an own Natal email template

- **WHEN** the consultant clicks "Criar template" for `natal/email`
- **AND** fills the editor and clicks "Publicar"
- **THEN** a row SHALL be inserted in `tpl_email_library` with `scope='consultant', scope_id=user.id, category='natal', status='published'`
- **AND** the cascade resolver SHALL start using this template for the consultant's leads at the next tick

#### Scenario: Template in draft does not affect spawns

- **WHEN** a consultant template has `status='draft'`
- **THEN** the spawner SHALL skip it and fall to the global layer

### Requirement: Mutes globais tab exposes high-level toggles

The Mutes globais tab SHALL provide explicit toggles that translate to `contact_automation_mutes` rows, including "Silenciar TODOS os aniversários", "Silenciar TODOS os Natais", "Silenciar TODOS os Anos Novos", "Silenciar TUDO", plus per-channel variants.

#### Scenario: Consultant silences all their New Year events

- **WHEN** the consultant enables "Silenciar TODOS os Anos Novos" toggle
- **THEN** one row SHALL be inserted in `contact_automation_mutes` with `consultant_id=user.id, lead_id=NULL, event_type='ano_novo', channel=NULL`
- **AND** disabling the toggle SHALL delete that same row

#### Scenario: Duplicate mute rejected

- **WHEN** enabling a toggle that would create a duplicate row (same four discriminators)
- **THEN** the API SHALL detect the existing row and return 200 without inserting again
- **AND** the UI SHALL reflect the toggle as already enabled

