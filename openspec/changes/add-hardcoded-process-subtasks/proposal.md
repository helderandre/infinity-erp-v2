## Why

O módulo de processos tem uma camada de subtarefas declarativa (`tpl_subtasks`) que na prática está a travar a entrega: cada subtarefa tem comportamento único (envio de email específico, geração de PDF específico, validação de KYC por proprietário, etc.) e o cenário de mudança no negócio é ~5%, o que torna o custo de manter tudo como dados muito superior ao ganho. Stages e tasks funcionam bem como estrutura declarativa e devem permanecer; a fronteira entre "declarativo (DB)" e "imperativo (código)" deve mover-se apenas para a camada das subtarefas.

## What Changes

- Adicionar coluna `subtask_key` a `proc_subtasks` e unique index `(proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil))` para permitir idempotência com repetição por proprietário.
- Criar tabela `holidays_pt(date, name, scope)` com seed de 3 anos (nacionais fixos + móveis derivados da Páscoa).
- Introduzir um registry em código — `lib/processes/subtasks/` — com o contrato `SubtaskRule` (key, taskKind, repeatPerOwner, titleBuilder, dueRule, Component, complete).
- Adicionar API `POST /api/processes/[id]/subtasks/populate-angariacao` — chamada sync pelo botão "Criar angariação", idempotente via `ON CONFLICT DO NOTHING`, sem rollback transaccional.
- Adicionar API `POST /api/processes/[id]/subtasks/[subtaskId]/complete` — fecha a subtarefa, emite activity `'subtask_completed'`, propaga `due_date` para siblings via `propagateDueDates()` com shift de dias não-úteis.
- Introduzir três novos `activity_type` em `proc_task_activities`: `subtasks_populated`, `subtask_completed`, `due_date_set` (sem schema novo — a coluna `activity_type` é text).
- UI: overlay bloqueante com spinner durante o populate, `beforeunload` listener para evitar abandono, toast de erro com criação de rascunho (reutiliza o fluxo de rascunho existente), toggle "mostrar eventos do sistema" na timeline para esconder `due_date_set` por defeito.
- Backfill script `scripts/backfill-angariacao-subtasks.ts` para processos PROC-ANG em curso (concluídos são intocados, novos são populados na criação).

**Out of scope** nesta change: processos de negócio (PROC-NEG), recrutamento e outros processos futuros — recebem a sua própria change quando forem abordados, reusando o registry e o padrão documentado.

## Capabilities

### New Capabilities
- `subtasks-runtime`: infraestrutura genérica para subtarefas hardcoded — contrato `SubtaskRule`, registry em código, APIs populate/complete, propagação de `due_date`, tabela `holidays_pt`, novos `activity_type`. Reutilizável por qualquer tipo de processo.
- `subtasks-angariacao`: primeiro domínio concreto — lista de rules de angariação, integração UI no botão "Criar angariação", backfill dos processos em curso.

### Modified Capabilities
- Nenhuma. Esta change não toca em requisitos de capabilities existentes; `proc_subtasks` mantém todas as colunas actuais (apenas adiciona `subtask_key` e ajusta semântica de uso para subtarefas hardcoded).

## Impact

- **Schema DB**: 1 ALTER + 1 CREATE INDEX em `proc_subtasks`, 1 CREATE TABLE `holidays_pt` + seed. Aditivo e reversível. Nenhuma coluna removida.
- **Código novo**: pasta `lib/processes/subtasks/` (registry + types + business-days + rules/angariacao/*), 2 route handlers em `app/api/processes/[id]/subtasks/`, hook `useCreateAngariacao()` actualizado, componente `<PopulatingSubtasksOverlay>`, actualização da timeline para reconhecer `due_date_set`/`subtask_completed`/`subtasks_populated`.
- **Scripts**: `scripts/backfill-angariacao-subtasks.ts` (run-book manual, 1× após deploy).
- **Documentação**: separadamente à change, será criado `docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md` como base de conhecimento reutilizável para replicar o padrão em processos futuros (negócio, recrutamento, etc.). Este doc vive fora do ciclo OpenSpec.
- **Sem impacto**: template builder (`tpl_processes`/`tpl_stages`/`tpl_tasks`), triggers existentes (`populate_process_tasks`, `generate_proc_ref`), APIs de tarefas (`PUT /api/processes/[id]/tasks/[taskId]`), timeline do processo, `log_emails`, `proc_task_comments`, cálculo de `percent_complete`.
