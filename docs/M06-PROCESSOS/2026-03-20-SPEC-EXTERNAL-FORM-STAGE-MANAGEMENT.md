# SPEC: Formulário Externo + Gestão de Estágios em Processos

**Data**: 2026-03-20
**PRD**: [2026-03-20-PRD-EXTERNAL-FORM-STAGE-MANAGEMENT.md](2026-03-20-PRD-EXTERNAL-FORM-STAGE-MANAGEMENT.md)

---

## Resumo

Duas funcionalidades:

1. **`external_form`** — Novo tipo de subtarefa: popup com campos read-only + copiar + links externos + atalhos de documentos
2. **Gestão de Estágios** — Conclusão explícita de estágio, dependências entre estágios, cores dinâmicas no Kanban

---

## FASE A: Formulário Externo (`external_form`)

---

### A1. `types/subtask.ts`

**Modificar** — Adicionar tipo `external_form` e interfaces associadas.

**L3** — Adicionar `'external_form'` ao union type:
```typescript
export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc' | 'form' | 'field' | 'schedule_event' | 'external_form'
```

**Após L96** (depois de `FieldSubtaskConfig`) — Adicionar novas interfaces:
```typescript
export interface ExternalFormField {
  field_name: string
  label: string
  target_entity: FormTargetEntity  // 'property' | 'property_specs' | 'property_internal' | 'owner' | 'property_owner'
  format?: 'text' | 'currency' | 'number' | 'date'
  order_index: number
}

export interface ExternalLink {
  site_name: string
  url: string
  icon_url?: string
}

export interface DocumentShortcut {
  doc_type_id: string
  label?: string
}

export interface ExternalFormConfig {
  type: 'external_form'
  form_title?: string
  fields: ExternalFormField[]
  external_links: ExternalLink[]
  document_shortcuts: DocumentShortcut[]
}
```

**Em `SubtaskData.config`** (~L189-219) e **`TplSubtask.config`** (~L100-133) — Incluir os novos campos na união de config:
- Adicionar `external_form_fields?: ExternalFormField[]`
- Adicionar `external_links?: ExternalLink[]`
- Adicionar `document_shortcuts?: DocumentShortcut[]`
- Adicionar `form_title?: string`

> **Nota:** Verificar como os outros tipos (form, field) armazenam config em `SubtaskData` e `TplSubtask` — seguir o mesmo padrão de flatten vs nested.

---

### A2. `lib/validations/template.ts`

**Modificar** — Adicionar `'external_form'` à validação Zod e config associada.

**L7-13** — No `subtaskSchema`, campo `type`:
```typescript
type: z.enum(['upload', 'checklist', 'email', 'generate_doc', 'form', 'field', 'schedule_event', 'external_form'])
```

**L22-107** — No objecto `config`, adicionar campos:
```typescript
form_title: z.string().optional(),
external_form_fields: z.array(z.object({
  field_name: z.string(),
  label: z.string(),
  target_entity: z.enum(['property', 'property_specs', 'property_internal', 'owner', 'property_owner']),
  format: z.enum(['text', 'currency', 'number', 'date']).optional(),
  order_index: z.number(),
})).optional(),
external_links: z.array(z.object({
  site_name: z.string(),
  url: z.string().url(),
  icon_url: z.string().url().optional(),
})).optional(),
document_shortcuts: z.array(z.object({
  doc_type_id: z.string(),
  label: z.string().optional(),
})).optional(),
```

**L109-138** — No primeiro `.refine()`, adicionar regra para `external_form`:
```typescript
if (data.type === 'external_form') {
  if (!data.config.external_form_fields || data.config.external_form_fields.length === 0) {
    return false // precisa de pelo menos 1 campo
  }
}
```

---

### A3. `lib/constants.ts`

**Modificar** — Adicionar labels e ícone para `external_form`.

**L598-609** — Em `SUBTASK_TYPE_LABELS`:
```typescript
external_form: 'Formulário Externo',
```

