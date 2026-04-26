-- ============================================================================
-- 20260426_internal_chat_privacy.sql
-- Internal chat: enforce per-channel membership privacy via RLS.
-- ============================================================================
--
-- PROBLEMA
--   Os endpoints em app/api/chat/internal/* nunca verificavam se o utilizador
--   é membro do channel_id pedido. Qualquer utilizador autenticado podia
--   ler/escrever em qualquer DM se conhecesse (ou adivinhasse) o channel_id
--   — incluindo subscrições realtime.
--
-- SOLUÇÃO
--   1. Nova tabela `internal_chat_channel_members` regista quem pertence a
--      cada canal. O canal global ("watercooler"
--      00000000-0000-0000-0000-000000000001) é tratado como excepção pública.
--   2. Função SECURITY DEFINER `is_internal_chat_member(uuid)` evita
--      recursão infinita das policies (a tabela tem RLS sobre si mesma).
--   3. RLS em todas as tabelas internal_chat_* usa essa função para gating.
--   4. Backfill: cada (channel_id, sender_id) distinto vira membership row.
--      Limitação: DMs com mensagens só de um lado deixam o destinatário sem
--      acesso até o thread ser reaberto (POST com `dm_recipient_id` adiciona
--      ambos). Aceitável face a privacidade por defeito; histórico curto.
--
-- REVERT (manual, se necessário)
--   ALTER TABLE internal_chat_messages       DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE internal_chat_attachments    DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE internal_chat_reactions      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE internal_chat_read_receipts  DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE internal_chat_channel_members DISABLE ROW LEVEL SECURITY;
--   DROP POLICY ... (todas as criadas abaixo)
--   DROP FUNCTION public.is_internal_chat_member(uuid);
--   DROP TABLE public.internal_chat_channel_members;
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1) Membership table
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.internal_chat_channel_members (
  channel_id  uuid        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_internal_chat_channel_members_user
  ON public.internal_chat_channel_members(user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2) Backfill membership a partir de mensagens existentes
--    (ignora o canal global — é público)
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.internal_chat_channel_members (channel_id, user_id, joined_at)
SELECT m.channel_id, m.sender_id, MIN(m.created_at)
FROM public.internal_chat_messages m
WHERE m.channel_id <> '00000000-0000-0000-0000-000000000001'::uuid
GROUP BY m.channel_id, m.sender_id
ON CONFLICT (channel_id, user_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 3) Helper SECURITY DEFINER — evita recursão com a policy da membership
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_internal_chat_member(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_channel_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR EXISTS (
      SELECT 1
      FROM public.internal_chat_channel_members m
      WHERE m.channel_id = p_channel_id
        AND m.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_internal_chat_member(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 4) RLS — internal_chat_messages
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.internal_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_chat_messages_member_select ON public.internal_chat_messages;
CREATE POLICY internal_chat_messages_member_select
  ON public.internal_chat_messages
  FOR SELECT
  TO authenticated
  USING (public.is_internal_chat_member(channel_id));

DROP POLICY IF EXISTS internal_chat_messages_member_insert ON public.internal_chat_messages;
CREATE POLICY internal_chat_messages_member_insert
  ON public.internal_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_internal_chat_member(channel_id)
  );

DROP POLICY IF EXISTS internal_chat_messages_owner_update ON public.internal_chat_messages;
CREATE POLICY internal_chat_messages_owner_update
  ON public.internal_chat_messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- (sem policy de DELETE — o app usa soft-delete via UPDATE is_deleted=true)

-- ──────────────────────────────────────────────────────────────────────────
-- 5) RLS — internal_chat_attachments
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.internal_chat_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_chat_attachments_member_select ON public.internal_chat_attachments;
CREATE POLICY internal_chat_attachments_member_select
  ON public.internal_chat_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_chat_messages m
      WHERE m.id = internal_chat_attachments.message_id
        AND public.is_internal_chat_member(m.channel_id)
    )
  );

DROP POLICY IF EXISTS internal_chat_attachments_member_insert ON public.internal_chat_attachments;
CREATE POLICY internal_chat_attachments_member_insert
  ON public.internal_chat_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.internal_chat_messages m
      WHERE m.id = internal_chat_attachments.message_id
        AND public.is_internal_chat_member(m.channel_id)
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 6) RLS — internal_chat_reactions
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.internal_chat_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_chat_reactions_member_select ON public.internal_chat_reactions;
CREATE POLICY internal_chat_reactions_member_select
  ON public.internal_chat_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_chat_messages m
      WHERE m.id = internal_chat_reactions.message_id
        AND public.is_internal_chat_member(m.channel_id)
    )
  );

DROP POLICY IF EXISTS internal_chat_reactions_member_insert ON public.internal_chat_reactions;
CREATE POLICY internal_chat_reactions_member_insert
  ON public.internal_chat_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.internal_chat_messages m
      WHERE m.id = internal_chat_reactions.message_id
        AND public.is_internal_chat_member(m.channel_id)
    )
  );

DROP POLICY IF EXISTS internal_chat_reactions_owner_delete ON public.internal_chat_reactions;
CREATE POLICY internal_chat_reactions_owner_delete
  ON public.internal_chat_reactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- 7) RLS — internal_chat_read_receipts (próprios apenas)
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.internal_chat_read_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_chat_read_receipts_self_select ON public.internal_chat_read_receipts;
CREATE POLICY internal_chat_read_receipts_self_select
  ON public.internal_chat_read_receipts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS internal_chat_read_receipts_self_upsert ON public.internal_chat_read_receipts;
CREATE POLICY internal_chat_read_receipts_self_upsert
  ON public.internal_chat_read_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_internal_chat_member(channel_id)
  );

DROP POLICY IF EXISTS internal_chat_read_receipts_self_update ON public.internal_chat_read_receipts;
CREATE POLICY internal_chat_read_receipts_self_update
  ON public.internal_chat_read_receipts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- 8) RLS — internal_chat_channel_members
--   Os utilizadores só podem ver linhas de canais aos quais eles próprios
--   pertencem. Os INSERT/DELETE são feitos via service role (POST handler
--   chama ensureDmMembership antes de inserir a primeira mensagem da DM).
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.internal_chat_channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_chat_channel_members_visible ON public.internal_chat_channel_members;
CREATE POLICY internal_chat_channel_members_visible
  ON public.internal_chat_channel_members
  FOR SELECT
  TO authenticated
  USING (public.is_internal_chat_member(channel_id));
