# SPEC — Renomear tabelas `temp_` para `forma_` (Módulo Formações)

**Data:** 2026-03-19
**Objectivo:** Substituir o prefixo `temp_` por `forma_` em todas as tabelas e views do módulo de formações, e actualizar todas as referências no código.

---

## 1. Mapeamento de Tabelas (temp_ → forma_)

| Tabela Actual | Nova Tabela |
|---|---|
| `temp_training_courses` | `forma_training_courses` |
| `temp_training_categories` | `forma_training_categories` |
| `temp_training_modules` | `forma_training_modules` |
| `temp_training_lessons` | `forma_training_lessons` |
| `temp_training_quizzes` | `forma_training_quizzes` |
| `temp_training_quiz_questions` | `forma_training_quiz_questions` |
| `temp_training_quiz_attempts` | `forma_training_quiz_attempts` |
| `temp_training_enrollments` | `forma_training_enrollments` |
| `temp_training_lesson_progress` | `forma_training_lesson_progress` |
| `temp_training_lesson_materials` | `forma_training_lesson_materials` |
| `temp_training_lesson_ratings` | `forma_training_lesson_ratings` |
| `temp_training_lesson_reports` | `forma_training_lesson_reports` |
| `temp_training_comments` | `forma_training_comments` |
| `temp_training_certificates` | `forma_training_certificates` |
| `temp_training_bookmarks` | `forma_training_bookmarks` |
| `temp_training_learning_paths` | `forma_training_learning_paths` |
| `temp_training_learning_path_courses` | `forma_training_learning_path_courses` |
| `temp_training_path_enrollments` | `forma_training_path_enrollments` |
| `temp_training_material_downloads` | `forma_training_material_downloads` |
| `temp_training_notifications` | `forma_training_notifications` |

### Views (sem prefixo temp_ mas dependem das tabelas acima)

| View Actual | Nova View |
|---|---|
| `training_course_completion_stats` | `forma_course_completion_stats` |
| `training_material_download_stats` | `forma_material_download_stats` |
| `training_user_completion_stats` | `forma_user_completion_stats` |

**Total: 20 tabelas + 3 views = 23 objectos de BD a renomear**

---

## 2. Migração SQL (Supabase)

A migração deve ser executada numa única transacção. Ordem: DROP views → RENAME tabelas → RECREATE views.

```sql
-- ============================================================
-- MIGRAÇÃO: Renomear temp_ → forma_ (Módulo Formações)
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- PASSO 1: Dropar views que dependem das tabelas temp_
-- -------------------------------------------------------
DROP VIEW IF EXISTS training_course_completion_stats CASCADE;
DROP VIEW IF EXISTS training_material_download_stats CASCADE;
DROP VIEW IF EXISTS training_user_completion_stats CASCADE;

-- -------------------------------------------------------
-- PASSO 2: Renomear todas as tabelas temp_ → forma_
-- -------------------------------------------------------
ALTER TABLE temp_training_courses RENAME TO forma_training_courses;
ALTER TABLE temp_training_categories RENAME TO forma_training_categories;
ALTER TABLE temp_training_modules RENAME TO forma_training_modules;
ALTER TABLE temp_training_lessons RENAME TO forma_training_lessons;
ALTER TABLE temp_training_quizzes RENAME TO forma_training_quizzes;
ALTER TABLE temp_training_quiz_questions RENAME TO forma_training_quiz_questions;
ALTER TABLE temp_training_quiz_attempts RENAME TO forma_training_quiz_attempts;
ALTER TABLE temp_training_enrollments RENAME TO forma_training_enrollments;
ALTER TABLE temp_training_lesson_progress RENAME TO forma_training_lesson_progress;
ALTER TABLE temp_training_lesson_materials RENAME TO forma_training_lesson_materials;
ALTER TABLE temp_training_lesson_ratings RENAME TO forma_training_lesson_ratings;
ALTER TABLE temp_training_lesson_reports RENAME TO forma_training_lesson_reports;
ALTER TABLE temp_training_comments RENAME TO forma_training_comments;
ALTER TABLE temp_training_certificates RENAME TO forma_training_certificates;
ALTER TABLE temp_training_bookmarks RENAME TO forma_training_bookmarks;
ALTER TABLE temp_training_learning_paths RENAME TO forma_training_learning_paths;
ALTER TABLE temp_training_learning_path_courses RENAME TO forma_training_learning_path_courses;
ALTER TABLE temp_training_path_enrollments RENAME TO forma_training_path_enrollments;
ALTER TABLE temp_training_material_downloads RENAME TO forma_training_material_downloads;
ALTER TABLE temp_training_notifications RENAME TO forma_training_notifications;

-- -------------------------------------------------------
-- PASSO 3: Recrear views com novos nomes de tabela
-- (NOTA: Verificar o SQL original das views no Supabase
--  e substituir temp_ por forma_ antes de executar)
-- -------------------------------------------------------

-- TODO: Copiar definição das 3 views do Supabase,
-- substituir temp_ por forma_ nos nomes de tabela,
-- e renomear as views para forma_*

-- Exemplo (ajustar conforme SQL real):
-- CREATE VIEW forma_course_completion_stats AS
--   SELECT ... FROM forma_training_courses ...;
--
-- CREATE VIEW forma_material_download_stats AS
--   SELECT ... FROM forma_training_material_downloads ...;
--
-- CREATE VIEW forma_user_completion_stats AS
--   SELECT ... FROM forma_training_enrollments ...;

COMMIT;
```

