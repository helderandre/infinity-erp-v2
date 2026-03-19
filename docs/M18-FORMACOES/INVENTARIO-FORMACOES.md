# M18 — Formações: Inventário Completo da Implementação

**Data:** 2026-03-19
**Estado:** Implementado (Frontend + Backend + Base de Dados)

---

## Resumo Executivo

| Camada | Quantidade |
|--------|-----------|
| Tabelas no Supabase | 16 (prefixo `temp_training_`) |
| API Routes (endpoints) | 32 |
| Páginas Frontend | 13 |
| Componentes React | 20 |
| Hooks Customizados | 8 |
| Types TypeScript | 1 ficheiro (~20 interfaces + enums) |
| Validações Zod | 1 ficheiro (~12 schemas) |
| RPCs / Functions | 0 |
| Edge Functions | 0 |
| Triggers | 0 |
| RLS Policies | 0 (sem RLS activo) |
| Migração | `20260315235506_create_training_module_tables` |

### Dados Existentes no Banco

| Tabela | Registos |
|--------|---------|
| `temp_training_categories` | **8** (seed) |
| `temp_training_courses` | **3** |
| `temp_training_modules` | **8** |
| `temp_training_lessons` | **23** |
| `temp_training_enrollments` | **2** |
| `temp_training_lesson_progress` | **1** |
| Restantes tabelas | **0** |

---

## 1. Base de Dados — Schema Completo

### 1.1 `temp_training_categories`

Categorias de formação. 8 categorias seed.

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO | — |
| `slug` | text | NO | — (UNIQUE) |
| `description` | text | YES | — |
| `icon` | text | YES | — |
| `color` | text | YES | `'blue-500'` |
| `order_index` | integer | NO | `0` |
| `is_active` | boolean | NO | `true` |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

**Categorias Seed:** Comercial, Processual, Marketing, Liderança, Jurídico/Legal, Tecnologia/Ferramentas, Desenvolvimento Pessoal, Onboarding.

---

### 1.2 `temp_training_courses`

Entidade principal de curso.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `title` | text | NO | — | — |
| `slug` | text | NO | — (UNIQUE) | — |
| `description` | text | YES | — | — |
| `summary` | text | YES | — | — |
| `cover_image_url` | text | YES | — | — |
| `category_id` | uuid | NO | — | → `temp_training_categories.id` |
| `difficulty_level` | text | NO | `'beginner'` | — |
| `tags` | text[] | YES | `'{}'` | — |
| `instructor_id` | uuid | YES | — | → `dev_users.id` |
| `instructor_name` | text | YES | — | — |
| `estimated_duration_minutes` | integer | YES | — | — |
| `is_mandatory` | boolean | NO | `false` | — |
| `mandatory_for_roles` | text[] | YES | `'{}'` | — |
| `has_certificate` | boolean | NO | `false` | — |
| `certificate_validity_months` | integer | YES | — | — |
| `passing_score` | integer | YES | `70` | — |
| `prerequisite_course_ids` | uuid[] | YES | `'{}'` | — |
| `status` | text | NO | `'draft'` | — |
| `published_at` | timestamptz | YES | — | — |
| `created_by` | uuid | NO | — | → `dev_users.id` |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**Indexes:** PK, slug (unique), category_id, instructor_id, status

---

### 1.3 `temp_training_modules`

Módulos agrupam lições dentro de um curso.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `course_id` | uuid | NO | — | → `temp_training_courses.id` |
| `title` | text | NO | — | — |
| `description` | text | YES | — | — |
| `order_index` | integer | NO | `0` | — |
| `is_active` | boolean | NO | `true` | — |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**Indexes:** PK, course_id

---

### 1.4 `temp_training_lessons`

Lições individuais (vídeo, PDF, texto, link externo).

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `module_id` | uuid | NO | — | → `temp_training_modules.id` |
| `title` | text | NO | — | — |
| `description` | text | YES | — | — |
| `content_type` | text | NO | — | — |
| `video_url` | text | YES | — | — |
| `video_provider` | text | YES | — | — |
| `video_duration_seconds` | integer | YES | — | — |
| `pdf_url` | text | YES | — | — |
| `text_content` | text | YES | — | — |
| `external_url` | text | YES | — | — |
| `order_index` | integer | NO | `0` | — |
| `is_active` | boolean | NO | `true` | — |
| `estimated_minutes` | integer | YES | — | — |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**content_type values:** `video`, `pdf`, `text`, `external_link`
**video_provider values:** `youtube`, `vimeo`, `r2`, `other`

