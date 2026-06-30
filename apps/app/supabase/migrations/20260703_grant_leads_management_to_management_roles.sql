-- Concede a permissão `leads_management` aos roles de gestão para que possam
-- atribuir/reatribuir leads a consultores (tal como a "Gestora de Leads").
--
-- Contexto: a atribuição de leads é gated pela permissão `leads_management`
-- (sheet "Gestão de Leads", /api/crm/gestora/reassign, /api/analise-meta/...).
-- admin e Broker/CEO/Office Manager já recebem TODAS as permissões via merge
-- (ALL_PERMISSION_MODULES em lib/auth/permissions.ts) — incluí-los aqui é
-- defensivo/auto-documentado e protege contra futuras alterações ao ADMIN_ROLES.
-- O role que efectivamente não tinha a permissão era o "Gestor Processual"
-- (a migration 20260612 só fazia efeito se aplicada com a grafia exacta).
--
-- Match case-insensitive + variantes de grafia ('Gestor'/'Gestora Processual')
-- para ser robusto a inconsistências de nome de role já presentes no schema.
-- Idempotente — pode ser reaplicada sem efeitos secundários (|| sobre o jsonb
-- apenas garante a chave a true).

UPDATE public.roles
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('leads_management', true)
WHERE lower(name) IN (
  'broker/ceo',
  'office manager',
  'gestor processual',
  'gestora processual'
);

-- Revert:
-- UPDATE public.roles
-- SET permissions = permissions - 'leads_management'
-- WHERE lower(name) IN ('gestor processual', 'gestora processual');
-- (Não reverter para broker/ceo nem office manager — recebem tudo via merge,
--  o flag no jsonb é meramente informativo nesses casos.)
