-- =============================================================================
-- contact_property_sends — registry of property→contact sends, contact-level.
--
-- Purpose: answer "have I already sent property X to contact Y?" without
-- having to JOIN through negocios + negocio_properties. Survives negocio
-- delete / merge, and is the only place to register a "general send"
-- (when the consultor sends a message at the contact level without
-- attaching it to a specific deal).
--
-- Coexists with negocio_properties:
--   • Sending a property in the context of a negócio → 1 row in BOTH
--     tables (negocio_properties keeps the dossier, this table keeps the
--     contact-level history).
--   • "Mensagem geral ao contacto" (no negócio chosen) → only this table
--     gets a row, with source_negocio_id = NULL.
--
-- Used by:
--   • The bulk action menu in the kanban (multi-select sends)
--   • Imóveis → "potenciais interessados" badge ("Enviado em DD/MM")
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contact_property_sends (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id          uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  property_id         uuid NOT NULL REFERENCES public.dev_properties(id) ON DELETE CASCADE,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  channel             text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms', 'manual', 'other')),
  -- Optional link back to the deal that triggered the send (NULL = sent at
  -- contact level without a specific negócio).
  source_negocio_id   uuid REFERENCES public.negocios(id) ON DELETE SET NULL,
  -- Who clicked send.
  sent_by             uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  -- Optional snapshot for audit: subject line, message preview, etc.
  message_summary     text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Hot lookups: "everyone we've sent property X to" + reverse direction
-- "everything we've sent to contact Y".
CREATE INDEX IF NOT EXISTS contact_property_sends_property_idx
  ON public.contact_property_sends (property_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS contact_property_sends_contact_idx
  ON public.contact_property_sends (contact_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS contact_property_sends_negocio_idx
  ON public.contact_property_sends (source_negocio_id)
  WHERE source_negocio_id IS NOT NULL;

-- RLS: any authenticated user can read; only the sender or someone with
-- the right permission can write. Mirror the pattern used elsewhere in
-- the project (negocio_properties). Tighten later if needed.
ALTER TABLE public.contact_property_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contact_property_sends'
      AND policyname = 'contact_property_sends_select_authenticated'
  ) THEN
    CREATE POLICY contact_property_sends_select_authenticated
      ON public.contact_property_sends
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contact_property_sends'
      AND policyname = 'contact_property_sends_insert_authenticated'
  ) THEN
    CREATE POLICY contact_property_sends_insert_authenticated
      ON public.contact_property_sends
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;