**L611-619** — Em `SUBTASK_TYPE_ICONS`:
```typescript
external_form: 'ClipboardList',  // ou 'ExternalLink' — ícone Lucide
```

---

### A4. `components/templates/subtask-config-dialog.tsx`

**Modificar** — Adicionar secção de configuração para tipo `external_form`.

**Na secção `Dados`** (~L486-682) — Adicionar bloco condicional para `type === 'external_form'`:

1. **Campo `form_title`** — Input de texto para o título do popup
2. **Campos do formulário** — Reutilizar `FormFieldPicker` em modo simplificado:
   - Lista de campos com `field_name`, `label`, `target_entity`, `format`
   - Botão "Adicionar Campo" que abre picker de campos (reutilizar catálogo de `form-field-picker.tsx`)
   - Drag-to-reorder com @dnd-kit
3. **Links externos** — Lista editável:
   - Cada link: `site_name` (input), `url` (input), botão remover
   - Botão "Adicionar Link"
4. **Atalhos de documentos** — Lista com select de `doc_types`:
   - Select do `doc_type_id` (reutilizar lista de doc types já carregada no dialog)
   - Campo `label` override opcional
   - Botão "Adicionar Documento"

**Na secção `Proprietários`** (~L756-912) — O tipo `external_form` DEVE ser incluído na lista de tipos que suportam owner config. Verificar a condição que controla se a secção de proprietários aparece — adicionar `'external_form'` à lista.

---

### A5. `components/templates/subtask-editor.tsx`

**Modificar** — Adicionar `external_form` à lista de tipos disponíveis.

**~L107-115** — Em `SUBTASK_TYPE_OPTIONS`, adicionar:
```typescript
{ type: 'external_form' as SubtaskType, label: 'Formulário Externo', icon: ClipboardList }
```

**~L371-382** — Em `hasAdvancedConfig()`, adicionar detecção de config de external_form (campos, links, documentos).

---

### A6. `components/processes/task-detail-actions.tsx`

**Modificar** — Adicionar lógica de renderização para subtarefas `external_form`.

**~L107-115** — Em `SUBTASK_TYPE_OPTIONS`, adicionar:
```typescript
{ type: 'external_form', label: 'Formulário Externo', icon: ClipboardList }
```

**~L310-510** — Em `renderActionContent()`, o tipo `external_form` segue o mesmo padrão de `COMPOSITE/FORM` (usa `SubtaskCardList`). Verificar se já é coberto pelo caso COMPOSITE — se não, adicionar caso.

---

### A7. `components/processes/subtask-card-base.tsx`

**Modificar** — Garantir que o componente base renderiza correctamente o tipo `external_form`.

Verificar em `process-task-card.tsx` ~L95-103 o mapa `SUBTASK_TYPE_ICONS_MAP` e adicionar:
```typescript
external_form: ClipboardList,
```

---

### A8. CRIAR `components/processes/external-form-dialog.tsx`

**Criar** — Dialog que mostra campos resolvidos com copiar + links externos + atalhos de documentos.

**Props:**
```typescript
interface ExternalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtask: ProcSubtask
  property: ProcessInstance['property']  // dados da propriedade (do ProcessDetail)
  owner?: ProcessOwner                   // se subtarefa multiplicada por proprietário
  processDocuments: ProcessDocument[]    // para resolver atalhos de documentos
  onComplete: () => void                // callback para marcar como concluída
}
```

**Lógica de resolução de campos:**
```typescript
function resolveFieldValue(
  field: ExternalFormField,
  property: ProcessInstance['property'],
  owner?: ProcessOwner
): string {
  switch (field.target_entity) {
    case 'property':
      return property?.[field.field_name] ?? ''
    case 'property_specs':
      return property?.dev_property_specifications?.[field.field_name] ?? ''
    case 'property_internal':
      return property?.dev_property_internal?.[field.field_name] ?? ''
    case 'owner':
    case 'property_owner':
      return owner?.[field.field_name] ?? ''
  }
}
```

