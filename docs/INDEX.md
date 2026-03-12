# ERP Infinity — Índice de Documentação

> Organizado por módulos, ficheiros ordenados por data de implementação.
> Total: **100 documentos** | **13 módulos**

---

## M01 — Fundação (Fev 17)

Estabelecimento da fundação do ERP: autenticação, layout, componentes base.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-17 | FASE-01-IMPLEMENTACAO.md | Guia de Implementação |

---

## M02 — Base de Dados e Processos (Fev 17)

Fundação da base de dados, migrations, validações e estrutura de templates.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-17 | templates-structure.md | Referência Técnica |
| 2026-02-17 | FASE-02-BASE-PROCESSOS.md | Guia de Implementação |

---

## M03 — Imóveis (Fev 17 – Fev 24)

Gestão de propriedades, integração Mapbox, relações proprietários/documentos.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-17 | property-relations.md | Referência Técnica |
| 2026-02-17 | mapbox-integration.md | Referência Técnica |
| 2026-02-24 | PRD-M03-IMOVEIS.md | PRD |
| 2026-02-24 | SPEC-M03-IMOVEIS.md | Especificação |

---

## M04 — Infraestrutura e Storage (Fev 17 – Fev 23)

Cloudflare R2, fluxo de upload, upload diferido.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-17 | r2-connection.md | Referência Técnica |
| 2026-02-20 | SPEC-DEFERRED-UPLOAD.md | Especificação |
| 2026-02-23 | FLUXO-UPLOAD-R2-SUPABASE.md | Referência Técnica |

---

## M05 — Leads (Fev 23)

Módulo de gestão de leads/contactos.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-23 | SPEC-M05-LEADS.md | Especificação |

---

## M06 — Processos (Fev 20 – Mar 11)

Gestão de processos, tipos de processo, seleção de templates, aprovação, tarefas ad-hoc.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-20 | PRD-M06-PROCESSOS.md | PRD |
| 2026-02-20 | SPEC-M06-PROCESSOS.md | Especificação |
| 2026-02-20 | SPEC-SELECCAO-TEMPLATE-APROVACAO.md | Especificação |
| 2026-02-23 | SPEC-REDESIGN-PROCESSO-DETALHE.md | Especificação |
| 2026-03-10 | PRD-PROCESS-TYPES.md | PRD |
| 2026-03-10 | SPEC-PROCESS-TYPES.md | Especificação |
| 2026-03-11 | SPEC-ADHOC-TASKS-PROCESSOS.md | Especificação |

---

## M07 — Templates de Processos (Fev 20 – Mar 11)

Templates reutilizáveis, subtarefas, formulários, chat, notificações, task sheets.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-20 | PRD-M07-TEMPLATES-PROCESSO.md | PRD |
| 2026-02-20 | SPEC-M07-TEMPLATES-PROCESSO.md | Especificação |
| 2026-02-23 | SUBTASKS-FORM-TEMPLATES.md | Referência Técnica |
| 2026-02-23 | PRD-APRIMORAMENTO-SUBTASKS.md | PRD |
| 2026-02-23 | SPEC-SUBTASKS-FORM.md | Especificação |
| 2026-02-24 | PRD-TASK-DETAIL-SHEET.md | PRD |
| 2026-02-24 | SPEC-TASK-DETAIL-SHEET.md | Especificação |
| 2026-02-24 | PRD-CHAT-PROCESSOS.md | PRD |
| 2026-02-24 | SPEC-CHAT-PROCESSOS.md | Especificação |
| 2026-02-24 | PRD-NOTIFICACOES.md | PRD |
| 2026-02-24 | SPEC-NOTIFICACOES.md | Especificação |
| 2026-03-05 | DOCUMENTAÇÃO-PREENCHIMENTO-EMAIL-DOCUMENTO.md | Documentação |
| 2026-03-05 | DOCUMENTAÇÃO-TEMPLATE-SYSTEM.md | Documentação |
| 2026-03-05 | PRD-OWNER-CONDITIONAL-SUBTASKS.md | PRD |
| 2026-03-05 | SPEC-OWNER-CONDITIONAL-SUBTASKS.md | Especificação |
| 2026-03-05 | PRD-TASK-SHEET-ENHANCEMENT.md | PRD |
| 2026-03-05 | SPEC-TASK-SHEET-ENHANCEMENT.md | Especificação |
| 2026-03-05 | PRD-SUBTASK-CARDS-REDESIGN.md | PRD |
| 2026-03-05 | SPEC-SUBTASK-CARDS-REDESIGN.md | Especificação |
| 2026-03-10 | PRD-FORM-SUBTASKS.md | PRD |
| 2026-03-10 | SPEC-FORM-SUBTASKS.md | Especificação |
| 2026-03-10 | SPEC-FORM-TEMPLATES-DB.md | Especificação |
| 2026-03-11 | SPEC-FIX-ALERTAS-PONTA-A-PONTA.md | Especificação (Fix) |

