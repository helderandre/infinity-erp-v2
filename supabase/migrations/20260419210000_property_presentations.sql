-- Property presentations — cached PDF + shareable metadata per (property, format)
-- Each row represents the most recent generation. Regeneration upserts this row.

CREATE TABLE IF NOT EXISTS public.property_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.dev_properties(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('ficha', 'presentation')),
  pdf_url TEXT NOT NULL,
  share_url TEXT,
  sections TEXT[],
  summary_override TEXT,
  generated_by UUID REFERENCES public.dev_users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT property_presentations_property_format_unique UNIQUE (property_id, format)
);

CREATE INDEX IF NOT EXISTS property_presentations_property_id_idx
  ON public.property_presentations (property_id);

-- Trigger to keep updated_at fresh on upsert
CREATE OR REPLACE FUNCTION public.property_presentations_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_presentations_touch ON public.property_presentations;
CREATE TRIGGER property_presentations_touch
  BEFORE UPDATE ON public.property_presentations
  FOR EACH ROW EXECUTE FUNCTION public.property_presentations_touch_updated_at();

COMMENT ON TABLE public.property_presentations IS
  'Stores the most recently generated PDF (ficha/presentation) for each property, so the same link can be reused across sessions.';