**Indexes:** PK, module_id

---

### 1.5 `temp_training_quizzes`

Testes de avaliação (por módulo ou por curso).

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `module_id` | uuid | YES | — | → `temp_training_modules.id` |
| `course_id` | uuid | YES | — | → `temp_training_courses.id` |
| `title` | text | NO | — | — |
| `description` | text | YES | — | — |
| `passing_score` | integer | NO | `70` | — |
| `max_attempts` | integer | YES | `0` | — |
| `time_limit_minutes` | integer | YES | — | — |
| `shuffle_questions` | boolean | NO | `false` | — |
| `show_correct_answers` | boolean | NO | `true` | — |
| `is_active` | boolean | NO | `true` | — |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**Indexes:** PK, module_id, course_id

---

### 1.6 `temp_training_quiz_questions`

Perguntas dos quizzes.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `quiz_id` | uuid | NO | — | → `temp_training_quizzes.id` |
| `question_text` | text | NO | — | — |
| `question_type` | text | NO | `'single_choice'` | — |
| `options` | jsonb | NO | `'[]'` | — |
| `explanation` | text | YES | — | — |
| `points` | integer | NO | `1` | — |
| `order_index` | integer | NO | `0` | — |
| `created_at` | timestamptz | NO | `now()` | — |

**question_type values:** `single_choice`, `multiple_choice`, `true_false`
**options format:** `[{ "text": "...", "is_correct": true/false }]`

**Indexes:** PK, quiz_id

---

### 1.7 `temp_training_enrollments`

Inscrições dos utilizadores em cursos.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `user_id` | uuid | NO | — | → `dev_users.id` |
| `course_id` | uuid | NO | — | → `temp_training_courses.id` |
| `status` | text | NO | `'enrolled'` | — |
| `progress_percent` | integer | NO | `0` | — |
| `enrolled_at` | timestamptz | NO | `now()` | — |
| `started_at` | timestamptz | YES | — | — |
| `completed_at` | timestamptz | YES | — | — |
| `deadline` | timestamptz | YES | — | — |
| `certificate_issued` | boolean | NO | `false` | — |
| `certificate_url` | text | YES | — | — |
| `certificate_expires_at` | timestamptz | YES | — | — |
| `assigned_by` | uuid | YES | — | → `dev_users.id` |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**status values:** `enrolled`, `in_progress`, `completed`, `dropped`
**UNIQUE:** `(user_id, course_id)`

**Indexes:** PK, user_id, course_id, status, unique(user_id+course_id)

---

### 1.8 `temp_training_lesson_progress`

Progresso por lição individual.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `user_id` | uuid | NO | — | → `dev_users.id` |
| `lesson_id` | uuid | NO | — | → `temp_training_lessons.id` |
| `enrollment_id` | uuid | NO | — | → `temp_training_enrollments.id` |
| `status` | text | NO | `'not_started'` | — |
| `video_watched_seconds` | integer | YES | `0` | — |
| `video_watch_percent` | integer | YES | `0` | — |
| `started_at` | timestamptz | YES | — | — |
| `completed_at` | timestamptz | YES | — | — |
| `last_accessed_at` | timestamptz | YES | — | — |
| `time_spent_seconds` | integer | YES | `0` | — |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**status values:** `not_started`, `in_progress`, `completed`
**UNIQUE:** `(user_id, lesson_id)`
**Auto-complete:** lição de vídeo marcada como completa quando `video_watch_percent >= 90`

**Indexes:** PK, user_id, lesson_id, enrollment_id, unique(user_id+lesson_id)

---

### 1.9 `temp_training_quiz_attempts`

Tentativas de quiz com respostas e scores.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `user_id` | uuid | NO | — | → `dev_users.id` |
| `quiz_id` | uuid | NO | — | → `temp_training_quizzes.id` |
| `enrollment_id` | uuid | NO | — | → `temp_training_enrollments.id` |
| `score` | integer | NO | — | — |
| `passed` | boolean | NO | — | — |
| `answers` | jsonb | NO | `'[]'` | — |
| `started_at` | timestamptz | NO | `now()` | — |
| `completed_at` | timestamptz | YES | — | — |
| `time_spent_seconds` | integer | YES | — | — |
| `attempt_number` | integer | NO | `1` | — |
| `created_at` | timestamptz | NO | `now()` | — |

**Indexes:** PK, user_id, quiz_id, enrollment_id

---

### 1.10 `temp_training_learning_paths`