**Subpastas:**

- `ATUALIZACOES/` — Desvios e melhorias incrementais (6 ficheiros, Mar 11)
- `TASKS/` — Editor de tarefas do template (2 ficheiros, Fev 25)

---

## M08 — Documentos (Fev 20 – Mar 10)

Registo de documentos, gestor tipo Google Drive, fix de owner_id.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-20 | PRD-M08-DOCUMENTOS.md | PRD |
| 2026-02-20 | SPEC-M08-DOCUMENTOS.md | Especificação |
| 2026-02-23 | SPEC-FIX-OWNER-ID-DOCUMENTS.md | Especificação |
| 2026-03-10 | PRD-DOCUMENT-MANAGER.md | PRD |
| 2026-03-10 | SPEC-DOCUMENT-MANAGER.md | Especificação |

---

## M09 — Angariações (Fev 20 – Mar 11)

Fluxo de angariação, documentos de proprietários, proprietários editáveis.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-20 | PRD-DEFERRED-UPLOAD.md | PRD |
| 2026-02-23 | SPEC-ANGARIACOES.md | Especificação |
| 2026-02-23 | SPEC-OWNER-DOCS-ANGARIACOES-PROCESSOS.md | Especificação |
| 2026-02-23 | PRD-OWNER-DOCS.md | PRD |
| 2026-02-23 | SPEC-OWNER-DOCS-IMPL.md | Especificação |
| 2026-03-11 | SPEC-PROPRIETARIOS-EDITAVEIS.md | Especificação |
| 2026-03-11 | SPEC-OWNER-TASKS-DROPDOWN.md | Especificação |

---

## M10 — Automações (Mar 5 – Mar 6)

Motor de automações: variáveis, WhatsApp, editor visual, execução, monitorização.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-03-05 | SPEC-AUTOMACOES-GERAL.md | Especificação Geral |
| 2026-03-05 | SPEC-AUTO-F1-DATABASE.md | Especificação |
| 2026-03-05 | SPEC-AUTO-F2-TIPOS-VARIAVEIS.md | Especificação |
| 2026-03-05 | SPEC-AUTO-F3-INSTANCIAS-WPP.md | Especificação |
| 2026-03-05 | SPEC-AUTO-F4-TEMPLATES-WPP.md | Especificação |
| 2026-03-05 | SPEC-AUTO-F4F5-PENDENTES.md | Especificação |
| 2026-03-05 | SPEC-AUTO-F5-EDITOR-VISUAL.md | Especificação |
| 2026-03-05 | IMPL-AUTO-F1-DESVIOS.md | Desvios/Implementação |
| 2026-03-05 | IMPL-AUTO-F2-DESVIOS.md | Desvios/Implementação |
| 2026-03-05 | IMPL-AUTO-F3-DESVIOS.md | Desvios/Implementação |
| 2026-03-05 | IMPL-AUTO-F4-DESVIOS.md | Desvios/Implementação |
| 2026-03-05 | IMPL-AUTO-F4F5-PENDENTES.md | Desvios/Implementação |
| 2026-03-05 | DESVIOS-ACUMULADOS-F1-F4.md | Relatório de Desvios |
| 2026-03-06 | SPEC-AUTO-F6-MOTOR-EXECUCAO.md | Especificação |
| 2026-03-06 | SPEC-AUTO-F7-MONITORIZACAO.md | Especificação |
| 2026-03-06 | SPEC-AUTO-DRAFT-PUBLISH.md | Especificação |
| 2026-03-06 | SPEC-REFACTOR-UX-EDITOR.md | Especificação |
| 2026-03-06 | IMPL-AUTO-F5-DESVIOS.md | Desvios/Implementação |
| 2026-03-06 | IMPL-AUTO-F6-DESVIOS.md | Desvios/Implementação |
| 2026-03-06 | IMPL-AUTO-F7-DESVIOS.md | Desvios/Implementação |
| 2026-03-06 | DESVIOS-ACUMULADOS-F1-F6.md | Relatório de Desvios |
| 2026-03-06 | CONFIG-CRON-WORKER.md | Configuração |

