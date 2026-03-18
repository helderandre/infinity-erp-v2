# AUDIT M07 — Templates de Processo

**Data da auditoria:** 2026-03-16
**Âmbito:** Backend (API Routes) + Frontend (Pages, Components) + Base de Dados + Validação

---

## 1. RESUMO

O módulo de Templates está **100% funcional no core** (builder, CRUD, validação). O sistema suporta subtarefas avançadas com 6 tipos, multiplicação por proprietário, dependências, alertas multicanal e formulários dinâmicos.

| Área | Documentado | Real | Delta |
|------|------------|------|-------|
| API Routes | 3 endpoints | 3 route.ts (+ active) | +1 |
| Componentes | ~4 | 11 | +7 |
| Tabelas tpl_* | 3 (processes, stages, tasks) | 7 (+subtasks, email_lib, doc_lib, variables, form_templates) | +4 |
| Tipos de subtarefa | 4 (UPLOAD, EMAIL, GENERATE_DOC, MANUAL) | 6 (upload, checklist, email, generate_doc, form, field) | +2 |

---

## 2. BASE DE DADOS — ESTADO ACTUAL

### 2.1. tpl_processes (6 registos)

| Coluna | Tipo | Documentada? | Notas |
|--------|------|:---:|-------|
| id | uuid | ✅ | PK |
| name | text | ✅ | |
| description | text | ✅ | |
| is_active | boolean | ✅ | default true |
| created_at | timestamptz | ✅ | |
| **process_type** | text | ❌ | `angariacao` / `negocio` — NÃO documentado no CLAUDE.md |
| **updated_at** | timestamptz | ❌ | |
| **deleted_at** | timestamptz | ❌ | Soft delete |

### 2.2. tpl_stages (27 registos)

| Coluna | Tipo | Documentada? |
|--------|------|:---:|
| id | uuid | ✅ |
| tpl_process_id | uuid | ✅ |
| name | text | ✅ |
| order_index | integer | ✅ |
| description | text | ❌ |
| created_at | timestamptz | ✅ |

### 2.3. tpl_tasks (74 registos)

| Coluna | Tipo | Documentada? | Notas |
|--------|------|:---:|-------|
| id | uuid | ✅ | |
| tpl_stage_id | uuid | ✅ | |
| title | text | ✅ | |
| description | text | ✅ | |
| ~~action_type~~ | text | ✅ | **DEPRECATED** — derivado como COMPOSITE no backend |
| is_mandatory | boolean | ✅ | |
| dependency_task_id | uuid | ✅ | Self-ref |
| sla_days | integer | ✅ | |
| config | jsonb | ✅ | Agora contém alerts |
| order_index | integer | ✅ | |
| **priority** | text | ❌ | urgent/normal/low |
| **assigned_role** | text | ❌ | FK → roles.name |

### 2.4. tpl_subtasks (71 registos) — NÃO DOCUMENTADA NO CLAUDE.md

Esta é a tabela mais importante adicionada desde a documentação original.

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid | PK |
| tpl_task_id | uuid | FK → tpl_tasks |
| title | text | |
| description | text | |
| is_mandatory | boolean | |
| order_index | integer | |
| config | jsonb | **Varia por tipo** (ver secção 3) |
| created_at | timestamptz | |
| sla_days | integer | |
| assigned_role | text | |
| priority | text | urgent/normal/low |
| dependency_type | text | none/subtask/task |
| dependency_subtask_id | uuid | FK → tpl_subtasks (self-ref) |
| dependency_task_id | uuid | FK → tpl_tasks |

### 2.5. Tabelas de Biblioteca

| Tabela | Registos | Documentada? | Notas |
|--------|---------|:---:|-------|
| tpl_email_library | Existe | ✅ | Templates de email (name, subject, body_html) |
| tpl_doc_library | Existe | ✅ | Templates de documento (name, content_html, doc_type_id) |
| tpl_variables | Existe | ❌ | Sistema de variáveis para templates |
| tpl_form_templates | Existe | ❌ | Biblioteca de formulários reutilizáveis |
| doc_types | Existe | ✅ | Tipos de documento |

---