Percursos de formação (sequências de cursos).

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `title` | text | NO | — | — |
| `slug` | text | NO | — (UNIQUE) | — |
| `description` | text | YES | — | — |
| `cover_image_url` | text | YES | — | — |
| `is_mandatory` | boolean | NO | `false` | — |
| `mandatory_for_roles` | text[] | YES | `'{}'` | — |
| `estimated_duration_minutes` | integer | YES | — | — |
| `status` | text | NO | `'draft'` | — |
| `created_by` | uuid | NO | — | → `dev_users.id` |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**Indexes:** PK, slug (unique)

---

### 1.11 `temp_training_learning_path_courses`

Junction table: cursos num percurso.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `learning_path_id` | uuid | NO | — | → `temp_training_learning_paths.id` |
| `course_id` | uuid | NO | — | → `temp_training_courses.id` |
| `order_index` | integer | NO | `0` | — |
| `is_required` | boolean | NO | `true` | — |

**UNIQUE:** `(learning_path_id, course_id)`

**Indexes:** PK, learning_path_id, unique(learning_path_id+course_id)

---

### 1.12 `temp_training_path_enrollments`

Inscrições em percursos de formação.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `user_id` | uuid | NO | — | → `dev_users.id` |
| `learning_path_id` | uuid | NO | — | → `temp_training_learning_paths.id` |
| `status` | text | NO | `'enrolled'` | — |
| `progress_percent` | integer | NO | `0` | — |
| `enrolled_at` | timestamptz | NO | `now()` | — |
| `completed_at` | timestamptz | YES | — | — |
| `deadline` | timestamptz | YES | — | — |
| `assigned_by` | uuid | YES | — | → `dev_users.id` |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**UNIQUE:** `(user_id, learning_path_id)`

**Indexes:** PK, user_id, unique(user_id+learning_path_id)

---

### 1.13 `temp_training_comments`

Comentários/dúvidas por lição com threading.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `lesson_id` | uuid | NO | — | → `temp_training_lessons.id` |
| `user_id` | uuid | NO | — | → `dev_users.id` |
| `content` | text | NO | — | — |
| `parent_id` | uuid | YES | — | → `temp_training_comments.id` (self-ref) |
| `is_resolved` | boolean | NO | `false` | — |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | — |

**Indexes:** PK, lesson_id, user_id

---

### 1.14 `temp_training_bookmarks`

Favoritos de cursos e lições.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `user_id` | uuid | NO | — | → `dev_users.id` |
| `course_id` | uuid | YES | — | → `temp_training_courses.id` |
| `lesson_id` | uuid | YES | — | → `temp_training_lessons.id` |
| `created_at` | timestamptz | NO | `now()` | — |

**UNIQUE (parcial):** `(user_id, course_id) WHERE course_id IS NOT NULL`
**UNIQUE (parcial):** `(user_id, lesson_id) WHERE lesson_id IS NOT NULL`

**Indexes:** PK, user_id, unique parciais

---

### 1.15 `temp_training_certificates`

Certificados internos e externos.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `user_id` | uuid | NO | — | → `dev_users.id` |
| `course_id` | uuid | YES | — | → `temp_training_courses.id` |
| `enrollment_id` | uuid | YES | — | → `temp_training_enrollments.id` |
| `is_external` | boolean | NO | `false` | — |
| `external_title` | text | YES | — | — |
| `external_provider` | text | YES | — | — |
| `external_file_url` | text | YES | — | — |
| `title` | text | NO | — | — |
| `certificate_code` | text | YES | — (UNIQUE) | — |
| `pdf_url` | text | YES | — | — |
| `issued_at` | timestamptz | NO | `now()` | — |
| `expires_at` | timestamptz | YES | — | — |
| `is_valid` | boolean | NO | `true` | — |
| `created_at` | timestamptz | NO | `now()` | — |

**Indexes:** PK, user_id, course_id, certificate_code (unique)

---

### 1.16 `temp_training_notifications`

Notificações de formação.

| Coluna | Tipo | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| `id` | uuid | NO | `gen_random_uuid()` | — |
| `user_id` | uuid | NO | — | → `dev_users.id` |
| `notification_type` | text | NO | — | — |
| `title` | text | NO | — | — |
| `message` | text | NO | — | — |
| `course_id` | uuid | YES | — | → `temp_training_courses.id` |
| `lesson_id` | uuid | YES | — | → `temp_training_lessons.id` |
| `quiz_id` | uuid | YES | — | → `temp_training_quizzes.id` |
| `is_read` | boolean | NO | `false` | — |
| `read_at` | timestamptz | YES | — | — |
| `created_at` | timestamptz | NO | `now()` | — |

