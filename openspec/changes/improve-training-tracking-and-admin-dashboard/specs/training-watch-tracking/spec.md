## ADDED Requirements

### Requirement: Server-side gate for manual lesson completion

The system SHALL reject manual `status='completed'` updates on video lessons when the user's recorded `video_watch_percent` is below 90%, UNLESS the user has permission `training` (admin override).

Applies to `PUT /api/training/courses/[id]/lessons/[lessonId]/progress`.

#### Scenario: Consultor marks video lesson completed with 40% watched

- **WHEN** a consultor calls the progress endpoint with `{ status: 'completed' }` and the stored `video_watch_percent` for that lesson is 40
- **THEN** the endpoint responds 403 with `{ error: 'Assista a pelo menos 90% do vídeo para concluir', current_percent: 40, required_percent: 90 }`
- **AND** the lesson remains in `status='in_progress'`

#### Scenario: Consultor marks video lesson completed with 92% watched

- **WHEN** a consultor calls with `{ status: 'completed' }` and stored `video_watch_percent` is 92
- **THEN** the endpoint sets `status='completed'`, `completed_at=now()`, `completion_source='manual'`
- **AND** responds 200

#### Scenario: Auto-completion from player heartbeat

- **WHEN** the player sends `{ video_watch_percent: 91 }` without explicit `status`
- **THEN** the endpoint sets `status='completed'`, `completion_source='auto_watch'` (existing behaviour preserved but source field now recorded)

#### Scenario: Admin override

- **WHEN** a broker (permission `training`) calls with `{ status: 'completed' }` and stored `video_watch_percent` is 10
- **THEN** the endpoint accepts the update, sets `completion_source='admin_override'`, and writes a row to `log_audit` with `entity_type='training_completion_override'`, `entity_id=<lesson_progress.id>`, `new_data={ course_id, lesson_id, target_user_id, forced_percent: 10 }`

#### Scenario: Non-video lesson types are unaffected

- **WHEN** a consultor marks a `pdf`, `text`, `external_link`, or `quiz` lesson as completed
- **THEN** the 90% gate does not apply and the lesson is marked completed (existing behaviour)

### Requirement: Heartbeat endpoint for accurate watched-time tracking

The system SHALL expose `POST /api/training/courses/[id]/lessons/[lessonId]/heartbeat` accepting `{ delta_seconds: number, position_seconds: number, percent: number }`.

Rules:
- Requires authenticated user with an active enrollment on the course (404 otherwise).
- `delta_seconds` MUST be between 1 and 15 (values outside are clamped to 15 — prevents single-burst cheating).
- The endpoint increments `forma_training_lesson_progress.time_spent_seconds` by `delta_seconds`, updates `last_video_position_seconds = position_seconds`, updates `video_watched_seconds = MAX(current, position_seconds)`, updates `video_watch_percent = MAX(current, percent)`.
- If `percent >= 90` and `status != 'completed'`, transitions to `status='completed'`, `completion_source='auto_watch'`.
- Rate limit: if two heartbeats for the same `(user_id, lesson_id)` arrive within 3 seconds, the second is discarded silently (202).

#### Scenario: Valid heartbeat every 10 seconds

- **WHEN** the player sends `{ delta_seconds: 10, position_seconds: 120, percent: 40 }` for an in-progress lesson
- **THEN** the endpoint returns 200, `time_spent_seconds` increased by 10, `last_video_position_seconds=120`, `video_watch_percent=max(previous, 40)`

#### Scenario: Delta larger than 15 seconds

- **WHEN** player sends `{ delta_seconds: 60, ... }` (e.g. tab was backgrounded)
- **THEN** the server clamps the increment to 15 seconds
- **AND** response includes `{ clamped: true, applied_delta: 15 }`

#### Scenario: Duplicate heartbeat within 3s window

- **WHEN** two heartbeats arrive 1s apart for the same `(user_id, lesson_id)`
- **THEN** the second returns 202 `{ skipped: true, reason: 'rate_limited' }` and state is unchanged

#### Scenario: User without enrollment

- **WHEN** a user who is not enrolled in the course sends a heartbeat
- **THEN** the endpoint responds 404 `{ error: 'Inscrição não encontrada para este curso' }`

#### Scenario: Heartbeat triggers auto-completion

- **WHEN** heartbeat arrives with `percent=91` and current status is `in_progress`
- **THEN** the endpoint transitions status to `completed`, sets `completion_source='auto_watch'`, sets `completed_at=now()`
- **AND** recalculates `enrollment.progress_percent` (same logic as existing progress endpoint)

### Requirement: Completion source and resume position persisted

The `forma_training_lesson_progress` table MUST include columns `completion_source TEXT` (nullable; allowed values: `auto_watch`, `manual`, `admin_override`, `quiz_pass`) and `last_video_position_seconds INT NOT NULL DEFAULT 0`.

#### Scenario: Resume video from last position

- **WHEN** a user returns to a video lesson they paused at 3:42 (`last_video_position_seconds=222`)
- **THEN** the player, on load, seeks to 3:42 instead of 0:00
- **AND** the user can override by scrubbing to any other position

#### Scenario: Completion source queryable

- **WHEN** admin calls `GET /api/training/admin/courses/[id]/activity` (defined in `training-admin-course-dashboard`)
- **THEN** the response includes aggregate counts by `completion_source` per lesson (e.g. `{ auto_watch: 12, manual: 3, admin_override: 1 }`)

### Requirement: UI gate in lesson player for manual completion button

The "Marcar como concluída" button in the lesson page MUST be disabled for the current user when:
- `content_type='video'` AND
- local `video_watch_percent < 90` AND
- current user does NOT have permission `training`.

A tooltip SHALL explain: "Assista a pelo menos 90% do vídeo para concluir (actualmente X%)".

#### Scenario: Consultor with 50% watched sees disabled button

- **WHEN** consultor is on a video lesson and the player's live `watchPercent` state is 50
- **THEN** the "Marcar como concluída" button is disabled
- **AND** hover shows "Assista a pelo menos 90% do vídeo para concluir (actualmente 50%)"

#### Scenario: Consultor reaches 90%

- **WHEN** the `onWatchPercentChange` callback reports 90
- **THEN** the button becomes enabled
- **AND** clicking it succeeds (server side accepts because stored percent is also >=90)

#### Scenario: Broker always sees enabled button

- **WHEN** a user with permission `training` views any video lesson
- **THEN** the button is always enabled regardless of watch percentage
- **AND** an "(override)" badge is visible next to the button to signal the audited action
