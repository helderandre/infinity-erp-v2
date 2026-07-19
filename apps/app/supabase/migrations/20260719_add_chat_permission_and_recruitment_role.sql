-- ============================================================================
-- Nova permissão `chat` (Chat Interno) + role lean "Recrutamento"
-- ============================================================================
--
-- Contexto: o "Chat Interno" no sidebar estava gated pela permissão `dashboard`,
-- partilhada com WhatsApp, Email, Dashboard (home) e Tarefas. Isso impedia
-- criar um role que visse SÓ o Chat Interno sem também revelar WhatsApp/Email.
--
-- Mudança de código (já feita, precisa de deploy):
--   - `ALL_PERMISSION_MODULES` (lib/auth/roles.ts) ganha 'chat'.
--   - `PERMISSION_MODULES` (lib/constants.ts) ganha { key:'chat', label:'Chat Interno' }
--     -> aparece como checkbox no construtor de roles (Definições → Roles).
--   - Item "Chat Interno" (comunicacaoItems, app-sidebar.tsx) passa de
--     permission:'dashboard' para permission:'chat'. Propaga a desktop +
--     mobile-nav-launcher + mobile-bottom-nav (todos importam comunicacaoItems).
--
-- ⚠️ REGRESSÃO A EVITAR: como o Chat Interno deixou de depender de `dashboard`,
--    qualquer role que tinha `dashboard=true` mas não `chat` deixaria de ver o
--    Chat Interno. O passo 1 faz backfill para preservar o acesso actual.
--
-- ⚠️ ORDEM DE DEPLOY: aplicar esta migration ANTES ou EM CONJUNTO com o deploy
--    do código. Aplicá-la antes é seguro — o código antigo ignora a chave `chat`.
--
-- Idempotente. DML apenas (tabela `roles`); sem DDL.
-- ============================================================================

BEGIN;

-- 1. Backfill: quem via o Chat Interno via `dashboard` continua a vê-lo.
UPDATE public.roles
SET permissions = permissions || '{"chat": true}'::jsonb
WHERE COALESCE((permissions->>'dashboard')::boolean, false) = true
  AND COALESCE((permissions->>'chat')::boolean, false) = false;

-- 2. Role lean "Recrutamento": SÓ recrutamento + chat interno.
--    (A página Equipa/Consultores é visível a qualquer utilizador autenticado,
--     por isso não precisa de permissão. WhatsApp/Email/Dashboard/Tarefas ficam
--     escondidos porque este role NÃO tem `dashboard`.)
INSERT INTO public.roles (name, description, permissions)
VALUES (
  'Recrutamento',
  'Acesso ao módulo de Recrutamento, Chat Interno e Equipa (sem WhatsApp/Email/Dashboard).',
  '{"recruitment": true, "chat": true}'::jsonb
)
ON CONFLICT (name) DO UPDATE
  SET permissions = EXCLUDED.permissions,
      description = EXCLUDED.description;

COMMIT;

-- ============================================================================
-- REVERT:
--   BEGIN;
--   DELETE FROM public.roles WHERE name = 'Recrutamento';
--   -- (opcional) remover a chave chat dos roles backfillados:
--   UPDATE public.roles SET permissions = permissions - 'chat';
--   COMMIT;
--   -- e reverter os 3 ficheiros de código (Chat Interno volta a permission:'dashboard').
-- ============================================================================
