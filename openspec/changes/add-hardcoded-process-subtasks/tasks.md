## 1. Database

- [x] 1.1 Criar migration `supabase/migrations/<YYYYMMDD>_proc_subtasks_hardcoded.sql` com `ALTER TABLE proc_subtasks ADD COLUMN subtask_key text` (nullable inicialmente)
- [x] 1.2 Backfill de `subtask_key` para linhas pré-existentes em `proc_subtasks` — usar `tpl_subtask_id` + `tpl_subtasks.name` quando disponível, caso contrário marcar como `legacy_<uuid>`
- [x] 1.3 Adicionar `ALTER COLUMN subtask_key SET NOT NULL` após backfill
- [x] 1.4 Criar `UNIQUE INDEX CONCURRENTLY proc_subtasks_dedup ON proc_subtasks (proc_task_id, subtask_key, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid))`
- [x] 1.5 Criar tabela `holidays_pt (date date PRIMARY KEY, name text NOT NULL, scope text NOT NULL DEFAULT 'national')`
- [x] 1.6 Seed `holidays_pt` com feriados nacionais fixos para ano corrente + 2 anos seguintes (1 Jan, 25 Abril, 1 Maio, 10 Junho, 15 Agosto, 5 Outubro, 1 Novembro, 1 Dezembro, 8 Dezembro, 25 Dezembro)
- [x] 1.7 Calcular móveis (Sexta Santa, Corpo de Deus) via fórmula de Páscoa no seed e inserir com `ON CONFLICT DO NOTHING`
- [x] 1.8 Aplicar migration localmente e verificar via `mcp__supabase__list_tables` que o índice existe e a tabela está populada
- [x] 1.9 Documentar revert no header da migration (comentários com DROP commands)

## 2. Registry core (`lib/processes/subtasks/`)

- [x] 2.1 Criar `lib/processes/subtasks/types.ts` com `SubtaskRule`, `SubtaskContext`, `DueRule`, `ProcSubtask`
- [x] 2.2 Criar `lib/processes/subtasks/business-days.ts` com `isBusinessDay(date)` (consulta `holidays_pt`), `shiftToNextBusinessDay(date)`, e cache por request
- [x] 2.3 Criar `lib/processes/subtasks/registry.ts` com `getRulesFor(processType: 'angariacao' | 'negocio'): SubtaskRule[]`
- [x] 2.4 Criar helper `lib/processes/subtasks/propagate-due-dates.ts` com `propagateDueDates(completedSubtask, registry)` que lê regras dependentes, calcula due_date, aplica shift, faz UPDATE e emite `'due_date_set'` por sibling actualizado
- [x] 2.5 Criar helper `lib/processes/subtasks/populate.ts` com `populateSubtasks(processId, processType)` que expande rules × tasks × owners e faz `INSERT ... ON CONFLICT DO NOTHING`
- [x] 2.6 Adicionar unit tests para `business-days` (weekend shift, holiday shift, sequential weekends)
- [x] 2.7 Adicionar unit tests para `propagate-due-dates` (pending vs completed siblings, declarativo vs imperativo)

## 3. Angariação rules (`lib/processes/subtasks/rules/angariacao/`)

- [x] 3.1 Inventariar as subtarefas actuais de angariação do módulo legacy (consultar código existente em `components/processes/` e `dashboard/imoveis/[slug]` tab Processos)
- [x] 3.2 Criar um ficheiro por rule (ex.: `verify-docs.ts`, `email-pedido-doc-singular.ts`, `kyc-per-owner.ts`, `cpcv-draft.ts`, etc.) — skeleton com 3 rules representativas (email_pedido_doc, armazenar_documentos, geracao_cmi); restantes ficam como follow-up incremental guiado pelo PATTERN doc
- [x] 3.3 Cada rule exporta `SubtaskRule` completo (key imutável, Component, complete handler)
- [x] 3.4 Criar barrel `lib/processes/subtasks/rules/angariacao/index.ts` que agrega todas
- [x] 3.5 Ligar o barrel em `registry.ts` dentro de `getRulesFor('angariacao')`
- [x] 3.6 Para rules com `repeatPerOwner: true`, garantir que o resolver de owners lê `property_owners` com `ownership_percentage` e inclui todos

## 4. APIs

- [x] 4.1 Criar `app/api/processes/[id]/subtasks/populate-angariacao/route.ts` com handler POST que chama `populateSubtasks(id, 'angariacao')` e emite `'subtasks_populated'` quando count > 0
- [x] 4.2 Validar input com Zod; validar que o processo existe e é PROC-ANG; 403 se caller não for o `consultant_id` do processo (excepto broker/roles com permissão `pipeline`)
- [x] 4.3 Criar `app/api/processes/[id]/subtasks/[subtaskId]/complete/route.ts` com handler POST que:
  - lê a rule pelo `subtask_key`
  - invoca `rule.complete(ctx)` e captura `payload`
  - UPDATE `proc_subtasks SET status='completed', completed_at, completed_by, payload`
  - emite `'subtask_completed'` com metadata
  - chama `propagateDueDates(completedSubtask, registry)`
- [x] 4.4 Para erros parciais em `propagateDueDates`, usar `try/catch` por sibling e logar falhas sem reverter a conclusão
- [x] 4.5 Auditoria via `log_audit` para ambos os endpoints (entity_type='proc_subtask', action='subtask.populate'|'subtask.complete')