## 3. SISTEMA DE SUBTAREFAS — 6 TIPOS

### Evolução do Schema

**Documentação original (CLAUDE.md):**
```
action_type: UPLOAD | EMAIL | GENERATE_DOC | MANUAL
```

**Implementação actual:**
```
type: upload | checklist | email | generate_doc | form | field
```

A migração de `action_type` na task para `type` na subtask é completa. Uma task pode ter **múltiplas subtarefas** de tipos diferentes. O `action_type` na proc_tasks é agora derivado como `COMPOSITE`.

### Config por Tipo

| Tipo | config.type | Campos Específicos |
|------|------------|-------------------|
| **upload** | `upload` | `doc_type_id`, `owner_scope`, `person_type_filter`, `singular_config`, `coletiva_config` |
| **checklist** | `checklist` | (nenhum extra — checkbox manual) |
| **email** | `email` | `email_library_id`, `recipient_type`, `custom_recipients` |
| **generate_doc** | `generate_doc` | `doc_library_id`, `output_format`, `variables` |
| **form** | `form` | `sections[]` com `fields[]` (ver secção 3.1) |
| **field** | `field` | `field_name`, `label`, `field_type`, `target_entity`, `required`, `help_text` |

### 3.1. Formulários Dinâmicos (tipo `form`)

```typescript
interface FormSectionConfig {
  title: string
  fields: FormFieldConfig[]
}

interface FormFieldConfig {
  field_name: string
  label: string
  field_type: FormFieldType  // 14 tipos
  target_entity: FormTargetEntity
  required?: boolean
  help_text?: string
  placeholder?: string
  width?: 'full' | 'half' | 'third'
  options?: { label: string; value: string }[]  // para select
}
```

**FormFieldType** (14 tipos):
text, textarea, number, currency, percentage, select, checkbox, date, email, phone, rich_text, address_map, media_upload, link_external

**FormTargetEntity**:
property, property_specs, property_internal, owner, process

### 3.2. Multiplicação por Proprietário

```typescript
interface SubtaskOwnerConfig {
  owner_scope: 'none' | 'all_owners' | 'main_contact_only'
  person_type_filter: 'all' | 'singular' | 'coletiva'
  singular_config?: { doc_type_id: string; ... }
  coletiva_config?: { doc_type_id: string; ... }
}
```

Uma subtarefa com `owner_scope: 'all_owners'` é multiplicada em N `proc_subtasks`, uma por proprietário. Configs diferentes para pessoa singular vs colectiva.

---

## 4. API ROUTES

### 4.1. CRUD de Templates

| Método | Rota | Estado | Notas |
|--------|------|:---:|-------|
| GET | `/api/templates` | ✅ | Lista com filtro por process_type, contagem stages/tasks |
| POST | `/api/templates` | ✅ | Criação completa (stages → tasks → subtasks) |
| GET | `/api/templates/[id]` | ✅ | Detalhe com todas as relações nested |
| PUT | `/api/templates/[id]` | ✅ | Edição completa com regeneração |
| DELETE | `/api/templates/[id]` | ✅ | Soft delete (deleted_at) |
| GET | `/api/templates/active` | ✅ | Templates activos filtráveis por process_type |

### 4.2. Validação (Zod)

`lib/validations/template.ts` — 214 linhas:
- `subtaskSchema` — validação condicional por tipo (upload requer doc_type_id, email requer email_library_id, etc.)
- `taskSchema` — valida dependências, array de subtasks
- `stageSchema` — mínimo 1 task
- `templateSchema` — mínimo 1 stage, requer process_type

---

## 5. FRONTEND

### 5.1. Páginas

| Página | Rota | Estado |
|--------|------|:---:|
| Listagem de templates | `/dashboard/processos/templates` | ✅ |
| Criar template | `/dashboard/processos/templates/novo` | ✅ |
| Editar template | `/dashboard/processos/templates/[id]/editar` | ✅ |

### 5.2. Componentes (11 ficheiros em `components/templates/`)

