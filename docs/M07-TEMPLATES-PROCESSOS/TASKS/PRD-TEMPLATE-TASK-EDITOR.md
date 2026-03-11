# PRD — Novo Editor de Tarefas em Templates (Sheet + Subtasks)

**Data:** 2026-02-25
**Módulo:** M07 — Templates de Processo
**Status:** Pesquisa Concluída

---

## 1. Resumo da Mudança

**Antes (actual):** Dialog (`template-task-dialog.tsx`) para criar/editar tarefas dentro de um template.

**Depois (novo):** Sheet lateral (side panel) no estilo do `task-detail-sheet.tsx` do módulo de processos, com:
- Header fixo (título + badges)
- Corpo scrollável com campos de edição + lista de subtasks
- Subtasks com drag-and-drop, cada uma podendo ser: Upload de Documento, Checklist Manual, ou outro tipo de acção
- Botão "Adicionar Subtask" com dropdown de tipo
- Footer fixo com acções (Guardar / Cancelar)

---

## 2. Arquivos da Base de Código Afectados

### 2.1 Arquivos a MODIFICAR

| Arquivo | Razão |
|---------|-------|
| [template-builder.tsx](src/components/templates/template-builder.tsx) | Substituir abertura de Dialog por abertura de Sheet. Ajustar callbacks `handleAddTask` / `handleEditTask` |
| [template-task-card.tsx](src/components/templates/template-task-card.tsx) | Click no card abre o novo Sheet (em vez de dialog). Possível ajuste nos badges |
| [template-stage-column.tsx](src/components/templates/template-stage-column.tsx) | Botão "Adicionar Tarefa" agora abre Sheet em vez de Dialog |
| [subtask-editor.tsx](src/components/templates/subtask-editor.tsx) | Refactoring significativo — deixa de ser exclusivo para FORM, passa a ser genérico para todos os tipos de subtask |
| [lib/validations/template.ts](src/lib/validations/template.ts) | Actualizar schema — subtasks passam a existir em qualquer task (não só FORM) |
| [lib/constants.ts](src/lib/constants.ts) | Possível adição de novas constantes para tipos de subtask |
| [types/template.ts](src/types/template.ts) | Actualizar `TaskData` — subtasks deixam de ser opcionais/exclusivas de FORM |
| [types/subtask.ts](src/types/subtask.ts) | Actualizar `SubtaskData` — novos check_types ou simplificação |

### 2.2 Arquivo a ELIMINAR

| Arquivo | Razão |
|---------|-------|
| [template-task-dialog.tsx](src/components/templates/template-task-dialog.tsx) | Substituído pelo novo Sheet |

### 2.3 Arquivo a CRIAR

| Arquivo | Descrição |
|---------|-----------|
| `components/templates/template-task-sheet.tsx` | Novo Sheet lateral para criar/editar tarefas com subtasks |

### 2.4 Arquivos de REFERÊNCIA (padrões a reutilizar)

| Arquivo | O que reutilizar |
|---------|------------------|
| [task-detail-sheet.tsx](src/components/processes/task-detail-sheet.tsx) | Layout do Sheet: header fixo + corpo scrollável + footer fixo |
| [task-detail-metadata.tsx](src/components/processes/task-detail-metadata.tsx) | Padrão de campos editáveis inline (Select, Switch, etc.) |
| [task-detail-actions.tsx](src/components/processes/task-detail-actions.tsx) | Padrão de secção de acções dinâmica por tipo |
| [subtask-editor.tsx](src/components/templates/subtask-editor.tsx) | Drag-and-drop de subtasks com @dnd-kit (refactorizar) |
| [property-media-gallery.tsx](src/components/properties/property-media-gallery.tsx) | Padrão de lista sortable com add/remove |

### 2.5 APIs Afectadas

