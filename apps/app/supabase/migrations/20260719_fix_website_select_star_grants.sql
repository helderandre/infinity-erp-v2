-- ============================================================================
-- FIX: repor as páginas de imóveis do website (regressão da migration anterior)
-- ============================================================================
--
-- Contexto: 20260719_lock_down_anon_website_access.sql concedeu ao `anon`
-- SELECT ao nível da COLUNA em dev_properties e dev_property_media. Mas o
-- website faz `select('*')` nessas tabelas (useProperties.ts:
-- `.select('*, dev_property_media(*)')`; PropertyDetailPage.tsx: `.select('*')`).
--
-- Com grants de coluna, o PostgREST expande `*` para TODAS as colunas,
-- incluindo as não concedidas -> erro 42501 "permission denied for table
-- dev_properties" -> a listagem e o detalhe de imóveis do website ficam em
-- branco/erro.
--
-- Verificação nos dados reais: nas 76 fichas publicáveis, as colunas "internas"
-- que tínhamos escondido estão vazias ou são públicas:
--   notas_juridico_convictus: 0/76 preenchidas
--   remax_draft_number:       0/76 preenchidas
--   link_portal_remax:        2/76 (são apenas URLs públicos de portais)
-- Logo, esconder colunas aqui não traz segurança real e parte o website.
--
-- Solução: conceder SELECT da TABELA INTEIRA (todas as colunas) ao anon em
-- dev_properties e dev_property_media, mantendo a RLS por LINHA (só imóveis
-- publicáveis). Rascunhos / cancelados / pendentes continuam invisíveis ao
-- público. As restantes 5 tabelas do allowlist (dev_users,
-- dev_consultant_profiles, user_roles, roles) MANTÊM os grants de coluna —
-- o website consulta-as com listas de colunas explícitas, por isso funcionam
-- na mesma e continuam protegidas ao nível da coluna
-- (calendar_feed_token, active_lead_count, permissions, etc. ficam ocultos).
--
-- ⚠️ APLICAR via Supabase SQL editor (ou MCP). Idempotente.
-- ============================================================================

BEGIN;

-- Table-level SELECT: torna `select('*')` funcional outra vez.
-- (Os grants de coluna anteriores tornam-se redundantes; a RLS por linha
--  criada na migration anterior continua a aplicar-se e a filtrar as linhas.)
GRANT SELECT ON public.dev_properties     TO anon;
GRANT SELECT ON public.dev_property_media TO anon;

COMMIT;

-- ============================================================================
-- Depois de aplicar, confirmar (como anon):
--   SELECT count(*) FROM dev_properties;   -- ~76 (só publicáveis; RLS activa)
--   -- select('*') deve devolver 200, não 42501.
--   -- Tabelas sensíveis (leads, owners, deals, ...) continuam 401.
--
-- REVERT (volta ao grant de coluna da migration anterior):
--   BEGIN;
--   REVOKE SELECT ON public.dev_properties     FROM anon;
--   REVOKE SELECT ON public.dev_property_media FROM anon;
--   GRANT SELECT (
--     id, slug, external_ref, title, description, listing_price, property_type,
--     business_type, status, energy_certificate, city, zone, consultant_id,
--     created_at, updated_at, property_condition, business_status, contract_regime,
--     address_parish, address_street, postal_code, latitude, longitude,
--     show_on_website, presentation_show_staging, presentation_show_ai_plantas,
--     presentation_overrides, description_per_language, external_ref_seq
--   ) ON public.dev_properties TO anon;
--   GRANT SELECT (
--     id, property_id, url, media_type, order_index, is_cover,
--     ai_enhanced_url, ai_staged_url, ai_staged_style, render_3d_style
--   ) ON public.dev_property_media TO anon;
--   COMMIT;
-- ============================================================================