**notification_type values:** `course_assigned`, `deadline_reminder`, `course_completed`, `quiz_passed`, `quiz_failed`, `new_course`, `certificate_issued`

**Indexes:** PK, user_id, (user_id + is_read)

---

### Diagrama de Relações (FK)

```
dev_users
  ├── temp_training_courses.instructor_id
  ├── temp_training_courses.created_by
  ├── temp_training_enrollments.user_id
  ├── temp_training_enrollments.assigned_by
  ├── temp_training_lesson_progress.user_id
  ├── temp_training_quiz_attempts.user_id
  ├── temp_training_comments.user_id
  ├── temp_training_bookmarks.user_id
  ├── temp_training_certificates.user_id
  ├── temp_training_notifications.user_id
  ├── temp_training_learning_paths.created_by
  └── temp_training_path_enrollments.user_id / assigned_by

temp_training_categories
  └── temp_training_courses.category_id

temp_training_courses
  ├── temp_training_modules.course_id
  ├── temp_training_quizzes.course_id
  ├── temp_training_enrollments.course_id
  ├── temp_training_bookmarks.course_id
  ├── temp_training_certificates.course_id
  ├── temp_training_notifications.course_id
  └── temp_training_learning_path_courses.course_id

temp_training_modules
  ├── temp_training_lessons.module_id
  └── temp_training_quizzes.module_id

temp_training_lessons
  ├── temp_training_lesson_progress.lesson_id
  ├── temp_training_comments.lesson_id
  ├── temp_training_bookmarks.lesson_id
  └── temp_training_notifications.lesson_id

temp_training_quizzes
  ├── temp_training_quiz_questions.quiz_id
  ├── temp_training_quiz_attempts.quiz_id
  └── temp_training_notifications.quiz_id

temp_training_enrollments
  ├── temp_training_lesson_progress.enrollment_id
  ├── temp_training_quiz_attempts.enrollment_id
  └── temp_training_certificates.enrollment_id

temp_training_learning_paths
  ├── temp_training_learning_path_courses.learning_path_id
  └── temp_training_path_enrollments.learning_path_id

temp_training_comments
  └── temp_training_comments.parent_id (self-ref, threading)
```

---

## 2. Infra Supabase

### RPCs / Functions
**Nenhuma** RPC ou stored function específica para formações.

### Edge Functions
**Nenhuma** Edge Function específica para formações.

### Triggers
**Nenhum** trigger associado às tabelas de formação.

### RLS Policies
**Nenhuma** policy de RLS configurada. Todas as queries são feitas via Supabase admin client (service role) nos Route Handlers.

### CHECK Constraints
**Nenhum** CHECK constraint adicional (além dos NOT NULL implícitos).

### Migração
- **Nome:** `20260315235506_create_training_module_tables`
- **Tipo:** DDL (CREATE TABLE + INSERT seeds)

---

## 3. API Routes — 32 Endpoints

### 3.1 Categorias

| Método | Rota | Ficheiro |
|--------|------|---------|
| GET | `/api/training/categories` | `app/api/training/categories/route.ts` |
| POST | `/api/training/categories` | `app/api/training/categories/route.ts` |
| PUT | `/api/training/categories/[id]` | `app/api/training/categories/[id]/route.ts` |
| DELETE | `/api/training/categories/[id]` | `app/api/training/categories/[id]/route.ts` |

### 3.2 Cursos

| Método | Rota | Ficheiro |
|--------|------|---------|
| GET | `/api/training/courses` | `app/api/training/courses/route.ts` |
| POST | `/api/training/courses` | `app/api/training/courses/route.ts` |
| GET | `/api/training/courses/[id]` | `app/api/training/courses/[id]/route.ts` |
| PUT | `/api/training/courses/[id]` | `app/api/training/courses/[id]/route.ts` |
| DELETE | `/api/training/courses/[id]` | `app/api/training/courses/[id]/route.ts` |
| POST | `/api/training/courses/[id]/publish` | `app/api/training/courses/[id]/publish/route.ts` |
| POST | `/api/training/courses/[id]/enroll` | `app/api/training/courses/[id]/enroll/route.ts` |
| POST | `/api/training/courses/[id]/assign` | `app/api/training/courses/[id]/assign/route.ts` |

### 3.3 Módulos & Lições

