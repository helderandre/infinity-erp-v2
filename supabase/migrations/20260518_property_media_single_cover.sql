-- ============================================================================
-- Enforce a single cover photo per property.
--
-- Problem: dev_property_media.is_cover was a plain boolean with no DB-level
-- constraint. Bugs in the upload path (auto-promote-when-no-cover) and race
-- conditions in the "clear-then-set" PUT could leave several rows with
-- is_cover=true for the same property. Users then saw the wrong cover in
-- the list/sheet/detail page depending on which place picked which row.
--
-- This migration:
--   1. Cleans up existing data: keep only ONE cover per property — the one
--      with the lowest order_index (the photo dragged to position 0). Any
--      other rows currently flagged as cover get is_cover=false.
--   2. Adds a partial unique index so that, going forward, the DB rejects
--      INSERT/UPDATE statements that would create a second cover for the
--      same property. Atomic, race-free.
-- ============================================================================

-- 1. Cleanup — keep the lowest order_index per property as the single cover.
-- (dev_property_media has no created_at column; tie-break on id which is
-- ULID-ish and stable.)
WITH ranked AS (
  SELECT
    id,
    property_id,
    ROW_NUMBER() OVER (
      PARTITION BY property_id
      ORDER BY order_index ASC, id ASC
    ) AS rn
  FROM public.dev_property_media
  WHERE is_cover = true
)
UPDATE public.dev_property_media m
SET is_cover = false
FROM ranked r
WHERE m.id = r.id
  AND r.rn > 1;

-- 2. Partial unique index — at most one cover per property.
-- Using a partial index (WHERE is_cover = true) means rows with is_cover=false
-- are not part of the index, so no false collisions. CONCURRENTLY omitted
-- because the table is small; if it grows large, switch to CONCURRENTLY in a
-- follow-up migration.
CREATE UNIQUE INDEX IF NOT EXISTS dev_property_media_one_cover_per_property
  ON public.dev_property_media (property_id)
  WHERE is_cover = true;

-- ============================================================================
-- Revert (manual):
--   DROP INDEX IF EXISTS public.dev_property_media_one_cover_per_property;
-- (The cleanup is idempotent and intentional — it doesn't need reverting.)
-- ============================================================================
