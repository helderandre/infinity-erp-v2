## ADDED Requirements

### Requirement: Fixed automations are implicit by default

The system SHALL schedule three fixed event types (`aniversario_contacto`, `natal`, `ano_novo`) for every eligible lead in the `leads` table automatically, without requiring manual creation, storing zero rows in `contact_automations` for the default case.

A lead is **eligible** when `agent_id IS NOT NULL` AND at least one contact channel is filled (`email IS NOT NULL OR telemovel IS NOT NULL`). The spawner does NOT filter by `leads.estado` — that column carries free-text values without a canonical schema, so dead/converted leads are managed via the mute mechanism instead.

#### Scenario: Lead without overrides or mutes receives birthday automation

- **WHEN** a lead exists in `leads` with non-null `data_nascimento` and `agent_id`, and at least one of `email` or `telemovel` filled
- **AND** no row exists in `contact_automation_mutes` matching the lead or its consultant for `aniversario_contacto`
- **AND** no row exists in `contact_automation_lead_settings` for `(lead_id, 'aniversario_contacto')`
- **THEN** the spawner SHALL compute the next trigger as `(data_nascimento.month, data_nascimento.day, current_year_or_next, 08:00 Europe/Lisbon)`
- **AND** create an `auto_run` with the standard channels enabled by the consultant's active accounts when that moment arrives

#### Scenario: Natal fires on 25 December 08:00 every year for every eligible lead

- **WHEN** the spawner tick runs on 2026-12-25 08:00 Europe/Lisbon
- **AND** a lead is eligible (has agent + at least one channel filled) and an active consultant
- **AND** no mute applies for `(lead, natal, any channel)` for that consultant
- **THEN** the spawner SHALL generate one `auto_run` for that lead's `natal` event
- **AND** insert a `contact_automation_runs` row with `kind='virtual', lead_id, event_type='natal', scheduled_for='2026-12-25 08:00'`

#### Scenario: Ano Novo fires on 31 December

- **WHEN** the spawner tick runs on 31 December at `send_hour` (default 08:00)
- **AND** the lead is eligible and has no mute and no override pointing elsewhere
- **THEN** the spawner SHALL fire `ano_novo` for the lead

#### Scenario: Lead without agent or contact channels is ignored

- **WHEN** a lead has `agent_id IS NULL` or both `email IS NULL AND telemovel IS NULL`
- **THEN** the spawner SHALL exclude that lead from the virtual track entirely
- **AND** SHALL NOT create any `contact_automation_runs` row for it

### Requirement: Channel gating by consultant account availability

The spawner SHALL skip a channel silently when the consultant responsible for the lead (`leads.agent_id`) has no active account of that channel, and skip the entire event when both channels are unavailable.

#### Scenario: Consultant has no active SMTP account

- **WHEN** the spawner evaluates a fixed event for a lead whose `leads.agent_id` has zero `consultant_email_accounts` with `is_active=true`
- **AND** the consultant has at least one `auto_wpp_instances` with `status='connected'`
- **THEN** the spawner SHALL fire only the WhatsApp channel
- **AND** record the email skip in `auto_scheduler_log` with reason `no_active_account_email`

#### Scenario: Consultant has no active channels at all

- **WHEN** the spawner evaluates a fixed event for a lead whose consultant has zero active SMTP accounts and zero connected WhatsApp instances
- **THEN** the spawner SHALL NOT create any `auto_run`
- **AND** SHALL NOT create a `contact_automation_runs` row
- **AND** SHALL record a skip in `auto_scheduler_log` with reason `no_active_account_any`

### Requirement: First-created account selected automatically

When a consultant has multiple active SMTP accounts or connected WhatsApp instances, the spawner SHALL use the one with the oldest `created_at` unless a per-lead override exists.

#### Scenario: Consultant has three active SMTP accounts

- **WHEN** the consultant has three `consultant_email_accounts` rows with `is_active=true` created on 2024-03-01, 2024-06-15, 2025-01-20
- **AND** no override for this lead in `contact_automation_lead_settings.smtp_account_id`
- **THEN** the spawner SHALL use the 2024-03-01 account

#### Scenario: Per-lead override points to a deactivated account

- **WHEN** `contact_automation_lead_settings.smtp_account_id` references an account where `is_active=false`
- **THEN** the spawner SHALL fall back to the first-created active account of the consultant
- **AND** if none exists, skip the email channel silently

### Requirement: Reconciliation with legacy manual rows

When a row exists in `contact_automations` for a lead with `event_type` in `{aniversario_contacto, natal, ano_novo}`, the virtual track SHALL NOT generate a parallel run for that (lead, event_type).

#### Scenario: Legacy manual row honored

- **WHEN** a lead has a `contact_automations` row with `event_type='natal', status='scheduled'` created before this change
- **AND** the spawner's virtual track evaluates that lead for `natal`
- **THEN** the virtual track SHALL exclude this lead from the `natal` calculation
- **AND** the manual track SHALL fire the existing row as before

#### Scenario: Manual row deleted hands control back to virtual track

- **WHEN** the consultant deletes a `contact_automations` row for `natal`
- **AND** no mute applies
- **THEN** on the next tick the virtual track SHALL include that lead for the next `natal` occurrence

### Requirement: Idempotent virtual runs

The system SHALL guarantee that each virtual occurrence of a fixed event for a given lead fires at most once, even across retries of the spawner tick.

#### Scenario: Unique constraint prevents duplicate virtual run

- **WHEN** the spawner tick attempts to insert `contact_automation_runs` with `(kind='virtual', lead_id=L, event_type='natal', scheduled_for='2026-12-25 08:00')`
- **AND** a row with the same tuple already exists
- **THEN** the insert SHALL fail with a unique violation
- **AND** the spawner SHALL treat it as already handled and continue