| Método | Rota | Ficheiro |
|--------|------|---------|
| POST | `/api/training/courses/[id]/modules` | `app/api/training/courses/[id]/modules/route.ts` |
| PUT | `/api/training/modules/[id]` | `app/api/training/modules/[id]/route.ts` |
| DELETE | `/api/training/modules/[id]` | `app/api/training/modules/[id]/route.ts` |
| POST | `/api/training/modules/[id]/lessons` | `app/api/training/modules/[id]/lessons/route.ts` |
| PUT | `/api/training/lessons/[id]` | `app/api/training/lessons/[id]/route.ts` |
| DELETE | `/api/training/lessons/[id]` | `app/api/training/lessons/[id]/route.ts` |
| PUT | `/api/training/courses/[id]/lessons/[lessonId]/progress` | `app/api/training/courses/[id]/lessons/[lessonId]/progress/route.ts` |

### 3.4 Quizzes & Perguntas

| Método | Rota | Ficheiro |
|--------|------|---------|
| POST | `/api/training/quizzes` | `app/api/training/quizzes/route.ts` |
| PUT | `/api/training/quizzes/[id]` | `app/api/training/quizzes/[id]/route.ts` |
| DELETE | `/api/training/quizzes/[id]` | `app/api/training/quizzes/[id]/route.ts` |
| GET | `/api/training/quizzes/[id]/questions` | `app/api/training/quizzes/[id]/questions/route.ts` |
| POST | `/api/training/quizzes/[id]/questions` | `app/api/training/quizzes/[id]/questions/route.ts` |
| PUT | `/api/training/questions/[id]` | `app/api/training/questions/[id]/route.ts` |
| DELETE | `/api/training/questions/[id]` | `app/api/training/questions/[id]/route.ts` |
| POST | `/api/training/quizzes/[id]/attempt` | `app/api/training/quizzes/[id]/attempt/route.ts` |
| GET | `/api/training/quizzes/[id]/attempts` | `app/api/training/quizzes/[id]/attempts/route.ts` |

### 3.5 Utilizador

| Método | Rota | Ficheiro |
|--------|------|---------|
| GET | `/api/training/my-courses` | `app/api/training/my-courses/route.ts` |
| GET | `/api/training/my-certificates` | `app/api/training/my-certificates/route.ts` |
| GET/POST | `/api/training/bookmarks` | `app/api/training/bookmarks/route.ts` |

### 3.6 Percursos

| Método | Rota | Ficheiro |
|--------|------|---------|
| GET | `/api/training/learning-paths` | `app/api/training/learning-paths/route.ts` |
| POST | `/api/training/learning-paths` | `app/api/training/learning-paths/route.ts` |
| GET | `/api/training/learning-paths/[id]` | `app/api/training/learning-paths/[id]/route.ts` |
| PUT | `/api/training/learning-paths/[id]` | `app/api/training/learning-paths/[id]/route.ts` |
| POST | `/api/training/learning-paths/[id]/enroll` | `app/api/training/learning-paths/[id]/enroll/route.ts` |

### 3.7 Comentários

| Método | Rota | Ficheiro |
|--------|------|---------|
| GET/POST | `/api/training/courses/[id]/lessons/[lessonId]/comments` | `app/api/training/courses/[id]/lessons/[lessonId]/comments/route.ts` |
| PUT | `/api/training/comments/[id]` | `app/api/training/comments/[id]/route.ts` |
| DELETE | `/api/training/comments/[id]` | `app/api/training/comments/[id]/route.ts` |
| PUT | `/api/training/comments/[id]/resolve` | `app/api/training/comments/[id]/resolve/route.ts` |

### 3.8 Estatísticas & Notificações

| Método | Rota | Ficheiro |
|--------|------|---------|
| GET | `/api/training/stats/overview` | `app/api/training/stats/overview/route.ts` |
| GET | `/api/training/stats/users/[userId]` | `app/api/training/stats/users/[userId]/route.ts` |
| GET | `/api/training/notifications` | `app/api/training/notifications/route.ts` |
| PUT | `/api/training/notifications/[id]/read` | `app/api/training/notifications/[id]/read/route.ts` |
| PUT | `/api/training/notifications/read-all` | `app/api/training/notifications/read-all/route.ts` |

---

## 4. Frontend — Páginas (13)

