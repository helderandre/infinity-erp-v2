# Documentação Obsoleta — M06 e M07

**Data da auditoria:** 2026-03-16

Este documento classifica cada ficheiro de documentação existente em `docs/M06-PROCESSOS/` e `docs/M07-TEMPLATES-PROCESSOS/` quanto à sua relevância actual.

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ ACTUAL | Conteúdo reflecte a implementação real |
| ⚠️ PARCIAL | Partes do conteúdo estão correctas, outras obsoletas |
| ❌ OBSOLETO | Conteúdo não corresponde à implementação — pode induzir em erro |
| 📜 HISTÓRICO | Documento tem valor histórico mas não deve ser usado como referência técnica |

---

## docs/M06-PROCESSOS/

| # | Ficheiro | Estado | Razão |
|---|----------|:---:|-------|
| 1 | `PRD-M06-PROCESSOS.md` | ⚠️ PARCIAL | Descreve 5 status (faltam draft, returned, cancelled). Schema de proc_tasks desactualizado (faltam 11 colunas). Gaps listados já foram resolvidos na maioria. **Secções úteis:** visão geral do fluxo, roles. **Secções obsoletas:** schema DB, gaps, código de exemplo. |
| 2 | `PRD-PROCESS-TYPES.md` | ✅ ACTUAL | process_type está implementado em proc_instances e tpl_processes. ref_counters existe com prefixo ANG. |
| 3 | `SPEC-ADHOC-TASKS-PROCESSOS.md` | ✅ ACTUAL | Tarefas ad-hoc implementadas com POST/DELETE em `/api/processes/[id]/tasks`. AdhocTaskSheet existe. Roles validados. |
| 4 | `SPEC-M06-PROCESSOS.md` | ❌ OBSOLETO | Documento massivo (~53KB) com 8 fases de implementação. A maioria das fases foi executada mas o schema, APIs e componentes evoluíram muito além do especificado. Usar como referência histórica apenas. **Não usar para implementação.** |
| 5 | `SPEC-PROCESS-TYPES.md` | 📜 HISTÓRICO | Migração SQL e mudanças foram aplicadas. Útil apenas para entender decisões de design do process_type. |
| 6 | `SPEC-REDESIGN-PROCESSO-DETALHE.md` | ⚠️ PARCIAL | Kanban + Lista views existem (ProcessKanbanView, ProcessListView). Priority field implementado. **Não implementado:** Kanban drag-and-drop entre colunas. |
| 7 | `SPEC-SELECCAO-TEMPLATE-APROVACAO.md` | ✅ ACTUAL | Template selection na aprovação está implementado exactamente como especificado. Pode ser usado como referência. |

### Resumo M06

- **Manter como referência:** PRD-PROCESS-TYPES, SPEC-ADHOC-TASKS, SPEC-SELECCAO-TEMPLATE-APROVACAO
- **Actualizar ou substituir:** PRD-M06-PROCESSOS, SPEC-REDESIGN-PROCESSO-DETALHE
- **Arquivar (histórico):** SPEC-M06-PROCESSOS, SPEC-PROCESS-TYPES

---

## docs/M07-TEMPLATES-PROCESSOS/

| # | Ficheiro | Estado | Razão |
|---|----------|:---:|-------|
| 1 | `PRD-M07-TEMPLATES-PROCESSO.md` | ⚠️ PARCIAL | Descreve action_type (UPLOAD/EMAIL/GENERATE_DOC/MANUAL) que foi **substituído** por sistema de subtarefas com 6 tipos. Visão geral do builder ainda é válida. |
| 2 | `SPEC-M07-TEMPLATES-PROCESSO.md` | ❌ OBSOLETO | Schema de tpl_tasks com action_type e config está desactualizado. Não menciona tpl_subtasks. **Não usar para implementação.** |
| 3 | `PRD-CHAT-PROCESSOS.md` | ✅ ACTUAL | Chat implementado com 4 tabelas e 8 componentes. |
| 4 | `SPEC-CHAT-PROCESSOS.md` | ✅ ACTUAL | Especificação aplicada. |
| 5 | `PRD-TASK-DETAIL-SHEET.md` | ✅ ACTUAL | TaskDetailSheet implementado com 3 abas. |
| 6 | `SPEC-TASK-DETAIL-SHEET.md` | ✅ ACTUAL | |
| 7 | `PRD-FORM-SUBTASKS.md` | ✅ ACTUAL | 6 renderizadores de campo implementados. |
| 8 | `SPEC-FORM-SUBTASKS.md` | ✅ ACTUAL | DynamicFormRenderer e field renderers implementados. |
| 9 | `SPEC-FORM-TEMPLATES-DB.md` | ✅ ACTUAL | tpl_form_templates existe na DB. |
| 10 | `SPEC-SUBTASKS-FORM.md` | ✅ ACTUAL | |
| 11 | `PRD-SUBTASK-CARDS-REDESIGN.md` | ✅ ACTUAL | 7 componentes subtask-card-* implementados. |
| 12 | `SPEC-SUBTASK-CARDS-REDESIGN.md` | ✅ ACTUAL | |
| 13 | `PRD-OWNER-CONDITIONAL-SUBTASKS.md` | ✅ ACTUAL | owner_scope + person_type_filter implementados. |
| 14 | `SPEC-OWNER-CONDITIONAL-SUBTASKS.md` | ✅ ACTUAL | |
| 15 | `PRD-NOTIFICACOES.md` | ✅ ACTUAL | lib/notifications/service.ts implementado. |
| 16 | `SPEC-NOTIFICACOES.md` | ✅ ACTUAL | |
| 17 | `PRD-APRIMORAMENTO-SUBTASKS.md` | ✅ ACTUAL | Tipos avançados implementados. |
| 18 | `PRD-TASK-SHEET-ENHANCEMENT.md` | ✅ ACTUAL | |
| 19 | `SPEC-TASK-SHEET-ENHANCEMENT.md` | ✅ ACTUAL | |
| 20 | `DOCUMENTAÇÃO-TEMPLATE-SYSTEM.md` | ⚠️ PARCIAL | Visão geral válida mas schema de tasks precisa actualização (falta subtasks). |
| 21 | `DOCUMENTAÇÃO-PREENCHIMENTO-EMAIL-DOCUMENTO.md` | ✅ ACTUAL | Documentação de variáveis e preenchimento. |
| 22 | `SUBTASKS-FORM-TEMPLATES.md` | ✅ ACTUAL | |

