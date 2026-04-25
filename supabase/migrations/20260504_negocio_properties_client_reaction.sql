-- ─────────────────────────────────────────────────────────────────────────────
-- 20260504 — negocio_properties: client_reaction
--
-- Adiciona reacção do cliente sobre cada imóvel partilhado no dossier do
-- negócio. Suporta o widget "Imóveis enviados" do novo dashboard de negócio:
-- o consultor marca 👍/👎 com base no feedback recebido (whatsapp/email/visita).
--
-- Aditivo. Rows existentes ficam com client_reaction = NULL.
--
-- Revert:
--   ALTER TABLE negocio_properties DROP COLUMN IF EXISTS client_reaction_note;
--   ALTER TABLE negocio_properties DROP COLUMN IF EXISTS client_reaction_at;
--   ALTER TABLE negocio_properties DROP COLUMN IF EXISTS client_reaction;
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE negocio_properties
  ADD COLUMN IF NOT EXISTS client_reaction text
    CHECK (client_reaction IN ('liked', 'disliked')),
  ADD COLUMN IF NOT EXISTS client_reaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_reaction_note text;

CREATE INDEX IF NOT EXISTS idx_negocio_properties_reaction
  ON negocio_properties (negocio_id, client_reaction)
  WHERE client_reaction IS NOT NULL;

COMMENT ON COLUMN negocio_properties.client_reaction IS
  'Reacção do cliente ao imóvel partilhado: liked | disliked | NULL (sem feedback ainda).';
