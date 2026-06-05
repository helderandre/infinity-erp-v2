-- ─────────────────────────────────────────────────────────────────────────
-- 20260510_chat_message_metadata
--
-- Adiciona uma coluna `metadata jsonb` a `internal_chat_messages` para
-- permitir mensagens com render custom no chat panel (cards estruturados).
-- A primeira utilização é `metadata.kind = 'property_announcement'` —
-- mensagens disparadas pelo botão "Anunciar no Geral" no header da
-- 3ª stage de uma angariação. O painel detecta a kind e renderiza um
-- card no estilo da pré-visualização (foto + badge consultor + chips).
--
-- Mensagens antigas mantêm metadata=`'{}'::jsonb` e continuam a render
-- como bubble de texto normal (sem regressão).
--
-- Aditiva, NULL-safe.
--
-- Revert:
--   ALTER TABLE public.internal_chat_messages DROP COLUMN IF EXISTS metadata;
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.internal_chat_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.internal_chat_messages.metadata IS
  'Payload estruturado para mensagens com render custom (ex.: ''property_announcement''). Vazio (`{}`) = mensagem texto normal.';
