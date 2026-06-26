-- Fecho de Negócio (PROC-NEG) — promover "Pagar às partes" para pay_parties
--
-- Part of openspec/changes/rebuild-fecho-process.
--
-- Why:
--   As subtarefas `neg_cpcv_pagamento` (Pagamento aos consultores e parceiros
--   (CPCV)) e `neg_esc_pagamento` (… (Escritura)) foram promovidas no registry
--   hardcoded de `checklist` → `pay_parties`. O card mostra a repartição
--   "quem recebe o quê" do pagamento do momento — MESMO cálculo do mapa de
--   gestão (`/api/deals/[id]/payout-breakdown` → buildMapaRowsFromPayment):
--   parte de cada consultor (com toggle Pago via updateSplitPaid), Convictus
--   (rede), margem da agência e agência parceira.
--   `populateSubtasks` é idempotente (ON CONFLICT DO NOTHING) → não reescreve
--   linhas já populadas; este backfill alinha as proc_instances existentes.
--
-- Idempotente + aditivo (merge `||` a nível de topo; preserva hardcoded/rule_key).
--
-- REVERT (voltar a checklist):
--   update public.proc_subtasks
--     set config = config || jsonb_build_object('type','checklist') - 'moment'
--     where subtask_key in ('neg_cpcv_pagamento','neg_esc_pagamento');

update public.proc_subtasks
set config = config || jsonb_build_object(
  'type','pay_parties',
  'moment','cpcv',
  'hint','A repartição (consultor/rede/agência/parceira) é calculada automaticamente — igual ao mapa de gestão.'
)
where subtask_key = 'neg_cpcv_pagamento';

update public.proc_subtasks
set config = config || jsonb_build_object(
  'type','pay_parties',
  'moment','escritura',
  'hint','A repartição (consultor/rede/agência/parceira) é calculada automaticamente — igual ao mapa de gestão.'
)
where subtask_key = 'neg_esc_pagamento';
