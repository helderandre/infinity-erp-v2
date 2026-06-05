-- Camada de overrides granulares por utilizador, aplicada DEPOIS do merge dos
-- roles. Permite "grant" (somar permissão) ou "deny" (subtrair) face às
-- permissões derivadas dos roles. Pensada para casos pontuais — a maioria das
-- alterações deve continuar a passar por roles.
--
-- Estrutura propositadamente minimal:
--  * `mode` é binário (grant/deny) — sem níveis intermédios.
--  * `expires_at` opcional para forçar revisões periódicas.
--  * UNIQUE(user_id, module) — uma só decisão por par; novo write substitui.
--  * `created_by` para audit; `reason` opcional para contexto.

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('grant', 'deny')),
  expires_at TIMESTAMPTZ,
  reason TEXT,
  created_by UUID REFERENCES public.dev_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_overrides_unique UNIQUE (user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user
  ON public.user_permission_overrides(user_id);

CREATE OR REPLACE FUNCTION public.user_permission_overrides_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_permission_overrides_touch ON public.user_permission_overrides;
CREATE TRIGGER trg_user_permission_overrides_touch
  BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.user_permission_overrides_touch();

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_permission_overrides_self_read ON public.user_permission_overrides
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_permission_overrides IS
  'Overrides granulares por utilizador aplicados depois do merge de roles. mode=grant adiciona, mode=deny remove. Aplicado em lib/auth/permissions.ts.';
