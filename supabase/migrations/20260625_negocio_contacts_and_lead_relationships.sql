-- ============================================================================
-- Multiple people on an oportunidade + contact-to-contact relationships
--
-- Problem: `negocios.lead_id` points to a single "main" contacto, but a deal
-- often involves a couple (casados) or a partnership — more than one person.
-- And there was no way to record that two contactos are married/partners.
--
-- Design (mirrors the existing `property_owners` M:N + is_main_contact pattern):
--   1. `lead_relationships` — symmetric link between two `leads` (conjuge,
--      parceiro, etc.). One row per pair (deduped via expression unique index);
--      treated as bidirectional in the API.
--   2. `negocio_contacts` — junction of all people on a negócio, each reusing a
--      real `leads` record, with exactly one `is_primary` (the "main" one).
--
-- `negocios.lead_id` stays the single source of truth for the primary
-- participant (everything already reads it). One AFTER trigger mirrors it into
-- the junction's is_primary row (demote-then-promote, so the one-primary index
-- never trips). Changing the primary is done by updating negocios.lead_id — NOT
-- by writing is_primary directly (a reverse trigger was tried and dropped: it
-- trips the partial unique index on promotion and risks trigger recursion).
--
-- Backfill: one is_primary='titular' row per existing negócio from lead_id.
-- Additive only. RLS left disabled to match sibling CRM tables (negocios,
-- deal_clients) — authorization is enforced in the API layer via the admin
-- client. REVERT at the bottom.
-- ============================================================================

-- ── 1. Contact-to-contact relationships ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id         uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  related_contact_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  relationship_type  text NOT NULL DEFAULT 'conjuge'
    CHECK (relationship_type IN ('conjuge','parceiro','familiar','socio','representante_legal','outro')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES public.dev_users(id),
  CONSTRAINT lead_relationships_no_self CHECK (contact_id <> related_contact_id)
);

-- One relationship per unordered pair (A↔B == B↔A), regardless of type.
CREATE UNIQUE INDEX IF NOT EXISTS lead_relationships_pair_uniq
  ON public.lead_relationships (
    LEAST(contact_id, related_contact_id),
    GREATEST(contact_id, related_contact_id)
  );

CREATE INDEX IF NOT EXISTS lead_relationships_contact_idx
  ON public.lead_relationships (contact_id);
CREATE INDEX IF NOT EXISTS lead_relationships_related_idx
  ON public.lead_relationships (related_contact_id);

-- ── 2. People on a negócio (participants) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.negocio_contacts (
  negocio_id   uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  lead_id      uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  is_primary   boolean NOT NULL DEFAULT false,
  role         text NOT NULL DEFAULT 'titular'
    CHECK (role IN ('titular','conjuge','co_comprador','co_vendedor','fiador','representante','outro')),
  order_index  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.dev_users(id),
  PRIMARY KEY (negocio_id, lead_id)
);

-- Exactly one primary per negócio.
CREATE UNIQUE INDEX IF NOT EXISTS negocio_contacts_one_primary
  ON public.negocio_contacts (negocio_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS negocio_contacts_lead_idx
  ON public.negocio_contacts (lead_id);

-- ── 3. Sync triggers (negocios.lead_id  ⇄  primary participant) ─────────────

-- Forward: when a negócio's lead_id is set/changed, mirror the primary row.
CREATE OR REPLACE FUNCTION public.sync_negocio_primary_contact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- demote any stale primary that isn't the new main contact
  UPDATE public.negocio_contacts
     SET is_primary = false
   WHERE negocio_id = NEW.id
     AND lead_id <> NEW.lead_id
     AND is_primary;

  -- ensure the primary row exists and is flagged
  INSERT INTO public.negocio_contacts (negocio_id, lead_id, is_primary, role, order_index)
  VALUES (NEW.id, NEW.lead_id, true, 'titular', 0)
  ON CONFLICT (negocio_id, lead_id)
  DO UPDATE SET is_primary = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_negocio_primary_contact ON public.negocios;
CREATE TRIGGER trg_sync_negocio_primary_contact
AFTER INSERT OR UPDATE OF lead_id ON public.negocios
FOR EACH ROW
WHEN (NEW.lead_id IS NOT NULL)
EXECUTE FUNCTION public.sync_negocio_primary_contact();

-- Reverse: when a junction row becomes primary, push it back to negocios.lead_id.
-- Guarded by IS DISTINCT so the two triggers can't ping-pong.
-- NOTE: a reverse trigger (junction.is_primary -> negocios.lead_id) was
-- deliberately NOT kept — promoting a junction row directly trips the
-- one-primary partial unique index before an AFTER trigger can demote the old
-- primary, and two-way sync risks recursion. To change the primary, update
-- negocios.lead_id; the forward trigger above does the demote-then-promote.

-- ── 4. Backfill primary rows from existing negócios ────────────────────────
INSERT INTO public.negocio_contacts (negocio_id, lead_id, is_primary, role, order_index)
SELECT id, lead_id, true, 'titular', 0
FROM public.negocios
WHERE lead_id IS NOT NULL
ON CONFLICT (negocio_id, lead_id) DO NOTHING;

-- ── 5. Grants (match sibling CRM tables; RLS stays disabled) ────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_relationships TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negocio_contacts   TO authenticated, service_role;

-- ============================================================================
-- REVERT
-- DROP TRIGGER IF EXISTS trg_sync_negocio_primary_contact ON public.negocios;
-- DROP FUNCTION IF EXISTS public.sync_negocio_primary_contact();
-- DROP TABLE IF EXISTS public.negocio_contacts;
-- DROP TABLE IF EXISTS public.lead_relationships;
-- ============================================================================
