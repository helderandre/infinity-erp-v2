-- ─── Tabela para dados editáveis de Estrutura (Acessos) ───
CREATE TABLE IF NOT EXISTS public.acessos_company_info (
  scope text PRIMARY KEY CHECK (scope IN ('faturacao', 'convictus')),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.dev_users(id) ON DELETE SET NULL
);

ALTER TABLE public.acessos_company_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acessos_company_info_select" ON public.acessos_company_info;
CREATE POLICY "acessos_company_info_select"
  ON public.acessos_company_info FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "acessos_company_info_update" ON public.acessos_company_info;
CREATE POLICY "acessos_company_info_update"
  ON public.acessos_company_info FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_acessos_company_info_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acessos_company_info_updated_at ON public.acessos_company_info;
CREATE TRIGGER trg_acessos_company_info_updated_at
BEFORE UPDATE ON public.acessos_company_info
FOR EACH ROW
EXECUTE FUNCTION public.set_acessos_company_info_updated_at();

INSERT INTO public.acessos_company_info (scope, data) VALUES
  ('faturacao', '{
    "nome": "LECOQIMMO - MEDIAÇÃO IMOBILIÁRIA, UNIPESSOAL LDA",
    "sede": "Avenida da Liberdade, Nº 129 B 1250-140 Lisboa",
    "nipc": "514828528"
  }'::jsonb),
  ('convictus', '{
    "agencia": {
      "nome": "RE/MAX COLLECTION CONVICTUS",
      "morada": "Avenida Ressano Garcia, 37 A 1070-234 Lisboa",
      "telefone": "218 036 779"
    },
    "sede": {
      "nome": "RE/MAX CONVICTUS",
      "morada": "Av. das Forças Armadas 22 C 1600-082 Lisboa",
      "telefone": "217978189",
      "ami": "4719"
    }
  }'::jsonb)
ON CONFLICT (scope) DO NOTHING;
