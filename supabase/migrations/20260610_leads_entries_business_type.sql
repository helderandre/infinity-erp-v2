-- Add business_type to leads_entries.
-- Aditiva, NULL para entradas pré-existentes (não bloqueia leituras antigas).
-- CHECK só permite os 3 valores PT-PT usados no resto do CRM.

ALTER TABLE public.leads_entries
  ADD COLUMN IF NOT EXISTS business_type TEXT
    CHECK (business_type IS NULL OR business_type IN ('Venda', 'Arrendamento', 'Trespasse'));

COMMENT ON COLUMN public.leads_entries.business_type IS
  'Venda | Arrendamento | Trespasse — preenchido pelo lead-entry-dialog. NULL em entradas antigas.';
