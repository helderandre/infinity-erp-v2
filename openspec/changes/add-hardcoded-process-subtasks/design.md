## Context

O ERP Infinity instancia processos por imóvel via `proc_instances`, com stages e tasks populadas por `populate_process_tasks()` a partir de templates (`tpl_processes` → `tpl_stages` → `tpl_tasks`). Esta estrutura declarativa funciona bem para stages e tasks porque são poucos, estáveis e o seu comportamento é genérico (UPLOAD/EMAIL/GENERATE_DOC/MANUAL basta).

Abaixo das tasks existem **subtarefas** — unidades de trabalho específicas por passo do processo (ex.: "enviar email de pedido de documentação para proprietário singular", "gerar rascunho de CPCV", "validar KYC do proprietário #2"). Tentar modelar isto como `tpl_subtasks` declarativo não está a funcionar: cada subtarefa tem lógica, prompt de AI, template de email e schema de payload distintos. A camada está a travar a entrega do módulo e o cenário de mudança é ~5%.

Stakeholders: consultores (angariação em primeiro plano), broker/CEO (aprovações), gestora processual (acompanha KYC, CPCV), equipa de desenvolvimento (reduzir tempo até entrega). Constraint temporal: é preciso avançar com angariação esta iteração; negócio fica para change seguinte.

## Goals / Non-Goals

**Goals:**
- Substituir a camada declarativa de subtarefas por um **registry em código** com persistência mínima em DB.
- Permitir repetição de subtarefas por proprietário (ex.: KYC por owner) de forma idempotente.
- Preservar tudo o que já funciona: activity log (`proc_task_activities`), emails (`log_emails`), rascunhos de email, geração de documentos, refs `PROC-ANG-*`/`PROC-NEG-*`, stages/tasks declarativos.
- Permitir que `due_date` seja definido dinamicamente à conclusão de um prerequisito, com shift automático para dia útil.
- Suportar retomar de rascunho em erro parcial do populate (sem duplicar linhas).
- Deixar o padrão documentado e pronto para ser replicado em negócio e processos futuros.

**Non-Goals:**
- Não reescrever o template builder (stages/tasks) — continua declarativo.
- Não tocar no trigger `populate_process_tasks()`.
- Não tocar em `log_emails`, `proc_task_comments`, timeline do processo nem no cálculo de `percent_complete`.
- Não suportar processos de negócio, recrutamento ou outros — ficam para changes futuras que reusam este registry.
- Não implementar admin UI para `holidays_pt` — seed via migration, edição manual pontual; admin UI fica para depois se necessário.
- Não implementar feriados municipais — só nacionais.

## Decisions

### 1. `subtask_key` como chave de identidade; `owner_id` mantido

**Decisão:** Adicionar coluna `subtask_key text NOT NULL` a `proc_subtasks` e criar unique index `(proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil))`.

**Alternativas consideradas:**
- Usar `tpl_subtask_id` como chave — rejeitada: fica NULL para subtarefas hardcoded, e `NULL` é distinct por defeito em Postgres, o que partia a dedup.
- Usar `title` como chave — rejeitada: muda quando o texto é editado e perde-se correspondência com o registry de código.
- Usar hash `(proc_task_id, rule_name, rule_input)` — rejeitada: opaco, difícil de debugar, não permite lookup directo do `Component` a partir da linha.

**Porquê esta escolha:** O `subtask_key` é humano-legível (`"email_pedido_doc_singular"`, `"kyc_verification"`), corresponde 1:1 a uma entrada no registry TS, e permite o front-end renderizar a UI correcta via lookup O(1). O `COALESCE(owner_id, uuid_nil)` é um padrão já em produção (ver `contact_automation_lead_settings` no CLAUDE.md bloco `redesign-automation-detail-as-sheet`) e resolve o caso em que a mesma rule se materializa em N linhas (uma por proprietário).

### 2. `is_blocked` não é usado — `due_date` é a variável dinâmica

**Decisão:** Todas as subtarefas hardcoded nascem com `is_blocked=FALSE` e `due_date=NULL`. Quando um prerequisito fecha, `propagateDueDates()` actualiza o `due_date` dos siblings **se ainda não estiverem completos**. Se já estiverem completos, no-op.