> **IMPORTANTE:** Antes de executar, obter o SQL das 3 views com:
> ```sql
> SELECT pg_get_viewdef('training_course_completion_stats', true);
> SELECT pg_get_viewdef('training_material_download_stats', true);
> SELECT pg_get_viewdef('training_user_completion_stats', true);
> ```

---

## 3. Ficheiros a Alterar no Backend (API Routes)

**164 ocorrências de `temp_training` em 46 ficheiros.**

Alteração: find-and-replace `temp_training_` → `forma_training_` em cada ficheiro.

### Cursos (Core)

| # | Ficheiro | Ocorrências |
|---|---|---|
| 1 | `app/api/training/courses/route.ts` | 4 |
| 2 | `app/api/training/courses/[id]/route.ts` | 10 |
| 3 | `app/api/training/courses/[id]/enroll/route.ts` | 4 |
| 4 | `app/api/training/courses/[id]/publish/route.ts` | 3 |
| 5 | `app/api/training/courses/[id]/modules/route.ts` | 2 |
| 6 | `app/api/training/courses/[id]/assign/route.ts` | 4 |
| 7 | `app/api/training/courses/[id]/upload-cover/route.ts` | 2 |
| 8 | `app/api/training/courses/[id]/lessons/[lessonId]/progress/route.ts` | 11 |
| 9 | `app/api/training/courses/[id]/lessons/[lessonId]/comments/route.ts` | 2 |

### Módulos & Lições

| # | Ficheiro | Ocorrências |
|---|---|---|
| 10 | `app/api/training/modules/[id]/route.ts` | 2 |
| 11 | `app/api/training/modules/[id]/lessons/route.ts` | 3 |
| 12 | `app/api/training/lessons/[id]/route.ts` | 3 |
| 13 | `app/api/training/lessons/[id]/upload-video/route.ts` | 2 |
| 14 | `app/api/training/lessons/[id]/upload-pdf/route.ts` | 2 |
| 15 | `app/api/training/lessons/[id]/materials/route.ts` | 4 |
| 16 | `app/api/training/lessons/[id]/materials/[materialId]/route.ts` | 2 |
| 17 | `app/api/training/lessons/[id]/rate/route.ts` | 3 |
| 18 | `app/api/training/lessons/[id]/report/route.ts` | 2 |

### Quizzes

| # | Ficheiro | Ocorrências |
|---|---|---|
| 19 | `app/api/training/quizzes/route.ts` | 3 |
| 20 | `app/api/training/quizzes/[id]/route.ts` | 2 |
| 21 | `app/api/training/quizzes/[id]/questions/route.ts` | 4 |
| 22 | `app/api/training/quizzes/[id]/attempts/route.ts` | 1 |
| 23 | `app/api/training/quizzes/[id]/attempt/route.ts` | 6 |
| 24 | `app/api/training/questions/[id]/route.ts` | 2 |

### Learning Paths

| # | Ficheiro | Ocorrências |
|---|---|---|
| 25 | `app/api/training/learning-paths/route.ts` | 4 |
| 26 | `app/api/training/learning-paths/[id]/route.ts` | 9 |
| 27 | `app/api/training/learning-paths/[id]/enroll/route.ts` | 6 |

### Categorias

| # | Ficheiro | Ocorrências |
|---|---|---|
| 28 | `app/api/training/categories/route.ts` | 4 |
| 29 | `app/api/training/categories/[id]/route.ts` | 2 |

### Comentários

| # | Ficheiro | Ocorrências |
|---|---|---|
| 30 | `app/api/training/comments/[id]/route.ts` | 4 |
| 31 | `app/api/training/comments/[id]/resolve/route.ts` | 2 |

### Bookmarks & Notificações

| # | Ficheiro | Ocorrências |
|---|---|---|
| 32 | `app/api/training/bookmarks/route.ts` | 6 |
| 33 | `app/api/training/notifications/route.ts` | 2 |
| 34 | `app/api/training/notifications/[id]/read/route.ts` | 1 |
| 35 | `app/api/training/notifications/read-all/route.ts` | 1 |

### Cursos do Utilizador & Certificados

| # | Ficheiro | Ocorrências |
|---|---|---|
| 36 | `app/api/training/my-courses/route.ts` | 4 |
| 37 | `app/api/training/my-certificates/route.ts` | 2 |

