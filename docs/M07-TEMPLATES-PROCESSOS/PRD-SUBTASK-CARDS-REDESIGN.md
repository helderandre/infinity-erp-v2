# PRD — Redesign de Subtarefas: De Collapsible para Cards Independentes

**Data:** 2026-03-05
**Módulo:** Processos (M06) — Sistema de Tarefas/Subtarefas

---

## 1. Problema Actual

Actualmente, as subtarefas (acções) de uma tarefa COMPOSITE ficam dentro de um `<Collapsible>` no componente `TaskFormAction` ([task-form-action.tsx](components/processes/task-form-action.tsx)). Este padrão tem limitações:

1. **Todas as subtarefas são linhas iguais** — não há distinção visual entre tipos (email, upload, documento, checklist)
2. **O collapsible esconde as acções** — o utilizador tem de expandir para ver o que precisa ser feito
3. **Cada subtarefa é uma linha simples** — sem informação contextual (quem completou, quando, status de envio, etc.)
4. **Falta de acções inline** — para reverter conclusão, reenviar email, substituir documento
5. **Sem indicação visual clara de progresso** por tipo

---

## 2. Objectivo

Substituir o `<Collapsible>` de subtarefas por **cards independentes** com layout e funcionalidade específica por tipo. Os cards ficam visíveis directamente na tab "Tarefa" do `TaskDetailSheet`, sem necessidade de expandir.

### Tipos de Card

| Tipo | Ícone | Acção Primária | Ao Clicar |
|------|-------|----------------|-----------|
| `checklist` | CheckSquare | Toggle check/uncheck | Toggle inline |
| `upload` | Upload | Upload de documento | Abre zona de upload/preview |
| `email` | Mail | Enviar email | Abre `SubtaskEmailSheet` existente |
| `generate_doc` | FileText | Gerar documento | Abre `SubtaskDocSheet` existente |

---

## 3. Arquivos Relevantes da Base de Código

### 3.1 Componentes Principais (a modificar)

| Arquivo | Linhas | Responsabilidade Actual |
|---------|--------|------------------------|
| [task-form-action.tsx](components/processes/task-form-action.tsx) | 332 | Collapsible com subtarefas — **será completamente redesenhado** |
| [task-detail-actions.tsx](components/processes/task-detail-actions.tsx) | ~400 | Renderiza acções por `action_type` — chama `TaskFormAction` para COMPOSITE |
| [task-detail-sheet.tsx](components/processes/task-detail-sheet.tsx) | ~500 | Sheet principal — tab "Tarefa" mostra metadata + actions |

### 3.2 Sheets Existentes (reutilizar)

| Arquivo | Tipo | Já Implementado |
|---------|------|----------------|
| [subtask-email-sheet.tsx](components/processes/subtask-email-sheet.tsx) | Email | Editor Craft.js, guardar rascunho, enviar, marcar enviado |
| [subtask-doc-sheet.tsx](components/processes/subtask-doc-sheet.tsx) | Gerar Documento | Preview HTML, guardar rascunho, imprimir/PDF, marcar concluído |

### 3.3 APIs e Hooks

| Arquivo | Responsabilidade |
|---------|-----------------|
| [app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts](app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts) | PUT — toggle `is_completed`, save `rendered_content`, log activities |
| [app/api/processes/[id]/tasks/[taskId]/route.ts](app/api/processes/[id]/tasks/[taskId]/route.ts) | PUT — update task status, assignments, priority |
| [app/api/processes/[id]/tasks/[taskId]/activities/route.ts](app/api/processes/[id]/tasks/[taskId]/activities/route.ts) | GET/POST — activity log |
| [hooks/use-email-status.ts](hooks/use-email-status.ts) | Hook para status de email via `log_emails` com realtime |
| [hooks/use-task-activities.ts](hooks/use-task-activities.ts) | Hook para timeline de actividades com realtime |
| [lib/processes/activity-logger.ts](lib/processes/activity-logger.ts) | `logTaskActivity()` — insere em `proc_task_activities` |

### 3.4 Types e Constantes

| Arquivo | O que contém |
|---------|-------------|
| [types/process.ts](types/process.ts) | `ProcessTask`, `TaskActivityType`, `TaskActivity`, `LogEmail`, `ActionType` |
| [types/subtask.ts](types/subtask.ts) | `ProcSubtask`, `SubtaskType`, `SubtaskOwnerConfig` |
| [lib/constants.ts](lib/constants.ts) | `SUBTASK_TYPES`, `SUBTASK_TYPE_LABELS`, `EMAIL_STATUS_CONFIG`, `TASK_ACTIVITY_TYPE_CONFIG` |

