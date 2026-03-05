# Preenchimento, Visualização e Edição de Email e Documento em Subtarefas

> **Última actualização:** 2026-03-03
>
> Este documento descreve a funcionalidade de visualização e edição de conteúdo de subtarefas dos tipos `email` e `generate_doc` dentro da execução de processos.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitectura](#2-arquitectura)
3. [Armazenamento](#3-armazenamento)
4. [API — Endpoint de Subtarefa](#4-api--endpoint-de-subtarefa)
5. [Resolução de Variáveis](#5-resolução-de-variáveis)
6. [Componentes UI](#6-componentes-ui)
   - 6.1 [TaskFormAction — Botão Eye](#61-taskformaction--botão-eye)
   - 6.2 [SubtaskEmailSheet](#62-subtaskemailsheet)
   - 6.3 [SubtaskDocSheet](#63-subtaskdocsheet)
7. [Fluxos de Dados](#7-fluxos-de-dados)
   - 7.1 [Abrir email pela primeira vez](#71-abrir-email-pela-primeira-vez)
   - 7.2 [Abrir email com rascunho existente](#72-abrir-email-com-rascunho-existente)
   - 7.3 [Guardar Rascunho](#73-guardar-rascunho)
   - 7.4 [Marcar como Enviado / Concluído](#74-marcar-como-enviado--concluído)
8. [Determinação do Template por Tipo de Pessoa](#8-determinação-do-template-por-tipo-de-pessoa)
9. [Utilitário `interpolateVariables`](#9-utilitário-interpolatevariables)
10. [Ficheiros Criados / Modificados](#10-ficheiros-criados--modificados)
11. [Notas de Implementação](#11-notas-de-implementação)

---

## 1. Visão Geral

Subtarefas do tipo `email` e `generate_doc` em tarefas COMPOSITE têm um botão **Eye** (ver) na sua linha. Clicar nesse botão abre uma sheet que ocupa o ecrã completo e:

1. **Carrega** o template de email ou documento associado à subtarefa
2. **Resolve** todas as variáveis `{{chave}}` com dados reais do processo (imóvel, proprietário, etc.)
3. **Permite editar visualmente** o conteúdo com o editor Craft.js (email) ou com textarea HTML (documento)
4. **Persiste** o conteúdo editado no DB, ligado à subtarefa específica (`config.rendered`)
5. **Repõe** o último rascunho guardado ao reabrir, sem necessitar de page refresh

O conteúdo editado **não altera o template da biblioteca** — é guardado exclusivamente na instância da subtarefa (`proc_subtasks.config.rendered`).

---

## 2. Arquitectura

```
TaskDetailSheet
  └── TaskDetailActions
        └── TaskFormAction (task COMPOSITE)
              ├── Subtarefa "email"        → botão Eye → SubtaskEmailSheet
              └── Subtarefa "generate_doc" → botão Eye → SubtaskDocSheet

SubtaskEmailSheet:
  ├── POST /api/libraries/emails/preview-data       → variáveis resolvidas (sempre, em paralelo)
  ├── GET /api/libraries/emails/[email_library_id]  → template { subject, editor_state } (1.ª vez)
  ├── Editor Craft.js com EmailVariablesProvider    → variáveis inseridas como valores reais
  └── PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]
        ├── { rendered_content }                    → guardar rascunho
        └── { rendered_content, is_completed: true} → concluir

SubtaskDocSheet:
  ├── POST /api/libraries/emails/preview-data       → mesmas variáveis
  ├── GET /api/libraries/docs/[doc_library_id]      → template { content_html, letterhead_url }
  ├── interpolateVariables(content_html, variables) → HTML final
  └── PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]
        ├── { rendered_content }                    → guardar rascunho
        └── { rendered_content, is_completed: true} → concluir
```

---

## 3. Armazenamento

O conteúdo renderizado e eventualmente editado é persistido em **`proc_subtasks.config.rendered`** (jsonb merge):

### Email
```jsonc
{
  "type": "email",
  "email_library_id": "uuid-do-template",
  "owner_scope": "all_owners",
  // Adicionado ao guardar rascunho ou marcar como enviado:
  "rendered": {
    "subject": "Olá João Silva, precisamos dos seguintes documentos...",
    "body_html": "<p>Exmo. Sr. João Silva,<br>...</p>",
    "editor_state": { /* JSON serializado do estado Craft.js, com valores reais (sem {{variáveis}}) */ }
  }
}
```

### Documento
```jsonc
{
  "type": "generate_doc",
  "doc_library_id": "uuid-do-template",
  // Adicionado ao guardar rascunho ou marcar como concluído:
  "rendered": {
    "content_html": "<p>CONTRATO DE MEDIAÇÃO IMOBILIÁRIA...</p>"
  }
}
```

**Prioridade de carregamento ao abrir a sheet (email):**

| Prioridade | Condição | Fonte |
|-----------|----------|-------|
| 1 | Rascunho guardado nesta sessão (`localDraftRef`) | Ref em memória — evita stale prop |
| 2 | `subtask.config.rendered.editor_state` existe | DB via prop (após refetch do pai) |
| 3 | Nenhuma das anteriores | Fetch template + resolve variáveis |

---

## 4. API — Endpoint de Subtarefa

**Rota:** `PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]`

**Ficheiro:** `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

**Nota de compatibilidade Zod v4:** O projecto usa **Zod v4.3.6**. `z.record(z.unknown())` com argumento único tem um bug interno nesta versão. Usar `z.any()` para campos de estrutura opaca.

**Nota de RLS:** Todas as operações em `proc_subtasks` usam `createAdminClient()` (service role), pois o cliente do utilizador não tem permissão de UPDATE na coluna `config`. O `proc_tasks` mantém o cliente de utilizador normal.

### Schema do body

```typescript
{
  is_completed?: boolean
  rendered_content?: {
    subject?: string       // email — assunto
    body_html?: string     // email — corpo HTML renderizado
    content_html?: string  // documento — conteúdo HTML
    editor_state?: unknown // email — estado JSON do editor Craft.js
  }
}
// Pelo menos um dos dois campos de nível raiz deve estar presente
```

### Tipos de subtarefa aceites

| `config.type` | `config.check_type` | Permitido? |
|---------------|---------------------|-----------|
| `checklist` | — | ✅ |
| `email` | — | ✅ |
| `generate_doc` | — | ✅ |
| — | `manual` (legado) | ✅ |
| `upload` | — | ❌ |

### Comportamento

| Body enviado | Acção no DB |
|---|---|
| `{ rendered_content }` | Merge em `config.rendered`, sem alterar `is_completed` |
| `{ is_completed: true }` | Actualiza `is_completed`, `completed_at`, `completed_by` |
| `{ rendered_content, is_completed: true }` | Ambas as operações em simultâneo |

Após alteração de `is_completed`: recalcula status da tarefa pai e progresso do processo via `recalculateProgress()`.

---

## 5. Resolução de Variáveis

**Rota:** `POST /api/libraries/emails/preview-data`

**Body:**
```typescript
{
  property_id?: string   // ID do imóvel do processo
  owner_id?: string      // ID do proprietário (da subtask.owner_id)
  consultant_id?: string
  process_id?: string
}
```

**Retorno:**
```typescript
{ variables: Record<string, string> }
// Exemplo: { "proprietario_nome": "João Silva", "imovel_ref": "IMV-2026-001", ... }
```

**Algoritmo:**
1. Lê definições de variáveis de `tpl_variables` (apenas `is_active = true`)
2. Agrupa por entidade + tabela para batch queries
3. Formata por `format_type`: `text`, `currency`, `date`, `concat`
4. Variáveis `system`: data actual, valores estáticos

O `owner_id` passado é sempre o `subtask.owner_id` — garante que as variáveis do proprietário sejam as do proprietário específico desta subtarefa (quando multiplicada por `owner_scope`).

### Contexto de variáveis no editor (email)

O `SubtaskEmailSheet` envolve o editor com `<EmailVariablesProvider variables={resolvedVariables}>`. Os componentes do editor (`EmailText`, `EmailHeading`) lêem este contexto via `useEmailVariables()` e:
- Mostram o valor resolvido no botão de variável (ex: `João Silva`)
- Inserem o valor real no editor ao clicar (em vez de `{{proprietario_nome}}`)

No template builder (fora do sheet), o contexto permanece `{}` e os tokens `{{chave}}` são inseridos normalmente.

---

## 6. Componentes UI

### 6.1 TaskFormAction — Botão Eye

**Ficheiro:** `components/processes/task-form-action.tsx`

**Props:**
```typescript
interface TaskFormActionProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  propertyId: string
  onSubtaskToggle: (taskId, subtaskId, completed) => Promise<void>
  onTaskUpdate: () => void  // refetch no pai
}
```

**Comportamento por tipo de subtarefa:**

| Tipo | Ícone | Botão Eye | Acção |
|------|-------|-----------|-------|
| `checklist` | CheckSquare cinzento | ❌ | Toggle manual |
| `upload` | Upload azul | ❌ | Sem acção directa |
| `email` | Mail âmbar | ✅ | Abre `SubtaskEmailSheet` |
| `generate_doc` | FileText roxo | ✅ | Abre `SubtaskDocSheet` |

**Badge "Rascunho":** Quando `subtask.config.rendered` existe, aparece um badge âmbar "Rascunho" na linha da subtarefa. O badge é actualizado automaticamente após guardar rascunho, pois `onSaveDraft={onTaskUpdate}` despoleta o refetch do pai.

---

### 6.2 SubtaskEmailSheet

**Ficheiro:** `components/processes/subtask-email-sheet.tsx`

**Props:**
```typescript
interface SubtaskEmailSheetProps {
  subtask: ProcSubtask
  propertyId: string
  processId: string
  taskId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: () => void    // chamado ao marcar como enviado (+ fecha sheet)
  onSaveDraft?: () => void  // chamado após guardar rascunho (dispara refetch no pai)
}
```

**Estado interno:**
| Estado | Tipo | Descrição |
|--------|------|-----------|
| `isLoading` | boolean | A carregar template + variáveis (1.ª abertura) |
| `subject` | string | Assunto editável |
| `loadedEditorState` | string \| null | JSON do estado Craft.js a carregar no Frame |
| `resolvedVariables` | Record<string, string> | Variáveis resolvidas do processo |
| `isSaving` | boolean | A guardar rascunho |
| `isCompleting` | boolean | A marcar como enviado |
| `hasRendered` | boolean | Se já há rascunho guardado (badge no header) |
| `editorKey` | number | Incrementado para forçar re-mount do Editor ao recarregar |
| `localDraftRef` | Ref | Rascunho guardado nesta sessão (evita prop stale do pai) |

**UI:**
```
┌─ Sheet (ecrã completo: 100vw × 100dvh) ──────────────────────────────────────┐
│ ┌─ Header ────────────────────────────────────────────────────────────────┐   │
│ │ [Mail] Título da subtarefa                                [X fechar]    │   │
│ │        [Badge proprietário?] [Rascunho guardado?] [Enviado?]            │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│ ┌─ Barra assunto + tabs ──────────────────────────────────────────────────┐   │
│ │ Assunto: [Input ──────────────────────────────────]  [Editar][Pré-vis.] │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│ ┌─ Canvas (modo Editar) ──────────────────────────────────────────────────┐   │
│ │ [Toolbox] │ [Frame Craft.js — conteúdo editável] │ [Propriedades/Camad]│   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│ ┌─ Canvas (modo Pré-visualizar) ──────────────────────────────────────────┐   │
│ │   ┌─ Assunto: "..." ──────────────────────────────────────────────┐    │   │
│ │   │ HTML renderizado do corpo                                      │    │   │
│ │   └───────────────────────────────────────────────────────────────┘    │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│ ┌─ Footer ────────────────────────────────────────────────────────────────┐   │
│ │ [Guardar Rascunho]                          [Marcar como Enviado]       │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Nota de layout:** A `SheetContent` usa `style={{ position: 'fixed', inset: 0, width: '100vw', maxWidth: '100vw', height: '100dvh' }}` para sobrepor os seletores CSS do Radix (`data-[side=right]:w-3/4`, `sm:max-w-sm`) com estilos inline de maior especificidade.

---

### 6.3 SubtaskDocSheet

**Ficheiro:** `components/processes/subtask-doc-sheet.tsx`

**Props:** Idênticas a `SubtaskEmailSheet` (com `onComplete`; sem `onSaveDraft`).

**Diferenças em relação ao email:**
- Usa `doc_library_id` em vez de `email_library_id`
- Fetch: `GET /api/libraries/docs/[id]` → `{ content_html, letterhead_url, name }`
- Editor simples: textarea HTML (sem Craft.js)
- Mostra `letterhead_url` como cabeçalho da pré-visualização
- Sem campo "Assunto" (só `content_html`)
- Botão "Marcar como Concluído" em vez de "Marcar como Enviado"
- `rendered_content` enviado com `content_html` (sem `editor_state`)

**UI com letterhead:**
```
┌─ Pré-visualização ─────────────────────────┐
│ ┌─ Cabeçalho (letterhead_url) ─────────┐  │
│ │ [Imagem do cabeçalho da empresa]      │  │
│ └───────────────────────────────────────┘  │
│ Conteúdo HTML renderizado...               │
└────────────────────────────────────────────┘
```

---

## 7. Fluxos de Dados

### 7.1 Abrir email pela primeira vez

```
Utilizador clica Eye numa subtarefa email
  │
  ▼ SubtaskEmailSheet abre
  │
  ├── localDraftRef → null (sem sessão anterior)
  ├── subtask.config.rendered → não existe
  │
  ├── Fetch em paralelo:
  │   ├── GET /api/libraries/emails/[email_library_id]
  │   │     → { subject: "...", editor_state: {...} }
  │   └── POST /api/libraries/emails/preview-data
  │         body: { property_id, owner_id: subtask.owner_id }
  │         → { variables: { "proprietario_nome": "João Silva", ... } }
  │
  ├── interpolateVariables(subject, variables) → "Olá João Silva..."
  ├── Substitui {{chave}} no JSON do editor_state com valores reais
  │   (replace regex sobre o JSON serializado)
  │
  └── Editor Craft.js carrega com conteúdo interpolado
      hasRendered = false (sem badge "Rascunho")
      Variáveis disponíveis via EmailVariablesProvider
```

### 7.2 Abrir email com rascunho existente

```
Utilizador clica Eye numa subtarefa email (já guardada anteriormente)
  │
  ▼ SubtaskEmailSheet abre
  │
  ├── Prioridade 1: localDraftRef.current?.subtaskId === subtask.id
  │   → Carrega subject + editorState do ref (prop pode estar stale)
  │   → Fetch de variáveis em paralelo (para botões do editor)
  │
  ├── Prioridade 2: subtask.config.rendered.editor_state existe
  │   → Carrega a partir do prop (dado refetch pelo pai)
  │   → Fetch de variáveis em paralelo
  │
  └── Mostra badge "Rascunho guardado" no header
      hasRendered = true
```

### 7.3 Guardar Rascunho

```
Utilizador edita o conteúdo e clica "Guardar Rascunho"
  │
  ├── query.serialize() → estado JSON do Craft.js
  ├── renderEmailToHtml(state, {}) → HTML final
  │
  ▼ PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]
    body: {
      rendered_content: {
        subject,
        body_html,
        editor_state: JSON.parse(state)
      }
    }
  │
  ├── DB: config = config || '{"rendered": {...}}'::jsonb
  │   (merge jsonb, preserva outros campos de config)
  │
  ├── is_completed NÃO muda
  │
  ├── localDraftRef.current = { subtaskId, subject, editorState: state }
  ├── Toast: "Rascunho guardado com sucesso!"
  ├── Badge "Rascunho guardado" aparece no header da sheet
  │
  └── onSaveDraft?.()
        → onTaskUpdate() no TaskFormAction
        → refetch no pai → subtask.config.rendered actualizado
        → badge "Rascunho" na lista de subtarefas aparece sem refresh
```

### 7.4 Marcar como Enviado / Concluído

```
Utilizador clica "Marcar como Enviado"
  │
  ▼ PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]
    body: {
      rendered_content: { subject, body_html, editor_state },
      is_completed: true
    }
  │
  ├── DB: config.rendered actualizado
  ├── DB: is_completed = true, completed_at = now(), completed_by = user.id
  │
  ├── Recalcula status da tarefa pai:
  │   ├── Todas obrigatórias completas → completed
  │   ├── Algumas → in_progress
  │   └── Nenhuma → pending
  │
  ├── recalculateProgress(proc_instance_id) → actualiza percent_complete
  │
  ├── Toast: "Email marcado como enviado!"
  ├── onComplete() → TaskFormAction actualiza contadores e ícones
  └── Sheet fecha
```

---

## 8. Determinação do Template por Tipo de Pessoa

Quando `config.has_person_type_variants = true`, o template a usar depende do tipo do proprietário da subtarefa:

```typescript
// Email
function getEmailLibraryId(subtask: ProcSubtask): string | undefined {
  const c = subtask.config
  if (c.has_person_type_variants) {
    if (subtask.owner?.person_type === 'singular') return c.singular_config?.email_library_id
    if (subtask.owner?.person_type === 'coletiva')  return c.coletiva_config?.email_library_id
  }
  return c.email_library_id
}

// Documento (mesma lógica)
function getDocLibraryId(subtask: ProcSubtask): string | undefined {
  const c = subtask.config
  if (c.has_person_type_variants) {
    if (subtask.owner?.person_type === 'singular') return c.singular_config?.doc_library_id
    if (subtask.owner?.person_type === 'coletiva')  return c.coletiva_config?.doc_library_id
  }
  return c.doc_library_id
}
```

**Exemplo:**
```
Template configurado com has_person_type_variants = true:
  singular_config.email_library_id → "template-pessoa-singular-uuid"
  coletiva_config.email_library_id → "template-empresa-uuid"

Imóvel com 2 proprietários:
  proc_subtask 1 (owner: João Silva, singular)  → usa "template-pessoa-singular-uuid"
  proc_subtask 2 (owner: Empresa ABC, coletiva) → usa "template-empresa-uuid"
```

---

## 9. Utilitário `interpolateVariables`

**Ficheiro:** `lib/utils.ts`

```typescript
/**
 * Substitui {{variável}} por valores reais num template de texto/HTML
 */
export function interpolateVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')
}
```

**Comportamento:**
- `{{proprietario_nome}}` → `"João Silva"` (se variável existe)
- `{{chave_inexistente}}` → `""` (string vazia se variável não resolvida)

> **Nota:** `lib/email-renderer.ts` usa `match` como fallback (preserva `{{chave}}`) porque é usado para **pré-visualização de templates** onde os placeholders devem ser visíveis ao designer. `interpolateVariables` usa `''` porque é usado para **renderização final** destinada ao utilizador/proprietário.

Para o estado JSON do Craft.js, a interpolação é feita directamente sobre o JSON serializado com regex, antes de passar ao `Frame`:
```typescript
const populated = stateStr.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
  const val = variables[key]
  return val !== undefined ? escapeForJsonString(val) : ''
})
```

---

## 10. Ficheiros Criados / Modificados

### Criados

| Ficheiro | Descrição |
|----------|-----------|
| `components/processes/subtask-email-sheet.tsx` | Sheet ecrã completo com editor Craft.js, guardar rascunho, marcar como enviado |
| `components/processes/subtask-doc-sheet.tsx` | Sheet de documento: pré-visualização com letterhead, edição HTML, marcar como concluído |
| `components/email-editor/email-variables-context.tsx` | Contexto React que fornece variáveis resolvidas aos componentes do editor |

### Modificados

| Ficheiro | Alteração |
|----------|-----------|
| `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | Schema expandido com `editor_state: z.any()`; admin client para `proc_subtasks`; merge em `config.rendered` |
| `components/processes/task-form-action.tsx` | `onSaveDraft={onTaskUpdate}` passado ao `SubtaskEmailSheet`; badge "Rascunho" |
| `components/processes/task-detail-actions.tsx` | Passa `propertyId` ao `TaskFormAction` |
| `components/email-editor/user/email-text.tsx` | Usa `useEmailVariables()` para mostrar e inserir valores reais |
| `components/email-editor/user/email-heading.tsx` | Idem `email-text.tsx` |
| `lib/utils.ts` | Adicionada função `interpolateVariables` |

### Dependências entre ficheiros

```
task-detail-actions.tsx
  └── task-form-action.tsx (propertyId, onTaskUpdate)
        ├── subtask-email-sheet.tsx (onSaveDraft → onTaskUpdate)
        │     ├── /api/libraries/emails/[id]        (template + editor_state)
        │     ├── /api/libraries/emails/preview-data (variáveis resolvidas)
        │     ├── email-variables-context.tsx        (EmailVariablesProvider)
        │     │     └── email-text.tsx / email-heading.tsx (useEmailVariables)
        │     └── /api/processes/.../subtasks/[id]   (guardar/concluir)
        └── subtask-doc-sheet.tsx
              ├── /api/libraries/docs/[id]           (template)
              ├── /api/libraries/emails/preview-data  (variáveis)
              └── /api/processes/.../subtasks/[id]    (guardar/concluir)
```

---

## 11. Notas de Implementação

- O envio real de email **não está implementado** — "Marcar como Enviado" é um passo manual. O envio automático será integrado futuramente.
- A edição é feita directamente no editor visual com os valores já substituídos — o utilizador nunca vê tokens `{{chave}}`.
- O `localDraftRef` resolve o problema do **prop stale**: após guardar, o componente pai não actualiza o `subtask` prop imediatamente. O ref garante que reabrir a sheet nessa sessão carregue o último rascunho, mesmo antes do refetch terminar.
- **Zod v4.3.6:** `z.record(z.unknown())` com argumento único não inicializa `._zod` correctamente. Usar `z.any()` para campos de estrutura opaca.
- **RLS em `proc_subtasks`:** O cliente autenticado do utilizador não tem permissão de UPDATE na coluna `config`. Todas as operações nesta tabela usam `createAdminClient()` (service role); `proc_tasks` mantém o cliente normal.
- O conteúdo persistido em `config.rendered` pode ser consultado ou editado novamente em qualquer momento enquanto a subtarefa não estiver concluída. Após concluída, a sheet mostra o conteúdo em modo de leitura (editor desactivado).
