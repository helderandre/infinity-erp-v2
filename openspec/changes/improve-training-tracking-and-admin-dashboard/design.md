## Context

Training module is live with 7+ API sub-routes, enrollment flow, video player, quiz attempts, lesson comments, and admin stats. Three friction points remain:

1. **Course creation UX**: broker has to type every field manually. Whisper is already in the project (`/api/transcribe` and `components/negocios/quick-fill.tsx` pattern).
2. **Completion integrity**: `LessonPlayer` already auto-completes at ≥90%, but `lesson-rating.tsx`'s manual "Marcar como concluída" calls `markCompleted()` directly — bypasses the watch gate server-side AND client-side. The DB also has no way to tell who completed "honestly" vs clicked the button.
3. **Admin visibility**: `GET /api/training/admin/stats` gives a global snapshot and `GET /api/training/admin/users/[id]` inverts the view (one user, all courses). There's no "one course, all learners + all lessons + all quizzes" aggregation.

The training tables involved:
- `forma_training_courses`, `forma_training_modules`, `forma_training_lessons`, `forma_training_quizzes`
- `forma_training_enrollments(user_id, course_id, status, progress_percent, started_at, completed_at, enrolled_at, updated_at)`
- `forma_training_lesson_progress(user_id, lesson_id, enrollment_id, status, video_watched_seconds, video_watch_percent, time_spent_seconds, started_at, completed_at, last_accessed_at)`
- `forma_training_quiz_attempts`
- Existing views: `forma_course_completion_stats`, `forma_user_completion_stats`
- `forma_training_lesson_reports`, `forma_training_material_downloads`

## Goals / Non-Goals

**Goals:**
- Make course creation ~3× faster by letting broker speak for 20–60s and auto-filling the form with GPT-4o-mini extraction.
- Guarantee "concluído" in the DB means "at least 90% of the video was actually watched" (or an explicit, audited admin override).
- Give brokers a single-page view per course: summary KPIs, per-learner drill-down, per-lesson engagement, per-quiz performance.

**Non-Goals:**
- Anti-cheat that beats determined users (multiple tabs, 2x playback detection, tab-hidden tracking). Heartbeats + clamped deltas are "good enough" honest-user gating.
- Offline mode / video download for offline viewing.
- Auto-transcribe video lessons into captions or text summaries.
- Bulk enrollment, batch actions, CSV export (future change).
- Rewriting the existing player — we augment it with heartbeat and resume-position.
- Changing certificate generation logic.

## Decisions

### D1. Two-layer voice form fill: `/api/transcribe` for individual fields, new `/api/training/courses/fill-from-voice` for whole form

**Why**: reuse the existing Whisper pipeline for the inline "microphone next to input" flow (no extraction needed, just text into one field). The whole-form flow needs a second layer (GPT-4o-mini with structured output) to extract ≥10 typed fields from free speech. Separating keeps the extraction prompt small (only fires when user opts into "Ditar tudo").

**Alternative considered**: single endpoint that always extracts. Rejected because (a) makes inline field dictation unnecessarily expensive (GPT call per dictation), (b) couples two concerns.

**Structured extraction**: use `openai.chat.completions.create` with `response_format: { type: 'json_schema', json_schema: {...} }` so the model returns a JSON object matching `createCourseSchema`. Fields unmentioned stay `null` (explicit nullable in schema). For `difficulty_level`, we whitelist the enum values (beginner/intermediate/advanced). For `category_id`, we don't ask the model for a UUID; instead we ask for `category_name` string and do a server-side case-insensitive lookup in `training_categories` — safer, avoids hallucinated UUIDs.

### D2. Watch gate enforced at both API and UI layers

**Why**: defense in depth. If someone calls the API directly with `{ status: 'completed' }`, the server rejects it based on the server-side `video_watch_percent`. The UI disable is for UX so the user understands why.

**Trust boundary**: `video_watch_percent` is still reported by the client (player polls `currentTime/duration`). This is fine because (a) the client can only increase their own watch percent; (b) making it higher just marks their own lesson complete — no lateral impact. We trade "absolute tamper-proof" for "simple and good enough", with heartbeat clamping (D3) as the main integrity signal.

**Admin override path**: `training` permission holders can force-complete with `admin_override` source logged in `log_audit`. Useful for remediation (e.g., learner had a buffering issue, broker confirms they watched offline). The override is audited with target user id so it's traceable.

### D3. Heartbeat with 15s clamp

**Why**: players send `video_watched_seconds` cumulatively, but that can be gamed by fast-forwarding. Heartbeat = "I'm still actually playing, here's the position". Clamping `delta_seconds` to 15 means even if a user pauses playback and keeps the tab open for 10 minutes, the server only accepts 15s of additional `time_spent`. Duplicate suppression (3s window) stops trivial script-driven double-counting.