**Formatação de valores:**
```typescript
function formatValue(value: string | number, format?: string): string {
  switch (format) {
    case 'currency': return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value))
    case 'number': return new Intl.NumberFormat('pt-PT').format(Number(value))
    case 'date': return /* format com date-fns */
    default: return String(value ?? '')
  }
}
```

**Resolução de atalhos de documentos:**
```typescript
function resolveDocumentShortcuts(
  shortcuts: DocumentShortcut[],
  processDocuments: ProcessDocument[]
): ResolvedDocShortcut[] {
  return shortcuts.map(shortcut => {
    const doc = processDocuments.find(d => d.doc_type_id === shortcut.doc_type_id)
    return {
      label: shortcut.label || doc?.doc_type?.name || 'Documento',
      doc_type_id: shortcut.doc_type_id,
      available: !!doc,
      file_url: doc?.file_url || null,
      file_name: doc?.file_name || null,
    }
  })
}
```

**UI — Estrutura do Dialog:**
1. **Header**: `form_title` ou "Formulário Externo"
2. **Secção campos**: Lista de campos com label + valor + `<CopyButton>`
3. **Botão "Copiar Todos"**: Copia `label: valor\n` de todos os campos
4. **Separator**
5. **Secção links externos**: Cards clicáveis com `target="_blank"` + ícone ExternalLink
6. **Secção documentos** (se houver shortcuts): Links de download ou "Não disponível"
7. **Footer**: Botão "Concluir" que marca subtarefa como concluída + fecha dialog

---

### A9. CRIAR `components/shared/copy-button.tsx`

**Criar** — Botão de copiar reutilizável com feedback visual.

```typescript
interface CopyButtonProps {
  value: string
  label?: string
  className?: string
}
```

- Usa `navigator.clipboard.writeText()` com fallback `document.execCommand('copy')`
- Ícone alterna entre `Copy` e `Check` (2s timeout)
- Toast via `sonner`: `"${label} copiado!"`

---

### A10. Integração do Dialog na Pipeline

**Modificar `components/processes/task-detail-actions.tsx`** — Quando uma subtarefa `external_form` é clicada, abrir o `ExternalFormDialog`.

Adicionar estado:
```typescript
const [externalFormSubtask, setExternalFormSubtask] = useState<ProcSubtask | null>(null)
```

Renderizar dialog:
```tsx
<ExternalFormDialog
  open={!!externalFormSubtask}
  onOpenChange={(open) => !open && setExternalFormSubtask(null)}
  subtask={externalFormSubtask!}
  property={/* do contexto do processo */}
  owner={externalFormSubtask?.owner}
  processDocuments={processDocuments}
  onComplete={handleSubtaskComplete}
/>
```

Nos cards de subtarefa do tipo `external_form`, o click abre o dialog em vez de acção inline.

---

### A11. API — Completar subtarefa `external_form`

**Ficheiro:** `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

**Sem alterações necessárias** — A rota PUT já suporta `is_completed: true` que é genérico para todos os tipos. O dialog no frontend chama esta API com `{ is_completed: true }`.

**Verificar** apenas que o `activity_type` no log de actividade faz sentido para `external_form` — pode precisar de um case adicional (~L230-312) para logar como `"external_form_completed"` ou simplesmente `"completed"`.

---

## FASE B: Gestão de Estágios com Conclusão Explícita

---

### B1. Migração SQL

**Executar via Supabase MCP** (`mcp__claude_ai_SupabaseInfinity__execute_sql` ou `apply_migration`):

```sql
-- 1. Dependências entre estágios no template
ALTER TABLE tpl_stages
  ADD COLUMN depends_on_stages UUID[] DEFAULT '{}';

-- 2. Tracking de estágios no processo
ALTER TABLE proc_instances
  ADD COLUMN current_stage_ids UUID[] DEFAULT '{}',
  ADD COLUMN completed_stage_ids UUID[] DEFAULT '{}';

