-- Adiciona coluna `page` (slug da página onde o feedback foi submetido)
-- a `feedback_submissions`. O endpoint /api/feedback POST e o filtro
-- GET por `?page=` já assumiam esta coluna; faltava só a migration.
--
-- Nullable porque rows pré-feature não têm essa info; novos inserts
-- têm o slug populado pelo client (ver FEEDBACK_PAGES em types/feedback.ts).
--
-- Revert:
--   DROP INDEX IF EXISTS public.idx_feedback_submissions_page;
--   ALTER TABLE public.feedback_submissions DROP COLUMN IF EXISTS page;

ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS page TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_page
  ON public.feedback_submissions(page)
  WHERE page IS NOT NULL;