### Materiais

| # | Ficheiro | Ocorrências |
|---|---|---|
| 38 | `app/api/training/materials/[id]/download/route.ts` | 2 |

### Estatísticas & Admin

| # | Ficheiro | Ocorrências |
|---|---|---|
| 39 | `app/api/training/stats/overview/route.ts` | 9 |
| 40 | `app/api/training/stats/users/[userId]/route.ts` | 4 |
| 41 | `app/api/training/admin/stats/route.ts` | 4 |
| 42 | `app/api/training/admin/users/[id]/route.ts` | 4 |
| 43 | `app/api/training/admin/reports/route.ts` | 4 |
| 44 | `app/api/training/admin/reports/[id]/route.ts` | 1 |
| 45 | `app/api/training/admin/comments/route.ts` | 5 |
| 46 | `app/api/training/admin/downloads/route.ts` | 1 |

### Admin — Views (referências SEM prefixo temp_)

| # | Ficheiro | View Referenciada | Nova Referência |
|---|---|---|---|
| 41 | `app/api/training/admin/stats/route.ts` | `training_course_completion_stats` | `forma_course_completion_stats` |
| 43 | `app/api/training/admin/users/route.ts` | `training_user_completion_stats` | `forma_user_completion_stats` |
| 46 | `app/api/training/admin/downloads/route.ts` | `training_material_download_stats` | `forma_material_download_stats` |

---

## 4. Ficheiro de Types (Auto-gerado)

| # | Ficheiro | Acção |
|---|---|---|
| 47 | `types/database.ts` | **Regenerar** com `npx supabase gen types typescript` APÓS migração |

> Este ficheiro é auto-gerado. Não editar manualmente — regenerar após a migração SQL.

---

## 5. Ficheiros que NÃO Precisam de Alteração

Os seguintes ficheiros **NÃO** referenciam nomes de tabelas directamente (usam a API como abstracção):

- `types/training.ts` — tipos manuais, sem referências a tabelas
- `lib/validations/training.ts` — schemas Zod, sem referências a tabelas
- `lib/r2/training.ts` — storage R2, sem referências a tabelas
- `lib/constants.ts` — constantes PT-PT, sem referências a tabelas
- `hooks/use-training-*.ts` — todos os hooks fazem fetch via API
- `components/training/**` — todos os componentes usam hooks/API
- `app/dashboard/formacoes/**` — todas as páginas usam hooks/API

---

## 6. Plano de Execução (Ordem)

### Passo 1 — Migração SQL no Supabase
1. Obter definição das 3 views (SQL acima)
2. Executar migração numa transacção (DROP views → RENAME tabelas → CREATE views)
3. Verificar que todas as tabelas foram renomeadas: `SELECT tablename FROM pg_tables WHERE tablename LIKE 'forma_%';`
4. Verificar que as views existem: `SELECT viewname FROM pg_views WHERE viewname LIKE 'forma_%';`

### Passo 2 — Actualizar API Routes (46 ficheiros)
1. Find-and-replace global: `temp_training_` → `forma_training_`
2. Find-and-replace nas views:
   - `training_course_completion_stats` → `forma_course_completion_stats`
   - `training_material_download_stats` → `forma_material_download_stats`
   - `training_user_completion_stats` → `forma_user_completion_stats`

### Passo 3 — Regenerar Types
```bash
npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts
```

### Passo 4 — Verificar Build
```bash
npm run build
```

### Passo 5 — Testar
- Listar cursos
- Detalhe de curso
- Inscrição
- Progresso de lição
- Quizzes
- Painel admin (stats, reports, comments, downloads)

---

## 7. Resumo de Impacto

| Área | Ficheiros | Acção |
|---|---|---|
| Base de Dados | 20 tabelas + 3 views | Migração SQL (RENAME + RECREATE views) |
| API Routes | 46 ficheiros | Replace `temp_training_` → `forma_training_` |
| API Routes (views) | 3 ficheiros | Replace nomes de views |
| Types (auto-gerado) | 1 ficheiro | Regenerar após migração |
| **Frontend (hooks, components, pages)** | **0 ficheiros** | **Nenhuma alteração necessária** |
| **Total** | **47 ficheiros + migração SQL** | |

---

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Views com SQL complexo | Obter definição antes de dropar |
| RLS policies referenciando nomes antigos | Verificar com `SELECT * FROM pg_policies WHERE tablename LIKE 'temp_training_%'` e actualizar |
| Triggers referenciando nomes antigos | Verificar com `SELECT * FROM pg_trigger WHERE tgrelid::regclass::text LIKE 'temp_%'` |
| Foreign keys | O `ALTER TABLE RENAME` preserva automaticamente as FK constraints |
| Indexes | O `RENAME` preserva indexes, mas os nomes dos indexes mantêm `temp_` — considerar renomear se necessário |