-- 3. Migrar dados existentes (current_stage_id → current_stage_ids)
UPDATE proc_instances
SET current_stage_ids = CASE
  WHEN current_stage_id IS NOT NULL THEN ARRAY[current_stage_id]
  ELSE '{}'
END;
```

> **Nota:** NÃO remover `current_stage_id` — manter para backwards compatibility. O novo código usa `current_stage_ids` mas `current_stage_id` continua a ser actualizado como alias do primeiro elemento.

---

### B2. `types/template.ts`

**Modificar** — Adicionar `depends_on_stages` ao tipo `TemplateStage`.

**L23-25** — `TemplateStage`:
```typescript
export interface TemplateStage extends TplStage {
  tpl_tasks: TemplateTask[]
  depends_on_stages?: string[]  // UUID[] dos estágios dependentes
}
```

> **Nota:** Verificar se `TplStage` é importado de um tipo gerado (database.ts) ou definido manualmente. Se gerado, a coluna nova aparecerá após regeneração de types. Se manual, adicionar `depends_on_stages?: string[]` ao tipo base.

---

### B3. `types/process.ts`

**Modificar** — Actualizar `ProcessStageWithTasks` e `ProcessInstance`.

**L78-85** — `ProcessStageWithTasks`, adicionar campos de estado:
```typescript
export interface ProcessStageWithTasks {
  id: string                    // ← NOVO: ID do tpl_stage
  name: string
  order_index: number
  status: 'completed' | 'in_progress' | 'pending'
  is_current: boolean           // ← NOVO: está na lista current_stage_ids
  is_completed_explicit: boolean // ← NOVO: está na lista completed_stage_ids
  depends_on_stages: string[]   // ← NOVO: dependências
  tasks_completed: number
  tasks_total: number
  tasks: ProcessTask[]
}
```

**L38-63** — `ProcessInstance`, adicionar campos:
```typescript
current_stage_ids?: string[]      // ← NOVO
completed_stage_ids?: string[]    // ← NOVO
```

---

### B4. `lib/validations/template.ts`

**Modificar** — Adicionar `depends_on_stages` ao `stageSchema`.

**L190-195** — `stageSchema`:
```typescript
export const stageSchema = z.object({
  name: z.string().min(1, 'Nome da fase é obrigatório'),
  order_index: z.number(),
  depends_on_stages: z.array(z.string()).default([]),  // ← NOVO
  tasks: z.array(taskSchema).min(1, 'Cada fase precisa de pelo menos 1 tarefa'),
})
```

---

### B5. `components/templates/template-builder.tsx`

**Modificar** — Adicionar `depends_on_stages` ao `StageData`.

**L55-59** — `StageData`:
```typescript
interface StageData {
  id: string
  name: string
  description?: string
  depends_on_stages: string[]  // ← NOVO: IDs de estágios dos quais depende
}
```

**~L446-484** — No payload de save, incluir `depends_on_stages` na serialização de cada stage:
```typescript
stages: containers.map((stageId, idx) => ({
  name: stagesData[stageId].name,
  description: stagesData[stageId].description,
  order_index: idx,
  depends_on_stages: stagesData[stageId].depends_on_stages || [],  // ← NOVO
  tasks: [...]
}))
```

**Ao carregar template existente** (modo edição) — Mapear `depends_on_stages` do `TemplateStage` para o `StageData`. Atenção: os IDs dos estágios no template são IDs de DB; ao carregar, o builder usa IDs locais. Precisar de um mapa `dbStageId → localStageId` para converter as referências.

---

### B6. `components/templates/template-stage-dialog.tsx`

**Modificar** — Adicionar selector de dependências de estágios.

Actualmente tem apenas `name` e `description`. Adicionar:

**Novas props:**
```typescript
interface TemplateStageDialogProps {
  // ... props existentes
  allStages?: { id: string; name: string }[]  // ← NOVO: para selector de dependências
  currentStageId?: string                      // ← NOVO: para excluir o próprio
}
```

**Novo campo no form** (após description):
```tsx
<div className="space-y-2">
  <Label>Depende dos Estágios</Label>
  <p className="text-xs text-muted-foreground">
    Este estágio só pode ser concluído após os estágios seleccionados.
  </p>
  {/* Checkboxes ou MultiSelect dos estágios existentes (excluindo o próprio) */}
  {otherStages.map(stage => (
    <div key={stage.id} className="flex items-center gap-2">
      <Checkbox
        checked={dependsOnStages.includes(stage.id)}
        onCheckedChange={(checked) => {
          setDependsOnStages(prev =>
            checked ? [...prev, stage.id] : prev.filter(id => id !== stage.id)
          )
        }}
      />
      <Label className="text-sm font-normal">{stage.name}</Label>
    </div>
  ))}
