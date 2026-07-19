-- ============================================================================
-- Lock down PUBLIC (anon) access — website stays functional, CRM data hidden
-- ============================================================================
--
-- PROBLEMA (auditoria 2026-07-19):
--   O website público (www.infinitygroup.pt) fala DIRECTAMENTE com o Supabase
--   do ERP usando a anon key (embutida no bundle JS, visível a qualquer um).
--   O role `anon` tinha SELECT em ~302 das 310 tabelas do schema public,
--   incluindo dados MUITO sensíveis:
--     - leads (791), leads_activities (1847), leads_notifications (841)
--     - negocios (311), owners (115), deals (13), deal_payments (11)
--     - wpp_contacts (7727 contactos WhatsApp), log_audit (3082)
--     - conta_corrente_transactions, company_transactions, log_emails,
--       consultant_email_accounts, recruitment_candidates, etc.
--   Qualquer pessoa com a anon key (i.e. qualquer visitante) conseguia
--   descarregar a carteira de leads, proprietários e financeiro inteiros.
--
-- ESTRATÉGIA:
--   1. REVOGAR todo o acesso do `anon` a TODAS as tabelas de public.
--      -> Não toca em `authenticated` (utilizadores logados do ERP) nem em
--         `service_role` (API routes do ERP). O ERP continua igual.
--   2. RE-CONCEDER ao `anon` apenas o estritamente necessário para o website,
--      com SELECT ao nível da COLUNA (só campos front-facing) e RLS ao nível
--      da LINHA (só imóveis publicáveis / consultores activos).
--
-- O QUE O WEBSITE PRECISA (allowlist), confirmado por auditoria ao código em
--   ~/Desktop/Infinitygrouperp (useProperties.ts, useAgents.ts,
--   PropertyDetailPage.tsx, LeadContactModal.tsx):
--     dev_properties, dev_property_media, dev_property_specifications,
--     dev_users, dev_consultant_profiles, user_roles, roles
--
-- REGRAS DE VISIBILIDADE:
--   - dev_properties: só linhas show_on_website=true E
--       status ∈ (active, reserved, sold, rented). Colunas internas
--       (notas jurídicas, links de portais, nº de rascunho remax) ficam FORA.
--   - dev_users: só consultores is_active=true. (NÃO se exige display_website
--       porque a página de detalhe de imóvel mostra o consultor atribuído,
--       e 7 imóveis publicados pertencem a consultores activos com
--       display_website=false. A grelha /equipa continua a filtrar
--       display_website no próprio JS.) Colunas de negócio interno
--       (active_lead_count, is_marketing_partner) ficam FORA.
--   - dev_consultant_profiles: só de consultores activos; SEM
--       calendar_feed_token (token secreto do feed ICS) nem assinaturas de email.
--   - roles: só (id, name) — a matriz de permissões (jsonb) NÃO é exposta.
--
-- SEGURANÇA vs. ERP:
--   - `authenticated` e `service_role` mantêm as grants existentes -> o ERP
--     (browser logado + API routes) não é afectado.
--   - Nas 7 tabelas do allowlist activa-se RLS. Para não alterar o
--     comportamento do ERP, cria-se uma policy permissiva
--     `<t>_authenticated_all` (FOR ALL TO authenticated USING(true)).
--     service_role tem BYPASSRLS -> ignora RLS na mesma.
--
-- REVERT (emergência — repõe a exposição, NÃO recomendado):
--   Ver bloco comentado no fim do ficheiro.
--
-- ⚠️ APLICAR via Supabase SQL editor (ou MCP) — precisa de privilégios DDL
--    que a service_role via PostgREST não tem. Idempotente: pode reaplicar-se.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Cortar TODO o acesso do anon a public (sledgehammer).
--    Não afecta authenticated / service_role.
-- ----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;

-- Impedir que TABELAS FUTURAS criadas por este role voltem a conceder ao anon.
-- (best-effort: só afecta objectos criados pelo role que corre esta migration.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Garantir que o anon ainda pode "ver" o schema (necessário para as grants
-- re-concedidas a seguir). Idempotente.
GRANT USAGE ON SCHEMA public TO anon;

-- ----------------------------------------------------------------------------
-- 2. Helper: neutralizar policies pré-existentes nas 7 tabelas do allowlist,
--    para o estado final ser determinístico (independente do que lá estava).
--    Só toca nestas 7 tabelas; as sensíveis não são mexidas (basta não terem
--    grant do anon).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p record;
  allowlist text[] := ARRAY[
    'dev_properties','dev_property_media','dev_property_specifications',
    'dev_users','dev_consultant_profiles','user_roles','roles'
  ];
BEGIN
  FOREACH t IN ARRAY allowlist LOOP
    -- Só age se a tabela existir (defensivo).
    IF to_regclass('public.'||t) IS NULL THEN
      RAISE NOTICE 'Tabela public.% não existe — ignorada.', t;
      CONTINUE;
    END IF;

    -- Drop de todas as policies actuais desta tabela (recriadas a seguir).
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Preservar o comportamento actual do ERP (utilizadores logados veem tudo).
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t||'_authenticated_all', t
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Re-conceder ao anon SÓ o necessário (SELECT por coluna) + RLS por linha.
-- ----------------------------------------------------------------------------

-- 3.1 dev_properties — só imóveis publicáveis, sem colunas internas ---------
GRANT SELECT (
  id, slug, external_ref, title, description, listing_price, property_type,
  business_type, status, energy_certificate, city, zone, consultant_id,
  created_at, updated_at, property_condition, business_status, contract_regime,
  address_parish, address_street, postal_code, latitude, longitude,
  show_on_website, presentation_show_staging, presentation_show_ai_plantas,
  presentation_overrides, description_per_language, external_ref_seq
) ON public.dev_properties TO anon;

CREATE POLICY dev_properties_anon_public ON public.dev_properties
  FOR SELECT TO anon
  USING (
    show_on_website = true
    AND status IN ('active','reserved','sold','rented')
  );

-- 3.2 dev_property_media — só media de imóveis publicáveis ------------------
GRANT SELECT (
  id, property_id, url, media_type, order_index, is_cover,
  ai_enhanced_url, ai_staged_url, ai_staged_style, render_3d_style
) ON public.dev_property_media TO anon;

CREATE POLICY dev_property_media_anon_public ON public.dev_property_media
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.dev_properties p
      WHERE p.id = dev_property_media.property_id
        AND p.show_on_website = true
        AND p.status IN ('active','reserved','sold','rented')
    )
  );

