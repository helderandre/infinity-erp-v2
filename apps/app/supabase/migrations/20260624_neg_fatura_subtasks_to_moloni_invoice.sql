-- Fecho de Negócio (PROC-NEG) — promover os passos "Pedido de fatura" para moloni_invoice
--
-- Part of openspec/changes/rebuild-fecho-process (design.md §4).
--
-- Why:
--   As subtarefas `neg_cpcv_fatura_emitida` (Faturação CPCV) e
--   `neg_esc_fatura_emitida` (Faturação final) foram promovidas no registry
--   hardcoded de `checklist` → `moloni_invoice` (card que reusa o painel Moloni
--   do mapa de gestão; destinatário/valor via deriveFaturaTarget). O
--   `populateSubtasks` é idempotente (INSERT … ON CONFLICT DO NOTHING), por isso
--   NÃO actualiza linhas já populadas — as proc_instances de fecho já criadas
--   continuariam a mostrar um checklist. Este backfill alinha as linhas
--   existentes com o registry.
--
-- Idempotente + aditivo: o `||` faz merge a nível de topo, preservando os
-- marcadores (`hardcoded`, `process_type`, `rule_key`) e o resto do config.
--
-- REVERT (voltar a checklist):
--   update public.proc_subtasks
--     set config = config || jsonb_build_object('type','checklist') - 'moment'
--     where subtask_key in ('neg_cpcv_fatura_emitida','neg_esc_fatura_emitida');

update public.proc_subtasks
set config = config || jsonb_build_object(
  'type','moloni_invoice',
  'moment','cpcv',
  'hint','Destinatário e valor são calculados automaticamente pelo cenário do negócio.'
)
where subtask_key = 'neg_cpcv_fatura_emitida';

update public.proc_subtasks
set config = config || jsonb_build_object(
  'type','moloni_invoice',
  'moment','escritura',
  'hint','Destinatário e valor são calculados automaticamente pelo cenário do negócio.'
)
where subtask_key = 'neg_esc_fatura_emitida';
