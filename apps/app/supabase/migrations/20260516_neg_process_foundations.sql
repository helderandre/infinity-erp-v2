-- ==================================================================
-- MIGRATION: neg_process_foundations
-- ==================================================================
-- Foundation (spine) for the deal-closing workflow (PROC-NEG):
--
--   1. `deal_events` — per-event logistics with reschedule tracking.
--      Each deal can have multiple events (CPCV, escritura, contrato
--      arrendamento, entrega chaves) with location, notary, attendees,
--      scheduled_at vs occurred_at, and a small reschedule audit on
--      the row itself (count + last_reason). Maps frontend has the
--      coordinates ready.
--
--   2. `deal_marketing_moments` — photos + AI-generated descriptions
--      captured at signing moments (CPCV / escritura / entrega chaves)
--      so consultants can post on Instagram/LinkedIn straight from the
--      ERP. Linked to `deal_events` when a corresponding event exists.
--
--   3. `deals` ALTER — adds `cpcv_actual_date` and
--      `escritura_actual_date`. Existing `contract_signing_date` and
--      `max_deadline` keep their semantics as the *predicted/initial*
--      dates set at submit time. The actual columns are populated
--      when the corresponding `deal_payments` row flips to
--      `is_signed=true` (hook to land in next migration).
--
--   4. `doc_types` seed — populates the catalogue of documents used
--      by the deal-side processes:
--        • KYC comprador singular (5)
--        • KYC comprador colectiva (5)
--        • Compliance / IMPIC / PEP (3)
--        • Vendedor externo (5+5 — mirrors comprador)
--        • Closing artifacts (CPCV, escritura, comprovativos, distrate,
--          declaração condomínio, direitos preferência)
--      All marked `applies_to = {negocios, processes}` so they appear
--      in negócio document folders AND in PROC-NEG task pickers.
--
-- This migration is the SPINE. The PROC-NEG `tpl_processes` row + 5
-- stages + tasks/subtasks land in a follow-up migration that wires
-- doc_type_id references back into the task config jsonb.
--
-- ADITIVA. Nada é removido. Revert no fundo do ficheiro.
-- ==================================================================