| URL | Ficheiro | Descrição |
|-----|---------|-----------|
| `/dashboard/formacoes` | `app/dashboard/formacoes/page.tsx` | Catálogo de formações (grid com filtros) |
| `/dashboard/formacoes/meus-cursos` | `app/dashboard/formacoes/meus-cursos/page.tsx` | Meus cursos (tabs: Em Progresso, Concluídos, Todos) |
| `/dashboard/formacoes/certificados` | `app/dashboard/formacoes/certificados/page.tsx` | Certificados (tabs: Internos, Externos) |
| `/dashboard/formacoes/cursos/[id]` | `app/dashboard/formacoes/cursos/[id]/page.tsx` | Detalhe do curso (curriculum, sobre, certificado) |
| `/dashboard/formacoes/cursos/[id]/licoes/[lessonId]` | `app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx` | Player de lição (vídeo/PDF/texto + sidebar + comments) |
| `/dashboard/formacoes/cursos/[id]/quiz/[quizId]` | `app/dashboard/formacoes/cursos/[id]/quiz/[quizId]/page.tsx` | Quiz player (perguntas paginadas + timer + resultados) |
| `/dashboard/formacoes/percursos` | `app/dashboard/formacoes/percursos/page.tsx` | Catálogo de percursos |
| `/dashboard/formacoes/percursos/[id]` | `app/dashboard/formacoes/percursos/[id]/page.tsx` | Detalhe do percurso (timeline de cursos) |
| `/dashboard/formacoes/estatisticas` | `app/dashboard/formacoes/estatisticas/page.tsx` | Dashboard estatísticas (admin) |
| `/dashboard/formacoes/gestao` | `app/dashboard/formacoes/gestao/page.tsx` | Gestão de cursos (admin: tabela CRUD) |
| `/dashboard/formacoes/gestao/novo` | `app/dashboard/formacoes/gestao/novo/page.tsx` | Criar novo curso |
| `/dashboard/formacoes/gestao/[id]/editar` | `app/dashboard/formacoes/gestao/[id]/editar/page.tsx` | Editar curso (tabs: Detalhes, Conteúdo, Configuração) |
| `/dashboard/formacoes/gestao/categorias` | `app/dashboard/formacoes/gestao/categorias/page.tsx` | Gestão de categorias |

---

## 5. Componentes React (20)

Todos em `components/training/`.

| Componente | Ficheiro | Descrição |
|------------|---------|-----------|
| `CourseCard` | `course-card.tsx` | Card de curso (imagem, badges, progresso) |
| `TrainingFilters` | `training-filters.tsx` | Barra de filtros (search, categoria, dificuldade) |
| `DifficultyBadge` | `difficulty-badge.tsx` | Badge de nível com cor |
| `CourseProgressBar` | `course-progress-bar.tsx` | Barra de progresso visual |
| `BookmarkButton` | `bookmark-button.tsx` | Toggle de favorito |
| `CourseDetailHeader` | `course-detail-header.tsx` | Header hero do detalhe do curso |
| `CourseCurriculum` | `course-curriculum.tsx` | Lista accordion de módulos/lições |
| `LessonPlayer` | `lesson-player.tsx` | Player de vídeo (YouTube, Vimeo, R2) com tracking |
| `LessonPDFViewer` | `lesson-pdf-viewer.tsx` | Viewer PDF inline + download |
| `LessonTextContent` | `lesson-text-content.tsx` | Renderizador HTML/texto |
| `LessonSidebar` | `lesson-sidebar.tsx` | Navegação lateral módulos/lições |
| `LessonComments` | `lesson-comments.tsx` | Comentários com threading e replies |
| `QuizPlayer` | `quiz-player.tsx` | Interface de quiz (paginado, timer) |
| `QuizResults` | `quiz-results.tsx` | Resultados do quiz (score, revisão) |
| `QuizBuilder` | `quiz-builder.tsx` | Admin: construtor visual de quizzes |
| `CourseBuilder` | `course-builder.tsx` | Admin: construtor de módulos e lições |
| `TrainingStatsOverview` | `training-stats-overview.tsx` | Dashboard KPIs e top cursos |
| `CertificateCard` | `certificate-card.tsx` | Card de certificado |
| `LearningPathCard` | `learning-path-card.tsx` | Card de percurso |
| `TrainingNotificationsDropdown` | `training-notifications-dropdown.tsx` | Dropdown notificações no header |

---

## 6. Hooks Customizados (8)

Todos em `hooks/`.