| Componente | Ficheiro | Descrição | Estado |
|-----------|----------|-----------|:---:|
| TemplateBuilder | `template-builder.tsx` | Builder principal com DnD (707+ linhas) | ✅ |
| TemplateStageColumn | `template-stage-column.tsx` | Coluna de fase sortable | ✅ |
| TemplateStageDialog | `template-stage-dialog.tsx` | Dialog criar/editar fase | ✅ |
| TemplateTaskCard | `template-task-card.tsx` | Card de tarefa no builder | ✅ |
| TemplateTaskSheet | `template-task-sheet.tsx` | Sheet de edição de tarefa (3 abas) | ✅ |
| TemplateList | `template-list.tsx` | Grid de templates na listagem | ✅ |
| TemplatePreview | `template-preview.tsx` | Preview antes de guardar | ✅ |
| SubtaskEditor | `subtask-editor.tsx` | Editor de subtarefas DnD | ✅ |
| SubtaskConfigDialog | `subtask-config-dialog.tsx` | Configuração por tipo | ✅ |
| FormFieldPicker | `form-field-picker.tsx` | Selector de campos de formulário | ✅ |
| AlertConfigEditor | `alert-config-editor.tsx` | Configuração de alertas | ✅ |

### 5.3. Dependências de DnD

O TemplateBuilder usa `@dnd-kit`:
- `@dnd-kit/core` — DndContext, collision detection
- `@dnd-kit/sortable` — SortableContext, useSortable
- `horizontalListSortingStrategy` — fases horizontais
- `verticalListSortingStrategy` — tarefas verticais dentro de cada fase

---

## 6. TIPOS TYPESCRIPT

### 6.1. types/template.ts

```typescript
interface TemplateWithCounts {
  id: string; name: string; description: string
  is_active: boolean; process_type: string
  stages_count: number; tasks_count: number
}

interface TemplateDetail extends TplProcess {
  tpl_stages: TemplateStage[]
}

interface TemplateStage extends TplStage {
  tpl_tasks: TemplateTask[]
}

interface TemplateTask extends TplTask {
  tpl_subtasks?: TplSubtask[]
}
```

### 6.2. types/subtask.ts

```typescript
type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc' | 'form' | 'field'

interface SubtaskData {
  id: string; title: string; type: SubtaskType
  is_mandatory: boolean; priority?: string
  sla_days?: number; assigned_role?: string
  config: SubtaskConfig
  dependency_type: 'none' | 'subtask' | 'task'
  dependency_subtask_id?: string
  dependency_task_id?: string
  owner_scope?: 'none' | 'all_owners' | 'main_contact_only'
  person_type_filter?: 'all' | 'singular' | 'coletiva'
}
```

### 6.3. types/alert.ts

```typescript
interface AlertConfig {
  type: 'email' | 'sms' | 'whatsapp' | 'in_app'
  trigger_days_before: number
  recipients?: string[]
}
type AlertsConfig = AlertConfig[]
```

---

## 7. MOTOR DE TEMPLATES (lib/template-engine.ts)

| Funcionalidade | Estado | Notas |
|---------------|:---:|-------|
| Mapear IDs locais → DB IDs | ✅ | Na criação/edição |
| Resolver dependências task→task | ✅ | |
| Resolver dependências subtask→subtask/task | ✅ | |
| Inserção nested (stages→tasks→subtasks) | ✅ | Sequential queries |
| Legacy action_type → SubtaskType migration | ✅ | Backward compatible |
| Validação detalhada com path+message | ✅ | |

---

## 8. DISCREPÂNCIAS COM DOCUMENTAÇÃO ORIGINAL

### 8.1. CLAUDE.md — Secções Obsoletas

| Secção | Problema |
|--------|---------|
| "Tabelas de Templates de Processo" | Falta `tpl_subtasks`, `tpl_variables`, `tpl_form_templates` |
| `action_type: UPLOAD \| EMAIL \| GENERATE_DOC \| MANUAL` | **OBSOLETO** — migrado para SubtaskType nas subtarefas |
| `tpl_tasks.config` | Agora contém `alerts`, não configuração de acção |
| "trg_populate_tasks" | Não é trigger — é RPC chamado na aprovação |

### 8.2. Docs M07 — Estado por Ficheiro