---

## M11 — Editor de Documentos (Fev 25 – Mar 10)

Editor WYSIWYG, layout 3 painéis, componentes, hooks, variáveis.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-25 | README.md | Visão Geral |
| 2026-02-25 | EDITOR-DOCUMENTOS-GUIDE.md | Guia |
| 2026-02-25 | COMPONENTS-REFERENCE.md | Referência |
| 2026-02-25 | HOOKS-TYPES-REFERENCE.md | Referência |
| 2026-03-10 | ARQUITETURA-COMPONENTES.md | Arquitectura |
| 2026-03-10 | LAYOUT-VISUAL-3PAINEL.md | Layout |
| 2026-03-10 | TECHNICAL-LAYOUT-REFERENCE.md | Referência Técnica |
| 2026-03-10 | FIXEDLAYOUT-VISUAL-RESUMO.md | Resumo Visual |
| 2026-03-10 | FIXES-LAYOUT-VARIABLES-SIDEBAR.md | Correções |
| 2026-03-10 | BEFORE-AFTER-DETAILED.md | Comparativo |
| 2026-03-10 | SESSION-SUMMARY-2026-02-24.md | Resumo de Sessão |

---

## M12 — Email (Fev 25 – Mar 6)

Templates de email, editor de email, envio, status e reenvio.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-02-25 | PRD-TEMPLATES-EMAIL.md | PRD |
| 2026-02-25 | SPEC-TEMPLATES-EMAIL.md | Especificação |
| 2026-03-03 | EDGE-FUNCTION-SEND-EMAIL.md | Referência Técnica |
| 2026-03-05 | PRD-EMAIL-STATUS-RESEND.md | PRD |
| 2026-03-05 | SPEC-EMAIL-STATUS-RESEND.md | Especificação |
| 2026-03-06 | SPEC-EMAIL-EDITOR.md | Especificação |

---

## M13 — UI Inputs (Mar 12)

Máscaras de input para percentagem, monetário, data e telefone com Dice UI.

| Data | Ficheiro | Tipo |
|------|----------|------|
| 2026-03-12 | SPEC-MASK-INPUTS.md | Especificação |

---

## Timeline Geral

| Período | Módulos |
|---------|---------|
| Fev 17 | M01 Fundação, M02 Base DB, M03 Imóveis (parcial), M04 Storage (parcial) |
| Fev 20 | M04 (deferred upload), M06 Processos, M07 Templates, M08 Documentos, M09 Angariações |
| Fev 23 | M03 (PRD/SPEC), M05 Leads, M06 (redesign), M08 (fix), M09 (owner docs) |
| Fev 24 | M07 (chat, notificações, task detail) |
| Fev 25 | M11 Editor Documentos, M12 Email Templates |
| Mar 3–6 | M10 Automações, M12 (editor + status/resend) |
| Mar 10 | M06 (tipos processo), M07 (form subtasks), M08 (document manager), M11 (layout fixes) |
| Mar 11 | M07 (fix alertas ponta-a-ponta), M09 (proprietários editáveis, dropdown tarefas por owner) |
| Mar 12 | M13 UI Inputs (mask inputs: percentagem, monetário, data, telefone) |