| Hook | Ficheiro | Descrição |
|------|---------|-----------|
| `useTrainingCourses` | `use-training-courses.ts` | Listagem de cursos com filtros, search, paginação e debounce |
| `useTrainingCourse` | `use-training-course.ts` | Detalhe de um curso com módulos/lições |
| `useTrainingEnrollment` | `use-training-enrollment.ts` | Inscrição/desinscrição em cursos |
| `useTrainingLesson` | `use-training-lesson.ts` | Tracking de progresso de lição (vídeo %, tempo) |
| `useTrainingQuiz` | `use-training-quiz.ts` | Perguntas, tentativas e submissão de quiz |
| `useTrainingStats` | `use-training-stats.ts` | Estatísticas gerais e por utilizador |
| `useTrainingNotifications` | `use-training-notifications.ts` | Listagem e mark as read |
| `useTrainingBookmarks` | `use-training-bookmarks.ts` | Listagem e toggle de favoritos |

---

## 7. Types e Validações

### Types (`types/training.ts`)

**Interfaces principais:**
- `TrainingCategory` — Categoria de formação
- `TrainingCourse` — Curso completo
- `TrainingModule` — Módulo de curso
- `TrainingLesson` — Lição individual
- `TrainingQuiz` — Quiz de avaliação
- `TrainingQuizQuestion` — Pergunta de quiz
- `TrainingQuizAttempt` — Tentativa de quiz
- `TrainingEnrollment` — Inscrição em curso
- `TrainingLessonProgress` — Progresso por lição
- `TrainingLearningPath` — Percurso de formação
- `TrainingPathEnrollment` — Inscrição em percurso
- `TrainingComment` — Comentário em lição
- `TrainingCertificate` — Certificado
- `TrainingNotification` — Notificação
- `TrainingOverviewStats` — Estatísticas globais
- `UserTrainingStats` — Estatísticas por utilizador

**Enums:**
- `CourseDifficulty`: `beginner`, `intermediate`, `advanced`
- `CourseStatus`: `draft`, `published`, `archived`
- `EnrollmentStatus`: `enrolled`, `in_progress`, `completed`, `dropped`
- `LessonContentType`: `video`, `pdf`, `text`, `external_link`
- `VideoProvider`: `youtube`, `vimeo`, `r2`, `other`
- `QuizQuestionType`: `single_choice`, `multiple_choice`, `true_false`
- `TrainingNotificationType`: `course_assigned`, `deadline_reminder`, `course_completed`, `quiz_passed`, `quiz_failed`, `new_course`, `certificate_issued`

### Validações Zod (`lib/validations/training.ts`)

Schemas para:
- Criação/edição de categoria
- Criação/edição de curso
- Criação/edição de módulo
- Criação/edição de lição
- Criação/edição de quiz com perguntas
- Submissão de tentativa de quiz
- Atribuição de curso a múltiplos utilizadores
- Criação de bookmark
- Criação de comentário
- Criação de certificado externo
- Criação/edição de percurso de formação

---

## 8. Integração no Sistema

### Sidebar
- **Label:** "Formações"
- **Ícone:** `GraduationCap` (lucide-react)
- **Grupo:** "Pessoas"
- **URL:** `/dashboard/formacoes`

### Permissões
- **Módulo:** `training`
- Registado em `ALL_PERMISSION_MODULES` (`lib/auth/roles.ts`)
- Registado em `MODULES` e `PERMISSION_MODULES` (`lib/constants.ts`)

---

## 9. Total de Indexes (52)

| Tabela | Indexes |
|--------|---------|
| `temp_training_bookmarks` | 4 (PK, user, unique user+course, unique user+lesson) |
| `temp_training_categories` | 2 (PK, slug unique) |
| `temp_training_certificates` | 4 (PK, user, course, certificate_code unique) |
| `temp_training_comments` | 3 (PK, lesson, user) |
| `temp_training_courses` | 5 (PK, slug unique, category, instructor, status) |
| `temp_training_enrollments` | 5 (PK, user, course, status, unique user+course) |
| `temp_training_learning_path_courses` | 3 (PK, learning_path, unique path+course) |
| `temp_training_learning_paths` | 2 (PK, slug unique) |
| `temp_training_lesson_progress` | 5 (PK, user, lesson, enrollment, unique user+lesson) |
| `temp_training_lessons` | 2 (PK, module) |
| `temp_training_modules` | 2 (PK, course) |
| `temp_training_notifications` | 3 (PK, user, user+is_read) |
| `temp_training_path_enrollments` | 3 (PK, user, unique user+path) |
| `temp_training_quiz_attempts` | 4 (PK, user, quiz, enrollment) |
| `temp_training_quiz_questions` | 2 (PK, quiz) |
| `temp_training_quizzes` | 3 (PK, module, course) |