</div>
```

**`onSubmit`** — Incluir `depends_on_stages` no retorno.

---

### B7. `lib/process-engine.ts`

**Modificar** — Refactoring de `recalculateProgress()` para suportar estágios explícitos.

**L164-186** — Substituir lógica de determinação de estágio actual.

**Lógica actual:** Encontra primeira fase não-completa por `stage_order_index`.

**Nova lógica:**

```typescript
// 1. Buscar completed_stage_ids e depends_on_stages
const { data: instance } = await adminClient
  .from('proc_instances')
  .select('completed_stage_ids, tpl_process_id')
  .eq('id', procInstanceId)
  .single()

const { data: stages } = await adminClient
  .from('tpl_stages')
  .select('id, order_index, depends_on_stages')
  .eq('tpl_process_id', instance.tpl_process_id)
  .order('order_index')

// 2. Calcular current_stage_ids
const currentStageIds = calculateCurrentStages(stages, instance.completed_stage_ids || [])

// 3. Actualizar proc_instances
await adminClient
  .from('proc_instances')
  .update({
    current_stage_ids: currentStageIds,
    current_stage_id: currentStageIds[0] || null,  // backwards compat
    percent_complete: percentComplete,
    updated_at: new Date().toISOString(),
    ...(percentComplete >= 100 ? { current_status: 'completed', completed_at: new Date().toISOString() } : {}),
  })
  .eq('id', procInstanceId)