| Arquivo | Impacto |
|---------|---------|
| [app/api/templates/route.ts](src/app/api/templates/route.ts) | POST — ajustar inserção de subtasks para qualquer task (não só FORM) |
| [app/api/templates/[id]/route.ts](src/app/api/templates/[id]/route.ts) | PUT — mesma lógica de subtasks genéricas |

---

## 3. Padrões de Implementação Existentes na Base de Código

### 3.1 Padrão: Sheet com Header Fixo + Corpo Scrollável + Footer Fixo

**Fonte:** `components/processes/task-detail-sheet.tsx`

Este é o padrão "muito bom" que queremos replicar:

```tsx
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent
    side="right"
    className="sm:max-w-2xl w-full min-w-[600px] p-0 flex flex-col h-full"
  >
    {/* HEADER FIXO */}
    <SheetHeader className="border-b px-6 py-4 space-y-2">
      <div className="flex items-center gap-2">
        {statusIcon}
        <SheetTitle className="text-lg">{task.title}</SheetTitle>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{ACTION_TYPES[task.action_type]}</Badge>
        {task.is_mandatory && <Badge variant="outline">Obrigatória</Badge>}
        <Badge variant="outline">{task.stage_name}</Badge>
      </div>
    </SheetHeader>

    {/* CORPO SCROLLÁVEL */}
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
      <TaskDetailMetadata ... />
      <Separator />
      <TaskDetailActions ... />
    </div>

    {/* FOOTER FIXO */}
    <div className="border-t px-6 py-3">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={handleSave}>Guardar</Button>
      </div>
    </div>
  </SheetContent>
</Sheet>
```

**Classes CSS chave:**
- `p-0 flex flex-col h-full` — no SheetContent para layout flex completo
- `flex-1 overflow-y-auto` — no corpo para scroll
- `border-b` / `border-t` — separadores visuais header/footer

### 3.2 Padrão: Lista Sortable com @dnd-kit (Vertical)

**Fonte:** `components/templates/subtask-editor.tsx`

```tsx
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Sensors com activation constraint
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)

// Handler de reorder
const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const oldIndex = subtasks.findIndex((s) => s.id === active.id)
  const newIndex = subtasks.findIndex((s) => s.id === over.id)
  const reordered = arrayMove(subtasks, oldIndex, newIndex)
    .map((s, idx) => ({ ...s, order_index: idx }))
  onChange(reordered)
}, [subtasks, onChange])

// Componente sortable individual
function SortableSubtaskRow({ subtask, onUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-md border bg-card p-2">
      <button {...attributes} {...listeners} className="mt-2.5 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      {/* campos inline */}
    </div>
  )
}
```

### 3.3 Padrão: Adicionar / Remover Items de Array

**Fonte:** `components/templates/subtask-editor.tsx`

```tsx
// Adicionar
const handleAdd = () => {
  onChange([
    ...subtasks,
    {
      id: crypto.randomUUID(),
      title: '',
      is_mandatory: true,
      order_index: subtasks.length,
      config: { check_type: 'manual' },
    },
  ])
}

// Remover
const handleRemove = (id: string) => {
  onChange(
    subtasks
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, order_index: idx }))
  )
}

// Actualizar campo individual
const handleUpdate = (id: string, data: Partial<SubtaskData>) => {
  onChange(subtasks.map((s) => (s.id === id ? { ...s, ...data } : s)))
}
```

### 3.4 Padrão: Select com Agrupamento por Categoria

**Fonte:** `components/templates/subtask-editor.tsx`

```tsx
// Agrupar doc types por categoria
const docTypesByCategory = docTypes.reduce<Record<string, typeof docTypes>>(
  (acc, dt) => {
    const cat = dt.category || 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  },
  {}
)

// Render com SelectGroup
<Select value={value} onValueChange={onValueChange}>
  <SelectTrigger className="h-8 text-xs">
    <SelectValue placeholder="Seleccionar documento..." />
  </SelectTrigger>
  <SelectContent>
    {Object.entries(docTypesByCategory).map(([category, types]) => (
      <SelectGroup key={category}>
        <SelectLabel>{category}</SelectLabel>
        {types.map((dt) => (
          <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
        ))}
      </SelectGroup>
    ))}
  </SelectContent>
</Select>
```

