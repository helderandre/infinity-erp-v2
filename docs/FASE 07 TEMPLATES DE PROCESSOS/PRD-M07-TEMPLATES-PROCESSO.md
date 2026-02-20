# PRD — M07: Templates de Processo

**Data:** 2026-02-20
**Modulo:** M07 — Templates de Processo
**Objectivo:** Criar e gerir templates (moldes) reutilizaveis de processos documentais, com builder visual tipo Kanban horizontal.

---

## 1. Resumo Executivo

O M07 permite criar e gerir templates de processos documentais. Um template e composto por **Processo > Fases > Tarefas**, onde cada tarefa tem um tipo de accao (UPLOAD, EMAIL, GENERATE_DOC, MANUAL), SLA, obrigatoriedade e role atribuido. O builder visual apresenta as fases como colunas horizontais com tarefas arrastáveis dentro de cada coluna.

**O que NAO faz parte do M07:** Execucao de processos (instanciar templates para imoveis reais) — isso e o M06.

---

## 2. Estado Actual da Base de Dados

### 2.1 Tabelas Existentes e Prontas

| Tabela | Linhas | Estado |
|--------|--------|--------|
| `tpl_processes` | 2 | OK — 1 template completo ("Captacao da Angariacao") + 1 teste |
| `tpl_stages` | 8 | OK — 6 do template principal + 2 teste |
| `tpl_tasks` | 28 | OK — 26 do template principal + 2 teste |
| `tpl_email_library` | 0 | Vazia — OK para MVP (campo fica vazio) |
| `tpl_doc_library` | 0 | Vazia — OK para MVP (campo fica vazio) |
| `doc_types` | 23 | Populada — 23 tipos de documento (is_system=true) |

### 2.2 Schema das Tabelas Relevantes

**`tpl_processes`:**
```sql
id          UUID PK DEFAULT gen_random_uuid()
name        TEXT NOT NULL
description TEXT
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT now()
```

**`tpl_stages`:**
```sql
id              UUID PK DEFAULT gen_random_uuid()
tpl_process_id  UUID FK -> tpl_processes.id
name            TEXT NOT NULL
description     TEXT
order_index     INTEGER NOT NULL
created_at      TIMESTAMPTZ DEFAULT now()
```

**`tpl_tasks`:**
```sql
id                 UUID PK DEFAULT gen_random_uuid()
tpl_stage_id       UUID FK -> tpl_stages.id
title              TEXT NOT NULL
description        TEXT
action_type        TEXT NOT NULL  -- 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL'
is_mandatory       BOOLEAN DEFAULT true
dependency_task_id UUID FK -> tpl_tasks.id (self-ref)
sla_days           INTEGER
config             JSONB DEFAULT '{}'
order_index        INTEGER NOT NULL
assigned_role      TEXT  -- 'Processual' | 'Consultor' | 'Broker/CEO'
```

### 2.3 Migracoes FASE-02 — Verificacao

Todas as migracoes necessarias JA foram aplicadas:

- `20260210172456` — `update_populate_process_tasks_trigger` — Trigger actualizado para copiar `action_type`, `config`, `assigned_role` para `proc_tasks`
- `20260217160850` — `fase_02_migrations_m1_to_m6` — Criou todas as tabelas de template/processo + doc_types
- `20260217160955` — `seed_template_captacao_angariacao_completo` — Seed do template "Captacao da Angariacao" com 6 fases e 26 tarefas

**Colunas verificadas em `proc_tasks`:** `action_type` (text), `config` (jsonb), `assigned_role` (text) — todas presentes.

### 2.4 Dados de Seed — Template "Captacao da Angariacao"

```
Fases (6):
  0: Contrato de Mediacao (CMI)
  1: Identificacao Proprietarios
  2: Identificacao Empresa (Pessoa Coletiva)
  3: Documentacao do Imovel
  4: Situacoes Especificas
  5: Validacao Final

Tarefas: 26 total
  - UPLOAD: 18 tarefas (com config.doc_type_id referenciando doc_types)
  - MANUAL: 9 tarefas
  - EMAIL: 1 tarefa
  - GENERATE_DOC: 0 tarefas

assigned_role em uso: "Processual", "Consultor", "Broker/CEO"
```

### 2.5 doc_types Disponiveis (23)

