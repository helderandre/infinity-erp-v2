## 1. Database migration

- [x] 1.1 Create migration `supabase/migrations/2026xxxx_training_completion_source.sql` adding `completion_source TEXT` (nullable) and `last_video_position_seconds INT NOT NULL DEFAULT 0` to `forma_training_lesson_progress`, with CHECK constraint `completion_source IN ('auto_watch','manual','admin_override','quiz_pass') OR completion_source IS NULL`
- [x] 1.2 Add index `idx_lesson_progress_lesson` on `forma_training_lesson_progress(lesson_id)` if not already covered by existing unique constraint
- [x] 1.3 Migration applied via `mcp__supabase__apply_migration` (`training_completion_source`, version `20260422222858`). `types/database.ts` regeneration skipped — file is 578K, route handlers use `@ts-nocheck`, and client code uses hand-crafted types in `types/training.ts`. Regenerate manually when convenient: `npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts`.
- [x] 1.4 Update `types/training.ts` to include the two new fields on `TrainingLessonProgress`

## 2. Shared voice input primitive

- [x] 2.1 Create `components/shared/voice-input-button.tsx` — extracts MediaRecorder + toast + endpoint-POST logic, props `{ onTranscribe, mode?: 'append'|'replace', endpoint?, disabled? }`, defaults endpoint `/api/transcribe`
- [x] 2.2 Add microphone idle/recording/loading visual states (pulse while recording, spinner while uploading), reuse `Loader2` and `Mic` lucide icons
- [x] 2.3 Handle `getUserMedia` `NotAllowedError` → toast "Permissão de microfone negada"
- [x] 2.4 Handle second-click-while-recording = cancel & discard (no network call)

## 3. Voice-fill backend

- [x] 3.1 Create `app/api/training/courses/fill-from-voice/route.ts` with POST handler (multipart), auth `requirePermission('training')` or broker
- [x] 3.2 Whisper transcribe step (reuse prompt from `/api/transcribe`, language `pt`, `whisper-1`)
- [x] 3.3 GPT-4o-mini extraction with `response_format: json_schema` matching `createCourseSchema` — nullable fields; enum for `difficulty_level`; string `category_name` instead of uuid
- [x] 3.4 Server-side case-insensitive lookup of `category_name` in `training_categories` → return `category_match: { id, name } | null`
- [x] 3.5 Return `{ transcription, fields, category_match }`; 503 if `OPENAI_API_KEY` missing; 400 if audio missing
- [~] 3.6 Scenario tests — **N/A**: repo has no test harness (no vitest/jest config). The spec's scenarios serve as the manual QA plan.

## 4. Voice-fill frontend

- [x] 4.1 Add "Ditar tudo" button to `app/dashboard/formacoes/gestao/novo/page.tsx` header — opens `<DictateCourseDialog>`
- [x] 4.2 Create `components/training/dictate-course-dialog.tsx` — large mic button, records, shows transcription + extracted fields table, "Aplicar" merges non-null fields into the form (via `form.setValue` for each key), "Cancelar" discards
- [x] 4.3 Preserve fields already filled when extraction returns `null` for them (never overwrite with null) — backend strips nulls; apply handler skips undefined/null/empty
- [x] 4.4 Add inline `<VoiceInputButton>` next to `title`, `summary`, `description`, `instructor_name` inputs (both `novo` and `[id]/editar`) — mode `append` for textarea, `replace` for short fields
- [x] 4.5 Apply same wiring to `app/dashboard/formacoes/gestao/[id]/editar/page.tsx`
- [~] 4.6 Manual QA — deferred; requires running dev server and microphone. See spec scenarios for expected behaviour.

## 5. Completion gate & heartbeat backend

- [x] 5.1 Modify `app/api/training/courses/[id]/lessons/[lessonId]/progress/route.ts` — when body has `status='completed'` and current row's `video_watch_percent < 90` and lesson is `content_type='video'`, check caller permission; if not `training`, return 403 with `{ error, current_percent, required_percent: 90 }`
- [x] 5.2 Set `completion_source` on transitions: `auto_watch` when percent≥90 without explicit status; `manual` when user-initiated with ≥90; `admin_override` when permission `training` forces <90; `quiz_pass` derived from `content_type='quiz'` completions (no separate code path needed since `LessonQuiz.onQuizPassed` already calls `markCompleted()` which flows through this endpoint)
- [x] 5.3 When `admin_override`, insert `log_audit` row `{ entity_type: 'training_completion_override', entity_id: progress.id, user_id: caller.id, new_data: { course_id, lesson_id, target_user_id, forced_percent } }`
- [x] 5.4 Create `app/api/training/courses/[id]/lessons/[lessonId]/heartbeat/route.ts` POST handler — validate body `{ delta_seconds: 1..60, position_seconds: number, percent: 0..100 }`, clamp `delta_seconds` to 15, suppress duplicates within 3s window (compare `last_accessed_at`)
- [x] 5.5 Heartbeat upserts: `time_spent_seconds += clamped_delta`, `last_video_position_seconds = position_seconds`, `video_watched_seconds = MAX(current, position_seconds)`, `video_watch_percent = MAX(current, percent)`; if new percent ≥90 and status != completed → set `completed`, `completion_source='auto_watch'`, recalc `enrollment.progress_percent`
- [x] 5.6 Return 404 when no enrollment exists; 202 when rate-limited; 200 otherwise with `{ time_spent_seconds, video_watch_percent, status }`
- [x] 5.7 Add Zod schema `heartbeatSchema` in `lib/validations/training.ts`

