## ADDED Requirements

### Requirement: Subtask identity is defined by `subtask_key` + `owner_id`

The system SHALL identify each hardcoded subtask row in `proc_subtasks` by the tuple `(proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil))`, enforced by a unique index. The `subtask_key` SHALL be a human-readable string chosen from the registry in code (e.g., `"email_pedido_doc_singular"`, `"kyc_verification"`). Rows created by the hardcoded path SHALL have `tpl_subtask_id = NULL`.

#### Scenario: Duplicate insert returns no-op
- **WHEN** the populate API is called twice for the same process and task
- **THEN** the second call inserts zero rows because `ON CONFLICT (proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil)) DO NOTHING` matches existing rows

#### Scenario: Per-owner repetition produces N rows
- **WHEN** a rule with `repeatPerOwner: true` is applied to a property with 3 owners
- **THEN** 3 rows are inserted, each with the same `subtask_key` but distinct `owner_id`

#### Scenario: Rule without owner uses uuid_nil in the index
- **WHEN** a rule with `repeatPerOwner: false` is inserted
- **THEN** `owner_id` is NULL and the unique index treats it as `uuid_nil` for dedup

### Requirement: Subtask rules are declared in the TS registry

The system SHALL store subtask behavior in `lib/processes/subtasks/` as a typed registry. Each rule MUST conform to the `SubtaskRule` contract with fields: `key` (string), `taskKind` (string matching a task's kind), `repeatPerOwner` (optional boolean, default false), `isMandatory` (optional boolean, default true), `titleBuilder` (function), `assignedToResolver` (optional function, defaults to task's assignee), `dueRule` (optional `DueRule`), `Component` (React component), and `complete` (async function returning optional `payload`).

#### Scenario: Registry exposes rules per process type
- **WHEN** code calls `getRulesFor('angariacao')`
- **THEN** the function returns the full array of `SubtaskRule` declared in `lib/processes/subtasks/rules/angariacao/`

#### Scenario: Rule component is resolved by subtask_key
- **WHEN** the front-end receives a `proc_subtasks` row with `subtask_key = "email_pedido_doc_singular"`
- **THEN** it looks up the rule with that key in the registry and renders its `Component`

### Requirement: `dueRule` supports declarative and imperative forms

The system SHALL accept `dueRule` as either a declarative object `{ after: string, offset: string, shiftOnNonBusinessDay?: boolean }` or an imperative function `(ctx: { prereqCompletedAt: Date, businessDay: (d: Date) => Date }) => Date`. When declarative form is used and `shiftOnNonBusinessDay` is true, the computed date MUST be shifted forward to the next business day by calling `shiftToNextBusinessDay()`.

#### Scenario: Declarative dueRule with 24h offset
- **WHEN** the prerequisite subtask completes at `2026-05-01T14:00:00Z` and the rule is `{ after: "verify_docs", offset: "24h", shiftOnNonBusinessDay: true }`
- **THEN** the sibling's `due_date` is set to `2026-05-02T14:00:00Z` and then shifted to the next business day if needed

#### Scenario: Due date lands on a weekend
- **WHEN** computed due falls on Saturday
- **THEN** `shiftToNextBusinessDay()` pushes it to Monday (or next business day if Monday is a holiday)

#### Scenario: Imperative dueRule uses ctx.businessDay helper
- **WHEN** rule is defined as `(ctx) => ctx.businessDay(addHours(ctx.prereqCompletedAt, 24))`
- **THEN** the helper consults `holidays_pt` and returns the next business day

### Requirement: Portuguese holidays live in `holidays_pt`

The system SHALL store Portuguese holidays in a table `holidays_pt(date date PRIMARY KEY, name text NOT NULL, scope text NOT NULL DEFAULT 'national')`. The table SHALL be seeded with national fixed holidays plus movable ones (Sexta Santa, Corpo de Deus) for the current year and the two following years. The seed script MUST be idempotent via `ON CONFLICT DO NOTHING`.

#### Scenario: isBusinessDay consults the table
- **WHEN** `isBusinessDay('2026-04-25')` is called (25 de Abril, national holiday)
- **THEN** the function returns false

#### Scenario: Seed populates three years
- **WHEN** the seed runs in 2026
- **THEN** `holidays_pt` contains all national fixed and movable holidays for 2026, 2027, and 2028

#### Scenario: Seed is re-runnable
- **WHEN** the seed runs twice
- **THEN** no duplicates are created and no errors are raised