| Documento | Estado | Notas |
|-----------|:---:|-------|
| PRD-M07-TEMPLATES-PROCESSO.md | ⚠️ Parcialmente obsoleto | Descreve action_type antigo |
| SPEC-M07-TEMPLATES-PROCESSO.md | ⚠️ Parcialmente obsoleto | Schema de tasks desactualizado |
| PRD-CHAT-PROCESSOS.md | ✅ Implementado | Chat existe e funciona |
| SPEC-CHAT-PROCESSOS.md | ✅ Implementado | |
| PRD-TASK-DETAIL-SHEET.md | ✅ Implementado | TaskDetailSheet com 3 abas |
| SPEC-TASK-DETAIL-SHEET.md | ✅ Implementado | |
| PRD-FORM-SUBTASKS.md | ✅ Implementado | 6 renderizadores de campo |
| SPEC-FORM-SUBTASKS.md | ✅ Implementado | |
| PRD-SUBTASK-CARDS-REDESIGN.md | ✅ Implementado | 7 componentes subtask-card-* |
| SPEC-SUBTASK-CARDS-REDESIGN.md | ✅ Implementado | |
| PRD-OWNER-CONDITIONAL-SUBTASKS.md | ✅ Implementado | owner_scope + person_type_filter |
| SPEC-OWNER-CONDITIONAL-SUBTASKS.md | ✅ Implementado | |
| PRD-NOTIFICACOES.md | ✅ Implementado | lib/notifications/service.ts |
| SPEC-NOTIFICACOES.md | ✅ Implementado | |
| PRD-APRIMORAMENTO-SUBTASKS.md | ✅ Implementado | Tipos avançados |
| PRD-TASK-SHEET-ENHANCEMENT.md | ✅ Implementado | |
| SPEC-TASK-SHEET-ENHANCEMENT.md | ✅ Implementado | |
| DOCUMENTAÇÃO-TEMPLATE-SYSTEM.md | ⚠️ Parcialmente obsoleto | Precisa actualizar schema |
| DOCUMENTAÇÃO-PREENCHIMENTO-EMAIL-DOCUMENTO.md | ✅ Válido | |
| SUBTASKS-FORM-TEMPLATES.md | ✅ Implementado | |
| SPEC-FORM-TEMPLATES-DB.md | ✅ Implementado | tpl_form_templates existe |
| SPEC-SUBTASKS-FORM.md | ✅ Implementado | |

### 8.3. Docs M07/ATUALIZACOES — Estado

| Documento | Estado |
|-----------|:---:|
| SPEC-SUBTASK-ENHANCEMENTS.md | ✅ Implementado |
| DESVIOS-SUBTASK-ENHANCEMENTS.md | ✅ Histórico válido |
| SPEC-TASK-DEPENDENCIES.md | ✅ Implementado |
| DESVIOS-TASK-DEPENDENCIES.md | ✅ Histórico válido |
| SPEC-FIX-ALERTAS-PONTA-A-PONTA.md | ⚠️ Verificar se alertas end-to-end estão completos |
| SPEC-MULTICANAL-ALERTS.md | ⚠️ Parcial — infraestrutura existe, disparo automático por verificar |

### 8.4. Docs M07/TASKS

| Documento | Estado |
|-----------|:---:|
| PRD-TEMPLATE-TASK-EDITOR.md | ✅ Implementado |
| SPEC-TEMPLATE-TASK-SHEET.md | ✅ Implementado |

---

## 9. O QUE FALTA IMPLEMENTAR

| Feature | Prioridade | Esforço | Notas |
|---------|:---:|:---:|-------|
| Disparo automático de alertas | Alta | Médio | Infraestrutura existe (lib/alerts/service.ts), falta trigger/cron |
| Dashboard de delivery status | Média | Médio | proc_alert_log existe, falta UI |
| Visibilidade condicional de campos FORM | Média | Médio | "Campo A visível se B = X" |
| Campos calculados em FORM | Baixa | Baixo | Auto-cálculos |
| Versionamento de templates | Baixa | Alto | Editar template sem afectar instâncias activas |
| Duplicação de templates | Baixa | Baixo | Copiar template existente |
| Exportação/importação de templates | Baixa | Médio | JSON export/import |
