-- ─────────────────────────────────────────────────────────────────────────
-- Comentários no detalhe de feedback (tech pipeline)
--
-- O detail sheet do tech pipeline ganha uma secção de comentários onde a
-- equipa técnica pode deixar observações e, opcionalmente, despachar essa
-- nota via chat interno (DM) ao submetente original ou a um colega para
-- reencaminhamento. O comentário fica sempre persistido aqui (independente
-- do envio por chat) — o booleano `sent_to_chat` regista se foi também
-- enviado, e `chat_recipient_id` quem foi o destinatário.
--
-- RLS deliberadamente permissiva (qualquer authenticated lê) — o pipeline
-- já é um espaço fechado a quem tem acesso à página /dashboard/tech.
-- Insert restringido ao próprio author_id.
--
-- Revert:
--   DROP TABLE IF EXISTS public.feedback_comments;
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback_submissions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.dev_users(id) ON DELETE RESTRICT,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  sent_to_chat boolean NOT NULL DEFAULT false,
  chat_recipient_id uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  sent_to_chat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback
  ON public.feedback_comments(feedback_id, created_at DESC);

ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer authenticated. (Pipeline é gated na UI por permissão.)
DROP POLICY IF EXISTS "feedback_comments_read" ON public.feedback_comments;
CREATE POLICY "feedback_comments_read"
  ON public.feedback_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert: só o próprio (server usa admin client para o normal flow, mas
-- mantemos a policy para o caso de uso directo via PostgREST).
DROP POLICY IF EXISTS "feedback_comments_insert" ON public.feedback_comments;
CREATE POLICY "feedback_comments_insert"
  ON public.feedback_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Delete: só admins via service role; nada de delete por authenticated.