### 3.5 Schemas e Validações

| Arquivo | O que contém |
|---------|-------------|
| [lib/validations/activity.ts](lib/validations/activity.ts) | Zod schema para activity types |

### 3.6 Componentes de Upload Existentes

| Arquivo | O que faz |
|---------|----------|
| [components/processes/task-upload-action.tsx](components/processes/task-upload-action.tsx) | Upload widget para tarefas UPLOAD — mostra docs existentes + uploader |
| [components/documents/UploadZone.tsx](components/documents/UploadZone.tsx) | Componente de upload genérico |

### 3.7 Tabelas de BD Relevantes

```
proc_tasks           — tarefas instanciadas (status, action_type, config, task_result)
proc_subtasks        — subtarefas instanciadas (is_completed, config, owner_id, completed_at, completed_by)
proc_task_activities — log de actividades (activity_type, description, metadata)
log_emails           — registo de emails (resend_email_id, last_event, events, proc_subtask_id)
doc_registry         — documentos enviados (file_url, file_name, doc_type_id, status)
```

---

## 4. Design dos Cards por Tipo

### 4.1 Card Base (Layout Comum)

Todos os cards partilham:
```
┌─────────────────────────────────────────────────────────┐
│ [Ícone Tipo] [Título]                     [Status Badge]│
│                                                         │
│ [Conteúdo específico do tipo]                           │
│                                                         │
│ [Footer: badges proprietário + metadata + acções]       │
└─────────────────────────────────────────────────────────┘
```

**Estado visual:**
- **Pendente** — borda esquerda `border-l-4 border-l-slate-300`, fundo `bg-card`
- **Em progresso / Rascunho** — borda esquerda `border-l-4 border-l-amber-400`, fundo `bg-amber-50/30`
- **Concluído** — borda esquerda `border-l-4 border-l-emerald-500`, fundo `bg-emerald-50/30`, opacity 80
- **Opcional** — badge "Opcional" no canto

### 4.2 Card Checklist (`checklist`)

```
┌─────────────────────────────────────────────────────────┐
│ ☑ [Checkbox] Título da subtarefa           [Opcional?]  │
│              👤 Abel André da Silva                      │
└─────────────────────────────────────────────────────────┘
```

- Click no checkbox → toggle `is_completed`
- Quando concluído: strike-through no título, ícone ✅
- Mais simples de todos — uma linha compacta

### 4.3 Card Upload (`upload`)

```
┌─────────────────────────────────────────────────────────┐
│ 📤 Cópia do documento de identificação      ⬚ Pendente │
│                                                         │
│  ┌ - - - - - - - - - - - - - - - - - ┐                 │
│  │  Arraste um ficheiro ou clique     │                 │
│  │  para carregar (PDF, JPG, PNG)     │                 │
│  └ - - - - - - - - - - - - - - - - - ┘                 │
│                                                         │
│  👤 Abel André da Silva            Upload   [Opcional?] │
└─────────────────────────────────────────────────────────┘

// Quando tem documento:
┌─────────────────────────────────────────────────────────┐
│ 📤 Cópia do documento de identificação       ✅ Enviado │
│                                                         │
│  📄 documento-id-abel.pdf                               │
│     Enviado em 05/03/2026 às 14:30                      │
│     Por: João Silva                                     │
│                                                         │
│  [👁 Ver] [⬇ Download] [🔄 Substituir] [↩ Reverter]    │
│                                                         │
│  👤 Abel André da Silva            Upload   [Opcional?] │
└─────────────────────────────────────────────────────────┘
```

**Comportamento:**
- **Pendente:** mostra zona de upload inline (reutilizar padrão de `TaskUploadAction`)
- **Concluído:** mostra ficheiro anexado com acções (ver, download, substituir, reverter)
- **Substituir:** abre uploader e ao enviar novo doc, reverte o anterior e completa com o novo
- **Reverter:** marca `is_completed = false` e limpa `task_result`

### 4.4 Card Email (`email`)