| Categoria | Tipos |
|-----------|-------|
| Contratual | Contrato de Mediacao (CMI) |
| Imovel | Caderneta Predial, Certificado Energetico, Planta do Imovel, Ficha Tecnica, Contrato Arrendamento, Regulamento Condominio, Titulo Constitutivo |
| Juridico | Certidao Permanente (CRP), Escritura, Licenca de Utilizacao, Procuracao |
| Juridico Especial | Autorizacao do Tribunal, Certidao de Obito, Habilitacao de Herdeiros |
| Proprietario | Cartao de Cidadao, Comprovativo Estado Civil, Ficha Branqueamento |
| Proprietario Empresa | Certidao Permanente Empresa, Pacto Social, Ata Poderes Venda, RCBE, Ficha Branqueamento (Empresa) |

---

## 3. Ficheiros Relevantes da Base de Codigo

### 3.1 Ja Existem (Reutilizar/Estender)

| Ficheiro | O que faz | Relevancia para M07 |
|----------|-----------|---------------------|
| [app/api/templates/route.ts](app/api/templates/route.ts) | `GET` — lista templates com contagem de fases/tarefas | Base para adicionar POST, PUT, DELETE |
| [lib/validations/template.ts](lib/validations/template.ts) | Schemas Zod: `taskSchema`, `stageSchema`, `templateSchema` | Validacao completa ja implementada |
| [types/template.ts](types/template.ts) | Types: `TemplateWithCounts`, `TemplateTask`, `TemplateStage`, `TemplateDetail`, `ActionType` | Types prontos para uso |
| [lib/constants.ts](lib/constants.ts) | `ACTION_TYPES`, `TASK_STATUS`, `PROCESS_STATUS`, `ROLES` | Labels PT-PT para action types e roles |
| [components/processes/process-tasks-section.tsx](components/processes/process-tasks-section.tsx) | Renderiza tarefas com icones por action_type, dropdown de accoes, dialog bypass | Padrao visual de task card para reutilizar |
| [components/shared/status-badge.tsx](components/shared/status-badge.tsx) | Badge colorido por status | Reutilizar para activo/inactivo |
| [components/shared/empty-state.tsx](components/shared/empty-state.tsx) | Estado vazio com icone + CTA | Reutilizar na listagem |
| [app/dashboard/processos/page.tsx](app/dashboard/processos/page.tsx) | Listagem de processos com cards, search, skeleton | Padrao de pagina de listagem |
| [components/acquisitions/acquisition-form.tsx](components/acquisitions/acquisition-form.tsx) | Formulario multi-step com stepper visual | Padrao de formulario complexo |
| [components/layout/app-sidebar.tsx](components/layout/app-sidebar.tsx) | Sidebar com menu items e permissoes | Adicionar link para templates |

### 3.2 A Criar (Novos Ficheiros)

| Ficheiro | Funcao |
|----------|--------|
| `app/dashboard/processos/templates/page.tsx` | Listagem de templates |
| `app/dashboard/processos/templates/novo/page.tsx` | Pagina de criacao |
| `app/dashboard/processos/templates/[id]/editar/page.tsx` | Pagina de edicao |
| `app/api/templates/[id]/route.ts` | GET (detalhe), PUT (editar), DELETE (desactivar) |
| `components/templates/template-list.tsx` | Grid de cards de templates |
| `components/templates/template-builder.tsx` | Builder visual principal (DnD Kanban) |
| `components/templates/template-stage-column.tsx` | Coluna de fase (container sortable) |
| `components/templates/template-task-card.tsx` | Card de tarefa (item sortable) |
| `components/templates/template-task-dialog.tsx` | Dialog para configurar tarefa |
| `components/templates/template-stage-dialog.tsx` | Dialog para configurar fase |
| `components/templates/template-preview.tsx` | Preview read-only do template |

---

## 4. Codigo Existente — Snippets Essenciais

### 4.1 API Route Handler Pattern (Reutilizar)

```typescript
// app/api/templates/route.ts — JA EXISTE (GET)
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: templates, error } = await supabase
      .from('tpl_processes')
      .select(`
        id, name, description, is_active, created_at,
        tpl_stages (id, tpl_tasks (id))
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const templatesWithCounts = templates?.map((tpl) => {
      const stages = tpl.tpl_stages || []
      const totalTasks = stages.reduce(
        (acc, stage: any) => acc + (stage.tpl_tasks?.length || 0), 0
      )
      return {
        id: tpl.id, name: tpl.name, description: tpl.description,
        is_active: tpl.is_active, created_at: tpl.created_at,
        stages_count: stages.length, tasks_count: totalTasks,
      }
    })

    return NextResponse.json(templatesWithCounts)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 4.2 Validacao Zod (JA EXISTE)

