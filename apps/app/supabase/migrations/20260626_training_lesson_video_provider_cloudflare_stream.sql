-- Allow 'cloudflare_stream' as a video_provider on training lessons.
--
-- Cloudflare Stream is used for adaptive-bitrate (HLS) playback: the video is
-- uploaded to R2, copied into Stream, transcoded into multiple qualities, and
-- played via hls.js. New uploads store video_provider = 'cloudflare_stream'.
--
-- Assumption: forma_training_lessons.video_provider is a TEXT column (possibly
-- with a CHECK constraint). If it were a Postgres ENUM type instead, this would
-- need `ALTER TYPE ... ADD VALUE` — but the app stores it as free text validated
-- by Zod, so a CHECK is the only constraint that can exist here.
--
-- Idempotent: drops any existing CHECK constraint referencing video_provider and
-- re-adds an inclusive one. Safe to re-run.
--
-- Revert:
--   ALTER TABLE public.forma_training_lessons
--     DROP CONSTRAINT IF EXISTS forma_training_lessons_video_provider_check;
--   ALTER TABLE public.forma_training_lessons
--     ADD CONSTRAINT forma_training_lessons_video_provider_check
--     CHECK (video_provider IS NULL OR video_provider IN ('youtube','vimeo','r2','other'));

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT con.conname
    INTO v_conname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'forma_training_lessons'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%video_provider%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.forma_training_lessons DROP CONSTRAINT %I',
      v_conname
    );
  END IF;
END $$;

ALTER TABLE public.forma_training_lessons
  ADD CONSTRAINT forma_training_lessons_video_provider_check
  CHECK (
    video_provider IS NULL
    OR video_provider IN ('youtube', 'vimeo', 'r2', 'other', 'cloudflare_stream')
  );
