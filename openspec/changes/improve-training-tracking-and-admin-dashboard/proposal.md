## Why

O módulo de Formações já tem CRUD de cursos, inscrição, reprodução de lições e estatísticas básicas, mas três lacunas importantes prejudicam a experiência:

1. **Criar um curso é lento** — o formulário `/dashboard/formacoes/gestao/novo` obriga o broker a digitar título, resumo, descrição, dificuldade, nota mínima, etc. Já existe infra de transcrição Whisper reutilizável (ver `/api/transcribe` e `components/negocios/quick-fill.tsx`), mas não está aplicada aqui.
2. **O "concluir" não reflecte quem viu mesmo o vídeo** — o botão "Marcar como concluída" em [lesson-rating.tsx](components/training/lesson-rating.tsx) chama `markCompleted()` sem validar o tempo real assistido. O [LessonPlayer](components/training/lesson-player.tsx) já regista `time_spent_seconds` e `video_watch_percent` no servidor (auto-complete ≥90%), mas o botão manual contorna esse gate. Como consequência, `forma_course_completion_stats` reporta concluídos que nunca assistiram ao vídeo.
3. **Criadores do curso (broker/admin) não têm dashboard accionável por curso** — existe [GET /api/training/admin/stats](app/api/training/admin/stats/route.ts) com agregados globais e [GET /api/training/admin/users/[id]](app/api/training/admin/users/[id]/route.ts) com detalhe por utilizador, mas **não há vista "actividade completa dos matriculados neste curso"** (lição a lição, tempo real assistido, quando viu, se passou no quiz, se fez download de materiais). Hoje o broker tem de fazer drill-down user-por-user.

## What Changes

### 1. Ditado por voz no formulário de nova formação
- Adicionar botão "Ditar" (microfone) a `app/dashboard/formacoes/gestao/novo/page.tsx` e a `[id]/editar/page.tsx` que grava áudio, envia para novo endpoint `POST /api/training/courses/fill-from-voice` (Whisper + GPT-4o-mini) e preenche os campos estruturados (`title`, `summary`, `description`, `difficulty_level`, `instructor_name`, `estimated_duration_minutes`, `is_mandatory`, `has_certificate`, `passing_score`, `tags[]`).
- Reutilizar `/api/transcribe` para a camada Whisper; a extracção estruturada vive no novo endpoint.
- Permitir também ditar apenas um campo individual (pill "microfone" inline ao lado de cada input), não apenas o formulário inteiro.

### 2. Tracking efectivo de tempo assistido (e gate no "concluir")
- **BREAKING (UX)**: o botão "Marcar como concluída" deixa de aprovar cegamente vídeos. Para lições `content_type='video'`:
  - Se `video_watch_percent < 90` → botão desactivado com tooltip "Assista a pelo menos 90% do vídeo para concluir" (threshold já vigente no auto-complete).
  - Admin/broker com permissão `training` mantém o botão activo (override manual com auditoria).
- Melhorar [PUT /api/training/courses/[id]/lessons/[lessonId]/progress](app/api/training/courses/[id]/lessons/[lessonId]/progress/route.ts):
  - Rejeitar `status='completed'` enviado pelo cliente quando `video_watch_percent < 90` e utilizador não tem permissão `training` (retorna 403 com mensagem clara; fica em `in_progress`).
  - Gravar `completion_source` em `forma_training_lesson_progress` (`auto_watch | manual | admin_override`) para auditoria.
  - Gravar `last_video_position_seconds` (para retomar de onde parou — já existe `video_watched_seconds` mas é o máximo cumulativo, não a posição actual).
- Novo contador `heartbeat`: player manda `POST /api/training/courses/[id]/lessons/[lessonId]/heartbeat` a cada 10s enquanto vídeo está a reproduzir (já há `time_spent_seconds` mas é calculado client-side e fácil de falsificar). Heartbeats agregam em `time_spent_seconds` server-side com rate-limit simples (rejeita >15s de delta entre heartbeats consecutivos).