```typescript
// lib/validations/template.ts
export const taskSchema = z.object({
  title: z.string().min(1, 'O titulo e obrigatorio'),
  description: z.string().optional(),
  action_type: z.enum(['UPLOAD', 'EMAIL', 'GENERATE_DOC', 'MANUAL']),
  is_mandatory: z.boolean().default(true),
  sla_days: z.number().int().positive().optional(),
  assigned_role: z.string().optional(),
  config: z.record(z.string(), z.any()).default({}),
  order_index: z.number().int().min(0),
}).refine((task) => {
  if (task.action_type === 'UPLOAD') return !!task.config?.doc_type_id
  if (task.action_type === 'EMAIL') return !!task.config?.email_library_id
  if (task.action_type === 'GENERATE_DOC') return !!task.config?.doc_library_id
  return true
}, { message: 'Config invalido para o tipo de accao', path: ['config'] })

export const stageSchema = z.object({
  name: z.string().min(1, 'O nome da fase e obrigatorio'),
  description: z.string().optional(),
  order_index: z.number().int().min(0),
  tasks: z.array(taskSchema).min(1, 'A fase deve ter pelo menos uma tarefa'),
})

export const templateSchema = z.object({
  name: z.string().min(1, 'O nome do template e obrigatorio'),
  description: z.string().optional(),
  stages: z.array(stageSchema).min(1, 'O template deve ter pelo menos uma fase'),
})

export type TaskFormData = z.infer<typeof taskSchema>
export type StageFormData = z.infer<typeof stageSchema>
export type TemplateFormData = z.infer<typeof templateSchema>
```

### 4.3 Types (JA EXISTEM)

```typescript
// types/template.ts
export interface TemplateWithCounts extends TplProcess {
  stages_count: number
  tasks_count: number
}

export interface TemplateTask extends TplTask {
  config:
    | { doc_type_id?: string }
    | { email_library_id?: string }
    | { doc_library_id?: string }
    | Record<string, any>
}

export interface TemplateStage extends TplStage {
  tpl_tasks: TemplateTask[]
}

export interface TemplateDetail extends TplProcess {
  tpl_stages: TemplateStage[]
}

export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL'
```

### 4.4 Constantes PT-PT (JA EXISTEM)

```typescript
// lib/constants.ts — Relevantes para M07
export const ACTION_TYPES = {
  UPLOAD: 'Upload de Documento',
  EMAIL: 'Envio de Email',
  GENERATE_DOC: 'Gerar Documento',
  MANUAL: 'Tarefa Manual',
} as const

export const ROLES = {
  broker: 'Broker/CEO',
  consultor: 'Consultor',
  gestora_processual: 'Gestora Processual',
  // ...
} as const
```

### 4.5 Icones por Action Type (Padrao Existente)

```typescript
// De components/processes/process-tasks-section.tsx
import { Upload, Mail, FileText, Circle } from 'lucide-react'

const getTaskIcon = (actionType: string) => {
  switch (actionType) {
    case 'UPLOAD':    return <Upload className="h-4 w-4" />
    case 'EMAIL':     return <Mail className="h-4 w-4" />
    case 'GENERATE_DOC': return <FileText className="h-4 w-4" />
    default:          return <Circle className="h-4 w-4" />  // MANUAL
  }
}
```

### 4.6 Padrao de Listagem com Cards (Reutilizar)

```typescript
// De app/dashboard/processos/page.tsx — Padrao a seguir
// 1. Estado: processes[], isLoading, search
// 2. useDebounce(search, 300)
// 3. useCallback para loadData
// 4. Skeleton cards enquanto carrega
// 5. EmptyState quando vazio
// 6. Grid de cards com hover:bg-accent/50 transition-colors
```

### 4.7 Sidebar — Adicionar Link

```typescript
// components/layout/app-sidebar.tsx — Estrutura actual
// Adicionar sub-item "Templates" dentro de "Processos" OU
// Adicionar item separado "Templates" com permissao 'settings' ou 'processes'
const menuItems = [
  // ...existente
  {
    title: 'Processos',
    icon: FileStack,
    href: '/dashboard/processos',
    permission: 'processes',
  },
  // O link para templates sera um sub-item ou pagina acessada via botao na listagem
]
```

