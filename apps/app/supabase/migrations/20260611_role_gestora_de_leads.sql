-- Novo role "Gestora de Leads" + atribuição inicial à Mariana Cabral.
-- Sem migration de dados além do INSERT no user_roles. Idempotente:
-- ON CONFLICT DO NOTHING permite re-aplicar sem erros.

INSERT INTO public.roles (name, description, permissions)
VALUES (
  'Gestora de Leads',
  'Gestão da inbox de leads — distribuição, qualificação, monitorização de SLAs e import bulk.',
  jsonb_build_object('leads_management', true, 'leads', true)
)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      permissions = EXCLUDED.permissions;

INSERT INTO public.user_roles (user_id, role_id, assigned_at)
SELECT
  '39fa64ed-b002-400e-a4a7-8439746e358d'::uuid,
  r.id,
  now()
FROM public.roles r
WHERE r.name = 'Gestora de Leads'
ON CONFLICT (user_id, role_id) DO NOTHING;
