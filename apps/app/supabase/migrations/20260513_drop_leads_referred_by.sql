-- =============================================================================
-- Drop leads.referred_by_consultant_id (and its index).
--
-- Added in 20260512_internal_referral_handover to back the now-defunct
-- "first négocio gets the slice" rule. After the simplification (every
-- future deal between the referenced contacto and the recipient pays the
-- slice via the leads_referrals lookup at négocio create time), this
-- column is no longer read anywhere.
--
-- Revert:
--   ALTER TABLE public.leads ADD COLUMN referred_by_consultant_id uuid
--     REFERENCES public.dev_users(id) ON DELETE SET NULL;
--   CREATE INDEX idx_leads_referred_by
--     ON public.leads (referred_by_consultant_id)
--     WHERE referred_by_consultant_id IS NOT NULL;
-- =============================================================================

DROP INDEX IF EXISTS public.idx_leads_referred_by;

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS referred_by_consultant_id;
