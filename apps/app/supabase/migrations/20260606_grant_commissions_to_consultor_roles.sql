-- Abre a secção Financeiro (Visão geral + Conta corrente) aos consultores.
--
-- Contexto: o sidebar gate-a as entradas "Visão geral" e "Conta corrente"
-- via permission='commissions' (ver components/layout/app-sidebar.tsx). As
-- páginas correspondentes já adaptam o conteúdo ao consultor (ver
-- app/dashboard/financeiro/page.tsx + .../conta-corrente/page.tsx) e os
-- endpoints `/api/financial/consultor-summary` e `/api/marketing/conta-corrente`
-- já enforçam `isSelf || users-permission`. Faltava apenas activar a
-- permission nos roles de consultor para os links aparecerem no sidebar.
--
-- Esta migration concede `commissions=true` a:
--   - Consultor
--   - Consultora Executiva
--   - Team Leader
--
-- Os roles `Marketing`, `Recrutador`, `Intermediário de Crédito`, `Cliente`,
-- `owner`, `Staff` e `Gestor Processual` ficam intocados — não têm
-- comissões para visualizar.
--
-- Idempotente: usa jsonb_set + WHERE para repor o valor a true mesmo que
-- já exista. Revert: definir `commissions: false` ou apagar a chave via
-- `permissions - 'commissions'`.

UPDATE roles
SET
  permissions = jsonb_set(
    COALESCE(permissions, '{}'::jsonb),
    '{commissions}',
    'true'::jsonb,
    true
  ),
  updated_at = now()
WHERE name IN ('Consultor', 'Consultora Executiva', 'Team Leader');