```

**Adicionar função `calculateCurrentStages`** (pode ser no mesmo ficheiro ou exportada):

```typescript
export function calculateCurrentStages(
  allStages: { id: string; order_index: number; depends_on_stages: string[] }[],
  completedStageIds: string[]
): string[] {
  const completed = new Set(completedStageIds)
  const sorted = [...allStages].sort((a, b) => a.order_index - b.order_index)
  const currentStages: string[] = []

  for (const stage of sorted) {
    if (completed.has(stage.id)) continue

    const depsOk = (stage.depends_on_stages || []).every(depId => completed.has(depId))
    if (!depsOk) continue

    currentStages.push(stage.id)

    // Sem dependências explícitas → fluxo sequencial (parar no primeiro)
    if ((stage.depends_on_stages || []).length === 0 && currentStages.length > 0) {
      break
    }
  }

  return currentStages
}
```

> **IMPORTANTE:** O cálculo de `percent_complete` (baseado em tarefas/subtarefas) NÃO muda. Apenas a determinação de estágio actual muda.

---

### B8. CRIAR `app/api/processes/[id]/stages/[stageId]/complete/route.ts`

**Criar** — API para conclusão explícita de estágio.

```typescript
import { createClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { calculateCurrentStages } from '@/lib/process-engine'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const { id: procId, stageId } = await params
  const adminClient = createClient()

  // 1. Buscar instância
  const { data: instance } = await adminClient
    .from('proc_instances')
    .select('id, tpl_process_id, completed_stage_ids, current_stage_ids, current_status')
    .eq('id', procId)
    .single()

  if (!instance) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  if (instance.current_status !== 'active') {
    return NextResponse.json({ error: 'Processo não está activo' }, { status: 400 })
  }

  // 2. Verificar que o estágio é actual
  if (!instance.current_stage_ids?.includes(stageId)) {
    return NextResponse.json({ error: 'Estágio não é actual' }, { status: 400 })
  }

  // 3. Verificar dependências satisfeitas
  const { data: stage } = await adminClient
    .from('tpl_stages')
    .select('id, depends_on_stages')
    .eq('id', stageId)
    .single()

  const completedSet = new Set(instance.completed_stage_ids || [])
  const depsOk = (stage.depends_on_stages || []).every(depId => completedSet.has(depId))
  if (!depsOk) {
    return NextResponse.json({ error: 'Dependências de estágio não satisfeitas' }, { status: 400 })
  }

  // 4. Adicionar aos concluídos
  const newCompleted = [...(instance.completed_stage_ids || []), stageId]

  // 5. Recalcular estágios actuais
  const { data: allStages } = await adminClient
    .from('tpl_stages')
    .select('id, order_index, depends_on_stages')
    .eq('tpl_process_id', instance.tpl_process_id)
    .order('order_index')

  const newCurrent = calculateCurrentStages(allStages, newCompleted)

  // 6. Actualizar
  await adminClient
    .from('proc_instances')
    .update({
      completed_stage_ids: newCompleted,
      current_stage_ids: newCurrent,
      current_stage_id: newCurrent[0] || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', procId)

  // 7. Log de auditoria
  // (inserir em log_audit ou proc_activities)

  return NextResponse.json({
    completed_stage_ids: newCompleted,
    current_stage_ids: newCurrent,
  })
}
```

---

### B9. `app/api/processes/[id]/route.ts`

**Modificar** — Incluir dados de estágio na resposta GET.

**~L298-333** — Na construção de `stages`, adicionar campos novos:

```typescript
// Buscar current_stage_ids e completed_stage_ids da instância
const currentStageIds: string[] = instance.current_stage_ids || []
const completedStageIds: string[] = instance.completed_stage_ids || []

// No stage grouping, incluir:
const stages: ProcessStageWithTasks[] = stageGroups.map(group => ({
  id: group.stageId,           // ← precisa incluir o tpl_stage_id
  name: group.name,
  order_index: group.order_index,
  status: /* lógica existente */,
  is_current: currentStageIds.includes(group.stageId),
  is_completed_explicit: completedStageIds.includes(group.stageId),
  depends_on_stages: group.depends_on_stages || [],
  tasks_completed: group.tasks_completed,
  tasks_total: group.tasks_total,
  tasks: group.tasks,
}))
```

> **IMPORTANTE:** Actualmente, o stage grouping é feito por `stage_name` dos proc_tasks. Para incluir o `id` do tpl_stage e `depends_on_stages`, precisa de uma query adicional a `tpl_stages` (já que `proc_tasks` tem `tpl_task_id` que liga a `tpl_tasks.tpl_stage_id`). Alternativa: buscar `tpl_stages` directamente pelo `tpl_process_id` da instância.

---

### B10. `app/api/templates/route.ts`

**Modificar** — Persistir `depends_on_stages` ao criar template.

**~L138-260** — Na inserção de `tpl_stages`, incluir `depends_on_stages`:

```typescript
const { data: insertedStage } = await adminClient
  .from('tpl_stages')
  .insert({
    tpl_process_id: process.id,
    name: stage.name,
    order_index: stage.order_index,
    depends_on_stages: stage.depends_on_stages || [],  // ← NOVO
  })
  .select('id')
  .single()
```

> **Nota:** O `depends_on_stages` contém IDs locais no payload. Precisar converter para IDs de DB após inserção de todos os estágios. Padrão: inserir todos os estágios primeiro → criar mapa localId→dbId → update `depends_on_stages` com IDs de DB.

**Passos:**
1. Inserir todos os stages sem `depends_on_stages`
2. Criar mapa `stageLocalId → stageDbId`
3. Para cada stage com `depends_on_stages`, fazer UPDATE com IDs de DB convertidos

---

### B11. `app/api/templates/[id]/route.ts`

**Modificar** — Mesmo padrão do POST (B10) para o PUT.

A lógica de delete-recreate (~L128-344) já limpa tudo. Na recriação, aplicar o mesmo padrão de dois passos (insert → update depends).

---

### B12. `components/processes/process-kanban-view.tsx`

**Modificar** — Substituir cores estáticas por cores dinâmicas baseadas em estado.

**L10-17** — Substituir `STAGE_COLORS` por:

```typescript
const STAGE_STATUS_COLORS = {
  current: {
    dot: 'bg-blue-500',
    headerBg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-700',
  },
  completed: {
    dot: 'bg-emerald-500',
    headerBg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-700',
  },
  waiting: {
    dot: 'bg-slate-400',
    headerBg: 'bg-slate-400/10',
    border: 'border-slate-400/20',
    text: 'text-slate-500',
  },
} as const

function getStageColor(stage: ProcessStageWithTasks) {
  if (stage.is_completed_explicit) return STAGE_STATUS_COLORS.completed
  if (stage.is_current) return STAGE_STATUS_COLORS.current
  return STAGE_STATUS_COLORS.waiting
}
```

**No render** (~L56-65) — Substituir `STAGE_COLORS[idx % STAGE_COLORS.length]` por `getStageColor(stage)`.

**Adicionar botão de conclusão** no header de cada coluna (se `is_current && !is_completed_explicit`):
```tsx
{stage.is_current && !stage.is_completed_explicit && (
  <Button
    variant="outline"
    size="sm"
    className="w-full mt-2 text-xs"
    onClick={() => handleCompleteStage(stage.id)}
  >
    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
    Concluir Estágio
  </Button>
)}
```

**Novas props necessárias:**
```typescript
interface ProcessKanbanViewProps {
  // ... existentes
  onStageComplete?: (stageId: string) => void  // ← NOVO
}
```

---

### B13. CRIAR `components/processes/stage-complete-dialog.tsx`

**Criar** — Dialog de confirmação de conclusão de estágio.

```typescript
interface StageCompleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stageName: string
  onConfirm: () => void
  isLoading?: boolean
}
```

Usa `AlertDialog` do shadcn:
- Título: "Concluir Estágio"
- Descrição: `Tem a certeza de que pretende marcar o estágio "${stageName}" como concluído? Após confirmação, o próximo estágio ficará em evidência.`
- Botões: "Cancelar" / "Confirmar Conclusão"

---

### B14. `components/processes/process-stepper.tsx`

**Modificar** — Suportar múltiplos estágios actuais.

**L19-25** — Substituir lógica de `activeStep`:

```typescript
// Actual: encontra 1 stage in_progress
// Novo: pode haver múltiplos. O stepper marca todos os is_current como activos

const activeSteps = stages
  .map((s, idx) => s.is_current ? idx : -1)
  .filter(idx => idx >= 0)
```

No render, cada step pode ter 3 estados visuais:
- **Verde** com check — `is_completed_explicit === true`
- **Azul** activo — `is_current === true`
- **Cinza** — waiting

---

### B15. Integração na página de processo

**Ficheiro:** Página que renderiza o `ProcessKanbanView` (verificar em `app/dashboard/processos/[id]/page.tsx` ou componente pai).

Adicionar handler `onStageComplete`:

```typescript
async function handleStageComplete(stageId: string) {
  try {
    const res = await fetch(`/api/processes/${processId}/stages/${stageId}/complete`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error(await res.text())
    toast.success('Estágio concluído com sucesso')
    // Refresh dados do processo
    mutate()
  } catch (err) {
    toast.error('Erro ao concluir estágio')
  }
}
```

---

## Ficheiros — Resumo Final

### CRIAR (4 ficheiros)

| Ficheiro | Descrição |
|----------|-----------|
| `components/processes/external-form-dialog.tsx` | Dialog do formulário externo (campos + copiar + links + docs) |
| `components/processes/stage-complete-dialog.tsx` | AlertDialog de confirmação de conclusão de estágio |
| `components/shared/copy-button.tsx` | Botão de copiar com feedback visual |
| `app/api/processes/[id]/stages/[stageId]/complete/route.ts` | API POST para concluir estágio |

### MODIFICAR (16 ficheiros)

| Ficheiro | Alteração Principal |
|----------|--------------------|
| `types/subtask.ts` | `'external_form'` no union + interfaces `ExternalFormConfig`, `ExternalFormField`, `ExternalLink`, `DocumentShortcut` |
| `types/process.ts` | `ProcessStageWithTasks` + campos `id`, `is_current`, `is_completed_explicit`, `depends_on_stages`; `ProcessInstance` + `current_stage_ids`, `completed_stage_ids` |
| `types/template.ts` | `TemplateStage` + `depends_on_stages` |
| `lib/validations/template.ts` | `'external_form'` no enum Zod + validação de config + `depends_on_stages` no `stageSchema` |
| `lib/constants.ts` | `external_form` em `SUBTASK_TYPE_LABELS` e `SUBTASK_TYPE_ICONS` |
| `lib/process-engine.ts` | Refactoring `recalculateProgress()` + nova função `calculateCurrentStages()` |
| `components/templates/subtask-config-dialog.tsx` | Secção de configuração para `external_form` (campos, links, docs) |
| `components/templates/subtask-editor.tsx` | `external_form` em `SUBTASK_TYPE_OPTIONS` + `hasAdvancedConfig` |
| `components/templates/template-builder.tsx` | `StageData.depends_on_stages` + serialização no save + loading |
| `components/templates/template-stage-dialog.tsx` | Selector de dependências entre estágios |
| `components/processes/process-kanban-view.tsx` | Cores dinâmicas por estado + botão concluir estágio |
| `components/processes/process-stepper.tsx` | Múltiplos estágios actuais + estados visuais |
| `components/processes/process-task-card.tsx` | `external_form` em `SUBTASK_TYPE_ICONS_MAP` |
| `components/processes/task-detail-actions.tsx` | `external_form` em `SUBTASK_TYPE_OPTIONS` + integração do dialog |
| `app/api/processes/[id]/route.ts` | GET — `current_stage_ids`, `completed_stage_ids`, stage `id` e `depends_on_stages` na resposta |
| `app/api/templates/route.ts` | POST — persistir `depends_on_stages` (two-step: insert → update) |
| `app/api/templates/[id]/route.ts` | PUT — persistir `depends_on_stages` (mesmo padrão) |

### MIGRAÇÃO SQL (1 execução)

```sql
ALTER TABLE tpl_stages ADD COLUMN depends_on_stages UUID[] DEFAULT '{}';
ALTER TABLE proc_instances ADD COLUMN current_stage_ids UUID[] DEFAULT '{}';
ALTER TABLE proc_instances ADD COLUMN completed_stage_ids UUID[] DEFAULT '{}';
UPDATE proc_instances SET current_stage_ids = CASE WHEN current_stage_id IS NOT NULL THEN ARRAY[current_stage_id] ELSE '{}' END;
```

---

## Ordem de Implementação

### Fase A — Formulário Externo (independente, menor risco)
1. **A1-A3**: Types + validação Zod + constantes
2. **A9**: `CopyButton` (shared)
3. **A4-A5**: Config no template builder (subtask-config-dialog + subtask-editor)
4. **A8**: `ExternalFormDialog` (novo componente)
5. **A6-A7, A10**: Integração na pipeline (task-detail-actions, subtask-card-base, process-task-card)

### Fase B — Gestão de Estágios (maior impacto)
1. **B1**: Migração SQL
2. **B2-B4**: Types + validação
3. **B7**: `calculateCurrentStages()` + refactoring `recalculateProgress()`
4. **B8**: API de conclusão de estágio
5. **B5-B6**: Template builder (StageData + stage dialog com dependências)
6. **B10-B11**: APIs de template (POST/PUT com depends_on_stages)
7. **B9**: GET process — incluir dados de estágio
8. **B12-B14**: UI — Kanban cores + stepper + dialog de conclusão
9. **B15**: Integração na página