---

## 5. Componentes shadcn/ui Instalados (28)

```
alert, alert-dialog, avatar, badge, breadcrumb, button, card, checkbox,
combobox, command, dialog, dropdown-menu, field, form, input, input-group,
label, popover, progress, select, separator, sheet, sidebar, skeleton,
sonner, tabs, textarea, tooltip
```

**Componentes que FALTAM e serao necessarios:**

| Componente | Uso no M07 |
|------------|------------|
| `switch` | Toggle is_mandatory, is_active |
| `scroll-area` | Scroll dentro das colunas do builder |
| `collapsible` | Expandir/colapsar configuracao avancada |

---

## 6. Biblioteca DnD — @dnd-kit

### 6.1 Instalacao

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 6.2 Arquitectura Multi-Container

O builder usa o padrao **MultipleContainers** do dnd-kit:

```
DndContext (um unico contexto)
  |
  +-- SortableContext (nivel 1: fases/colunas)
  |     |
  |     +-- DroppableContainer (Fase 1)
  |     |     |
  |     |     +-- SortableContext (nivel 2: tarefas)
  |     |           +-- SortableItem (Tarefa 1)
  |     |           +-- SortableItem (Tarefa 2)
  |     |
  |     +-- DroppableContainer (Fase 2)
  |           |
  |           +-- SortableContext (nivel 2: tarefas)
  |                 +-- SortableItem (Tarefa 3)
  |
  +-- DragOverlay (portal — renderiza ghost durante drag)
```

### 6.3 Estrutura de Dados para DnD

```typescript
// Separar IDs do DnD dos dados completos
type Items = Record<string, string[]>  // { stageId: [taskId1, taskId2, ...] }

// Estado do builder
const [items, setItems] = useState<Items>({
  'stage-uuid-1': ['task-uuid-1', 'task-uuid-2'],
  'stage-uuid-2': ['task-uuid-3'],
})
const [containers, setContainers] = useState<string[]>(Object.keys(items))

// Metadados armazenados separadamente
const [stagesData, setStagesData] = useState<Record<string, StageData>>({})
const [tasksData, setTasksData] = useState<Record<string, TaskData>>({})
```

### 6.4 Sensor Configuration

```typescript
import { PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }, // CRITICO: previne drag acidental ao clicar
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
)
```

### 6.5 Helper findContainer

```typescript
const findContainer = (id: UniqueIdentifier) => {
  if (id in items) return id  // o ID e um container
  return Object.keys(items).find((key) => items[key].includes(id as string))
}
```

### 6.6 Collision Detection Strategy (Multi-Container)

```typescript
import { pointerWithin, rectIntersection, closestCenter, getFirstCollision } from '@dnd-kit/core'

const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
  // Ao arrastar container, so verificar outros containers
  if (activeId && activeId in items) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.id in items
      ),
    })
  }

  // Para items: primeiro pointer, fallback para rect
  const pointerIntersections = pointerWithin(args)
  const intersections = pointerIntersections.length > 0
    ? pointerIntersections
    : rectIntersection(args)

  let overId = getFirstCollision(intersections, 'id')

  if (overId != null) {
    if (overId in items) {
      const containerItems = items[overId]
      if (containerItems.length > 0) {
        overId = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.id !== overId && containerItems.includes(container.id as string)
          ),
        })[0]?.id
      }
    }
    lastOverId.current = overId
    return [{ id: overId }]
  }

  if (recentlyMovedToNewContainer.current) {
    lastOverId.current = activeId
  }

  return lastOverId.current ? [{ id: lastOverId.current }] : []
}, [activeId, items])
```

### 6.7 Event Handlers

