-- Concede permissão `leads_management` aos roles de gestão existentes:
-- Office Manager, Team Leader, Gestor Processual.
-- admin e Broker/CEO já recebem todas as permissões via merge (ALL_PERMISSION_MODULES),
-- não precisam de update aqui.

UPDATE public.roles
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('leads_management', true)
WHERE name IN ('Office Manager', 'Team Leader', 'Gestor Processual');