### 3. Dashboard de actividade por curso
- Nova página `app/dashboard/formacoes/gestao/[id]/actividade/page.tsx` (apenas permissão `training`) com tabs:
  - **Resumo**: total matriculados, % média de conclusão do curso, tempo médio assistido, nº de certificados emitidos, nº de reports abertos.
  - **Matriculados**: tabela com coluna por utilizador — `enrolled_at`, `progress_percent`, `lessons_completed/total`, `time_spent` (soma), `last_activity_at`, `status`. Ordenável + filtros (status, progresso). Click expande drill-down por lição.
  - **Lições**: tabela por lição — `total_viewed`, `avg_watch_percent`, `avg_time_spent`, `completed_count`, `reports_count`. Permite detectar lições com baixo engagement.
  - **Quizzes**: tabela por quiz — `attempts_count`, `pass_rate`, `avg_score`.
- Novo endpoint `GET /api/training/admin/courses/[id]/activity` agrega tudo acima num payload único (cacheável 60s).
- Novo endpoint `GET /api/training/admin/courses/[id]/enrollments` paginado (devolve drill-down por aluno com lições incluídas, semelhante ao que existe em `/api/training/admin/users/[id]` mas invertido — scoped ao curso).

## Capabilities

### New Capabilities
- `training-voice-form-fill`: ditado por voz para preencher/editar formulários de curso (endpoint dedicado Whisper+GPT estruturado + UI reutilizável).
- `training-watch-tracking`: gating server-side do "concluído", heartbeats de tempo assistido, `completion_source` auditável e retomar de posição.
- `training-admin-course-dashboard`: vista de actividade por curso para criadores — matriculados, lições, quizzes — com agregados e drill-down.

### Modified Capabilities
<!-- Nenhum spec de training existe ainda em openspec/specs/. As três capabilities acima são novas. -->

## Impact

- **Frontend**:
  - `app/dashboard/formacoes/gestao/novo/page.tsx`, `gestao/[id]/editar/page.tsx` — botão ditar + microfones inline.
  - `components/training/lesson-player.tsx`, `components/training/youtube-custom-player.tsx` — heartbeat + guardar `last_video_position_seconds`.
  - `components/training/lesson-rating.tsx` — disable do botão "Marcar como concluída" por permissão e percentagem.
  - Nova árvore `app/dashboard/formacoes/gestao/[id]/actividade/` + componentes em `components/training/admin/*`.
  - Novo componente reutilizável `<VoiceInputButton>` em `components/training/voice-input-button.tsx`.

- **Backend**:
  - Novo `POST /api/training/courses/fill-from-voice` (multipart áudio → JSON estruturado).
  - Novo `POST /api/training/courses/[id]/lessons/[lessonId]/heartbeat`.
  - Novo `GET /api/training/admin/courses/[id]/activity` e `/enrollments`.
  - Alterado `PUT /api/training/courses/[id]/lessons/[lessonId]/progress` (gate do `completed`).

- **Base de dados** (migração nova):
  - `forma_training_lesson_progress`: adicionar `completion_source TEXT` (enum check: `auto_watch|manual|admin_override|quiz_pass`), `last_video_position_seconds INT DEFAULT 0`.
  - Nova view materializada (ou view) `forma_course_activity_stats` scoped a `(course_id, lesson_id)` com agregados.
  - Índice em `forma_training_lesson_progress(lesson_id)` para agregações.
  - `log_audit` recebe linhas `entity_type='training_completion_override'` quando admin força conclusão.

- **Dependências**: nenhuma nova — já usamos OpenAI SDK, shadcn/ui, Supabase.

- **Segurança**: endpoint `fill-from-voice` exige `training` ou ser broker/admin; endpoints admin mantêm `requirePermission('training')`; heartbeat exige enrollment válido do próprio utilizador.

- **Out of scope** (explicitamente fora): gravação de sessões de vídeo, anti-cheat avançado (tab visibility API), transcrição automática de lições, detecção de "ver em 2x", inscrição em lote. Ficam para changes futuros.