```typescript
// onDragStart — snapshot para cancelamento
function handleDragStart({ active }: DragStartEvent) {
  setActiveId(active.id)
  setClonedItems(items)
}

// onDragOver — mover entre containers em tempo real
function handleDragOver({ active, over }: DragOverEvent) {
  const overId = over?.id
  if (overId == null || active.id in items) return

  const overContainer = findContainer(overId)
  const activeContainer = findContainer(active.id)
  if (!overContainer || !activeContainer || activeContainer === overContainer) return

  setItems((prev) => {
    const activeItems = prev[activeContainer]
    const overItems = prev[overContainer]
    const overIndex = overItems.indexOf(overId as string)
    const activeIndex = activeItems.indexOf(active.id as string)

    const isBelowOverItem = over && active.rect.current.translated &&
      active.rect.current.translated.top > over.rect.top + over.rect.height
    const modifier = isBelowOverItem ? 1 : 0
    const newIndex = overId in prev ? overItems.length + 1 : overIndex >= 0 ? overIndex + modifier : overItems.length + 1

    recentlyMovedToNewContainer.current = true
    return {
      ...prev,
      [activeContainer]: prev[activeContainer].filter((item) => item !== active.id),
      [overContainer]: [
        ...prev[overContainer].slice(0, newIndex),
        active.id as string,
        ...prev[overContainer].slice(newIndex),
      ],
    }
  })
}

// onDragEnd — finalizar posicao
function handleDragEnd({ active, over }: DragEndEvent) {
  if (active.id in items && over?.id) {
    setContainers((c) => arrayMove(c, c.indexOf(active.id as string), c.indexOf(over.id as string)))
  }

  const activeContainer = findContainer(active.id)
  if (!activeContainer || !over?.id) { setActiveId(null); return }

  const overContainer = findContainer(over.id)
  if (overContainer) {
    const activeIndex = items[activeContainer].indexOf(active.id as string)
    const overIndex = items[overContainer].indexOf(over.id as string)
    if (activeIndex !== overIndex) {
      setItems((items) => ({
        ...items,
        [overContainer]: arrayMove(items[overContainer], activeIndex, overIndex),
      }))
    }
  }
  setActiveId(null)
}

// onDragCancel — restaurar snapshot
function handleDragCancel() {
  if (clonedItems) setItems(clonedItems)
  setActiveId(null)
  setClonedItems(null)
}
```

### 6.8 Sortable Item (Task Card)

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableTaskCard({ id, task }: { id: string; task: TaskData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle — so esta parte inicia o drag */}
      <button {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      {/* Resto do card — cliques funcionam normalmente */}
      <span>{task.title}</span>
      <button onClick={() => openEditDialog(task)}>Editar</button>
    </div>
  )
}
```

### 6.9 Sortable Container (Stage Column)

```tsx
function DroppableStageColumn({ id, children, items }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'container', children: items },
  })

  const style = {
    transform: CSS.Translate.toString(transform),  // NOTA: Translate, nao Transform!
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners}>{/* Header da fase */}</div>
      <div>{children}</div>
    </div>
  )
}
```

### 6.10 Gotchas Criticos

| Problema | Solucao |
|----------|---------|
| Drag acidental ao clicar botoes | `activationConstraint: { distance: 8 }` no PointerSensor |
| Items flickam ao mudar de container | Usar `recentlyMovedToNewContainer` ref + `requestAnimationFrame` |
| ID collision no DragOverlay | NUNCA usar `useSortable` dentro do DragOverlay — usar componente presentational puro |
| Container distorce ao arrastar | Usar `CSS.Translate.toString()` em vez de `CSS.Transform.toString()` para containers |
| Container vazio nao recebe drop | Container deve ser ele proprio um sortable via `useSortable` |
| SSR com Next.js | Todos os componentes dnd-kit devem ser `'use client'` |
| Acessibilidade | Sempre incluir `KeyboardSensor` com `sortableKeyboardCoordinates` |

---

## 7. Padrao de API para CRUD Completo

### 7.1 POST /api/templates (Criar)

O POST recebe o template inteiro (com fases e tarefas nested) e insere em 3 tabelas numa transaccao:

```typescript
// Fluxo:
// 1. Validar com templateSchema.safeParse(body)
// 2. Inserir tpl_processes -> obter process.id
// 3. Para cada stage: inserir tpl_stages com tpl_process_id -> obter stage.id
// 4. Para cada task na stage: inserir tpl_tasks com tpl_stage_id

// Nota: Supabase JS nao suporta transaccoes explicitas.
// Opcao 1: Insercoes sequenciais com rollback manual se falhar
// Opcao 2: Usar RPC/function no Postgres para transaccao atomica
// Recomendacao: Opcao 1 para simplicidade no MVP
```

### 7.2 GET /api/templates/[id] (Detalhe)

```typescript
const { data, error } = await supabase
  .from('tpl_processes')
  .select(`
    *,
    tpl_stages (
      *,
      tpl_tasks (*)
    )
  `)
  .eq('id', id)
  .single()