```
┌─────────────────────────────────────────────────────────┐
│ 📧 Naturalidade                             ⬚ Pendente │
│                                                         │
│  Assunto: Pedido de Certidão de Naturalidade            │
│  Para: abel@email.com                                   │
│                                                         │
│  [✏️ Editar Email]                                      │
│                                                         │
│  👤 Abel André da Silva             Email   [Opcional?] │
└─────────────────────────────────────────────────────────┘

// Quando enviado:
┌─────────────────────────────────────────────────────────┐
│ 📧 Naturalidade                           ✅ Concluído  │
│                                                         │
│  Assunto: Pedido de Certidão de Naturalidade            │
│  Para: abel@email.com                                   │
│  Enviado em: 05/03/2026 às 14:30                        │
│  Status: ✅ Entregue                                    │
│                                                         │
│  [👁 Ver Email] [🔄 Reenviar] [↩ Reverter Conclusão]    │
│                                                         │
│  👤 Abel André da Silva             Email   [Opcional?] │
└─────────────────────────────────────────────────────────┘
```

**Comportamento:**
- **Pendente:** mostra preview do assunto, botão "Editar Email" que abre `SubtaskEmailSheet`
- **Rascunho:** badge "Rascunho" amarelo, botão "Continuar Edição"
- **Concluído:** mostra data de envio, status Resend (`EMAIL_STATUS_CONFIG`), botões ver/reenviar/reverter
- **Reverter:** marca `is_completed = false` (permite corrigir erros)
- **Reenviar:** chama `POST /api/processes/[id]/tasks/[taskId]/resend-email`
- **Status de envio realtime:** usa `useEmailStatus` hook existente

### 4.5 Card Gerar Documento (`generate_doc`)

```
┌─────────────────────────────────────────────────────────┐
│ 📄 Comprovante de Moradia                   ⬚ Pendente │
│                                                         │
│  Documento: Declaração de Morada                        │
│                                                         │
│  [✏️ Editar Documento]                                  │
│                                                         │
│  👤 Abel André da Silva         Documento   [Opcional?] │
└─────────────────────────────────────────────────────────┘

// Quando concluído:
┌─────────────────────────────────────────────────────────┐
│ 📄 Comprovante de Moradia                  ✅ Concluído │
│                                                         │
│  Documento: Declaração de Morada                        │
│  Gerado em: 05/03/2026 às 14:30                         │
│  Por: Maria Santos                                      │
│                                                         │
│  [👁 Ver] [🖨 Imprimir/PDF] [↩ Reverter Conclusão]      │
│                                                         │
│  👤 Abel André da Silva         Documento   [Opcional?] │
└─────────────────────────────────────────────────────────┘
```

**Comportamento:**
- **Pendente:** botão "Editar Documento" abre `SubtaskDocSheet`
- **Rascunho:** badge "Rascunho", botão "Continuar Edição"
- **Concluído:** data/quem gerou, botões ver/imprimir/reverter
- **Reverter:** marca `is_completed = false`

---

## 5. Alterações no Backend (API)

### 5.1 Novo Endpoint: Reverter Subtarefa

Actualmente a rota `PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]` já suporta `is_completed: false`, mas precisa de:

1. **Limpar `completed_at` e `completed_by`** ao reverter
2. **Log de actividade `reverted`** — novo tipo de actividade
3. **Para email:** NÃO apagar o `log_emails` — manter para histórico, mas o status da subtarefa volta a "pendente"
4. **Para upload:** opcionalmente limpar `task_result.doc_registry_id` do doc associado

### 5.2 Novo Endpoint: Upload de Documento por Subtarefa

Actualmente uploads de documentos para subtarefas UPLOAD não têm um fluxo dedicado. Precisamos:

- Reutilizar a lógica de `TaskUploadAction` mas associada a subtarefas
- Ao completar upload, marcar `is_completed = true` e guardar referência ao documento

### 5.3 Novos Activity Types

```typescript
// Adicionar a TaskActivityType:
| 'subtask_reverted'      // Subtarefa revertida (qualquer tipo)
| 'document_replaced'     // Documento substituído em subtarefa upload
| 'upload_completed'      // Upload de documento concluído em subtarefa
```

### 5.4 Alterações na Rota de Subtarefas