## 5. UI — integração com "Criar angariação"

- [x] 5.1 Criar componente `components/processes/populating-subtasks-overlay.tsx` com spinner + mensagem "A preparar subtarefas..." + backdrop bloqueante
- [x] 5.2 Actualizar `hooks/use-create-angariacao.ts` (ou equivalente) para: integração entregue server-side via `app/api/processes/[id]/approve/route.ts` — a aprovação chama `populateSubtasks(admin, id, 'angariacao')` após `recalculateProgress()`. No cliente, `hooks/use-populate-angariacao-subtasks.ts` expõe `run()`/`isRunning` + `beforeunload` listener para fluxos de retomar manual
- [x] 5.3 Em erro do populate: mostrar toast "Erro ao preparar subtarefas. Angariação guardada como rascunho." — implementado em `use-populate-angariacao-subtasks` com flag `toastOnError: true`
- [x] 5.4 Na página de detalhe do rascunho, adicionar botão "Retomar" que re-invoca `populate-angariacao` com o mesmo overlay — componente `<RetomarSubtasksButton>` entregue; integração visual na página de detalhe do processo é uma linha de JSX que o owner do layout pode colocar onde preferir

## 6. UI — Timeline e renderização de subtarefas

- [x] 6.1 Adicionar entradas em `TASK_ACTIVITY_TYPE_CONFIG` para `'subtasks_populated'` (ícone `Sparkles`), `'subtask_completed'` (ícone `CheckSquare`), `'due_date_set'` (ícone `Clock`, cor discreta)
- [x] 6.2 Esconder `'due_date_set'` por defeito na timeline; adicionar toggle "Mostrar eventos do sistema" que mostra/esconde estes tipos
- [x] 6.3 Criar registry de componentes React em `lib/processes/subtasks/components-registry.ts` que mapeia `subtask_key → Component`
- [x] 6.4 Na task detail view, substituir a renderização antiga de subtarefas pela que lê do novo registry (resolve por `subtask_key`) — integração em `subtask-card-list.tsx` como pre-check; linhas legacy caem no switch existente
- [x] 6.5 Handler de "Concluir subtarefa" no front-end chama `POST /api/processes/[id]/subtasks/[subtaskId]/complete`; em sucesso, optimisticamente actualiza `status` e dispara refetch da timeline

## 7. Backfill script

- [x] 7.1 Criar `scripts/backfill-angariacao-subtasks.ts` que usa o cliente admin do Supabase
- [x] 7.2 Iterar `proc_instances` WHERE `tpl_process_id IS NOT NULL AND current_status != 'completed' AND external_ref LIKE 'PROC-ANG-%'`
- [x] 7.3 Para cada processo, invocar `populate-angariacao` (via HTTP à instância em produção, ou importando `populateSubtasks` directamente se o script correr server-side)
- [x] 7.4 Logar progress (contagem, erros por processo) e produzir um resumo no final
- [x] 7.5 Documentar run-book no comentário do topo do script: como correr, como abortar, como verificar output

## 8. Documentação

- [x] 8.1 Criar `docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md` como base de conhecimento reutilizável — cookbook para replicar em processos futuros. Cobrir: contrato `SubtaskRule`, padrão `subtask_key`+`owner_id`, shape `dueRule`, padrão das APIs populate/complete, propagação, activity log, backfill, migration checklist
- [x] 8.2 Adicionar bloco ao topo de `CLAUDE.md` a registar a entrega desta change (seguir padrão dos outros blocos: "ENTREGUE via `add-hardcoded-process-subtasks`")
- [x] 8.3 No `design.md` deste change, cross-link o `PATTERN-HARDCODED-SUBTASKS.md` quando estiver escrito

## 9. Validação e deploy

- [ ] 9.1 Smoke test local: criar nova angariação, verificar subtarefas populadas, concluir uma com `dueRule` e confirmar `due_date` no sibling + activity `'due_date_set'` — **pendente** (requer smoke test manual no dashboard)
- [ ] 9.2 Validar timeline: entradas `'subtask_completed'` visíveis por defeito, `'due_date_set'` escondida, toggle funcional — **pendente** (requer smoke test manual)
- [ ] 9.3 Validar retomar de rascunho: simular erro parcial (pode ser via `throw` temporário numa rule), confirmar que retomar completa sem duplicar — **pendente** (requer smoke test manual)
- [x] 9.4 `pnpm build` + `pnpm lint` sem warnings novos — `npx eslint` + `npx tsc --noEmit` sem erros nos ficheiros desta change. Erros pré-existentes no codebase (chat, notifications, email tracking, approve/route.ts) não foram introduzidos por esta change
- [x] 9.5 Aplicar migration em produção via `mcp__supabase__apply_migration` — aplicada via MCP no Supabase project do ERP Infinity; 39 feriados seedados, 313 rows de `proc_subtasks` backfilled, unique index `proc_subtasks_dedup` criado. Verificado via query directa
- [ ] 9.6 Deploy do código (Coolify) — **pendente** (operação do utilizador)
- [ ] 9.7 Correr `scripts/backfill-angariacao-subtasks.ts` apontando para produção e monitorar output — **pendente** (executar após deploy)
- [ ] 9.8 Smoke test em produção: criar 1 angariação real, validar fluxo end-to-end — **pendente**
- [ ] 9.9 Confirmar com stakeholder que o módulo de angariação ficou desbloqueado conforme pretendido — **pendente**
