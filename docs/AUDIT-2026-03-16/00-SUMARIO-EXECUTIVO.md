# AUDITORIA M06 + M07 — Sumário Executivo

**Data:** 2026-03-16
**Objectivo:** Comparar documentação existente com implementação real, identificar discrepâncias e criar referência actualizada.

---

## ÍNDICE DE DOCUMENTOS

| # | Documento | Conteúdo |
|---|----------|----------|
| 01 | [AUDIT-M06-PROCESSOS.md](01-AUDIT-M06-PROCESSOS.md) | Instâncias de processo: DB, API (26 routes), Frontend (61 componentes), estado da máquina |
| 02 | [AUDIT-M07-TEMPLATES.md](02-AUDIT-M07-TEMPLATES.md) | Templates: DB (7 tabelas tpl_*), API (4 routes), Frontend (11 componentes), sistema de subtarefas |
| 03 | [AUDIT-CHAT-OWNERS-DOCS-BIBLIOTECAS.md](03-AUDIT-CHAT-OWNERS-DOCS-BIBLIOTECAS.md) | Chat (4 tabelas, 8 comp), Proprietários (8 comp), Documentos (7 comp), Bibliotecas (15 APIs), Actividades, Notificações, Alertas |
| 04 | [AUDIT-ANGARIACOES-CALENDARIO.md](04-AUDIT-ANGARIACOES-CALENDARIO.md) | Angariações (7 APIs, wizard multi-step), Calendário (9 comp, 2 APIs), Motores de processo/template, Node processors |
| 05 | [DOCS-OBSOLETOS.md](05-DOCS-OBSOLETOS.md) | Lista de documentação obsoleta/desactualizada nos docs M06/M07 originais |
| 06 | [AUDIT-NOTIFICACOES-ALERTAS.md](06-AUDIT-NOTIFICACOES-ALERTAS.md) | Auditoria completa das 3 camadas (Notificações + Alertas Multicanal + Activities). Mapa de triggers, divergências, 16 recomendações |

---

## MÉTRICAS GLOBAIS

### Ficheiros no Codebase (M06 + M07 + relacionados)

| Categoria | Quantidade |
|-----------|:---------:|
| API Route handlers | **53** |
| Componentes React (processes/) | **61** |
| Componentes React (templates/) | **11** |
| Componentes React (calendar/) | **9** |
| Hooks customizados | **8** |
| Tipos TypeScript | **6** |
| Validações Zod | **6** |
| Serviços/utilitários | **20** |
| **TOTAL** | **174** |

### Tabelas na Base de Dados

| Grupo | Tabelas | Registos |
|-------|:-------:|:--------:|
| proc_* (instâncias) | 7 | ~250 |
| tpl_* (templates) | 7 | ~178 |
| Calendar | 2 | - |
| Owners | 4 | - |
| **TOTAL** | **20** | - |

---

## ESTADO POR MÓDULO

### ✅ M06 — Processos (Instâncias) — **95% COMPLETO**

| Sub-feature | Estado | Notas |
|------------|:---:|-------|
| CRUD de instâncias | ✅ | 8 endpoints base |
| Máquina de estados (8 status) | ✅ | draft → pending_approval → active → completed |
| Aprovação com selecção de template | ✅ | POST approve + RPC populate_process_tasks |
| Rejeição, devolução, pausa, cancelamento | ✅ | Cada um com endpoint dedicado |
| Re-template (trocar template em processo activo) | ✅ | |
| Tarefas ad-hoc (fora do template) | ✅ | POST + DELETE com validação de roles |
| Subtarefas (6 tipos) | ✅ | upload, checklist, email, generate_doc, form, field |
| Dependências entre tarefas/subtarefas | ✅ | is_blocked + unblocked_at |
| Multiplicação por proprietário | ✅ | owner_scope + person_type_filter |
| Auto-complete de tarefas UPLOAD | ✅ | process-engine.ts |
| Cálculo de progresso por subtarefa | ✅ | recalculateProgress() |
| Kanban drag-and-drop entre fases | ❌ | Componente existe sem DnD |
| Supabase Realtime para tarefas | ⚠️ | Apenas para actividades |

### ✅ M07 — Templates — **100% COMPLETO (core)**

| Sub-feature | Estado | Notas |
|------------|:---:|-------|
| CRUD de templates | ✅ | GET, POST, PUT, DELETE + active |
| Builder visual com DnD | ✅ | @dnd-kit horizontal + vertical |
| Fases (stages) com reordenação | ✅ | |
| Tarefas com subtarefas | ✅ | Substituiu action_type antigo |
| 6 tipos de subtarefa | ✅ | upload, checklist, email, generate_doc, form, field |
| Configuração por tipo | ✅ | SubtaskConfigDialog |
| Dependências (task→task, subtask→subtask/task) | ✅ | |
| Multiplicação por proprietário | ✅ | owner_scope, person_type_filter, configs por tipo pessoa |
| Alertas multicanal (email, SMS, WhatsApp, in-app) | ✅ | Configuração no template |
| Formulários dinâmicos (14 tipos de campo) | ✅ | form-field-picker.tsx |
| Validação Zod completa | ✅ | 214 linhas |
| Preview antes de guardar | ✅ | template-preview.tsx |
| Versionamento de templates | ❌ | Não implementado |
| Duplicação de templates | ❌ | Não implementado |