### Requirement: Populate API is idempotent, sync, and non-transactional

The system SHALL expose `POST /api/processes/[id]/subtasks/populate-angariacao` that synchronously materializes all applicable subtask rules into `proc_subtasks`. The handler MUST NOT wrap the inserts in a transaction. Each insert MUST use `ON CONFLICT (proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil)) DO NOTHING`. On partial failure, successfully inserted rows remain; the client is responsible for persisting the process as a draft and allowing retry.

#### Scenario: First call inserts all missing rows
- **WHEN** the endpoint is called for a newly-created angariação process with no existing subtasks
- **THEN** all applicable rules are materialized and an activity `'subtasks_populated'` is emitted with `metadata: { count: N, process_type: 'angariacao' }`

#### Scenario: Retry after partial failure completes the set
- **WHEN** a previous call inserted 7 of 12 rows before failing
- **THEN** a retry inserts the remaining 5 rows and a final `'subtasks_populated'` activity is emitted

#### Scenario: Repeat call on complete set is a no-op
- **WHEN** all rules are already materialized and the endpoint is called again
- **THEN** zero rows are inserted and no `'subtasks_populated'` activity is emitted

### Requirement: Complete API closes subtask and propagates due_date

The system SHALL expose `POST /api/processes/[id]/subtasks/[subtaskId]/complete` that sets `status='completed'`, `completed_at=now()`, `completed_by=auth.uid()`, and any `payload` returned by the rule's `complete()` handler. After the update, the handler MUST emit activity `'subtask_completed'` with metadata `{ subtask_key, owner_id, payload }` and MUST call `propagateDueDates(completedSubtask)`.

#### Scenario: Completing a subtask emits activity
- **WHEN** a subtask is completed via the endpoint
- **THEN** a row is inserted into `proc_task_activities` with `activity_type = 'subtask_completed'` and metadata `{ subtask_key, owner_id, payload? }`

#### Scenario: propagateDueDates sets due on pending siblings
- **WHEN** the completed subtask has 2 sibling rules that declare `dueRule.after` referencing its `subtask_key`, and both siblings have `status != 'completed'`
- **THEN** `due_date` is set on both siblings according to their `offset` and `shiftOnNonBusinessDay` setting

#### Scenario: propagateDueDates skips already-completed siblings
- **WHEN** a sibling that depends on the completed subtask already has `status = 'completed'`
- **THEN** no UPDATE is issued for that sibling and no `'due_date_set'` activity is emitted for it

#### Scenario: due_date_set activity includes rich metadata
- **WHEN** a sibling receives a due_date via propagation
- **THEN** an activity row is inserted with `activity_type = 'due_date_set'` and metadata `{ subtask_key, previous_due_date, new_due_date, triggered_by: { subtask_id, subtask_key }, shifted_from_non_business_day: bool }`

### Requirement: New activity types are surfaced in the timeline

The system SHALL extend `TASK_ACTIVITY_TYPE_CONFIG` in the front-end to recognize `'subtasks_populated'`, `'subtask_completed'`, and `'due_date_set'` with appropriate icons, colors, and PT-PT labels. The timeline SHALL hide `'due_date_set'` by default, exposing a toggle "Mostrar eventos do sistema" to show them when needed.

#### Scenario: Timeline shows subtask_completed by default
- **WHEN** a consultor opens the process timeline
- **THEN** `'subtask_completed'` activities are visible without any toggle

#### Scenario: due_date_set is hidden by default
- **WHEN** a consultor opens the process timeline without toggling system events
- **THEN** `'due_date_set'` activities are NOT rendered

#### Scenario: Toggle reveals system events
- **WHEN** the consultor enables "Mostrar eventos do sistema"
- **THEN** all `'due_date_set'` activities render inline with the rest, in chronological position

### Requirement: `subtask_key` is immutable across deploys

The system MUST treat `subtask_key` values as immutable once in production. Renaming a key in the registry without a corresponding data migration SHALL be considered a breaking change. The migration for a rename MUST include `UPDATE proc_subtasks SET subtask_key = '<new>' WHERE subtask_key = '<old>'` applied before the code deploy.

#### Scenario: Rename without migration breaks lookup
- **WHEN** a developer renames a key in the registry without updating existing rows
- **THEN** the front-end cannot resolve the `Component` for orphaned rows and fails to render them

#### Scenario: Coordinated rename preserves rendering
- **WHEN** the migration runs before the code deploy and both the data and the registry use the new key
- **THEN** existing rows continue to render correctly post-deploy
