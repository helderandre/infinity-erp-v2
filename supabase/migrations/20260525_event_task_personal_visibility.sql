-- Add is_private flag to ad-hoc tasks and calendar events.
--
-- UI label: "Pessoal" (vs "Profissional"). When true, the row is redacted
-- from leadership users viewing another consultor's data:
--   - tasks: shown as "Tarefa pessoal" muted card with no title/description
--   - calendar_events: shown as "Ocupado" with no title/description/location/attendees
--
-- Default false (= Profissional) backfills all existing rows automatically
-- via the column default.
--
-- Process tasks (proc_tasks) are inherently profissional and not affected.
--
-- Servidor (lib/auth/roles.ts):
--   LEADERSHIP_ROLES = ['admin', 'Broker/CEO', 'Office Manager', 'Team Leader']
--   Estes papéis podem entrar na página doutro consultor para ver tarefas/eventos;
--   eventos pessoais são redacted como "Ocupado", tarefas pessoais como
--   "Tarefa pessoal" (muito esbatidas, opacity-40, ao fundo da lista).
--
-- Aplicado: 2026-05-25 via MCP supabase apply_migration.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasks.is_private IS
  'When true, task is hidden in detail from leadership viewing another user. UI label: "Pessoal".';

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.calendar_events.is_private IS
  'When true, event is shown as "Ocupado" to leadership viewing another user. UI label: "Pessoal".';

-- Revert:
-- ALTER TABLE public.tasks DROP COLUMN is_private;
-- ALTER TABLE public.calendar_events DROP COLUMN is_private;