-- 3.3 dev_property_specifications — todas as colunas são públicas (dados do
--     imóvel), mas só de imóveis publicáveis -------------------------------
GRANT SELECT ON public.dev_property_specifications TO anon;

CREATE POLICY dev_property_specifications_anon_public ON public.dev_property_specifications
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.dev_properties p
      WHERE p.id = dev_property_specifications.property_id
        AND p.show_on_website = true
        AND p.status IN ('active','reserved','sold','rented')
    )
  );

-- 3.4 dev_users — só consultores activos, só colunas front-facing ----------
--     (NÃO expõe active_lead_count / is_marketing_partner / created_at)
GRANT SELECT (
  id, commercial_name, professional_email, is_active, display_website, sub_role
) ON public.dev_users TO anon;

CREATE POLICY dev_users_anon_active ON public.dev_users
  FOR SELECT TO anon
  USING (is_active = true);

-- 3.5 dev_consultant_profiles — só de consultores activos, SEM segredos -----
--     (NÃO expõe calendar_feed_token nem email_signature_*)
GRANT SELECT (
  user_id, bio, profile_photo_url, profile_photo_nobg_url, phone_commercial,
  instagram_handle, linkedin_url, languages, specializations
) ON public.dev_consultant_profiles TO anon;

CREATE POLICY dev_consultant_profiles_anon_active ON public.dev_consultant_profiles
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.dev_users u
      WHERE u.id = dev_consultant_profiles.user_id
        AND u.is_active = true
    )
  );

-- 3.6 user_roles — só o par (user_id, role_id) de utilizadores activos ------
GRANT SELECT (user_id, role_id) ON public.user_roles TO anon;

CREATE POLICY user_roles_anon_active ON public.user_roles
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.dev_users u
      WHERE u.id = user_roles.user_id
        AND u.is_active = true
    )
  );

-- 3.7 roles — só (id, name); a matriz de permissões NÃO é exposta ----------
GRANT SELECT (id, name) ON public.roles TO anon;

CREATE POLICY roles_anon_read ON public.roles
  FOR SELECT TO anon
  USING (true);

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (correr depois de aplicar):
--   -- Deve devolver 0 linhas (nenhuma tabela sensível legível pelo anon
--   -- fora do allowlist):
--   SELECT table_name FROM information_schema.role_table_grants
--   WHERE grantee = 'anon' AND table_schema = 'public'
--     AND table_name NOT IN (
--       'dev_properties','dev_property_media','dev_property_specifications',
--       'dev_users','dev_consultant_profiles','user_roles','roles')
--   GROUP BY table_name;
--
--   -- Sanidade funcional do website (correr como anon / com a anon key):
--   --   SELECT count(*) FROM dev_properties;              -- ~76 (só publicáveis)
--   --   SELECT count(*) FROM dev_users;                    -- consultores activos
--   --   SELECT count(*) FROM leads;                        -- deve dar ERRO 42501
-- ============================================================================

-- ============================================================================
-- REVERT (emergência — REPÕE A EXPOSIÇÃO; usar só se algo do website partir):
--   BEGIN;
--   DROP POLICY IF EXISTS dev_properties_anon_public              ON public.dev_properties;
--   DROP POLICY IF EXISTS dev_property_media_anon_public          ON public.dev_property_media;
--   DROP POLICY IF EXISTS dev_property_specifications_anon_public ON public.dev_property_specifications;
--   DROP POLICY IF EXISTS dev_users_anon_active                   ON public.dev_users;
--   DROP POLICY IF EXISTS dev_consultant_profiles_anon_active     ON public.dev_consultant_profiles;
--   DROP POLICY IF EXISTS user_roles_anon_active                  ON public.user_roles;
--   DROP POLICY IF EXISTS roles_anon_read                         ON public.roles;
--   -- repõe o estado inseguro anterior:
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
--   COMMIT;
-- ============================================================================