### 3.5 Padrão: Campos Condicionais por Tipo (Dynamic Forms)

**Fonte:** `components/templates/template-task-dialog.tsx`

```tsx
// Carregar dados condicionais
useEffect(() => {
  if (['UPLOAD', 'FORM'].includes(actionType) && docTypes.length === 0) {
    fetch('/api/libraries/doc-types').then(res => res.json()).then(setDocTypes)
  }
}, [actionType, docTypes.length])

// Render condicional
{actionType === 'UPLOAD' && (
  <Select value={docTypeId} onValueChange={setDocTypeId}>
    {/* lista de tipos de documento */}
  </Select>
)}

{actionType === 'EMAIL' && (
  <Select value={emailLibraryId} onValueChange={setEmailLibraryId}>
    {/* lista de templates de email */}
  </Select>
)}

{actionType === 'MANUAL' && (
  <p className="text-sm text-muted-foreground">Sem configuração adicional</p>
)}
```

### 3.6 Padrão: TaskData e SubtaskData (Tipos Actuais)

**Fonte:** `types/template.ts` + `types/subtask.ts`

```tsx
// TaskData actual (do template-builder.tsx)
interface TaskData {
  id: string
  title: string
  description?: string
  action_type: 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM'
  is_mandatory: boolean
  priority?: 'urgent' | 'normal' | 'low'
  sla_days?: number
  assigned_role?: string
  config: Record<string, any>
  subtasks?: SubtaskData[]  // <-- Hoje só existe para FORM
}

// SubtaskData actual
interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  config: {
    check_type: 'field' | 'document' | 'manual'
    field_name?: string      // se check_type === 'field'
    doc_type_id?: string     // se check_type === 'document'
  }
}
```

### 3.7 Padrão: Constantes Existentes (PT-PT)

**Fonte:** `lib/constants.ts`

```tsx
export const ACTION_TYPES = {
  UPLOAD: 'Upload de Documento',
  EMAIL: 'Envio de Email',
  GENERATE_DOC: 'Gerar Documento',
  MANUAL: 'Tarefa Manual',
  FORM: 'Preencher Formulário',
}

export const TASK_PRIORITY_LABELS = {
  urgent: 'Urgente',
  normal: 'Normal',
  low: 'Baixa',
}

export const CHECK_TYPE_LABELS = {
  field: 'Campo do proprietário',
  document: 'Documento',
  manual: 'Verificação manual',
}
```

### 3.8 Padrão: Ícones por Tipo de Acção

**Fonte:** `components/templates/template-task-card.tsx`

```tsx
const ACTION_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  UPLOAD:       { icon: Upload, color: 'text-blue-500' },
  EMAIL:        { icon: Mail, color: 'text-amber-500' },
  GENERATE_DOC: { icon: FileText, color: 'text-purple-500' },
  FORM:         { icon: ClipboardList, color: 'text-teal-500' },
  MANUAL:       { icon: CheckSquare, color: 'text-slate-500' },
}
```

---

## 4. Documentação Externa Relevante

### 4.1 shadcn/ui Sheet — Layout com Sticky Header/Footer

