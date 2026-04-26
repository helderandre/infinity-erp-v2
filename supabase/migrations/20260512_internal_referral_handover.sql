-- =============================================================================
-- Internal referral hand-off — adds the columns the new "Referências" page
-- needs so a referrer keeps a money-bearing visibility on the négocio they
-- handed off plus an audit-only visibility on every future négocio of a
-- contact whose lead_entry they referred.
--
-- Builds on top of the existing referral infrastructure:
--   • leads_referrals      — audit row for every referral event (from→to)
--   • leads_entries        — already has has_referral / referral_consultant_id
--                            for partner/external referrals
--   • deal_referrals       — commission-split records (kept as is)
--   • negocios.referral_pct already exists
--
-- What this migration adds (all aditive, all nullable):
--   1. negocios.referrer_consultant_id    — internal consultant the négocio's
--                                           commission slice is paid to
--   2. leads.referred_by_consultant_id    — original referrer of this contact
--                                           (set on lead-entry referrals so
--                                           every future négocio is auditable)
--   3. leads_referrals.referral_pct       — per-referral % override (defaults
--                                           to agency setting if null)
--   4. agency setting: default_referral_pct = 0.25
--   5. supporting indexes for the Referências dashboard fetchers
--
-- Revert:
--   ALTER TABLE public.negocios       DROP COLUMN IF EXISTS referrer_consultant_id;
--   ALTER TABLE public.leads          DROP COLUMN IF EXISTS referred_by_consultant_id;
--   ALTER TABLE public.leads_referrals DROP COLUMN IF EXISTS referral_pct;
--   DROP INDEX IF EXISTS public.idx_negocios_referrer_consultant;
--   DROP INDEX IF EXISTS public.idx_leads_referred_by;
--   DELETE FROM public.temp_agency_settings WHERE key = 'default_referral_pct';
-- =============================================================================

-- 1. negocios — who gets the referral commission slice on this deal.
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS referrer_consultant_id uuid
  REFERENCES public.dev_users(id) ON DELETE SET NULL;

-- 2. leads — original referrer of the contact (only set when contact came
--    from a referred lead_entry). Used to surface every future négocio of
--    this lead in the original referrer's audit kanban.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referred_by_consultant_id uuid
  REFERENCES public.dev_users(id) ON DELETE SET NULL;

-- 3. leads_referrals — per-referral percentage override. NULL falls back to
--    the agency default (see #4). Range guard so accidental nonsense values
--    (e.g. 250 instead of 25) get rejected at write time.
ALTER TABLE public.leads_referrals
  ADD COLUMN IF NOT EXISTS referral_pct numeric(5,2)
  CHECK (referral_pct IS NULL OR (referral_pct >= 0 AND referral_pct <= 100));

-- 4. Default agency-wide referral percentage. Stored as text to match the
--    existing temp_agency_settings convention (margin_rate, default_commission_rate).
INSERT INTO public.temp_agency_settings (key, value)
VALUES ('default_referral_pct', '25')
ON CONFLICT (key) DO NOTHING;

-- 5. Indexes for the Referências page fetchers.
--    Partial indexes — only rows where the column is set are indexed.

-- "Show me every négocio whose commission slice I am owed."
CREATE INDEX IF NOT EXISTS idx_negocios_referrer_consultant
  ON public.negocios (referrer_consultant_id)
  WHERE referrer_consultant_id IS NOT NULL;

-- "Show me every contact whose négocios I should be auditing."
CREATE INDEX IF NOT EXISTS idx_leads_referred_by
  ON public.leads (referred_by_consultant_id)
  WHERE referred_by_consultant_id IS NOT NULL;
