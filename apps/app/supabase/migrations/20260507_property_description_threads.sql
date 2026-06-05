-- ─────────────────────────────────────────────────────────────────────────
-- 20260507_property_description_threads
--
-- Editor canvas (chat + documento) para a descrição dos imóveis.
--
--  - property_description_threads: 1 thread por (imóvel, idioma).
--    is_auto_generated=true quando a thread foi populada por tradução
--    automática no /finalize. Qualquer edição manual posterior flippa para
--    false e o auto-translate não a sobrescreve.
--  - property_description_messages: histórico da conversa.
--    document_snapshot guarda o estado do documento depois desta mensagem
--    (NULL para mensagens só conversacionais como ask_clarification).
--    selection_text é o trecho que o utilizador enviou como contexto.
--  - dev_properties.description_per_language: cache do estado actual por
--    idioma para leitura rápida pelos portais. PT continua espelhado em
--    description (compat).
--
-- Aditiva, NULL-safe, sem backfill destrutivo. RLS via permissão `properties`
-- enforced no app layer (mesmo padrão dos restantes endpoints).
--
-- Revert:
--   DROP TABLE IF EXISTS public.property_description_messages;
--   DROP TABLE IF EXISTS public.property_description_threads;
--   ALTER TABLE public.dev_properties DROP COLUMN IF EXISTS description_per_language;
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_description_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.dev_properties(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'pt'
    CHECK (language IN ('pt', 'en', 'fr', 'es')),
  is_auto_generated boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, language)
);

CREATE INDEX IF NOT EXISTS idx_pdt_property_lang
  ON public.property_description_threads(property_id, language);

CREATE TABLE IF NOT EXISTS public.property_description_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.property_description_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  document_snapshot text,
  selection_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdm_thread_created
  ON public.property_description_messages(thread_id, created_at);

ALTER TABLE public.dev_properties
  ADD COLUMN IF NOT EXISTS description_per_language jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON TABLE public.property_description_threads IS
  'Threads do editor canvas (chat + documento). 1 por (imóvel, idioma).';
COMMENT ON COLUMN public.property_description_threads.is_auto_generated IS
  'True se a thread foi populada por tradução automática (/finalize). Qualquer edição manual flippa para false.';
COMMENT ON COLUMN public.property_description_messages.document_snapshot IS
  'Estado do documento depois desta mensagem. NULL para mensagens só conversacionais.';
COMMENT ON COLUMN public.property_description_messages.selection_text IS
  'Trecho do documento que o utilizador enviou como contexto desta mensagem.';
COMMENT ON COLUMN public.dev_properties.description_per_language IS
  'Cache: { pt: text, en: text, fr: text, es: text }. PT continua espelhado em description.';

-- Trigger para manter updated_at
CREATE OR REPLACE FUNCTION public.tg_pdt_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_pdt_touch_updated_at ON public.property_description_threads;
CREATE TRIGGER tg_pdt_touch_updated_at
  BEFORE UPDATE ON public.property_description_threads
  FOR EACH ROW EXECUTE FUNCTION public.tg_pdt_touch_updated_at();

-- RLS — permissiva para authenticated; autorização real no app layer
-- (mesmo padrão das restantes tabelas property_*)
ALTER TABLE public.property_description_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_description_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdt_authenticated_all ON public.property_description_threads;
CREATE POLICY pdt_authenticated_all ON public.property_description_threads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pdm_authenticated_all ON public.property_description_messages;
CREATE POLICY pdm_authenticated_all ON public.property_description_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