### docs/M07-TEMPLATES-PROCESSOS/ATUALIZACOES/

| # | Ficheiro | Estado | Razão |
|---|----------|:---:|-------|
| 1 | `SPEC-SUBTASK-ENHANCEMENTS.md` | ✅ ACTUAL | Implementado. |
| 2 | `DESVIOS-SUBTASK-ENHANCEMENTS.md` | 📜 HISTÓRICO | Documento de desvios — útil para contexto. |
| 3 | `SPEC-TASK-DEPENDENCIES.md` | ✅ ACTUAL | Dependências task→task implementadas. |
| 4 | `DESVIOS-TASK-DEPENDENCIES.md` | 📜 HISTÓRICO | |
| 5 | `SPEC-FIX-ALERTAS-PONTA-A-PONTA.md` | ⚠️ PARCIAL | Infraestrutura existe, disparo automático por verificar. |
| 6 | `SPEC-MULTICANAL-ALERTS.md` | ⚠️ PARCIAL | Configuração implementada, disparo automático falta. |

### docs/M07-TEMPLATES-PROCESSOS/TASKS/

| # | Ficheiro | Estado | Razão |
|---|----------|:---:|-------|
| 1 | `PRD-TEMPLATE-TASK-EDITOR.md` | ✅ ACTUAL | TemplateTaskSheet implementado. |
| 2 | `SPEC-TEMPLATE-TASK-SHEET.md` | ✅ ACTUAL | |

### Resumo M07

- **Manter como referência:** 18 documentos actuais (PRD/SPEC de chat, subtasks, forms, owners, notificações, task sheet, task editor)
- **Actualizar:** DOCUMENTAÇÃO-TEMPLATE-SYSTEM.md, PRD-M07-TEMPLATES-PROCESSO.md
- **Arquivar (histórico):** SPEC-M07-TEMPLATES-PROCESSO.md, DESVIOS-*
- **Verificar completude:** SPEC-FIX-ALERTAS-PONTA-A-PONTA.md, SPEC-MULTICANAL-ALERTS.md

---

## RECOMENDAÇÃO GLOBAL

### Documentos a ACTUALIZAR (4)

1. `M06/PRD-M06-PROCESSOS.md` — Adicionar status draft/returned/cancelled, actualizar schema
2. `M06/SPEC-REDESIGN-PROCESSO-DETALHE.md` — Marcar Kanban DnD como não implementado
3. `M07/PRD-M07-TEMPLATES-PROCESSO.md` — Substituir action_type por sistema de subtarefas
4. `M07/DOCUMENTAÇÃO-TEMPLATE-SYSTEM.md` — Adicionar secção de tpl_subtasks

### Documentos a MANTER (20+)

Todos os PRDs e SPECs de features específicas (chat, subtasks, forms, owners, notificações, task sheet, alertas) são **actuais e válidos**.

---

## SECÇÕES DO CLAUDE.md A ACTUALIZAR

O ficheiro principal `CLAUDE.md` precisa de actualizações nas seguintes secções:

| Secção | O Que Mudar |
|--------|-------------|
| "Tabelas de Templates de Processo" | Adicionar tpl_subtasks, tpl_variables, tpl_form_templates. Actualizar tpl_tasks (remover action_type como campo principal, adicionar priority, assigned_role) |
| "Tabelas de Instâncias de Processo" | Actualizar proc_instances (+14 colunas). Actualizar proc_tasks (+11 colunas). Adicionar proc_subtasks, proc_chat_*, proc_task_activities, proc_task_comments, proc_alert_log |
| "M06 — Processos" checklist | Actualizar com todas as features implementadas |
| "M07 — Templates" checklist | Actualizar com sistema de subtarefas |
| Nota 10 sobre triggers | Corrigir: populate_process_tasks é RPC, não trigger |
| Estrutura do Projecto | Adicionar components/processes/ (61 ficheiros), components/calendar/ (9), hooks novos, lib/process-engine.ts, lib/template-engine.ts, lib/notifications/, lib/alerts/, lib/processes/ |