**Alternativas consideradas:**
- Usar `is_blocked=TRUE` nas dependentes e desbloquear à conclusão do prerequisito — rejeitada por cenário real: o consultor pode concluir a subtarefa antecipadamente (trabalho feito offline, conferido antes), e "bloqueado" não descreve esse estado. Obrigaria a lógica "desbloquear e simultaneamente marcar como já-feito" que é mais complexa que "só pôr due_date se ainda não feito".

**Porquê esta escolha:** `due_date` é a semântica correcta — "tens 24h a partir deste momento" — e preserva a flexibilidade de o consultor ter já concluído. As colunas `dependency_*`, `unblocked_at` e `is_blocked` ficam na tabela (não dropadas, conforme decisão do stakeholder) para o caso de um dia voltarmos à camada declarativa.

### 3. `dueRule` com formas declarativa e imperativa

**Decisão:** `dueRule` no `SubtaskRule` aceita duas shapes:
```ts
// declarativa (standard, 90% dos casos)
dueRule: { after: "verify_docs", offset: "24h", shiftOnNonBusinessDay: true }

// imperativa (escape hatch)
dueRule: (ctx) => ctx.businessDay(addHours(ctx.prereqCompletedAt, 24))
```

`ctx.businessDay(date)` é um helper injectado que consulta `holidays_pt` e devolve o próximo dia útil (salta Sáb/Dom/feriado).

**Alternativas consideradas:**
- Só declarativa — rejeitada: alguns casos precisam de lógica composta (ex.: "24h depois mas nunca antes das 9h da manhã").
- Só imperativa — rejeitada: perde-se legibilidade e auditoria; regras simples ficam verbosas.

**Porquê esta escolha:** A maioria das regras é simples e beneficia da forma declarativa; o escape imperativo garante que nunca ficamos presos por um caso especial sem custo arquitectural.

### 4. Feriados em tabela DB, não hardcoded em TS

**Decisão:** Criar `holidays_pt(date PK, name text, scope text default 'national')` e seed inicial para ano corrente + 2 anos seguintes. Móveis (Sexta Santa, Corpo de Deus) calculados via fórmula de Páscoa no seed.

**Alternativas consideradas:**
- Hardcode em `lib/processes/subtasks/holidays-pt.ts` — rejeitada a favor de DB para permitir correcções sem deploy e eventual admin UI futura.

**Porquê esta escolha:** Feriados mudam (novos decretados, móveis recalculados), e uma tabela editável evita PRs anuais. Volume é trivial (12-15 linhas/ano). Helper `isBusinessDay(date)` faz um SELECT simples (cacheável em memória por request). Seed re-runnable via `INSERT ... ON CONFLICT DO NOTHING`.

### 5. Populate **sync, não transaccional, idempotente**

**Decisão:** `POST /api/processes/[id]/subtasks/populate-angariacao` corre em resposta ao botão "Criar angariação". Caller espera a resposta (overlay bloqueante + `beforeunload`). Dentro do handler:
- Sem `BEGIN ... COMMIT` envolvente.
- Cada insert usa `ON CONFLICT (proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil)) DO NOTHING`.
- Em erro a meio, as linhas inseridas ficam; o caller grava a angariação como rascunho.
- Retomar a partir do rascunho re-chama o endpoint, que só insere o que falta.

**Alternativas consideradas:**
- Transaccional — rejeitada: força rollback total se falhar numa rule, obriga a re-executar tudo no retry, perde a vantagem do idempotente.
- Assíncrono com job queue — rejeitada: introduz complexidade (estado intermédio, polling/websockets) para volume baixo (~dezenas de linhas, <2s esperado).

**Porquê esta escolha:** Sync + overlay é previsível para o consultor e adequado para o volume. Não-transaccional casa perfeitamente com a unique index — retry nunca duplica, só completa. "Rascunho em erro" reutiliza um padrão existente (angariação já suporta draft).

### 6. `propagateDueDates()` vive no handler de completion, não em trigger SQL