**Fonte:** [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/radix/sheet) | [Patterns](https://www.shadcn.io/patterns/sheet-multi-section-5)

**Padrão recomendado:**
```tsx
<Sheet>
  <SheetContent className="flex flex-col p-0 h-full">
    {/* Sticky Header */}
    <SheetHeader className="border-b px-6 py-4 shrink-0">
      <SheetTitle>Título</SheetTitle>
    </SheetHeader>

    {/* Scrollable Content */}
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Conteúdo longo... */}
    </div>

    {/* Sticky Footer */}
    <SheetFooter className="border-t px-6 py-4 shrink-0">
      <Button variant="outline">Cancelar</Button>
      <Button>Guardar</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**Props chave:**
- `side`: `"top" | "right" | "bottom" | "left"` (default: `"right"`)
- `showCloseButton`: boolean (default: `true`)
- Baseado em Radix UI Dialog (acessível, keyboard nav, esc para fechar)

### 4.2 @dnd-kit Sortable — Lista Vertical com Add/Remove

**Fonte:** [dnd-kit Sortable](https://dndkit.com/presets/sortable) | [SortableContext](https://docs.dndkit.com/presets/sortable/sortable-context)

**Estratégias de sorting:**
- `verticalListSortingStrategy` — listas verticais (a usar para subtasks)
- `horizontalListSortingStrategy` — listas horizontais
- `rectSortingStrategy` — grid 2D
- `rectSwappingStrategy` — troca (swap)

**Padrão para add/remove com sortable:**
```tsx
// Adicionar item
const addItem = () => {
  setItems(prev => [...prev, { id: crypto.randomUUID(), ...defaults }])
}

// Remover item
const removeItem = (id: string) => {
  setItems(prev => prev.filter(item => item.id !== id))
}

// Reordenar (onDragEnd)
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event
  if (over && active.id !== over.id) {
    setItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id)
      const newIndex = prev.findIndex(i => i.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }
}

// Wrapper
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
    {items.map(item => <SortableItem key={item.id} {...item} />)}
  </SortableContext>
</DndContext>
```

**Boas práticas:**
- Usar `PointerSensor` com `activationConstraint: { distance: 5 }` para evitar drag acidental
- Usar `KeyboardSensor` com `sortableKeyboardCoordinates` para acessibilidade
- `DragOverlay` para feedback visual durante drag (evita problemas com scroll containers)
- Items array do `SortableContext` deve estar na mesma ordem do render

### 4.3 react-hook-form useFieldArray

**Fonte:** [useFieldArray API](https://react-hook-form.com/docs/usefieldarray)

**NOTA:** A base de código actual NÃO usa `useFieldArray`. Usa gestão manual de arrays com `useState` + callbacks. Recomendo manter o padrão existente para consistência.

**Métodos disponíveis (caso se decida usar):**
- `append(obj)` — adicionar ao final
- `prepend(obj)` — adicionar ao início
- `insert(index, obj)` — inserir em posição
- `remove(index)` — remover
- `move(from, to)` — mover (equivalente a drag-and-drop reorder)
- `swap(from, to)` — trocar posições
- `update(index, obj)` — actualizar item
- `replace(arr)` — substituir array inteiro

**Regra importante:** Sempre usar `field.id` como key no `map()`, não o index.

---

## 5. Arquitectura Proposta do Novo Componente

### 5.1 Estrutura Visual do Sheet

```
┌──────────────────────────────────────────────┐
│  HEADER FIXO                                  │
│  ┌─ Input: Título da tarefa ────────────────┐│
│  └──────────────────────────────────────────┘│
│  Textarea: Descrição (opcional)               │
│  [Obrigatória ⟟]                             │
├──────────────────────────────────────────────┤
│  CORPO SCROLLÁVEL                             │
│                                               │
│  ── Detalhes ──                               │
│  Prioridade:    [Normal ▾]                    │
│  Role:          [Gestora Processual ▾]        │
│  SLA (dias):    [2]                           │
│                                               │
│  ── Subtasks ──                               │
│  ┌ ⋮⋮ Upload: Certidão Permanente  [✓] [✕] ┐│
│  └──────────────────────────────────────────┘│
│  ┌ ⋮⋮ Upload: Caderneta Predial    [✓] [✕] ┐│
│  └──────────────────────────────────────────┘│
│  ┌ ⋮⋮ Checklist: Validar NIF       [✓] [✕] ┐│
│  └──────────────────────────────────────────┘│
│  ┌ ⋮⋮ Email: Pedido de docs        [✓] [✕] ┐│
│  └──────────────────────────────────────────┘│
│                                               │
│  [+ Adicionar Subtask ▾]                      │
│    ├ Upload de Documento                      │
│    ├ Checklist (Manual)                       │
│    ├ Envio de Email                           │
│    └ Gerar Documento                          │
│                                               │
├──────────────────────────────────────────────┤
│  FOOTER FIXO                                  │
│                    [Cancelar] [Guardar]        │
└──────────────────────────────────────────────┘
```

### 5.2 Modelo de Dados Proposto

```typescript
// TaskData (actualizado)
interface TaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  priority?: 'urgent' | 'normal' | 'low'
  sla_days?: number
  assigned_role?: string
  subtasks: SubtaskData[]  // SEMPRE presente, array (pode ser vazio)
}

