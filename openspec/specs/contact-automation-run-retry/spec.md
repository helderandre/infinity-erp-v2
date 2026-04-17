# contact-automation-run-retry Specification

## Purpose
TBD - created by archiving change add-fixed-contact-automations. Update Purpose after archive.
## Requirements
### Requirement: Retry endpoint creates a new run immediately

The system SHALL expose `POST /api/automacao/runs/[id]/retry` that, for any `contact_automation_runs` row with `status='failed'`, creates a fresh `auto_run` with `trigger_at=now()` and a new `contact_automation_runs` row linked via `parent_run_id`.

#### Scenario: Single failed run retried now

- **WHEN** a user with `permissions.leads` posts to `/api/automacao/runs/[id]/retry`
- **AND** the referenced `contact_automation_runs.status='failed'`
- **THEN** the endpoint SHALL resolve template, account and variables freshly
- **AND** insert a new `auto_run` with `trigger_at=now()`
- **AND** insert a new `contact_automation_runs` row with `kind` preserved, `parent_run_id=id`, `status='pending'`
- **AND** return 201 with the new run id

#### Scenario: Retry of a non-failed run is rejected

- **WHEN** a user posts retry for a run where `status='sent'` or `status='pending'`
- **THEN** the endpoint SHALL return 409 with code `invalid_status`

### Requirement: Reschedule endpoint accepts a future trigger time

The system SHALL expose `POST /api/automacao/runs/[id]/reschedule` with body `{ trigger_at: ISO8601 }` that creates a fresh run scheduled for the given time.

#### Scenario: Reschedule to future moment

- **WHEN** a user posts reschedule with `trigger_at='2026-05-01T09:00:00Z'`
- **AND** the target time is in the future
- **THEN** the endpoint SHALL create a new `auto_run` and `contact_automation_runs` with `trigger_at` set accordingly
- **AND** the run SHALL remain `pending` until the spawner tick reaches that time

#### Scenario: Reschedule to the past is rejected

- **WHEN** `trigger_at` is earlier than `now()`
- **THEN** the endpoint SHALL return 400 with code `trigger_in_past`

### Requirement: Batch retry and batch reschedule

The system SHALL expose `POST /api/automacao/runs/retry-batch` and `POST /api/automacao/runs/reschedule-batch` accepting `{ ids: uuid[] }` (max 100 ids) and optional `trigger_at` for the reschedule variant.

#### Scenario: Batch retry with 50 failed ids

- **WHEN** a user posts `{ ids: [50 uuids] }` to the batch retry endpoint
- **AND** all 50 reference `status='failed'` runs the user is allowed to touch
- **THEN** the endpoint SHALL process each id and return 200 with a per-id result array including new run id and per-id status

#### Scenario: Batch of 150 ids exceeds limit

- **WHEN** the batch array exceeds 100 ids
- **THEN** the endpoint SHALL return 400 with code `batch_too_large`

#### Scenario: Batch contains one forbidden id

- **WHEN** the batch contains one id belonging to a run outside the caller's scope (other consultant)
- **THEN** that single id SHALL return a per-id `forbidden` result
- **AND** the remaining ids SHALL still be processed normally

### Requirement: Retry resolves template and account freshly

A retried or rescheduled run SHALL re-resolve template, account and variables at fire time via the current cascade, not reuse the snapshot of the failed run.

#### Scenario: Consultant fixed SMTP credentials between failure and retry

- **WHEN** the original run failed because `consultant_email_accounts` password was wrong
- **AND** the consultant updated the password
- **AND** a retry is issued
- **THEN** the new run SHALL read the updated credentials
- **AND** the send SHALL succeed without any other action

