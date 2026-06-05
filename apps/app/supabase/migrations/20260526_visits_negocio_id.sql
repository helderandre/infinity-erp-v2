-- ============================================================================
-- visits.negocio_id — associate a colleague visit with the requesting
-- consultant's negócio (deal). Used by the new in-app booking flow where a
-- non-owner consultant requests a visit on a colleague's listing and picks
-- one of their own negócios as the context for the visit.
--
-- Aditiva. NULL-able: existing rows (public bookings, owner-side visits) keep
-- negocio_id = NULL. ON DELETE SET NULL so deleting a negócio doesn't cascade
-- into history.
--
-- Revert:
--   DROP INDEX IF EXISTS idx_visits_negocio_id;
--   ALTER TABLE public.visits DROP COLUMN IF EXISTS negocio_id;
-- ============================================================================

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS negocio_id uuid
    REFERENCES public.negocios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visits_negocio_id
  ON public.visits(negocio_id)
  WHERE negocio_id IS NOT NULL;
