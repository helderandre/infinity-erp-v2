-- ============================================================================
-- Public invite links for property owners
-- ============================================================================
-- Lets a consultant generate a single-use, time-limited link that a prospective
-- owner (or heirs) can use to submit their personal data + documents without
-- logging in. On submission, the handler creates `owners` + `property_owners`
-- rows and registers uploaded files in `doc_registry`.

CREATE TABLE IF NOT EXISTS property_owner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES dev_properties(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES dev_users(id),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  submitted_at timestamptz,
  submitted_owner_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  submission_metadata jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_owner_invites_property
  ON property_owner_invites (property_id);

CREATE INDEX IF NOT EXISTS idx_property_owner_invites_token
  ON property_owner_invites (token);

CREATE INDEX IF NOT EXISTS idx_property_owner_invites_pending
  ON property_owner_invites (property_id, created_at DESC)
  WHERE status = 'pending';

-- Trigger: bump updated_at on any update.
CREATE OR REPLACE FUNCTION tg_property_owner_invites_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_owner_invites_updated_at
  ON property_owner_invites;

CREATE TRIGGER trg_property_owner_invites_updated_at
  BEFORE UPDATE ON property_owner_invites
  FOR EACH ROW
  EXECUTE FUNCTION tg_property_owner_invites_updated_at();

COMMENT ON TABLE property_owner_invites IS
  'Tokenised public links inviting a prospective owner to submit their data + docs for a property.';