// SubtaskData (actualizado — mais genérico)
interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  type: 'upload' | 'checklist' | 'email' | 'generate_doc'
  config: {
    doc_type_id?: string        // se type === 'upload'
    email_library_id?: string   // se type === 'email'
    doc_library_id?: string     // se type === 'generate_doc'
    // checklist não precisa de config extra
  }
}
```

**Mudança conceptual:** O `action_type` antigo da TaskData migra para ser o `type` de cada subtask. Uma tarefa agora é um container de subtasks, e cada subtask define o seu próprio tipo de acção.

### 5.3 Fluxo de Interacção

1. **Abrir Sheet**: Click em "Adicionar Tarefa" na coluna → abre Sheet vazio (modo criação)
2. **Abrir Sheet**: Click no card de tarefa existente → abre Sheet preenchido (modo edição)
3. **Preencher campos**: Título, descrição, obrigatória, prioridade, role, SLA
4. **Adicionar subtask**: Botão "Adicionar Subtask" → Dropdown com tipos → seleccionar tipo
5. **Configurar subtask**: Dependendo do tipo:
   - **Upload**: Seleccionar tipo de documento (agrupado por categoria)
   - **Checklist**: Escrever texto da verificação manual
   - **Email**: Seleccionar template de email da biblioteca
   - **Gerar Doc**: Seleccionar template de documento
6. **Reordenar subtasks**: Drag-and-drop com handle (GripVertical)
7. **Remover subtask**: Botão trash (com confirmação se tem dados)
8. **Guardar**: Validar campos obrigatórios → fechar Sheet → retornar TaskData ao builder

### 5.4 Composição de Componentes

```
TemplateTaskSheet (NOVO)
  ├─ SheetContent (side="right", max-w-2xl)
  │   ├─ SheetHeader (fixo, border-b)
  │   │   ├─ Input: título
  │   │   ├─ Textarea: descrição
  │   │   └─ Switch: obrigatória
  │   │
  │   ├─ ScrollableDiv (flex-1, overflow-y-auto)
  │   │   ├─ Secção "Detalhes"
  │   │   │   ├─ Select: prioridade
  │   │   │   ├─ Select: role atribuído
  │   │   │   └─ Input: SLA dias
  │   │   │
  │   │   ├─ Separator
  │   │   │
  │   │   └─ Secção "Subtasks"
  │   │       ├─ DndContext + SortableContext
  │   │       │   └─ SortableSubtaskRow[] (reutilizar/refactorizar subtask-editor)
  │   │       │       ├─ GripVertical (drag handle)
  │   │       │       ├─ Ícone do tipo
  │   │       │       ├─ Título / config inline
  │   │       │       ├─ Switch: obrigatória
  │   │       │       └─ Trash2 (remover)
  │   │       │
  │   │       └─ DropdownMenu: "Adicionar Subtask"
  │   │           ├─ Upload de Documento
  │   │           ├─ Checklist (Manual)
  │   │           ├─ Envio de Email
  │   │           └─ Gerar Documento
  │   │
  │   └─ Footer (fixo, border-t)
  │       ├─ Button outline: Cancelar
  │       └─ Button primary: Guardar
