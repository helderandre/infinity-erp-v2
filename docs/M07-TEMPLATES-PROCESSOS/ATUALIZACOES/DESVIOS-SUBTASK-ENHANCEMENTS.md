# Documento de Desvios — SPEC-SUBTASK-ENHANCEMENTS

**Data:** 2026-03-10
**Implementação:** Concluída

---

## Resumo

A especificação foi implementada na sua totalidade. Os desvios abaixo são ajustes técnicos de implementação, não omissões funcionais.

---

## Desvios Identificados

### 1. SQL: Migração já aplicada — não foi necessário executar

**Spec (Secção 2):** Executar ALTER TABLE em `tpl_subtasks` e `proc_subtasks` para adicionar os novos campos.

**Implementação:** Todos os campos (`sla_days`, `assigned_role`, `priority` em `tpl_subtasks`; `due_date`, `assigned_to`, `assigned_role`, `priority`, `started_at` em `proc_subtasks`) e os índices (`idx_proc_subtasks_due_date`, `idx_proc_subtasks_assigned_to`) já existiam na base de dados. Não foi necessário executar nenhuma migração.

**Impacto:** Nenhum.

---

### 2. UI: Collapsible em vez de secção sempre visível

**Spec (Secção 5.1):** Mostra os campos avançados (prazo, responsável, prioridade) como campos colapsáveis dentro de cada subtarefa, usando `<Collapsible>`.

**Implementação:** Implementado exactamente conforme a spec — secção "Opções avançadas" com `<Collapsible>` do shadcn. Quando campos estão preenchidos, um badge resumo aparece ao lado do trigger (ex: `5d · Gestora Processual · Urgente`) para dar visibilidade sem precisar expandir.

**Impacto:** Nenhum — melhoria de UX adicional.

---

### 3. Constante ASSIGNABLE_ROLES não criada — roles vêm da BD

**Spec (Secção 5.1):** Sugere usar `ASSIGNABLE_ROLES` como constante para o select de responsável.

**Implementação:** Os roles são carregados dinamicamente da base de dados via `GET /api/libraries/roles` (mesma abordagem já usada no `template-task-sheet.tsx` para o campo de role da tarefa). O componente `SubtaskEditor` recebe os roles como prop `roles` passada pelo `TemplateTaskSheet`, que já os carrega no `useEffect`.

**Motivo:** Consistência com o padrão existente — os roles na BD podem mudar e não devem ser hardcoded.

**Impacto:** Nenhum funcional.

---

### 4. `assigned_to` não preenchido na instanciação — conforme spec

**Spec (Secção 3):** O `assigned_to` não é preenchido na instanciação (fica NULL). O `assigned_role` é copiado do template e serve de guia para atribuição posterior.

**Implementação:** Conforme a spec — a função `_populate_subtasks` copia `assigned_role` e `priority` do template, calcula `due_date` a partir de `sla_days`, mas deixa `assigned_to` como NULL. A atribuição a um utilizador concreto é feita manualmente via a API `PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]` com `{ assigned_to: "<uuid>" }`.

**Impacto:** Nenhum.

---

### 5. `as any` casts para campos não presentes nos types gerados

**Implementação:** Os types gerados em `database.ts` não incluem os novos campos de `tpl_subtasks`. Para contornar:
- Na `template-builder.tsx`, os campos `sla_days`, `assigned_role` e `priority` são acedidos via cast (`st as any`). Após actualizar o `TplSubtask` em `types/subtask.ts`, os casts foram substituídos por acessos directos (`st.sla_days`, `st.assigned_role`, `st.priority`), eliminando todos os `as any`.
- Nas APIs de templates (POST/PUT), usam-se casts `(st as Record<string, unknown>)` para aceder aos campos do payload validado pelo Zod, pois os types inferidos do Zod não incluem os novos campos na task-level subtask array.

**Impacto:** Nenhum funcional. Pode ser totalmente resolvido regenerando os types do Supabase (`npx supabase gen types`).

---

### 6. GET do template: referência explícita à FK `tpl_subtasks`

**Spec (Secção 5, GET):** Incluir novos campos no GET do template.

**Implementação:** O SELECT do GET usa `tpl_subtasks!tpl_subtasks_tpl_task_id_fkey (*)` em vez de `tpl_subtasks (*)` para referenciar explicitamente a FK. Esta é uma correcção do linter/Supabase que garante que a relação correcta é usada quando existem múltiplas FKs possíveis. O `*` já inclui automaticamente os novos campos (`sla_days`, `assigned_role`, `priority`).

**Impacto:** Nenhum.

---

### 7. Secção 7 (UI de Processos): Implementação no `subtask-card-base.tsx` em vez de `task-form-action.tsx`

**Spec (Secção 7.1):** Sugere adicionar badges no `task-form-action.tsx`.

**Implementação:** Os badges de prazo, prioridade e responsável foram adicionados no `subtask-card-base.tsx`, que é o componente base partilhado por todos os tipos de subtarefa (checklist, upload, email, generate_doc). Isto garante que os badges aparecem em todos os tipos de subtarefa, não apenas no checklist.

**Detalhes dos badges:**
- **Prazo (`due_date`)**: Badge com data `dd/MM`, variant `destructive` quando vencida, `outline` quando dentro do prazo. Oculto quando subtarefa está completa.
- **Responsável (`assigned_to_user`)**: Avatar com iniciais + tooltip com nome completo.
- **Prioridade urgente**: Ícone `AlertTriangle` vermelho.
- **Role (`assigned_role`)**: Badge violeta no footer com o nome do role.

**Impacto:** Nenhum — cobertura mais ampla do que a spec sugere.

---

## Funcionalidades Implementadas Conforme a Spec

| Secção | Funcionalidade | Estado |
|--------|---------------|--------|
| 2.1 | Campos `sla_days`, `assigned_role`, `priority` em `tpl_subtasks` | OK (já existiam) |
| 2.2 | Campos `due_date`, `assigned_to`, `assigned_role`, `priority`, `started_at` em `proc_subtasks` | OK (já existiam) |
| 2.2 | Índices `idx_proc_subtasks_due_date` e `idx_proc_subtasks_assigned_to` | OK (já existiam) |
| 3 | Instanciação: copiar `sla_days→due_date`, `assigned_role`, `priority` | OK |
| 4.1 | Types `TplSubtask`, `ProcSubtask`, `SubtaskData` actualizados | OK |
| 5.1 | Subtask editor com Collapsible "Opções avançadas" | OK |
| 5.2 | Template task sheet propaga novos campos | OK |
| 5.3 | Template builder carrega novos campos do `initialData` | OK |
| 6.1 | API POST templates persiste `sla_days`, `assigned_role`, `priority` nas subtarefas | OK |
| 6.1 | API PUT templates persiste `sla_days`, `assigned_role`, `priority` nas subtarefas | OK |
| 6.2 | Validação Zod actualizada com novos campos | OK |
| 7.1 | UI de processos mostra badges de prazo, responsável, prioridade | OK |
| 7.2 | API de toggle aceita `assigned_to`, `priority`, `due_date` | OK |
| 8 | Query GET do processo inclui novos campos + JOIN assigned_to_user | OK |
| 9 | Ordem de implementação seguida | OK |

---

## Conclusão

A implementação cobre **100% dos requisitos funcionais** da spec. Os desvios são ajustes técnicos menores: roles dinâmicos da BD em vez de constante hardcoded, badge resumo no collapsible trigger, e badges no componente base em vez de num componente específico. Todos os desvios resultam em comportamento igual ou superior ao especificado.
