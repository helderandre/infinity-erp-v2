-- Add editable "despedida" (goodbye/closing) text for email signatures.
-- Rendered in outgoing emails above the signature image; falls back to a
-- default string on the client when null/empty.
ALTER TABLE public.dev_consultant_profiles
  ADD COLUMN IF NOT EXISTS email_signature_goodbye text;

COMMENT ON COLUMN public.dev_consultant_profiles.email_signature_goodbye IS
  'Texto de despedida (closing) inserido antes da imagem de assinatura. NULL = usar default "Com os melhores cumprimentos,".';