**Decisão:** Quando `POST /api/processes/[id]/subtasks/[subtaskId]/complete` é chamado:
1. UPDATE `proc_subtasks SET status='completed', completed_at, completed_by WHERE id=...`
2. Emite activity `'subtask_completed'` com `metadata: { subtask_key, owner_id, payload }`
3. Chama `propagateDueDates(completedSubtask, registry)`:
   - Para cada rule cuja `dueRule.after === completedSubtask.subtask_key` e cujo sibling (`proc_task_id=X, subtask_key=Y, status != 'completed'`) exista
   - Calcula novo `due_date` via `offset` + `shiftOnNonBusinessDay`
   - UPDATE `proc_subtasks SET due_date=... WHERE id=...`
   - Emite activity `'due_date_set'` com metadata completa

**Alternativas consideradas:**
- Trigger SQL `AFTER UPDATE ON proc_subtasks` — rejeitada: lógica de negócio em SQL é opaca, difícil de testar, e as regras vivem em TS (não seria capaz de ler o registry).

**Porquê esta escolha:** Mantém toda a lógica num único sítio (TS), fácil de testar com unit tests do registry, e permite que a própria função emita activities consistentes.

### 7. 3 novos `activity_type` sem schema novo

**Decisão:** A coluna `proc_task_activities.activity_type` é `text` (não enum), portanto aceita novos valores sem migration. Adicionamos três:
- `subtasks_populated` — emitido no fim do `populate-angariacao` com `metadata: { count, process_type: 'angariacao' }`.
- `subtask_completed` — emitido no `/complete` com `metadata: { subtask_key, owner_id, payload? }`.
- `due_date_set` — emitido por cada sibling actualizado em `propagateDueDates()` com `metadata: { subtask_key, previous_due_date, new_due_date, triggered_by: { subtask_id, subtask_key }, shifted_from_non_business_day: bool }`.

O front-end deve reconhecer estes tipos em `TASK_ACTIVITY_TYPE_CONFIG` (ícones/cores/labels). `due_date_set` deve ficar escondido por defeito com toggle "Mostrar eventos do sistema" para não poluir a timeline.

**Porquê esta escolha:** Zero schema overhead; reutiliza a infra de auditoria; preserva o valor principal do sistema de activity log (nota do stakeholder: *"esse armazenamento das atividades é uma coisa muito fixe que precisamos continuar"*).

### 8. Registry + API só para angariação nesta change

**Decisão:** A API chama-se explicitamente `populate-angariacao` (não `populate-generic`), e só é invocada no botão "Criar angariação". Negócio terá a sua própria API (`populate-negocio`) numa change futura, por ter variáveis de fase/visualização que angariação não tem.

**Alternativas consideradas:**
- API genérica `populate/[processType]` — rejeitada: a diferença entre angariação e negócio ao nível do que é instanciado (loop por proprietário em angariação, loop por fase em negócio) é grande o suficiente para justificar handlers separados.

**Porquê esta escolha:** Evita abstracção prematura; força que cada novo tipo de processo escreva o seu próprio handler simples, com o padrão documentado em `docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md` para orientação. O registry (em `lib/processes/subtasks/`) é partilhado; o que muda é o caller.

### 9. Backfill via script one-off, não trigger automático

**Decisão:** Script manual `scripts/backfill-angariacao-subtasks.ts`, corrido 1× após deploy. Itera `proc_instances WHERE tpl_process_id IS NOT NULL AND current_status != 'completed' AND external_ref LIKE 'PROC-ANG-%'` e chama `populate-angariacao` para cada.

**Porquê esta escolha:** Scope controlado, observável no terminal, fácil de parar/retomar. Processos concluídos ficam intactos (decisão do stakeholder). Novos processos (criados depois do deploy) são populados no fluxo normal do botão "Criar angariação".

## Risks / Trade-offs

- **[Risk] Rule existente no registry é renomeada.** Processos em curso ficam com `subtask_key` órfão (não encontra no registry) → front-end não sabe que componente renderizar. → **Mitigation:** Regra: `subtask_key` é imutável depois de publicada em produção. Migração deve usar `ALTER TABLE` com `UPDATE proc_subtasks SET subtask_key='novo' WHERE subtask_key='antigo'` para renames. Adicionar check no CI que falha se um key do registry desaparecer sem migration correspondente (fica para trabalho futuro).

- **[Risk] `propagateDueDates()` falha a meio (UPDATE de um sibling dá erro).** Alguns siblings recebem `due_date`, outros não. → **Mitigation:** Cada UPDATE corre isoladamente com `try/catch` e log de erro; a conclusão da subtarefa principal não é revertida. O consultor vê a subtarefa como concluída e pode manualmente definir o due_date nos restantes. `proc_task_activities` guarda o estado exacto de que siblings foram actualizados, permitindo diagnóstico.

