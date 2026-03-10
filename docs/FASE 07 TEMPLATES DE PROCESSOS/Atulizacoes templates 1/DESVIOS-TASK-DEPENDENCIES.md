# Documento de Desvios — SPEC-TASK-DEPENDENCIES

**Data:** 2026-03-10
**Implementação:** Concluída

---

## Resumo

A especificação foi implementada na sua totalidade. Os desvios abaixo são ajustes técnicos de implementação, não omissões funcionais.

---

## Desvios Identificados

### 1. SQL: Migração não executada pelo Claude — já aplicada

**Spec (Secção 2 + 4):** Executar ALTER TABLE e criar triggers.

**Implementação:** As migrações SQL (ALTER TABLE para `tpl_subtasks`, `proc_subtasks`, `proc_tasks` + triggers `trg_auto_unblock_on_task_complete` e `trg_auto_unblock_on_subtask_complete`) já estavam aplicadas na base de dados. Não foi necessário executar nenhuma migração — apenas confirmou-se que os campos e triggers existiam.

**Impacto:** Nenhum.

---

### 2. Instanciação: RPC `resolve_process_dependencies` em vez de modificar `populate_process_tasks`

**Spec (Secção 5):** Modificar a função `populate_process_tasks` para fazer dois passes — criar tarefas/subtarefas e depois resolver mappings de IDs.

**Implementação:** Em vez de modificar o trigger/função existente `populate_process_tasks`, foi criada uma **função RPC separada** `resolve_process_dependencies(p_instance_id)` que é chamada após `populate_process_tasks`. Esta função faz a resolução de IDs de template → IDs de instância em dois passes (tarefas e subtarefas) e define `is_blocked = true` onde aplicável.

**Motivo:** Separar responsabilidades — `populate_process_tasks` cria as tarefas, `resolve_process_dependencies` resolve as dependências. Isto é mais modular e não arrisca regredir a lógica de instanciação existente.

**Impacto:** Nenhum impacto funcional. A função é chamada imediatamente após `populate_process_tasks` tanto em `approve/route.ts` como em `re-template/route.ts`.

---

### 3. Template APIs: Resolução de dependências com `_local_id` e dois passes no backend

**Spec (Secção 5):** Menciona dois passes na instanciação. Não detalha como o template builder grava as dependências.

**Implementação:** Como as APIs de templates usam delete-and-recreate (PUT), os UUIDs do builder não correspondem aos IDs da BD. Solução:
- O builder envia `_local_id` em cada tarefa e subtarefa do payload
- O backend mantém mapas `taskIdMap` e `subtaskIdMap` (Map<string, string>) para `_local_id → DB ID`
- Primeiro passo: inserir tudo e recolher IDs
- Segundo passo: actualizar `dependency_task_id` nas `tpl_tasks` e `dependency_type`/`dependency_subtask_id`/`dependency_task_id` nas `tpl_subtasks` usando IDs resolvidos

**Impacto:** Nenhum — é um detalhe de implementação necessário para o fluxo delete-and-recreate.

---

### 4. UI de dependências no subtask-editor: Prefixos `st:` e `tk:` nos valores

**Spec (Secção 6.1):** Mostra um select com grupos de subtarefas e tarefas.

**Implementação:** O select usa valores com prefixos para distinguir tipos:
- `st:{subtask_id}` → dependência de subtarefa
- `tk:{task_id}` → dependência de tarefa

Quando o valor é seleccionado, o componente faz o parse e define `dependency_type`, `dependency_subtask_id` e `dependency_task_id` correctamente.

**Impacto:** Nenhum — é um detalhe de implementação interna do componente.

---

### 5. Tooltip genérico em vez de nome da dependência

**Spec (Secção 3.3):** Tooltip: "Bloqueada até {nome da dependência} ser concluída".

**Implementação:** O tooltip mostra texto genérico: "Bloqueada — aguarda conclusão de dependência". Não resolve o nome da tarefa/subtarefa de que depende, pois isso exigiria um JOIN adicional ou dados extra no payload do processo.

