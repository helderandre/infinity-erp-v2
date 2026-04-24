-- Backfill `owner_id` em proc_subtasks órfãs criadas pelas regras hardcoded
-- com `ownerScope: 'main_contact_only'`. O bug em
-- `lib/processes/subtasks/populate.ts` (corrigido em conjunto com esta
-- migration) usava a flag legacy `repeatPerOwner` na linha que grava
-- `owner_id`, deixando-o sempre `null` em scopes 'main_contact_only'.
-- Consequência: o resolver `/api/libraries/emails/preview-data` saltava as
-- variáveis `proprietario_*` por falta de owner_id, deixando o CMI gerado
-- com a maioria dos campos do proprietário em branco.
--
-- Esta migration repõe o owner_id = contacto principal do imóvel para
-- todas as subtarefas hardcoded que dependem dele e ainda não foram
-- concluídas. Idempotente — só toca em rows com owner_id IS NULL.
--
-- Revert (caso necessário): UPDATE proc_subtasks SET owner_id = NULL
--   WHERE subtask_key IN ('geracao_cmi','email_envio_cmi') AND ...

WITH main_owner_per_property AS (
  SELECT DISTINCT ON (po.property_id)
         po.property_id,
         po.owner_id
    FROM property_owners po
   ORDER BY po.property_id, po.is_main_contact DESC NULLS LAST, po.owner_id ASC
)
UPDATE proc_subtasks s
   SET owner_id = mo.owner_id
  FROM proc_tasks t
  JOIN proc_instances pi ON pi.id = t.proc_instance_id
  JOIN main_owner_per_property mo ON mo.property_id = pi.property_id
 WHERE s.proc_task_id = t.id
   AND s.subtask_key IN ('geracao_cmi', 'email_envio_cmi')
   AND s.owner_id IS NULL
   AND s.is_completed = false;