**Ficheiro:** `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

Alterações necessárias:
1. Quando `is_completed = false` (reverter):
   - Limpar `completed_at: null`, `completed_by: null`
   - Remover `config.rendered` se for para limpar rascunho (opcional)
   - Log `subtask_reverted` com metadata do tipo e estado anterior
2. Adicionar suporte para `task_result` nas subtarefas upload (guardar `doc_registry_id`)
3. Log consistente para todos os tipos

---

## 6. Novos Componentes (a criar)

### 6.1 Componentes de Card

| Componente | Ficheiro | Descrição |
|-----------|---------|-----------|
| `SubtaskCardList` | `components/processes/subtask-card-list.tsx` | Container que renderiza a lista de cards + barra de progresso |
| `SubtaskCardChecklist` | `components/processes/subtask-card-checklist.tsx` | Card compacto com checkbox |
| `SubtaskCardUpload` | `components/processes/subtask-card-upload.tsx` | Card com zona de upload ou preview de documento |
| `SubtaskCardEmail` | `components/processes/subtask-card-email.tsx` | Card com preview de email e status Resend |
| `SubtaskCardDoc` | `components/processes/subtask-card-doc.tsx` | Card com preview de documento gerado |

### 6.2 Componente Genérico Base

```typescript
// components/processes/subtask-card-base.tsx
interface SubtaskCardBaseProps {
  subtask: ProcSubtask
  icon: React.ReactNode
  typeLabel: string
  statusBadge: React.ReactNode
  children: React.ReactNode  // conteúdo específico do tipo
  footer?: React.ReactNode
  className?: string
}
```

---

## 7. Padrões de Implementação

### 7.1 Pattern: Discriminated Union para Renderização

```typescript
// Baseado no padrão existente em task-detail-actions.tsx
function renderSubtaskCard(subtask: ProcSubtask, props: SharedProps) {
  const type = getSubtaskType(subtask)

  switch (type) {
    case 'checklist':
      return <SubtaskCardChecklist subtask={subtask} {...props} />
    case 'upload':
      return <SubtaskCardUpload subtask={subtask} {...props} />
    case 'email':
      return <SubtaskCardEmail subtask={subtask} {...props} />
    case 'generate_doc':
      return <SubtaskCardDoc subtask={subtask} {...props} />
    default:
      return <SubtaskCardChecklist subtask={subtask} {...props} />
  }
}
```

### 7.2 Pattern: Estado Visual do Card (já existente no projecto)

```typescript
// Reutilizar padrão de STATUS_COLORS de lib/constants.ts
const SUBTASK_CARD_STATES = {
  pending: {
    borderColor: 'border-l-slate-300',
    bg: 'bg-card',
    icon: Circle
  },
  draft: {
    borderColor: 'border-l-amber-400',
    bg: 'bg-amber-50/30',
    icon: FileEdit
  },
  completed: {
    borderColor: 'border-l-emerald-500',
    bg: 'bg-emerald-50/30',
    icon: CheckCircle2
  },
}
```

### 7.3 Pattern: Reverter Conclusão (novo)

```typescript
// Frontend: botão "Reverter" no card
const handleRevert = async () => {
  const res = await fetch(
    `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: false }),
    }
  )
  if (res.ok) {
    onTaskUpdate()
    toast.success('Subtarefa revertida')
  }
}
```

```typescript
// Backend: na rota de subtask, ao receber is_completed = false
if (is_completed === false && currentSubtask.is_completed) {
  // Reverter
  updateData.completed_at = null
  updateData.completed_by = null

  await logTaskActivity(
    supabase,
    taskId,
    userId,
    'subtask_reverted',
    `${userName} reverteu a subtarefa "${subtask.title}"`,
    { subtask_type: subtaskType, previous_completed_at: currentSubtask.completed_at }
  )
}
```

### 7.4 Pattern: Email Status Badge (já existente)

```typescript
// Reutilizar de task-form-action.tsx:225-256
// O hook useEmailStatus já busca logs de email com realtime
const { emails } = useEmailStatus(taskId)
const emailForSubtask = emails.find(e => e.proc_subtask_id === subtask.id)
// Renderizar com EMAIL_STATUS_CONFIG de lib/constants.ts
```

### 7.5 Pattern: Upload em Subtarefa

```typescript
// Reutilizar TaskUploadAction mas adaptado para subtarefas
// O componente já mostra docs existentes por doc_type_id
// Ao completar: PUT /subtasks/[id] com is_completed: true + task_result
```

### 7.6 Pattern: Optimistic Updates (usado no projecto)

```typescript
// Exemplo de usePropertyMedia (hooks/use-property-media.ts)
// Actualizar estado local imediatamente, reverter se API falha
const handleToggle = async () => {
  // Optimistic update
  setSubtasks(prev => prev.map(s =>
    s.id === subtask.id ? { ...s, is_completed: !s.is_completed } : s
  ))

  try {
    await onSubtaskToggle(taskId, subtask.id, !subtask.is_completed)
  } catch {
    // Revert
    setSubtasks(prev => prev.map(s =>
      s.id === subtask.id ? { ...s, is_completed: subtask.is_completed } : s
    ))
    toast.error('Erro ao actualizar subtarefa')
  }
}
```

---

## 8. Alterações no Sistema de Actividades

### 8.1 Novos `TaskActivityType`

Adicionar a `types/process.ts` e `lib/validations/activity.ts`:

```typescript
| 'subtask_reverted'     // Qualquer subtarefa revertida
| 'document_replaced'    // Upload substituído
| 'upload_completed'     // Upload concluído (subtarefa)
```

### 8.2 Novos Registos em `TASK_ACTIVITY_TYPE_CONFIG`

```typescript
// lib/constants.ts
subtask_reverted: { icon: 'RotateCcw', label: 'Subtarefa revertida', color: 'text-orange-500' },
document_replaced: { icon: 'RefreshCw', label: 'Documento substituído', color: 'text-blue-500' },
upload_completed: { icon: 'Upload', label: 'Upload concluído', color: 'text-emerald-500' },
```

### 8.3 Actualizar `ICON_MAP` em `task-activity-timeline.tsx`

```typescript
import { RotateCcw, RefreshCw } from 'lucide-react'

// Adicionar ao ICON_MAP existente:
RotateCcw,
RefreshCw,
```

---

## 9. Impacto na Estrutura da Página

### 9.1 Onde os Cards São Renderizados

**Localização actual:** `TaskDetailSheet` → tab "Tarefa" → `TaskDetailActions` → `TaskFormAction` (collapsible)

**Nova localização:** `TaskDetailSheet` → tab "Tarefa" → `TaskDetailActions` → `SubtaskCardList` (cards visíveis)

A mudança é **isolada ao componente `TaskFormAction`** que será substituído por `SubtaskCardList`. O `TaskDetailActions` continua a chamar o componente para tarefas COMPOSITE/FORM.

### 9.2 Fluxo de Dados

```
TaskDetailSheet
  └── TaskDetailActions
        └── SubtaskCardList (novo, substitui TaskFormAction)
              ├── Barra de progresso (mantida, visível sempre)
              ├── SubtaskCardChecklist (inline toggle)
              ├── SubtaskCardUpload (inline upload ou preview)
              ├── SubtaskCardEmail (preview + abre SubtaskEmailSheet)
              └── SubtaskCardDoc (preview + abre SubtaskDocSheet)
```

### 9.3 Fora do Sheet (Kanban/List View)

Os `ProcessTaskCard` continuam iguais — apenas mostram o contador de subtasks (`3/7 completas`). O detalhe dos cards de subtarefa só aparece dentro do `TaskDetailSheet`.

---

## 10. Documentação de Referência Usada

### 10.1 Documentação do Projecto

| Documento | Relevância |
|-----------|-----------|
| [PRD-TASK-SHEET-ENHANCEMENT.md](docs/TASKS/PRD-TASK-SHEET-ENHANCEMENT.md) | Arquitectura do TaskDetailSheet com sidebar e tabs |
| [SPEC-TASK-SHEET-ENHANCEMENT.md](docs/TASKS/SPEC-TASK-SHEET-ENHANCEMENT.md) | Implementação do sistema de actividades |
| [PRD-EMAIL-STATUS-RESEND.md](docs/TASKS/PRD-EMAIL-STATUS-RESEND.md) | Tracking de status de email via Resend webhooks |
| [SPEC-EMAIL-STATUS-RESEND.md](docs/TASKS/SPEC-EMAIL-STATUS-RESEND.md) | Hook `useEmailStatus`, `logTaskActivity`, webhook handler |
| [PRD-OWNER-CONDITIONAL-SUBTASKS.md](docs/TASKS/PRD-OWNER-CONDITIONAL-SUBTASKS.md) | Sistema de subtarefas por proprietário |
| [DOCUMENTAÇÃO-PREENCHIMENTO-EMAIL-DOCUMENTO.md](docs/TASKS/DOCUMENTAÇÃO-PREENCHIMENTO-EMAIL-DOCUMENTO.md) | SubtaskEmailSheet e SubtaskDocSheet — editor e draft |
| [DOCUMENTAÇÃO-TEMPLATE-SYSTEM.md](docs/TASKS/DOCUMENTAÇÃO-TEMPLATE-SYSTEM.md) | Arquitectura template → instância, populate, recalculate |
| [EDGE-FUNCTION-SEND-EMAIL.md](docs/TASKS/EDGE-FUNCTION-SEND-EMAIL.md) | Edge function send-email |

### 10.2 Padrões Externos

| Pattern | Fonte | Uso |
|---------|-------|-----|
| Discriminated union card props | [React TypeScript Cheatsheets](https://react-typescript-cheatsheet.netlify.app/docs/advanced/patterns_by_usecase/) | Renderizar cards diferentes por tipo |
| shadcn Card + Badge composição | [shadcnuikit.com/components/cards/task](https://shadcnuikit.com/components/cards/task) | Layout base dos cards |
| Activity timeline vertical | [shadcn-timeline](https://github.com/timDeHof/shadcn-timeline) | Já implementado no projecto |
| Resend webhook events | [resend.com/docs/webhooks](https://resend.com/docs/webhooks/introduction) | Já implementado — status de email |
| Optimistic UI updates | Padrão existente em `usePropertyMedia` | Toggle de subtarefas |

---

## 11. Dependências e Compatibilidade

### 11.1 Nenhuma Dependência Nova Necessária

Todas as bibliotecas necessárias já estão instaladas:
- `shadcn/ui` (Card, Badge, Checkbox, Button, Progress, Sheet, Dialog)
- `lucide-react` (todos os ícones)
- `date-fns` + `pt` locale (formatação de datas)
- `sonner` (toasts)
- `@dnd-kit/*` (se quisermos reordenar cards no futuro)

### 11.2 Retrocompatibilidade

- O `SubtaskCardList` aceita as mesmas props que `TaskFormAction`
- Os sheets existentes (`SubtaskEmailSheet`, `SubtaskDocSheet`) não mudam
- A API de subtarefas já suporta `is_completed: false` — apenas precisamos melhorar o cleanup
- A barra de progresso é mantida

---

## 12. Plano de Implementação Sugerido

### Fase 1 — Backend (Preparação)
1. Adicionar novos `TaskActivityType` aos types, validações e constantes
2. Melhorar a rota PUT de subtarefas para cleanup ao reverter
3. Adicionar activity logging para `subtask_reverted`, `document_replaced`, `upload_completed`

### Fase 2 — Componentes Base
4. Criar `SubtaskCardBase` — layout comum com borda colorida, ícone, título, badges
5. Criar `SubtaskCardChecklist` — toggle simples
6. Criar `SubtaskCardList` — container com progresso e lista de cards

### Fase 3 — Cards Complexos
7. Criar `SubtaskCardEmail` — preview de email, status Resend, acções (editar/ver/reenviar/reverter)
8. Criar `SubtaskCardDoc` — preview de documento, acções (editar/ver/imprimir/reverter)
9. Criar `SubtaskCardUpload` — zona de upload, preview de ficheiro, acções (ver/download/substituir/reverter)

### Fase 4 — Integração
10. Substituir `TaskFormAction` por `SubtaskCardList` em `TaskDetailActions`
11. Testar todos os fluxos (checklist, upload, email, generate_doc)
12. Verificar que actividades são logadas correctamente
13. Verificar que a barra de progresso actualiza ao completar/reverter

### Fase 5 — Polimento
14. Animações de transição ao mudar estado (fade/scale suave)
15. Confirmação para acções destrutivas (reverter conclusão → AlertDialog)
16. Empty state quando não há subtarefas

---

## 13. Riscos e Considerações

1. **Performance:** `useEmailStatus` faz 1 query por tarefa COMPOSITE — se houver muitas tarefas abertas no sheet, pode ser pesado. Mitigação: o hook já faz fetch só quando o sheet está aberto.

2. **Reverter email enviado:** Reverter a conclusão de um email NÃO desfaz o envio — o email já foi recebido. A reversão permite apenas reenviar ou corrigir o estado no sistema.

3. **Upload substituído:** Ao substituir um documento, o anterior fica no R2 (não é apagado) mas o registo no `doc_registry` pode ser actualizado. Considerar se queremos manter histórico de versões.

4. **Subtarefas de upload:** Actualmente as subtarefas tipo `upload` não têm um fluxo dedicado — são mostradas como circle/check read-only. Este redesign dá-lhes um fluxo completo.