## 6. Completion gate & heartbeat frontend

- [x] 6.1 Update `components/training/lesson-player.tsx` — add heartbeat interval (every 10s while playing) calling `/heartbeat` with current `delta` since last beat
- [x] 6.2 On mount, if `progress.last_video_position_seconds > 0` and < `duration - 5`, seek native video to that position; pass `startAt` prop to `<YouTubeCustomPlayer>` for YouTube case
- [x] 6.3 Update `components/training/youtube-custom-player.tsx` to accept `startAt` prop and call `player.seekTo(startAt)` after ready event
- [x] 6.4 Update `components/training/lesson-rating.tsx` — disable "Marcar como concluída" when `content_type==='video'` AND live `watchPercent < 90` AND user lacks `training` permission; add tooltip "Assista a pelo menos 90% do vídeo para concluir (actualmente X%)"
- [x] 6.5 Pass `watchPercent` from lesson page to rating component (hoist state) — already partially done via `liveWatchPercent`; wire it through
- [x] 6.6 For users with `training` permission, show "(override)" badge next to the button and, on click, call `/progress` with `status='completed'` (which triggers audit log server-side)
- [~] 6.7 Manual QA — deferred; requires running dev server + test broker & consultor accounts. Server-side: audit row appears in `log_audit` (entity_type='training_completion_override').

## 7. Admin dashboard backend

- [x] 7.1 Create `app/api/training/admin/courses/[id]/activity/route.ts` GET — `requirePermission('training')`; build payload `{ course, summary, lessons[], quizzes[] }` with parallel Supabase queries; return with `Cache-Control: private, max-age=60`
- [x] 7.2 Include `completion_by_source` aggregate per lesson (group `forma_training_lesson_progress` by `lesson_id, completion_source`)
- [x] 7.3 Include `reports_count` per lesson from `forma_training_lesson_reports`
- [x] 7.4 Return 404 when course not found; 403 without permission
- [x] 7.5 Create `app/api/training/admin/courses/[id]/enrollments/route.ts` GET — pagination (`page`, `limit` max 100), filters (`status`, `search` ILIKE on `commercial_name`), sort `last_activity_at DESC NULLS LAST`
- [x] 7.6 Build per-enrollment payload with all course lessons (including `status='not_started'` placeholders for unvisited ones) — left-join style in memory
- [x] 7.7 Include `quiz_attempts[]` per enrollment (filtered to quizzes in this course)

## 8. Admin dashboard frontend

- [x] 8.1 Create `app/dashboard/formacoes/gestao/[id]/actividade/page.tsx` — server component that checks permission `training` and renders `<CourseActivityClient />`
- [x] 8.2 Create `components/training/admin/course-activity-client.tsx` — client component with `Tabs` (Resumo/Matriculados/Lições/Quizzes), driven by query param `?tab=...`
- [x] 8.3 Create `components/training/admin/activity-summary-tab.tsx` — KPI cards from `summary`
- [x] 8.4 Create `components/training/admin/activity-enrollments-tab.tsx` — paginated table calling `/enrollments` endpoint with filters/search; row click opens side-panel `<Sheet>` showing per-lesson breakdown and quiz attempts
- [x] 8.5 Create `components/training/admin/activity-lessons-tab.tsx` — table of lessons with aggregates + `completion_by_source` breakdown
- [x] 8.6 Create `components/training/admin/activity-quizzes-tab.tsx` — table of quiz stats
- [x] 8.7 Add "Actividade" link/button to course rows in `gestao-cursos-tab.tsx` and to `[id]/editar/page.tsx` header, gated by `usePermissions().hasPermission('training')`
- [x] 8.8 Breadcrumb label `actividade → Actividade` added to `components/layout/breadcrumbs.tsx`
- [x] 8.9 `<NoPermissionEmptyState>` component for unauthorized visitors

## 9. Validations & types

- [x] 9.1 Extend `lib/validations/training.ts` with `fillFromVoiceResponseSchema`, `heartbeatSchema`, `completionSourceEnum`
- [x] 9.2 Extend `types/training.ts` with `CourseActivityPayload`, `CourseEnrollmentDetail`, `CompletionSource`, `VoiceFillResponse` types

## 10. Permissions & auth

- [x] 10.1 Confirmed: `lib/auth/permissions.ts` exposes `requirePermission(module)` for handlers; `hooks/use-permissions.ts` exposes `usePermissions().hasPermission(module)` for client code. Both merge role.permissions and treat Broker/CEO + admin as having all modules. No changes needed.
- [x] 10.2 Admin routes (`/admin/courses/[id]/activity`, `/admin/courses/[id]/enrollments`) and the server-rendered Actividade page use `requirePermission('training')` — returns 403 for non-admins and renders `<NoPermissionEmptyState>` on the page.

## 11. Validation & release

- [x] 11.1 Run `openspec validate improve-training-tracking-and-admin-dashboard --strict` → **valid**
- [~] 11.2 Manual end-to-end test — deferred; requires running dev server + real accounts across 3 roles
- [~] 11.3 Regression check on non-video lessons — deferred (progress endpoint gate is scoped to `content_type='video'`; other types fall through unchanged)
- [x] 11.4 Update `CLAUDE.md` "Estado Actual do Projecto" section with summary of the delivered capabilities and links to the spec files
- [ ] 11.5 After deploy & smoke test, archive via `openspec archive improve-training-tracking-and-admin-dashboard`

## Deployment checklist

- [x] **MIGRATION** — applied to production (version `20260422222858`, `training_completion_source`). ✅
- [ ] Deploy code (backend + frontend in one release).