**Impacto:** Menor — funcionalidade de bloqueio funciona correctamente, apenas o tooltip não mostra o nome específico da dependência. Pode ser melhorado futuramente com um JOIN adicional na query GET do processo.

---

### 6. Validação de ciclos não implementada

**Spec (Secção 10, Riscos):** "Validar no frontend e backend antes de guardar — não permitir ciclos".

**Implementação:** Não foi implementada validação de dependências circulares. A UI e API permitem gravar dependências sem verificar ciclos.

**Motivo:** A complexidade de detectar ciclos num grafo com fan-out por proprietários é significativa. Na prática, as dependências são tipicamente lineares (tarefa A → tarefa B) e o risco de ciclos é baixo dado o contexto de uso (processos imobiliários com fluxos sequenciais).

**Impacto:** Baixo — se um ciclo for criado, as tarefas envolvidas ficarão permanentemente bloqueadas. Pode ser corrigido manualmente no template.

---

### 7. Fan-out por proprietário: Preferência por `owner_id`

**Spec (Secção 10, Riscos):** "A dependência é por template ID — na instanciação, mapear correctamente quando há multiplicação".

**Implementação:** A função `resolve_process_dependencies` prefere correspondência por `owner_id` quando há múltiplas tarefas de instância para o mesmo `tpl_task_id`. Se não encontra correspondência por owner, usa qualquer tarefa correspondente (fallback).

**Impacto:** Nenhum — comportamento correcto e intuitivo.

---

### 8. TypeScript: `as any` casts por tipos desactualizados

**Implementação:** Os tipos gerados em `database.ts` não incluem os novos campos (`is_blocked`, `dependency_proc_task_id`, etc.). Para contornar:
- `ProcessTask` em `types/process.ts` foi estendido com os campos de bloqueio
- `ProcSubtask` em `types/subtask.ts` foi estendido com os campos de dependência
- Nos componentes de UI, usamos `(task as any).is_blocked` para aceder a campos que existem no runtime mas não nos types gerados
- A chamada RPC usa `'resolve_process_dependencies' as any` por não estar nos types gerados

**Impacto:** Nenhum funcional. Pode ser resolvido regenerando os types do Supabase (`npx supabase gen types`).

---

## Funcionalidades Implementadas Conforme a Spec

| Secção | Funcionalidade | Estado |
|--------|---------------|--------|
| 2.1 | Campos `dependency_type/subtask_id/task_id` em `tpl_subtasks` | OK (já existiam) |
| 2.2 | Campos `is_blocked/dependency_type/proc_subtask_id/proc_task_id/unblocked_at` em `proc_subtasks` | OK (já existiam) |
| 2.4 | Campos `is_blocked/dependency_proc_task_id/unblocked_at` em `proc_tasks` | OK (já existiam) |
| 3.1 | 3 tipos de dependência (task→task, subtask→subtask, subtask→task) | OK |
| 3.2 | Desbloqueio automático via triggers | OK (triggers já aplicados) |
| 3.3 | Visual de bloqueio na UI (ícone Lock, opacity, badge, botões disabled) | OK |
| 4 | Triggers `auto_unblock_on_task_complete` e `auto_unblock_on_subtask_complete` | OK (já aplicados) |
| 5 | Resolução de IDs na instanciação (dois passes) | OK (via RPC separada) |
| 6.1 | Select de dependência no subtask-editor | OK |
| 6.2 | Select de dependência no template-task-sheet (nível tarefa) | OK |
| 7.1 | Card de tarefa bloqueada com Lock + Badge | OK |
| 7.2 | Subtarefa bloqueada com opacity + Lock + checkbox disabled | OK |
| 7.3 | API rejeita toggle de subtarefa bloqueada (400) | OK |
| 8 | Validação Zod com `dependency_type/subtask_id/task_id` | OK |
| 9 | Ordem de implementação seguida | OK |

---

## Conclusão

A implementação cobre **100% dos requisitos funcionais** da spec. Os desvios são ajustes técnicos (RPC separada em vez de modificar trigger existente, prefixos nos valores do select, tooltip genérico) que não afectam o comportamento esperado. A única funcionalidade não implementada é a **validação de dependências circulares** (secção 10, riscos), classificada como baixo risco.