// Ordenar no frontend:
// data.tpl_stages.sort((a, b) => a.order_index - b.order_index)
// stage.tpl_tasks.sort((a, b) => a.order_index - b.order_index)
```

### 7.3 PUT /api/templates/[id] (Editar)

Estrategia de update: **delete-and-recreate** para stages e tasks (mais simples que diff):

```typescript
// 1. Validar body
// 2. Update tpl_processes (name, description)
// 3. Delete todas as tpl_tasks das stages do template
// 4. Delete todas as tpl_stages do template
// 5. Inserir novas stages e tasks

// NOTA: Apenas se o template NAO tiver instancias activas
// Verificar proc_instances com current_status != 'completed'/'cancelled'
```

### 7.4 DELETE /api/templates/[id] (Desactivar)

```typescript
// Soft delete: is_active = false
await supabase.from('tpl_processes').update({ is_active: false }).eq('id', id)
```

---

## 8. Padrao de Pagina de Listagem

Baseado no padrao existente em `app/dashboard/processos/page.tsx`:

```typescript
// Estrutura:
// 1. Header: titulo + botao "Novo Template"
// 2. Barra de pesquisa com debounce
// 3. Grid de cards (md:grid-cols-2 lg:grid-cols-3)
// 4. Skeleton loading (3 cards)
// 5. EmptyState quando vazio
// 6. Card com: nome, descricao, badge activo/inactivo, contagem fases/tarefas, data criacao
```

---

## 9. Padrao de Formulario Multi-Step vs Builder

O M07 NAO usa multi-step form. Em vez disso, usa um **builder** com layout diferente:

```
+-----------------------------------------------+
| Template Name:  [________________]             |
| Description:    [________________]             |
+-----------------------------------------------+
|                                                |
| [+ Adicionar Fase]                             |
|                                                |
| +----------+ +----------+ +----------+         |
| | Fase 1   | | Fase 2   | | Fase 3   |  ...   |
| |----------| |----------| |----------|         |
| | Task 1   | | Task 4   | | Task 6   |         |
| | Task 2   | | Task 5   | |          |         |
| | Task 3   | |          | |          |         |
| |          | |          | |          |         |
| | [+Task]  | | [+Task]  | | [+Task]  |         |
| +----------+ +----------+ +----------+         |
|                                                |
| [Cancelar]               [Guardar Template]    |
+-----------------------------------------------+
```

---

## 10. Configuracao de Tarefa por Action Type

Ao clicar numa tarefa, abre um Dialog com configuracao condicional:

| Campo | Todos | UPLOAD | EMAIL | GENERATE_DOC | MANUAL |
|-------|-------|--------|-------|-------------|--------|
| Titulo | X | X | X | X | X |
| Descricao | X | X | X | X | X |
| Tipo de Accao | X | X | X | X | X |
| Obrigatoria? | X | X | X | X | X |
| SLA (dias) | X | X | X | X | X |
| Role Atribuido | X | X | X | X | X |
| Tipo de Documento | | X (select doc_types) | | | |
| Template de Email | | | X (select tpl_email_library) | | |
| Template de Documento | | | | X (select tpl_doc_library) | |

**Select de doc_types:**
```typescript
// Buscar no mount do dialog
const { data: docTypes } = await supabase.from('doc_types').select('id, name, category').order('category, name')

// Agrupar por categoria no select
<Select>
  <SelectGroup>
    <SelectLabel>Contratual</SelectLabel>
    <SelectItem value="uuid1">Contrato de Mediacao (CMI)</SelectItem>
  </SelectGroup>
  <SelectGroup>
    <SelectLabel>Imovel</SelectLabel>
    <SelectItem value="uuid2">Caderneta Predial</SelectItem>
    ...
  </SelectGroup>