### ✅ Chat em Processo — **90% COMPLETO**

| Sub-feature | Estado |
|------------|:---:|
| Mensagens CRUD | ✅ |
| Reacções emoji | ✅ |
| Anexos (ficheiros) | ✅ |
| Read receipts | ✅ |
| Respostas (quote) | ✅ |
| Gravação de voz | ✅ |
| Supabase Realtime | ❌ |
| Typing indicators | ❌ |

### ✅ Angariações — **95% COMPLETO**

| Sub-feature | Estado |
|------------|:---:|
| Wizard multi-step (5 passos) | ✅ |
| Persistência por step | ✅ |
| KYC completo (singular + colectiva) | ✅ |
| Finalização com transição de estado | ✅ |
| Preenchimento por voz (IA) | ✅ |
| Conversão negócio → angariação | ✅ |

### ✅ Calendário — **85% COMPLETO**

| Sub-feature | Estado | Notas |
|------------|:---:|-------|
| Vista mensal | ✅ | |
| Vista semanal | ✅ | |
| CRUD de eventos | ✅ | |
| Categorias com cores | ✅ | 7 categorias |
| Filtros por categoria e utilizador | ✅ | |
| Relação com processo/imóvel/lead | ✅ | FKs existem |
| Página dedicada /dashboard/calendario | ❌ | **Falta criar a rota** |
| Eventos automáticos de SLA | ❌ | |
| Drag-and-drop no calendário | ❌ | |

### ⚠️ Alertas Multicanal — **50% COMPLETO**

| Sub-feature | Estado | Notas |
|------------|:---:|-------|
| Configuração no template | ✅ | AlertConfigEditor |
| Serviço de alertas | ✅ | lib/alerts/service.ts |
| Tabela de log | ✅ | proc_alert_log |
| **Trigger/cron de disparo** | ❌ | **Falta** |
| **Dashboard de delivery** | ❌ | **Falta** |

---

## DISCREPÂNCIAS PRINCIPAIS COM CLAUDE.md

| # | Discrepância | Impacto |
|---|-------------|---------|
| 1 | CLAUDE.md lista `action_type: UPLOAD \| EMAIL \| GENERATE_DOC \| MANUAL` como schema actual | **Alto** — foi substituído por sistema de subtarefas com 6 tipos |
| 2 | CLAUDE.md menciona `trg_populate_tasks` como trigger automático | **Alto** — não existe como trigger, é RPC chamado no approve |
| 3 | Tabelas `proc_subtasks`, `tpl_subtasks`, `proc_chat_*`, `proc_task_activities`, `proc_task_comments` não estão no CLAUDE.md | **Alto** — 11 tabelas ausentes |
| 4 | `proc_instances` tem 25 colunas vs 11 documentadas (+14) | **Médio** — campos de auditoria, processo tipo, soft delete |
| 5 | `proc_tasks` tem 26 colunas vs 15 documentadas (+11) | **Médio** — priority, is_blocked, dependencies, owner_id |
| 6 | 8 status de processo vs 5 documentados | **Médio** — draft, returned, cancelled não documentados |
| 7 | `ref_counters` usa prefixo "ANG" não "PROC" | **Baixo** |
| 8 | `process_type` existe em proc_instances e tpl_processes | **Baixo** — feature implementada mas não documentada |
| 9 | Tabelas de calendário usam prefixo `temp_` | **Info** |
| 10 | 53 API routes vs ~15 documentados | **Alto** — maioria das APIs não está no CLAUDE.md |

---

## RECOMENDAÇÕES

### Prioridade Alta
1. **Actualizar CLAUDE.md** — Secções de schema DB, API routes, e componentes estão severamente desactualizadas
2. **Implementar cron de alertas** — Infraestrutura completa, falta apenas o trigger temporal
3. **Criar página /dashboard/calendario** — 9 componentes prontos, falta apenas o route

### Prioridade Média
4. **Supabase Realtime no chat** — Substituir polling por subscriptions
5. **Dashboard de delivery de alertas** — proc_alert_log existe, falta UI
6. **Kanban DnD entre fases** — Componente existe, falta lógica de drag entre colunas

### Prioridade Baixa
7. **Versionamento de templates** — Evitar afectar instâncias activas ao editar template
8. **Duplicação de templates** — Conveniência
9. **@mentions nos comentários** — react-mentions
10. **Typing indicators no chat** — Supabase Broadcast

---

## CONCLUSÃO

A implementação real é **2-3x mais robusta** do que a documentação sugere. O sistema de processos e templates é **production-ready** com:
- **174 ficheiros** de código
- **20 tabelas** na base de dados
- **53 API routes** funcionais
- **81 componentes** React

As lacunas principais são em features de **qualidade de vida** (Realtime, alertas automáticos, calendário dedicado), não em funcionalidade core.
