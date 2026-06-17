-- 20260617_phase1_drop_angariacao_tpl_subtasks.sql
--
-- FASE 1 da reestruturação de processos — "hardcode total" da angariação.
--
-- PROPÓSITO: eliminar o duplo-populate. Hoje, ao activar uma angariação,
-- populate_process_tasks() chama _populate_subtasks() que cria subtarefas
-- `legacy_*` a partir destas 45 tpl_subtasks — que o populateSubtasks() hardcoded
-- (lib/processes/subtasks) apaga logo a seguir (deleteSupersededLegacyRows).
-- É um write-delete-rewrite desperdiçado e a origem da confusão "old vs new".
--
-- Ao esvaziar as tpl_subtasks do template activo de angariação, o
-- `EXISTS(tpl_subtasks)` (has_subtasks) em populate_process_tasks passa a FALSE
-- para todas as tasks de angariação → _populate_subtasks NUNCA é chamado → 0
-- linhas `legacy_*`. O registry hardcoded passa a ser a ÚNICA fonte de subtarefas.
--
-- SEGURANÇA (verificado 2026-06-17):
--   • Bijecção exacta 45↔45: cada uma das 45 tpl_subtasks é superseded por uma
--     regra hardcoded (supersedesTplSubtaskId). 0 perdidas, 0 órfãs. Nada se perde.
--   • FK proc_subtasks.tpl_subtask_id é ON DELETE SET NULL → as 85 instâncias
--     vivas NÃO são afectadas (as ~18 linhas legacy_tpl ficam com tpl_subtask_id
--     NULL, continuam a renderizar pelo switch legacy via config.type).
--   • _populate_subtasks() NÃO é tocado — continua a servir o negócio (template
--     diferente, tpl_subtasks intactas) até à Fase 2.
--   • Só afecta NOVAS angariações (passam a hardcoded-only — o estado desejado).
--
-- PRÉ-REQUISITO DE DEPLOY: aplicar SÓ depois de o código da Fase 1 estar deployed
-- (re-template + owners/populate-tasks passam a chamar populateSubtasks). Caso
-- contrário, no intervalo, re-template / adicionar-owner em produção ficariam sem
-- subtarefas para angariações.
--
-- Template activo de angariação: 'Processo de Angariações'
--   id = c8cd3fcb-968f-4e23-9114-f3421cafa745
--
-- REVERT:
--   INSERT INTO tpl_subtasks SELECT * FROM _backup_tpl_subtasks_ang_20260617;
--   DROP TABLE _backup_tpl_subtasks_ang_20260617;
--   (e re-deploy do código que removeu as chamadas declarativas, se aplicável)

BEGIN;

-- 1) Backup das 45 linhas (tabela de recuperação — reversível)
CREATE TABLE IF NOT EXISTS _backup_tpl_subtasks_ang_20260617 AS
SELECT tsub.*
FROM tpl_subtasks tsub
JOIN tpl_tasks tt ON tt.id = tsub.tpl_task_id
JOIN tpl_stages ts ON ts.id = tt.tpl_stage_id
WHERE ts.tpl_process_id = 'c8cd3fcb-968f-4e23-9114-f3421cafa745';

-- 2) Eliminar as tpl_subtasks do template activo de angariação
--    (scope estrito ao template; não toca negócio nem templates inactivos)
DELETE FROM tpl_subtasks tsub
USING tpl_tasks tt, tpl_stages ts
WHERE tsub.tpl_task_id = tt.id
  AND tt.tpl_stage_id = ts.id
  AND ts.tpl_process_id = 'c8cd3fcb-968f-4e23-9114-f3421cafa745';

COMMIT;