</Select>
```

**Select de email/doc templates (MVP):**
```typescript
// tpl_email_library e tpl_doc_library estao vazias
// Mostrar select vazio com mensagem "Nenhum template disponivel"
// Ou campo de texto livre para nome do template
// Sera completado quando M13 (Bibliotecas) for implementado
```

---

## 11. Roles Atribuiveis a Tarefas

Valores actuais na base de dados:

```typescript
const ASSIGNABLE_ROLES = [
  { value: 'Processual', label: 'Gestora Processual' },
  { value: 'Consultor', label: 'Consultor' },
  { value: 'Broker/CEO', label: 'Broker/CEO' },
] as const
```

---

## 12. Referencias Externas

### dnd-kit Documentacao

- **Oficial:** https://dndkit.com/
- **Instalacao:** https://docs.dndkit.com/introduction/installation
- **Sortable Preset:** https://dndkit.com/presets/sortable
- **MultipleContainers Example (codigo fonte):** https://github.com/clauderic/dnd-kit/blob/master/stories/2%20-%20Presets/Sortable/MultipleContainers.tsx

### Tutoriais

- **Build a Kanban board with dnd-kit and React (LogRocket):** https://blog.logrocket.com/build-kanban-board-dnd-kit-react/
- **Kanban Board with React and dnd-kit (Radzion):** https://radzion.com/blog/kanban/
- **Kanban Board with Drag-and-Drop in React with Shadcn (Marmelab):** https://marmelab.com/blog/2026/01/15/building-a-kanban-board-with-shadcn.html
- **Awesome Kanban Board using dnd-kit (Chetan Verma):** https://www.chetanverma.com/blog/how-to-create-an-awesome-kanban-board-using-dnd-kit

### Componentes Pre-Construidos (Referencia)

- **Dice UI Kanban (shadcn-compatible):** https://www.diceui.com/docs/components/radix/kanban
- **react-dnd-kit-tailwind-shadcn-ui (GitHub):** https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui
- **shadcn-kanban-board (zero-dependency):** https://github.com/janhesters/shadcn-kanban-board

### NPM Packages

```bash
# Necessarios
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Pacotes:
# @dnd-kit/core     — DndContext, sensors, collision detection, DragOverlay
# @dnd-kit/sortable — SortableContext, useSortable, arrayMove, strategies
# @dnd-kit/utilities — CSS transform utilities
```

---

## 13. Decisoes de Design

### 13.1 DnD vs Botoes de Setas

**Decisao: DnD com fallback de botoes.**
- O builder visual e a principal feature do M07
- dnd-kit suporta keyboard accessibility nativo
- Botoes de setas sao secundarios (para acessibilidade)

### 13.2 Transaccao de Save

**Decisao: Insercoes sequenciais no MVP.**
- Supabase JS nao suporta transaccoes explicitas
- Se uma insercao falhar, limpar manualmente
- Para producao: migrar para RPC/stored procedure

### 13.3 Update Strategy

**Decisao: Delete-and-recreate para stages/tasks.**
- Mais simples que diff complexo
- Validar que nao ha instancias activas antes de permitir edicao
- Templates com instancias activas: apenas editar nome/descricao/is_active

### 13.4 Sidebar Navigation

**Decisao: Botao na pagina de Processos + link directo na listagem.**
- Nao adicionar item separado no sidebar (evitar poluicao)
- Na pagina `/dashboard/processos`, adicionar botao "Gerir Templates"
- URL: `/dashboard/processos/templates`

### 13.5 Email/Doc Library no MVP

**Decisao: Campos visiveis mas com nota "Em breve".**
- Selects de email e doc templates mostram "Nenhum template disponivel"
- Nao bloqueia a criacao de tarefas EMAIL/GENERATE_DOC
- Sera completado com o M13

---

## 14. Checklist de Componentes shadcn Necessarios

```bash
# Ja instalados (28) — SUFICIENTE para M07
# Componentes shadcn opcionais a instalar:
npx shadcn@latest add switch       # Toggle is_mandatory, is_active
npx shadcn@latest add scroll-area  # Scroll nas colunas do builder
```

---

## 15. Sumario de Dependencias

| Dependencia | Estado | Accao |
|-------------|--------|-------|
| Tabelas DB (tpl_processes, tpl_stages, tpl_tasks) | Existem | Nenhuma |
| assigned_role em tpl_tasks | Existe | Nenhuma |
| action_type + config em proc_tasks | Existe | Nenhuma |
| Trigger populate_process_tasks | Actualizado | Nenhuma |
| doc_types | 23 registos | Nenhuma |
| tpl_email_library | Vazia | Mostrar "Em breve" |
| tpl_doc_library | Vazia | Mostrar "Em breve" |
| Validacao Zod | Existe | Nenhuma |
| Types TypeScript | Existem | Nenhuma |
| API GET /templates | Existe | Estender com POST |
| @dnd-kit | Nao instalado | `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` |
| shadcn switch | Nao instalado | `npx shadcn@latest add switch` |
| shadcn scroll-area | Nao instalado | `npx shadcn@latest add scroll-area` |