-- ──────────────────────────────────────────────────────────────────
-- 1. deal_events
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                 uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  event_type              text NOT NULL CHECK (event_type IN (
                            'cpcv',
                            'escritura',
                            'contrato_arrendamento',
                            'entrega_chaves',
                            'visita_notario',
                            'outro'
                          )),

  -- Scheduling
  scheduled_at            timestamptz,
  occurred_at             timestamptz,           -- NULL until event happens
  duration_minutes        integer DEFAULT 60,

  -- Location (free-form label + structured address for Google Maps deep-link)
  location_label          text,                   -- e.g. "Cartório Notarial Maria Silva"
  location_address        text,                   -- full address (used for maps URL)
  latitude                double precision,
  longitude               double precision,

  -- Notary / official contact
  notary_name             text,
  notary_phone            text,
  notary_email            text,

  -- Status + lightweight reschedule audit (full history can be a child
  -- table later if needed; for now a count + last reason is enough).
  status                  text NOT NULL DEFAULT 'scheduled' CHECK (status IN (
                            'scheduled',
                            'rescheduled',
                            'done',
                            'cancelled',
                            'no_show'
                          )),
  reschedule_count        integer NOT NULL DEFAULT 0,
  last_reschedule_at      timestamptz,
  last_reschedule_reason  text,

  -- Attendees: array of {name, role, phone, email, confirmed}
  attendees               jsonb NOT NULL DEFAULT '[]'::jsonb,

  notes                   text,

  -- Audit
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES public.dev_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deal_events_deal
  ON public.deal_events(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_events_type
  ON public.deal_events(deal_id, event_type);

-- Used by the alerts cron (next commit): "events scheduled in the
-- next N days that haven't occurred yet".
CREATE INDEX IF NOT EXISTS idx_deal_events_upcoming
  ON public.deal_events(scheduled_at)
  WHERE occurred_at IS NULL AND status IN ('scheduled', 'rescheduled');

CREATE OR REPLACE FUNCTION public.touch_deal_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_deal_events_updated_at ON public.deal_events;
CREATE TRIGGER trg_touch_deal_events_updated_at
  BEFORE UPDATE ON public.deal_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_deal_events_updated_at();

COMMENT ON TABLE public.deal_events IS
  'Per-event logistics for deal closings (CPCV, escritura, etc). Stores predicted (scheduled_at) and actual (occurred_at) dates plus location/notary/attendees. Reschedule history kept inline (count + last reason); promote to child table if needed.';

-- ──────────────────────────────────────────────────────────────────
-- 2. deal_marketing_moments
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_marketing_moments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                     uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  event_id                    uuid REFERENCES public.deal_events(id) ON DELETE SET NULL,

  moment_type                 text NOT NULL CHECK (moment_type IN (
                                'cpcv',
                                'escritura',
                                'contrato_arrendamento',
                                'entrega_chaves'
                              )),

  -- Marketing assets (R2 URLs)
  photo_urls                  text[] NOT NULL DEFAULT '{}',

  -- AI description (generated by GPT-4o-mini or similar)
  ai_description              text,
  ai_description_model        text,                       -- e.g. "gpt-4o-mini"
  ai_description_generated_at timestamptz,
  ai_description_locale       text DEFAULT 'pt-PT',

  -- Manual override / consultant edits
  manual_caption              text,

  -- Publication tracking
  published_to_instagram      boolean NOT NULL DEFAULT false,
  published_to_linkedin       boolean NOT NULL DEFAULT false,
  published_at                timestamptz,

  consultant_id               uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_marketing_moments_deal
  ON public.deal_marketing_moments(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_marketing_moments_consultant
  ON public.deal_marketing_moments(consultant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_deal_marketing_moments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_deal_marketing_moments_updated_at ON public.deal_marketing_moments;
CREATE TRIGGER trg_touch_deal_marketing_moments_updated_at
  BEFORE UPDATE ON public.deal_marketing_moments
  FOR EACH ROW EXECUTE FUNCTION public.touch_deal_marketing_moments_updated_at();

COMMENT ON TABLE public.deal_marketing_moments IS
  'Marketing photos + AI-generated descriptions captured at signing moments. Linked to deal_events when a corresponding event exists. Used to publish to consultants social media (Instagram/LinkedIn).';

-- ──────────────────────────────────────────────────────────────────
-- 3. ALTER deals — add explicit "actual" date columns
-- ──────────────────────────────────────────────────────────────────
-- Existing semantics:
--   contract_signing_date → CPCV PREDICTED date (set at submit)
--   max_deadline          → escritura PREDICTED date (set at submit)
-- New columns are populated when the corresponding deal_payments row
-- flips to is_signed=true (hook lands in follow-up migration).
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS cpcv_actual_date      timestamptz,
  ADD COLUMN IF NOT EXISTS escritura_actual_date timestamptz;

COMMENT ON COLUMN public.deals.cpcv_actual_date IS
  'Effective date the CPCV was signed. NULL until signed. Populated by hook on deal_payments(moment=cpcv).is_signed=true.';

COMMENT ON COLUMN public.deals.escritura_actual_date IS
  'Effective date of the escritura (or single contract for arrendamento/trespasse). NULL until signed.';

-- ──────────────────────────────────────────────────────────────────
-- 4. doc_types seed — deal-side documents
-- ──────────────────────────────────────────────────────────────────
-- All seeded as is_system=true so they're protected from accidental
-- deletion. ON CONFLICT (name) DO NOTHING keeps the migration
-- idempotent and avoids clobbering tweaks made via UI.

INSERT INTO public.doc_types
  (name, description, category, applies_to, allowed_extensions, default_validity_months, is_system)
VALUES
  -- ── KYC Comprador singular ──
  ('CC/Passaporte do Comprador',
   'Cartão de Cidadão ou Passaporte do comprador (singular).',
   'KYC Comprador',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   60,
   true),
  ('NIF do Comprador',
   'Comprovativo de NIF do comprador (singular).',
   'KYC Comprador',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true),
  ('Comprovativo de Morada do Comprador',
   'Factura recente (luz, água, gás, telecomunicações) ou atestado de residência. Validade típica: 3 meses.',
   'KYC Comprador',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   3,
   true),
  ('IBAN do Comprador',
   'Comprovativo de IBAN/conta bancária do comprador.',
   'KYC Comprador',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true),
  ('Comprovativo de Origem de Fundos',
   'Documento que evidencia a origem dos fundos para a compra (extracto bancário, declaração IRS, etc.). Obrigatório para compliance/IMPIC.',
   'Compliance',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true),

  -- ── KYC Comprador colectiva ──
  ('Certidão Comercial do Comprador',
   'Certidão Comercial Permanente da pessoa colectiva compradora. Validade típica: 3 meses.',
   'KYC Comprador Empresa',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   3,
   true),
  ('RCBE do Comprador',
   'Registo Central do Beneficiário Efectivo da pessoa colectiva compradora.',
   'KYC Comprador Empresa',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   12,
   true),
  ('CC do Representante Legal (Comprador)',
   'Cartão de Cidadão do representante legal da empresa compradora.',
   'KYC Comprador Empresa',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   60,
   true),
  ('NIPC do Comprador',
   'Comprovativo de NIPC da pessoa colectiva compradora.',
   'KYC Comprador Empresa',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true),
  ('IBAN do Comprador (Empresa)',
   'Comprovativo de IBAN da pessoa colectiva compradora.',
   'KYC Comprador Empresa',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true),

  -- ── Compliance / IMPIC / PEP ──
  ('Declaração PEP',
   'Declaração de pessoa politicamente exposta (PEP) — obrigatória para compliance.',
   'Compliance',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   NULL,
   true),
  ('Comunicação IMPIC',
   'Comprovativo de comunicação à IMPIC ao abrigo da legislação anti-branqueamento.',
   'Compliance',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   NULL,
   true),
  ('Verificação IA — Comprador',
   'Output da verificação automática (IA) dos documentos KYC do comprador. Gerado pelo sistema; pode ser revisto.',
   'Compliance',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','json']::text[],
   NULL,
   true),

  -- ── Vendedor externo (só usado em angariacao_externa; mesmos docs do comprador) ──
  ('CC/Passaporte do Vendedor (Externo)',
   'CC/Passaporte do vendedor — apenas quando a angariação é externa (a outra agência fornece-nos os documentos).',
   'KYC Vendedor Externo',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   60,
   true),
  ('NIF do Vendedor (Externo)',
   'NIF do vendedor — apenas em angariação externa.',
   'KYC Vendedor Externo',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true),
  ('Caderneta Predial (Externo)',
   'Caderneta Predial fornecida pela agência angariadora — apenas em angariação externa.',
   'Imóvel Externo',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   12,
   true),
  ('Certidão Permanente (Externo)',
   'Certidão Permanente do imóvel — apenas em angariação externa.',
   'Imóvel Externo',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   6,
   true),
  ('Certificado Energético (Externo)',
   'Certificado Energético — apenas em angariação externa.',
   'Imóvel Externo',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   120,
   true),

  -- ── Pré-Escritura ──
  ('Distrate de Hipoteca',
   'Distrate de hipoteca emitido pela entidade financiadora do vendedor. Necessário antes da escritura quando há hipoteca activa.',
   'Pré-Escritura',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   NULL,
   true),
  ('Declaração de Não-Dívida ao Condomínio',
   'Declaração emitida pela administração do condomínio comprovando inexistência de dívidas. Obrigatória para a escritura.',
   'Pré-Escritura',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   3,
   true),
  ('Direitos de Preferência',
   'Resposta aos pedidos de direitos de preferência (Câmara Municipal, IGESPAR, IHRU, arrendatário). Obrigatório quando a angariação é nossa.',
   'Pré-Escritura',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   NULL,
   true),

  -- ── Closing artifacts ──
  ('Cópia CPCV Assinado',
   'Cópia digitalizada do Contrato de Promessa de Compra e Venda assinado por todas as partes.',
   'Contratual',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   NULL,
   true),
  ('Cópia Escritura Assinada',
   'Cópia digitalizada da escritura de compra e venda.',
   'Contratual',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   NULL,
   true),
  ('Cópia Contrato de Arrendamento Assinado',
   'Cópia digitalizada do contrato de arrendamento.',
   'Contratual',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf']::text[],
   NULL,
   true),
  ('Comprovativo de Pagamento de Sinal (CPCV)',
   'Comprovativo de transferência/depósito do sinal pago no momento do CPCV.',
   'Comprovativos',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true),
  ('Comprovativo de Pagamento Final (Escritura)',
   'Comprovativo de transferência do remanescente pago no momento da escritura.',
   'Comprovativos',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true),
  ('Comprovativo de Pagamento de Caução',
   'Comprovativo de pagamento da caução do contrato de arrendamento.',
   'Comprovativos',
   ARRAY['negocios','processes']::text[],
   ARRAY['pdf','jpg','jpeg','png']::text[],
   NULL,
   true)
ON CONFLICT (name) DO NOTHING;

-- ==================================================================
-- REVERT
-- ==================================================================
-- ALTER TABLE public.deals
--   DROP COLUMN IF EXISTS cpcv_actual_date,
--   DROP COLUMN IF EXISTS escritura_actual_date;
--
-- DROP TABLE IF EXISTS public.deal_marketing_moments;
-- DROP TABLE IF EXISTS public.deal_events;
--
-- DROP FUNCTION IF EXISTS public.touch_deal_events_updated_at();
-- DROP FUNCTION IF EXISTS public.touch_deal_marketing_moments_updated_at();
--
-- DELETE FROM public.doc_types
--   WHERE is_system = true
--     AND category IN ('KYC Comprador','KYC Comprador Empresa','Compliance',
--                      'KYC Vendedor Externo','Imóvel Externo','Pré-Escritura',
--                      'Contratual','Comprovativos')
--     AND name IN (
--       'CC/Passaporte do Comprador','NIF do Comprador',
--       'Comprovativo de Morada do Comprador','IBAN do Comprador',
--       'Comprovativo de Origem de Fundos',
--       'Certidão Comercial do Comprador','RCBE do Comprador',
--       'CC do Representante Legal (Comprador)','NIPC do Comprador',
--       'IBAN do Comprador (Empresa)',
--       'Declaração PEP','Comunicação IMPIC','Verificação IA — Comprador',
--       'CC/Passaporte do Vendedor (Externo)','NIF do Vendedor (Externo)',
--       'Caderneta Predial (Externo)','Certidão Permanente (Externo)',
--       'Certificado Energético (Externo)',
--       'Distrate de Hipoteca','Declaração de Não-Dívida ao Condomínio',
--       'Direitos de Preferência',
--       'Cópia CPCV Assinado','Cópia Escritura Assinada',
--       'Cópia Contrato de Arrendamento Assinado',
--       'Comprovativo de Pagamento de Sinal (CPCV)',
--       'Comprovativo de Pagamento Final (Escritura)',
--       'Comprovativo de Pagamento de Caução'
--     );