---

## 10. O Que NÃO Existe

| Item | Estado |
|------|--------|
| RPCs / Stored Functions | Nenhuma |
| Edge Functions | Nenhuma |
| Triggers | Nenhum |
| RLS Policies | Nenhuma (acesso via service role) |
| CHECK Constraints | Nenhum adicional |
| Views | Nenhuma |
| Materialised Views | Nenhuma |

---

## 11. Ficheiros — Referência Rápida

```
src/
├── app/
│   ├── api/training/                          ← 32 endpoints (32 ficheiros route.ts)
│   │   ├── bookmarks/route.ts
│   │   ├── categories/route.ts
│   │   ├── categories/[id]/route.ts
│   │   ├── comments/[id]/route.ts
│   │   ├── comments/[id]/resolve/route.ts
│   │   ├── courses/route.ts
│   │   ├── courses/[id]/route.ts
│   │   ├── courses/[id]/assign/route.ts
│   │   ├── courses/[id]/enroll/route.ts
│   │   ├── courses/[id]/lessons/[lessonId]/comments/route.ts
│   │   ├── courses/[id]/lessons/[lessonId]/progress/route.ts
│   │   ├── courses/[id]/modules/route.ts
│   │   ├── courses/[id]/publish/route.ts
│   │   ├── learning-paths/route.ts
│   │   ├── learning-paths/[id]/route.ts
│   │   ├── learning-paths/[id]/enroll/route.ts
│   │   ├── lessons/[id]/route.ts
│   │   ├── modules/[id]/route.ts
│   │   ├── modules/[id]/lessons/route.ts
│   │   ├── my-certificates/route.ts
│   │   ├── my-courses/route.ts
│   │   ├── notifications/route.ts
│   │   ├── notifications/[id]/read/route.ts
│   │   ├── notifications/read-all/route.ts
│   │   ├── questions/[id]/route.ts
│   │   ├── quizzes/route.ts
│   │   ├── quizzes/[id]/route.ts
│   │   ├── quizzes/[id]/attempt/route.ts
│   │   ├── quizzes/[id]/attempts/route.ts
│   │   ├── quizzes/[id]/questions/route.ts
│   │   ├── stats/overview/route.ts
│   │   └── stats/users/[userId]/route.ts
│   └── dashboard/formacoes/                   ← 13 páginas
│       ├── page.tsx
│       ├── meus-cursos/page.tsx
│       ├── certificados/page.tsx
│       ├── cursos/[id]/page.tsx
│       ├── cursos/[id]/licoes/[lessonId]/page.tsx
│       ├── cursos/[id]/quiz/[quizId]/page.tsx
│       ├── percursos/page.tsx
│       ├── percursos/[id]/page.tsx
│       ├── estatisticas/page.tsx
│       ├── gestao/page.tsx
│       ├── gestao/novo/page.tsx
│       ├── gestao/[id]/editar/page.tsx
│       └── gestao/categorias/page.tsx
├── components/training/                       ← 20 componentes
│   ├── bookmark-button.tsx
│   ├── certificate-card.tsx
│   ├── course-builder.tsx
│   ├── course-card.tsx
│   ├── course-curriculum.tsx
│   ├── course-detail-header.tsx
│   ├── course-progress-bar.tsx
│   ├── difficulty-badge.tsx
│   ├── learning-path-card.tsx
│   ├── lesson-comments.tsx
│   ├── lesson-pdf-viewer.tsx
│   ├── lesson-player.tsx
│   ├── lesson-sidebar.tsx
│   ├── lesson-text-content.tsx
│   ├── quiz-builder.tsx
│   ├── quiz-player.tsx
│   ├── quiz-results.tsx
│   ├── training-filters.tsx
│   ├── training-notifications-dropdown.tsx
│   └── training-stats-overview.tsx
├── hooks/                                     ← 8 hooks
│   ├── use-training-bookmarks.ts
│   ├── use-training-course.ts
│   ├── use-training-courses.ts
│   ├── use-training-enrollment.ts
│   ├── use-training-lesson.ts
│   ├── use-training-notifications.ts
│   ├── use-training-quiz.ts
│   └── use-training-stats.ts
├── types/training.ts                          ← ~20 interfaces + enums
├── lib/validations/training.ts                ← ~12 schemas Zod
└── docs/M18-FORMACOES/
    ├── SPEC-M18-FORMACOES.md
    └── INVENTARIO-FORMACOES.md                ← este ficheiro
```