- **[Risk] Feriado novo decretado no meio do ano.** Tabela `holidays_pt` fica desactualizada e `due_date` cai num feriado não-declarado. → **Mitigation:** Adicionar linha manualmente em `holidays_pt` (trivial). Impacto é cosmético — o due_date fica para um feriado, mas não bloqueia o trabalho.

- **[Risk] Populate sync demora >5s em processos com muitos proprietários.** Overlay fica parado, consultor desiste. → **Mitigation:** Volume esperado é <50 linhas por angariação (tasks × owners × rules); <2s confortável. Se empiricamente exceder, migrar para async com job é trade-off futuro (não feito agora).

- **[Trade-off] Registry em TS significa que novas regras exigem deploy.** Perde-se a capacidade de adicionar subtarefas sem code release. → **Aceite:** cenário de mudança é ~5% (confirmado pelo stakeholder). Ganho em UX rica, type-safety e AI específica por passo compensa.

- **[Trade-off] `dependency_*` e `unblocked_at` ficam unused nesta camada.** Consome espaço/colunas. → **Aceite:** são NULL e zero custo; ficam disponíveis se um dia voltarmos à camada declarativa para outros processos.

## Migration Plan

1. **Migration SQL aplicada** (um único ficheiro em `supabase/migrations/<YYYYMMDD>_proc_subtasks_hardcoded.sql`):
   - `ALTER TABLE proc_subtasks ADD COLUMN subtask_key text` (nullable no início, para permitir backfill).
   - Backfill de `subtask_key` para linhas pré-existentes de `proc_subtasks` (se houver): deduzir a partir de `tpl_subtask_id` + `tpl_subtasks.name`, ou marcar como `'legacy_<uuid>'` se ambíguo. Depois `ALTER COLUMN SET NOT NULL`.
   - `CREATE UNIQUE INDEX CONCURRENTLY proc_subtasks_dedup ON proc_subtasks (proc_task_id, subtask_key, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid))`.
   - `CREATE TABLE holidays_pt` com seed para ano corrente + 2 seguintes.

2. **Deploy código** (registry, APIs, UI overlay, timeline tipo novo).

3. **Run-book manual:** executar `pnpm tsx scripts/backfill-angariacao-subtasks.ts` apontando para produção. Script é idempotente; pode correr-se várias vezes sem risco.

4. **Smoke test:** criar uma nova angariação via UI, verificar que as subtarefas aparecem na task correcta e que concluir uma com prerequisito actualiza `due_date` do sibling.

**Rollback:**
- Reverter deploy de código (as APIs novas desaparecem).
- Se necessário dropar schema: `DROP TABLE holidays_pt; DROP INDEX proc_subtasks_dedup; ALTER TABLE proc_subtasks DROP COLUMN subtask_key;`. As outras colunas de `proc_subtasks` não foram tocadas.
- Subtarefas criadas pelo populate ficam a 1 linha só se não forem dropadas — podem ser apagadas via `DELETE FROM proc_subtasks WHERE tpl_subtask_id IS NULL AND subtask_key IS NOT NULL` (seguro porque nenhuma subtarefa legacy tem ambas estas condições).

## Open Questions

Nenhuma bloqueante à entrada desta change. Itens deixados explicitamente para trabalho futuro:

- **Admin UI para `holidays_pt`** — só se a edição manual via SQL se tornar dolorosa.
- **CI check de `subtask_key` imutável** — adicionar um test que compara o registry entre branches/tags para detectar renames acidentais.
- **Re-sync automático** — forma de re-correr o populate num processo em curso quando uma nova rule é adicionada ao registry (hoje só afecta processos criados depois). Provavelmente uma action admin "Re-sincronizar subtarefas".
- **Negócio (PROC-NEG)** — change separada, reusará o registry e o padrão documentado.

---

## Referência externa

Base de conhecimento para replicar este padrão em processos futuros:
[`docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md`](../../../docs/M06-PROCESSOS/PATTERN-HARDCODED-SUBTASKS.md) — cookbook com contrato `SubtaskRule`, padrões das APIs populate/complete, propagação, activity log, backfill e checklist de migração.
