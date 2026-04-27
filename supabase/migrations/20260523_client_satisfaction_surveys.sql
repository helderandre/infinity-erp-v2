-- ==================================================================
-- MIGRATION: client_satisfaction_surveys
-- ==================================================================
-- Inquérito de satisfação enviado ao cliente após fecho do negócio
-- (Stage 5 / Encerramento do PROC-NEG). 9 perguntas — 7 de escolha
-- múltipla + 2 de resposta aberta. Após submissão, o cliente é
-- convidado a deixar review no Google My Business.
--
-- Cada convite gera UMA row com token aleatório opaco — link público
-- partilhável tipo `/inquerito/{token}` (sem auth, validado por token).
-- Após submissão a row fica `completed_at IS NOT NULL` e o token deixa
-- de aceitar nova submissão (idempotência).
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.client_satisfaction_surveys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  consultant_id   uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  lead_id         uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  token           text NOT NULL UNIQUE,

  invited_at      timestamptz NOT NULL DEFAULT now(),
  invited_by      uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,

  -- Q1 — O seu consultor(a) prestou toda a ajuda necessária ao longo do processo?
  q1_consultor_ajuda    text CHECK (q1_consultor_ajuda IN
    ('sim_absolutamente','sim_maioria_vezes','parcialmente','nao')),

  -- Q2 — Como avalia o profissionalismo da equipa da Infinity Group?
  q2_profissionalismo   text CHECK (q2_profissionalismo IN
    ('excelente','bom','satisfatorio','insatisfatorio')),

  -- Q3 — Sentiu-se acompanhado(a) e informado(a) em todas as fases?
  q3_acompanhamento     text CHECK (q3_acompanhamento IN
    ('sim','parcialmente','nao')),

  -- Q4 — O tempo de resposta foi adequado?
  q4_tempo_resposta     text CHECK (q4_tempo_resposta IN
    ('muito_rapido','razoavel','demorado','muito_demorado')),

  -- Q5 — O processo foi conduzido com transparência e clareza?
  q5_transparencia      text CHECK (q5_transparencia IN
    ('sim_completamente','sim_grande_parte','parcialmente','nao')),

  -- Q6 — Como classificaria a sua experiência global?
  q6_experiencia_global text CHECK (q6_experiencia_global IN
    ('excelente','boa','razoavel','ma')),

  -- Q7 — Recomendaria os serviços a amigos ou familiares?
  q7_recomendaria       text CHECK (q7_recomendaria IN
    ('sim_com_certeza','talvez','provavelmente_nao')),

  -- Q8 — Conhece alguém que poderíamos ajudar? (texto livre)
  q8_referencia         text,
  -- Q9 — Comentário/sugestão para melhorar serviços (texto livre)
  q9_comentarios        text,

  completed_at              timestamptz,
  google_review_clicked_at  timestamptz,

  client_ip       text,
  user_agent      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_satisfaction_surveys_deal
  ON public.client_satisfaction_surveys(deal_id);

CREATE INDEX IF NOT EXISTS idx_client_satisfaction_surveys_consultant
  ON public.client_satisfaction_surveys(consultant_id, invited_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_satisfaction_surveys_pending
  ON public.client_satisfaction_surveys(invited_at)
  WHERE completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_client_satisfaction_surveys_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_client_satisfaction_surveys_updated_at ON public.client_satisfaction_surveys;
CREATE TRIGGER trg_touch_client_satisfaction_surveys_updated_at
  BEFORE UPDATE ON public.client_satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION public.touch_client_satisfaction_surveys_updated_at();

COMMENT ON TABLE public.client_satisfaction_surveys IS
  'Inquéritos de satisfação enviados aos clientes após fecho do negócio. Acedidos via link público com token opaco em /inquerito/{token}.';

-- URL do Google review é configurada via env var NEXT_PUBLIC_GOOGLE_REVIEW_URL
-- (formato típico: https://search.google.com/local/writereview?placeid=<PLACE_ID>).
-- A mover para uma tabela de settings adequada quando o módulo de
-- definições gerais estiver consolidado.

-- ==================================================================
-- REVERT
-- ==================================================================
-- DROP TABLE IF EXISTS public.client_satisfaction_surveys;
-- DROP FUNCTION IF EXISTS public.touch_client_satisfaction_surveys_updated_at();