**Cost**: one DB write per 10s per active viewer. With 100 concurrent viewers = 10 writes/sec — well within Supabase capacity. The table already has an index on `(user_id, lesson_id)` via the unique constraint.

**Alternative considered**: server-sent events for real-time presence. Rejected as over-engineered for the goal (tracking time, not live presence).

### D4. Dashboard = one aggregate endpoint + one drill-down endpoint

**Why**: two calls cover all four tabs. `GET /courses/[id]/activity` powers Resumo/Lições/Quizzes tabs (single roundtrip). `GET /courses/[id]/enrollments` is paginated because a course may have hundreds of enrollments and we only need page-sized detail.

**Alternative considered**: GraphQL / dataloader-style nested queries. Rejected — Next.js route handlers are fine; two endpoints are simpler and cacheable independently.

**Caching**: `Cache-Control: private, max-age=60` on the activity payload. Brokers don't need real-time; 60s staleness is tolerable. The enrollments list is not cached (freshness matters when checking a specific user's progress).

**Query strategy**: the activity endpoint does 5–6 parallel Supabase queries (one per aggregate: lessons, quizzes, reports, enrollments-count, sources) and merges in-memory. No joins deeper than 2 levels — keeps Postgres planner predictable.

### D5. Column additions are additive, not destructive

`completion_source TEXT` nullable + `last_video_position_seconds INT NOT NULL DEFAULT 0` on `forma_training_lesson_progress`. Existing rows get `completion_source=NULL` (historical unknown) and `last_video_position_seconds=0`. CHECK constraint on `completion_source IN ('auto_watch','manual','admin_override','quiz_pass') OR completion_source IS NULL`.

**Why**: we don't need to backfill `completion_source` for historical data — it's purely forward-looking. The admin dashboard shows "Origem desconhecida" for older rows.

### D6. Reuse `<VoiceInputButton>` as a cross-module primitive

The microphone recording + stop + transcribe flow is already implemented in `components/negocios/quick-fill.tsx`. Extract the reusable portion into `components/shared/voice-input-button.tsx` with props `{ onTranscribe: (text) => void; mode?: 'append' | 'replace'; endpoint?: string (default /api/transcribe) }`. Then `quick-fill.tsx` refactors to use it (optional) and training reuses it.

**Why**: avoid code duplication; future modules (leads notes, proprietários) can adopt.

**Scope discipline**: we ship the component and use it in training. Refactoring `quick-fill.tsx` is a nice-to-have not required for this change.

## Risks / Trade-offs

- [**Risk**: Breaking change for consultores who relied on "Marcar como concluída" to skip videos] → Communicate clearly in the release notes; brokers can override on request. Add a migration note in CLAUDE.md. Not a real regression — it fixes incorrect behaviour.
- [**Risk**: GPT extraction hallucinates fields] → Strict JSON schema; `fields` merge only overwrites empty form values; transcription shown alongside so broker can sanity-check.
- [**Risk**: Heartbeat endpoint gets hammered by buggy clients] → Rate limiting by 3s window + 15s clamp per heartbeat. 100 viewers × 6 heartbeats/min = ~10k/hour, trivial for Supabase.
- [**Risk**: Activity aggregate query slows down on courses with 1000+ enrollments] → `Cache-Control: max-age=60` absorbs most reloads; queries use `count` with `head: true` where possible. Revisit with materialized view if p95 > 800ms.
- [**Risk**: Voice dictation records PII] → Audio is sent to OpenAI (standard for our existing transcribe usage) and not stored. Same privacy posture as `/api/negocios/[id]/transcribe`. No new disclosure needed.
- [**Trade-off**: Server-side gate rejects manual completion when `video_watch_percent` in DB is stale (player crashed before last heartbeat)] → 90% is a generous threshold; if player reports 88% and crashes, user rewatches the last bit. Acceptable.

## Migration Plan

1. Apply migration `2026xxxx_training_completion_source.sql`: adds two columns + CHECK constraint. Non-blocking, no locks on large tables.
2. Ship backend endpoints (`fill-from-voice`, `heartbeat`, gated `progress`, `activity`, `enrollments`). All additive except the gate change on `PUT progress`.
3. Ship frontend in two sub-releases:
   - R1: `<VoiceInputButton>` + dictation on new/edit course forms + heartbeat in player + resume-from-position.
   - R2: Activity page + "Actividade" entry point.
4. Rollback: revert code; the two new columns stay (harmless). Heartbeats stop being called, nothing breaks.

## Open Questions

- Should the admin override require a free-text reason (like `bypass_reason` in processes)? → Decision deferred to implementation; start without, add if auditors ask.
- For `category_name` → `category_id` lookup during voice fill, do we auto-create the category if no match? → No. Broker sees "categoria não reconhecida: X" and picks manually. Creation of categories is a separate flow.
- Should the activity dashboard respect team hierarchy (team leader sees only their team's enrollments)? → Out of scope for this change; brokers see all. Add scoping in a follow-up if needed.
