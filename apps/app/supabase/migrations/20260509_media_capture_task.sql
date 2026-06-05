-- ─────────────────────────────────────────────────────────────────────────
-- 20260509_media_capture_task
--
-- 1) Adiciona uma coluna `category` à tabela `tasks` (ad-hoc) para
--    discriminar tarefas especiais (rendering custom na to-do list). A
--    primeira utilização é `category='media_capture'` — tarefa criada pela
--    gestão na primeira stage de uma angariação para o consultor recolher
--    fotos, vídeos, plantas e escrever a descrição com IA do imóvel.
--
-- 2) Adiciona em `dev_property_internal` o carimbo da conclusão da tarefa
--    Media. A página do imóvel mostra a data; quando a coluna estiver null
--    o tile fica vazio. `media_completed_by` aponta para o consultor que
--    fechou a tarefa (auditoria simples).
--
-- Aditiva, NULL-safe, sem backfill destrutivo.
--
-- Revert:
--   ALTER TABLE public.dev_property_internal
--     DROP COLUMN IF EXISTS media_completed_at,
--     DROP COLUMN IF EXISTS media_completed_by;
--   DROP INDEX IF EXISTS public.idx_tasks_category;
--   ALTER TABLE public.tasks DROP COLUMN IF EXISTS category;
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category text;

-- Index parcial — só interessa quando há discriminador. Cobre lookups
-- por category='media_capture' usados pelo /api/processes/[id]/media-task.
CREATE INDEX IF NOT EXISTS idx_tasks_category
  ON public.tasks (category, entity_id)
  WHERE category IS NOT NULL;

ALTER TABLE public.dev_property_internal
  ADD COLUMN IF NOT EXISTS media_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_completed_by uuid REFERENCES public.dev_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.category IS
  'Discriminador opcional para tarefas especiais com UI custom (ex.: ''media_capture''). NULL = tarefa genérica.';
COMMENT ON COLUMN public.dev_property_internal.media_completed_at IS
  'Carimbo de quando a tarefa Media (fotos/vídeos/plantas/descrição) foi concluída pelo consultor.';
COMMENT ON COLUMN public.dev_property_internal.media_completed_by IS
  'Consultor que fechou a tarefa Media. NULL até estar concluída.';