```

---

## 6. Snippets Úteis para Implementação

### 6.1 DropdownMenu para "Adicionar Subtask"

**Padrão existente:** shadcn DropdownMenu (já instalado)

```tsx
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const SUBTASK_TYPES = [
  { type: 'upload', label: 'Upload de Documento', icon: Upload, color: 'text-blue-500' },
  { type: 'checklist', label: 'Checklist (Manual)', icon: CheckSquare, color: 'text-slate-500' },
  { type: 'email', label: 'Envio de Email', icon: Mail, color: 'text-amber-500' },
  { type: 'generate_doc', label: 'Gerar Documento', icon: FileText, color: 'text-purple-500' },
]

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="w-full">
      <Plus className="mr-2 h-3.5 w-3.5" />
      Adicionar Subtask
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" className="w-56">
    {SUBTASK_TYPES.map((st) => (
      <DropdownMenuItem key={st.type} onClick={() => handleAddSubtask(st.type)}>
        <st.icon className={cn('mr-2 h-4 w-4', st.color)} />
        {st.label}
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

### 6.2 Handler de Adição com Tipo

```tsx
const handleAddSubtask = (type: SubtaskData['type']) => {
  const defaults: Record<string, Partial<SubtaskData>> = {
    upload: { title: '', config: {} },
    checklist: { title: '', config: {} },
    email: { title: '', config: {} },
    generate_doc: { title: '', config: {} },
  }

  setSubtasks(prev => [
    ...prev,
    {
      id: crypto.randomUUID(),
      type,
      title: defaults[type]?.title || '',
      is_mandatory: true,
      order_index: prev.length,
      config: defaults[type]?.config || {},
      ...defaults[type],
    },
  ])
}
```

### 6.3 Row de Subtask Condicional por Tipo

```tsx
function SortableSubtaskRow({ subtask, docTypes, emailTemplates, onUpdate, onRemove }) {
  // ... useSortable setup ...

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-md border bg-card p-3">
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="mt-2 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Conteúdo */}
      <div className="flex-1 space-y-2">
        {/* Tipo badge + título inline */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="shrink-0 text-xs">
            {SUBTASK_TYPE_LABELS[subtask.type]}
          </Badge>
          <Input
            value={subtask.title}
            onChange={(e) => onUpdate(subtask.id, { title: e.target.value })}
            placeholder={getPlaceholder(subtask.type)}
            className="h-8 text-sm"
          />
        </div>

        {/* Config condicional */}
        {subtask.type === 'upload' && (
          <Select
            value={subtask.config.doc_type_id || ''}
            onValueChange={(v) => onUpdate(subtask.id, { config: { ...subtask.config, doc_type_id: v } })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar tipo de documento..." />
            </SelectTrigger>
            <SelectContent>
              {/* SelectGroups por categoria */}
            </SelectContent>
          </Select>
        )}

        {subtask.type === 'email' && (
          <Select
            value={subtask.config.email_library_id || ''}
            onValueChange={(v) => onUpdate(subtask.id, { config: { ...subtask.config, email_library_id: v } })}
          >
            {/* lista de templates de email */}
          </Select>
        )}

        {/* checklist: só precisa do título — nenhum config extra */}
      </div>

      {/* Mandatory toggle + delete */}
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={subtask.is_mandatory}
          onCheckedChange={(v) => onUpdate(subtask.id, { is_mandatory: v })}
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
          onClick={() => onRemove(subtask.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
```

---

## 7. Pacotes Instalados (Sem Novas Dependências)

Todos os pacotes necessários já estão instalados:

| Pacote | Versão | Uso |
|--------|--------|-----|
| `@dnd-kit/core` | ^6.3.1 | DndContext, sensors, collision detection |
| `@dnd-kit/sortable` | ^10.0.0 | SortableContext, useSortable, arrayMove |
| `@dnd-kit/utilities` | ^3.2.2 | CSS.Transform |
| `react-hook-form` | instalado | Opcional se quisermos useFieldArray |
| `zod` | instalado | Validação de schema |
| `sonner` | instalado | Toasts de feedback |
| `lucide-react` | instalado | Ícones (GripVertical, Upload, Mail, etc.) |

**Nenhuma nova dependência é necessária.**

---

## 8. Impacto na Base de Dados

### Tabela `tpl_subtasks` — Já Existe

```sql
tpl_subtasks
├── id (UUID, PK)
├── tpl_task_id (UUID, FK → tpl_tasks.id)
├── title (text)
├── description (text)
├── is_mandatory (boolean, default true)
├── order_index (int)
├── config (jsonb)
```

**Mudança necessária:** O campo `config` actualmente armazena `{ check_type, field_name?, doc_type_id? }`. Passará a armazenar `{ type: 'upload'|'checklist'|'email'|'generate_doc', doc_type_id?, email_library_id?, doc_library_id? }`.

### Tabela `tpl_tasks` — Simplificação

O campo `action_type` pode ser deprecado/removido já que o conceito de "tipo de acção" migra para as subtasks. Decisão: manter por retrocompatibilidade ou migrar.

**Recomendação:** Manter `action_type` como campo calculado/derivado do tipo predominante das subtasks, ou simplesmente remover e derivar na UI.

---

## 9. Checklist de Implementação

- [ ] Criar `components/templates/template-task-sheet.tsx` com layout Sheet (header/body/footer)
- [ ] Implementar secção de detalhes (título, descrição, obrigatória, prioridade, role, SLA)
- [ ] Refactorizar `subtask-editor.tsx` para suportar todos os tipos de subtask (não só FORM)
- [ ] Implementar DropdownMenu "Adicionar Subtask" com tipos
- [ ] Implementar rows condicionais por tipo (upload → doc select, email → template select, etc.)
- [ ] Implementar drag-and-drop de subtasks (reutilizar padrão @dnd-kit existente)
- [ ] Actualizar `template-builder.tsx` para usar Sheet em vez de Dialog
- [ ] Actualizar `template-task-card.tsx` para abrir Sheet no click
- [ ] Actualizar `template-stage-column.tsx` — botão "Adicionar" abre Sheet
- [ ] Actualizar `types/template.ts` e `types/subtask.ts`
- [ ] Actualizar `lib/validations/template.ts`
- [ ] Actualizar APIs `POST/PUT /api/templates` para subtasks genéricas
- [ ] Eliminar `template-task-dialog.tsx`
- [ ] Testar criação de template completo (stages + tasks + subtasks)
- [ ] Testar edição de template existente
- [ ] Testar drag-and-drop de subtasks dentro da Sheet

---

## 10. Fontes

### Base de Código
- `components/processes/task-detail-sheet.tsx` — Padrão de Sheet a replicar
- `components/templates/template-task-dialog.tsx` — Dialog actual a substituir
- `components/templates/subtask-editor.tsx` — Editor de subtasks a refactorizar
- `components/templates/template-builder.tsx` — Builder principal a actualizar
- `components/properties/property-media-gallery.tsx` — Padrão @dnd-kit sortable

### Documentação Externa
- [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/radix/sheet)
- [Sheet Sticky Header/Footer Pattern](https://www.shadcn.io/patterns/sheet-multi-section-5)
- [Sheet Scrollable Content](https://www.shadcn.io/patterns/sheet-multi-section-3)
- [Sheet Action Buttons Footer](https://www.shadcn.io/patterns/sheet-multi-section-4)
- [@dnd-kit Sortable](https://dndkit.com/presets/sortable)
- [@dnd-kit SortableContext](https://docs.dndkit.com/presets/sortable/sortable-context)
- [react-hook-form useFieldArray](https://react-hook-form.com/docs/usefieldarray)
- [@dnd-kit GitHub](https://github.com/clauderic/dnd-kit)
- [dnd-kit Tree List Pattern](https://dev.to/fupeng_wang/react-dnd-kit-implement-tree-list-drag-and-drop-sortable-225l)
