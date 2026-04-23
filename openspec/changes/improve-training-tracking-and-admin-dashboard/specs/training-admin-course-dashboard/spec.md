## ADDED Requirements

### Requirement: Course activity aggregate endpoint

The system SHALL expose `GET /api/training/admin/courses/[id]/activity` that returns an aggregate view of all learner activity for a single course.

Response shape:
```
{
  course: { id, title, total_modules, total_lessons, total_quizzes },
  summary: {
    total_enrolled: number,
    in_progress: number,
    completed: number,
    avg_progress_percent: number,
    avg_time_spent_seconds: number,
    certificates_issued: number,
    open_reports: number
  },
  lessons: Array<{
    lesson_id, title, module_title, order_index,
    total_viewed: number,
    avg_watch_percent: number,
    avg_time_spent_seconds: number,
    completed_count: number,
    completion_by_source: { auto_watch, manual, admin_override, quiz_pass },
    reports_count: number
  }>,
  quizzes: Array<{
    quiz_id, title, lesson_id,
    attempts_count, unique_attempters, pass_rate, avg_score
  }>
}
```

- Requires permission `training`.
- Response cached 60 seconds per `course_id`.

#### Scenario: Broker loads dashboard for a course with 20 enrollments

- **WHEN** a broker calls `GET /api/training/admin/courses/<uuid>/activity`
- **THEN** the response includes `summary.total_enrolled=20` and arrays `lessons` and `quizzes` matching the course's structure
- **AND** the HTTP `Cache-Control` header is `private, max-age=60`

#### Scenario: Non-admin consultor blocked

- **WHEN** a consultor without `training` permission calls the endpoint
- **THEN** the endpoint responds 403

#### Scenario: Course not found

- **WHEN** the course id does not exist
- **THEN** the endpoint responds 404 with `{ error: 'Formação não encontrada' }`

#### Scenario: Empty course (no enrollments)

- **WHEN** the course has zero enrollments
- **THEN** `summary` is returned with all counts at 0, `lessons[]` and `quizzes[]` are populated with structural info but aggregates at 0 — never returns an empty array that hides missing data

### Requirement: Per-enrollment drill-down endpoint

The system SHALL expose `GET /api/training/admin/courses/[id]/enrollments?page=&limit=&status=&search=` returning paginated enrollments with lesson-level detail for the given course.

Response shape per enrollment:
```
{
  id, user_id, user_name, user_email,
  enrolled_at, status, progress_percent, completed_at, last_activity_at,
  total_time_spent_seconds,
  lessons_total: number, lessons_completed: number,
  lessons: Array<{ lesson_id, title, status, completion_source, time_spent_seconds, completed_at, last_video_position_seconds, video_watch_percent }>,
  quiz_attempts: Array<{ quiz_id, passed, score, attempted_at }>
}
```

- Requires permission `training`.
- Default `limit=20`, max `limit=100`.
- Filter `status` accepts `not_started | in_progress | completed`.
- Filter `search` matches `user.commercial_name` ILIKE.
- Sort defaults to `last_activity_at DESC NULLS LAST`.

#### Scenario: Filter by completed status

- **WHEN** broker calls `?status=completed&page=1&limit=20`
- **THEN** response only contains enrollments where `status='completed'`

#### Scenario: Search by consultant name

- **WHEN** broker calls `?search=isabel`
- **THEN** response only contains enrollments whose `user_name` matches "isabel" case-insensitively

#### Scenario: Drill-down includes all lesson rows, even unvisited

- **WHEN** response is built for an enrollment where the user only visited 3 of 10 lessons
- **THEN** `lessons[]` includes all 10 lessons of the course (including the 7 unvisited with `status='not_started'`, `time_spent_seconds=0`)
- **AND** this allows the UI to show complete per-lesson progress without a second fetch

#### Scenario: Pagination

- **WHEN** a course has 55 enrollments and the broker calls `?page=3&limit=20`
- **THEN** response includes 15 items and `{ total: 55, page: 3, limit: 20, total_pages: 3 }`

### Requirement: Admin course activity page

The system SHALL render `app/dashboard/formacoes/gestao/[id]/actividade/page.tsx` with four tabs:

1. **Resumo** (default): KPI cards built from `summary` — total inscritos, em progresso, concluídos, % média de progresso, tempo médio assistido, certificados, reports abertos.
2. **Matriculados**: paginated table driven by the enrollments endpoint with columns: nome, email, inscrito em, status, progresso, lições completas, tempo total, última actividade. Row click opens a side panel with per-lesson drill-down.
3. **Lições**: table of `lessons` from activity endpoint with columns: ordem, módulo, lição, vistos, % média, tempo médio, concluídos, reports. Clicking a lesson opens a drawer with the list of who completed it (source+when).
4. **Quizzes**: table of quiz stats (título, tentativas, aprovados, taxa aprovação, nota média).

Access: only users with permission `training`. Page uses `requirePermission('training')` via server component wrapper; denied users see "Sem permissão" empty state with link back to `/dashboard/formacoes/gestao`.

#### Scenario: Broker opens activity page

- **WHEN** a broker navigates to `/dashboard/formacoes/gestao/<uuid>/actividade`
- **THEN** the Resumo tab renders KPIs within 1 network roundtrip
- **AND** tabs render without re-fetching the activity payload (data is hoisted)

#### Scenario: Matriculados tab drill-down

- **WHEN** broker clicks a row in the Matriculados tab
- **THEN** a side panel opens showing the user's `lessons[]` for that enrollment with per-lesson status, `completion_source` badge, time spent, and last position
- **AND** the list of quiz attempts for that user is also shown

#### Scenario: Deep link to tab via query param

- **WHEN** broker opens `/dashboard/formacoes/gestao/<uuid>/actividade?tab=licoes`
- **THEN** the Lições tab is active on first render

#### Scenario: Consultor without training permission

- **WHEN** a consultor without permission opens the page URL directly
- **THEN** the page renders the "Sem permissão" empty state (no data leak)
- **AND** the sidebar does not show the "Actividade" link for that course

### Requirement: "Actividade" entry point from course management

The course management pages — `/dashboard/formacoes/gestao/page.tsx` (list) and `/dashboard/formacoes/gestao/[id]/editar/page.tsx` — SHALL include a link "Actividade" per course (icon `BarChart3`) visible only when the user has permission `training`, pointing to `/dashboard/formacoes/gestao/[id]/actividade`.

#### Scenario: Broker sees Actividade action on course card

- **WHEN** broker loads `/dashboard/formacoes/gestao`
- **THEN** each course row shows an "Actividade" button/link alongside "Editar"

#### Scenario: Consultor does not see the entry point

- **WHEN** a consultor without `training` permission loads the same page (if allowed at all)
- **THEN** the "Actividade" link is not rendered
