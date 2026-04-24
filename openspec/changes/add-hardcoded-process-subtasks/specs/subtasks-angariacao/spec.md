## ADDED Requirements

### Requirement: Angariação rules are declared under `lib/processes/subtasks/rules/angariacao/`

The system SHALL place all `SubtaskRule` declarations for angariação under `lib/processes/subtasks/rules/angariacao/` as individual TypeScript files, each exporting a single rule. A barrel index SHALL collect them and expose them via `getRulesFor('angariacao')`. The set of rules delivered in this change SHALL cover the angariação process end-to-end (document request emails, KYC per owner, CPCV draft generation, verification checks, etc.) and be enumerated in `docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md` as the reference example.

#### Scenario: Registry returns only angariação rules for 'angariacao'
- **WHEN** `getRulesFor('angariacao')` is called
- **THEN** it returns rules whose `taskKind` matches tasks in the angariação template, and no rules from other process types

#### Scenario: Per-owner rules expand to one row per owner
- **WHEN** the populate API runs for a property with 2 owners and a rule has `repeatPerOwner: true`
- **THEN** 2 rows are created with the same `subtask_key` and distinct `owner_id`

### Requirement: Populate is triggered from the "Criar angariação" button

The system SHALL invoke `POST /api/processes/[id]/subtasks/populate-angariacao` synchronously when the consultor confirms creation of an angariação. The client MUST block UI with a full-screen overlay component `<PopulatingSubtasksOverlay>` showing a spinner and the message "A preparar subtarefas...". A `beforeunload` handler MUST be active for the duration of the request, warning the user that leaving will discard progress.

#### Scenario: Successful populate shows overlay then redirects
- **WHEN** the consultor clicks "Criar angariação" and the populate succeeds
- **THEN** the overlay displays for the duration of the request, then the browser redirects to the process detail page

#### Scenario: beforeunload blocks accidental navigation
- **WHEN** the consultor tries to close the tab or navigate away during the populate
- **THEN** the browser shows the native "Are you sure?" dialog

#### Scenario: Error creates draft and surfaces toast
- **WHEN** the populate fails
- **THEN** the angariação is persisted as a draft (reusing the existing draft pattern) and a toast "Erro ao preparar subtarefas. Angariação guardada como rascunho." is shown, followed by a redirect to the draft detail page

### Requirement: Resume from draft completes the populate idempotently

The system SHALL allow the consultor to resume a draft angariação whose populate failed partially. Resuming SHALL re-invoke `populate-angariacao` for the same `process_id`, which will insert only the missing rows thanks to the unique index.

#### Scenario: Resume draft fills missing rows
- **WHEN** a draft process has 7 of 12 expected subtasks
- **THEN** clicking "Retomar" re-invokes the populate and inserts the 5 missing rows, upgrading the process from draft to active

#### Scenario: Resume on complete process is safe
- **WHEN** the consultor accidentally triggers resume on a process that already has all subtasks
- **THEN** zero rows are inserted and the process status is unchanged

### Requirement: Backfill script handles in-flight angariações

The system SHALL provide `scripts/backfill-angariacao-subtasks.ts` that iterates `proc_instances` where `tpl_process_id IS NOT NULL AND current_status != 'completed' AND external_ref LIKE 'PROC-ANG-%'` and invokes the populate endpoint for each. The script MUST be idempotent and safe to re-run. Completed angariações SHALL NOT be touched.

#### Scenario: In-flight processes receive subtasks
- **WHEN** the script runs post-deploy against processes created before the change
- **THEN** each in-flight PROC-ANG process receives its full set of subtasks

#### Scenario: Completed processes are skipped
- **WHEN** the script runs
- **THEN** processes with `current_status = 'completed'` are not touched; no rows are inserted for them

#### Scenario: Re-running the script is safe
- **WHEN** the script is run twice
- **THEN** the second run inserts zero rows and emits zero `'subtasks_populated'` activities (handler skips emission when zero rows changed)

### Requirement: New angariações populate on creation

The system SHALL call the populate endpoint as part of the "Criar angariação" flow for every new angariação created after deploy. Angariações SHALL NOT exist in an "approved-but-empty-subtasks" state beyond the brief populate window.

#### Scenario: Fresh angariação is fully populated
- **WHEN** a new angariação is created via the UI
- **THEN** the detail page renders with all subtasks present; no manual "Preparar subtarefas" step is required
