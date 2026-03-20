# PRD: Formulário Externo + Gestão de Estágios em Processos

**Data**: 2026-03-20
**Git Commit**: `7428625`
**Branch**: `master`

---

## Resumo Executivo

Este PRD documenta a pesquisa e planeamento para duas funcionalidades nos módulos de Templates e Processos:

1. **Novo tipo de subtarefa: `external_form`** — Uma subtarefa que exibe campos configurados (read-only) com botão de copiar, mais links externos para sites onde os dados devem ser inseridos.
2. **Gestão de Estágios com Conclusão Explícita** — Sistema visual de estágio actual com confirmação de conclusão, dependências entre estágios, e cores dinâmicas no Kanban (azul=actual, verde=concluído, cinza=aguardando).

---

## 1. Formulário Externo (`external_form`)

### 1.1 Conceito

Uma subtarefa que:
- Lista campos pré-configurados no template (ex: título, preço, morada, NIF do proprietário)
- Resolve os valores actuais desses campos a partir da base de dados (propriedade, proprietário, etc.)
- Apresenta um popup/dialog com os valores resolvidos + botão de copiar individual e "copiar todos"
- Inclui links externos configuráveis (1 ou mais) para sites onde os dados devem ser colados
- **Suporta multiplicação por proprietário** — reutiliza o padrão `SubtaskOwnerConfig` existente (`owner_scope`, `person_type_filter`, `has_person_type_variants`) para gerar uma instância por proprietário com campos do respectivo owner
- **Inclui atalhos para documentos** — permite configurar `doc_type_id`(s) cujos documentos existentes no processo podem ser descarregados directamente a partir do popup (ex: descarregar o CMI, a Caderneta Predial)

### 1.2 Casos de Uso

> **Caso 1 — Portais imobiliários**: "Preciso cadastrar o imóvel no Idealista e no Imovirtual. Configuro um formulário externo com os campos (título, preço, tipologia, área, morada) e os links dos portais. Quando chego a esta subtarefa, clico e vejo todos os dados prontos para copiar, com atalhos directos para os portais."

> **Caso 2 — Dados de proprietário para sistema externo**: "Preciso enviar os dados do proprietário para o portal de crédito. Activo a multiplicação por proprietário (`owner_scope: all_owners`). Para cada proprietário, a subtarefa mostra NIF, nome, morada, com botão de copiar. Se o proprietário é empresa (`coletiva`), mostra campos diferentes (NIPC, certidão comercial)."

> **Caso 3 — Documentos para download**: "Ao cadastrar no portal, preciso anexar a Caderneta Predial e o Certificado Energético. Configuro os `doc_type_id`s e no popup aparecem links directos para descarregar esses documentos (se já existirem no processo)."

### 1.3 Ficheiros Relevantes da Base de Código

#### Tipos e Validações (onde adicionar o novo tipo)

| Ficheiro | O que contém | Linhas-chave |
|----------|-------------|--------------|
| [types/subtask.ts](types/subtask.ts#L3) | `SubtaskType` enum — adicionar `'external_form'` | L3: `export type SubtaskType = 'upload' \| 'checklist' \| ...` |
| [types/subtask.ts](types/subtask.ts#L61-L75) | `FormFieldConfig` — reutilizar para definir campos do formulário externo | L61-75: estrutura de campo com `field_name`, `label`, `field_type`, `target_entity` |
| [types/subtask.ts](types/subtask.ts#L55-L59) | `ListingLink` — **já existe** estrutura de link externo! | L55: `{ site_name, url, published_at? }` |
| [lib/validations/template.ts](lib/validations/template.ts#L11) | Schema Zod `subtaskSchema` — adicionar `'external_form'` ao enum | L11: `z.enum(['upload', 'checklist', ...])` |
| [lib/constants.ts](lib/constants.ts#L598-L608) | `SUBTASK_TYPE_LABELS` — adicionar label PT-PT | L598: mapa de labels |

#### Template Builder (onde configurar no template)

| Ficheiro | O que contém | Linhas-chave |
|----------|-------------|--------------|
| [components/templates/template-builder.tsx](components/templates/template-builder.tsx) | Builder principal com DnD de fases/tarefas | 707 linhas |
| [components/templates/template-task-sheet.tsx](components/templates/template-task-sheet.tsx) | Sheet de edição de tarefa (3 secções: detalhes, subtarefas, alertas) | 457 linhas |
| [components/templates/subtask-config-dialog.tsx](components/templates/subtask-config-dialog.tsx) | Dialog de configuração de subtarefa (por tipo) | Configura upload, email, form, field, etc. |
| [components/templates/form-field-picker.tsx](components/templates/form-field-picker.tsx) | **Picker de campos de formulário** — reutilizável para external_form | Selecção de campo + target_entity |
| [components/templates/subtask-editor.tsx](components/templates/subtask-editor.tsx) | Editor de lista de subtarefas dentro de uma tarefa | Gestão de subtarefas com DnD |

#### Pipeline de Processo (onde renderizar no runtime)

| Ficheiro | O que contém | Linhas-chave |
|----------|-------------|--------------|
| [components/processes/process-kanban-view.tsx](components/processes/process-kanban-view.tsx) | Vista Kanban da pipeline | L10-17: `STAGE_COLORS` (cores actuais) |
| [components/processes/process-task-card.tsx](components/processes/process-task-card.tsx) | Card de tarefa no Kanban/Lista | Renderiza ícones por tipo |
| [components/processes/task-detail-sheet.tsx](components/processes/task-detail-sheet.tsx) | Sheet de detalhe de tarefa (tabs: tarefa, actividade, comentários, docs) | Onde adicionar painel de external_form |
| [components/processes/task-detail-actions.tsx](components/processes/task-detail-actions.tsx) | Acções da tarefa (subtarefas instanciadas) | Onde renderizar subtarefa `external_form` |
| [components/processes/subtask-card-base.tsx](components/processes/subtask-card-base.tsx) | Card base de subtarefa na pipeline | Base para novo card de external_form |

#### APIs (onde resolver dados e processar)

| Ficheiro | O que contém | Linhas-chave |
|----------|-------------|--------------|
| [app/api/processes/[id]/tasks/[taskId]/route.ts](app/api/processes/[id]/tasks/[taskId]/route.ts) | PUT para acções de tarefa (complete, bypass, etc.) | L1-100+ |
| [app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts](app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts) | PATCH para completar subtarefas | Onde completar external_form |
| [lib/process-engine.ts](lib/process-engine.ts) | `recalculateProgress()` — recalcula progresso | L110-237 |
| [app/api/templates/route.ts](app/api/templates/route.ts) | POST para criar template | L70+ |
| [app/api/templates/[id]/route.ts](app/api/templates/[id]/route.ts) | PUT para editar template | Actualização de stages/tasks |

### 1.4 Estrutura de Dados Proposta

#### Novo tipo no enum `SubtaskType`

```typescript
// types/subtask.ts — L3
export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc' | 'form' | 'field' | 'schedule_event' | 'external_form'
```

#### Config JSONB para `external_form`

```typescript
// Dentro de SubtaskData.config e TplSubtask.config
// Nota: herda SubtaskOwnerConfig via intersecção (& SubtaskOwnerConfig) — igual aos outros tipos
interface ExternalFormConfig {
  type: 'external_form'
  form_title?: string  // Título do popup (ex: "Dados para Portais Imobiliários")
  fields: ExternalFormField[]
  external_links: ExternalLink[]
  document_shortcuts: DocumentShortcut[]  // Atalhos para download de documentos

  // Herdado de SubtaskOwnerConfig (já existe no sistema):
  // owner_scope?: 'none' | 'all_owners' | 'main_contact_only'
  // person_type_filter?: 'all' | 'singular' | 'coletiva'
  // has_person_type_variants?: boolean
  // singular_config?: { ... }  // Config diferente para pessoa singular
  // coletiva_config?: { ... }  // Config diferente para pessoa colectiva
}

interface ExternalFormField {
  field_name: string            // Nome do campo no DB (ex: 'title', 'listing_price')
  label: string                 // Label para exibição (ex: 'Título', 'Preço')
  target_entity: FormTargetEntity  // 'property' | 'property_specs' | 'owner' | etc.
  format?: 'text' | 'currency' | 'number' | 'date'  // Formatação na exibição
  order_index: number
}

interface ExternalLink {
  site_name: string   // Ex: "Idealista", "Imovirtual", "Casa Sapo"
  url: string         // URL do portal
  icon_url?: string   // Favicon/logo opcional
}

interface DocumentShortcut {
  doc_type_id: string   // FK → doc_types.id — tipo de documento a mostrar
  label?: string        // Label override (se vazio, usa doc_types.name)
}
```

> **Nota**: Reutilizar `FormTargetEntity` e `FormFieldConfig` existentes em [types/subtask.ts](types/subtask.ts#L30-L75). O tipo `ListingLink` em L55-59 já tem uma estrutura similar aos links externos.

#### Multiplicação por Proprietário

O tipo `external_form` herda o padrão `SubtaskOwnerConfig` já implementado para subtarefas `upload`, `email` e `generate_doc`. A lógica existente em [subtask-config-dialog.tsx](components/templates/subtask-config-dialog.tsx#L773) (secção "Proprietários") pode ser reutilizada integralmente:

```typescript
// Padrão existente — SubtaskOwnerConfig (types/subtask.ts:10-24)
export interface SubtaskOwnerConfig {
  owner_scope?: OwnerScope           // 'none' | 'all_owners' | 'main_contact_only'
  person_type_filter?: PersonTypeFilter  // 'all' | 'singular' | 'coletiva'
  has_person_type_variants?: boolean
  singular_config?: { ... }  // Config específica para pessoa singular
  coletiva_config?: { ... }  // Config específica para pessoa colectiva
}
```

**Quando `owner_scope !== 'none'`:**
- A função RPC `populate_process_tasks()` cria uma `proc_subtask` por proprietário (com `owner_id`)
- No popup, os campos com `target_entity: 'owner'` são resolvidos a partir do proprietário específico
- Se `has_person_type_variants: true`, campos diferentes são mostrados para singular vs colectiva

**Exemplo prático:**
- Campos comuns: título do imóvel, preço, morada (target_entity: `property`)
- Campos por proprietário: nome, NIF, morada do proprietário (target_entity: `owner`)
- Com `owner_scope: 'all_owners'`, gera N subtarefas — uma por proprietário

#### Atalhos de Documentos (Download)

Os `document_shortcuts` permitem listar tipos de documentos cujos ficheiros existentes podem ser descarregados directamente a partir do popup. A resolução acontece no frontend:

```typescript
// No popup, resolver documentos existentes:
// 1. Buscar docs do processo (já disponíveis em ProcessDetail.documents)
// 2. Filtrar por doc_type_id configurado no shortcut
// 3. Se existe, mostrar link de download (file_url da doc_registry)
// 4. Se não existe, mostrar "Documento não disponível" (desabilitado)

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

**Componentes existentes de referência:**
- [types/process.ts:98-108](types/process.ts#L98) — `ProcessDocument` com `doc_type`, `file_url`, `file_name`
- [types/process.ts:112-136](types/process.ts#L112) — `DocumentFile` com detalhes completos
- O processo já retorna documentos no `GET /api/processes/[id]` (secção `documents`)

### 1.5 Padrão de Implementação: Clipboard Copy

```typescript
// Padrão React para copiar ao clipboard com feedback via toast (sonner)
async function copyToClipboard(text: string, label?: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(label ? `${label} copiado!` : 'Copiado!')
  } catch {
    // Fallback para browsers antigos
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    toast.success(label ? `${label} copiado!` : 'Copiado!')
  }
}

// Copiar todos os campos de uma vez
function copyAllFields(fields: { label: string; value: string }[]) {
  const text = fields
    .map(f => `${f.label}: ${f.value}`)
    .join('\n')
  copyToClipboard(text, 'Todos os campos')
}
```

**Componente de referência do shadcn/ui**:
```tsx
// Padrão de botão com ícone de copiar + feedback visual
import { Copy, Check } from 'lucide-react'

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label || 'Valor'} copiado!`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}
```

### 1.6 Resolução de Valores no Backend

O popup do external_form precisa resolver os valores actuais dos campos configurados. A API já tem lógica similar no form subtask — na rota de detalhe do processo (`GET /api/processes/[id]`) os dados da propriedade são incluídos:

```typescript
// Padrão existente em app/api/processes/[id]/route.ts (GET)
// O processo já retorna property com specs, internal, owners
// Para external_form, os valores são resolvidos no frontend a partir dos dados
// já disponíveis no ProcessDetail (instance.property, owners)
```

**Estratégia**: Resolver no frontend (sem nova API) usando `process.instance.property` e `process.owners` que já são retornados pelo `GET /api/processes/[id]`.

### 1.7 UI do Popup de Formulário Externo

```tsx
// Dialog com campos read-only + copiar + links externos
<Dialog>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>{config.form_title || 'Formulário Externo'}</DialogTitle>
      <DialogDescription>
        Copie os dados abaixo e cole nos portais externos.
      </DialogDescription>
    </DialogHeader>

    {/* Lista de campos com valores resolvidos */}
    <div className="space-y-2">
      {resolvedFields.map(field => (
        <div key={field.field_name} className="flex items-center justify-between p-2 rounded-md border">
          <div>
            <span className="text-xs text-muted-foreground">{field.label}</span>
            <p className="text-sm font-medium">{field.value || '—'}</p>
          </div>
          <CopyButton value={field.value} label={field.label} />
        </div>
      ))}
    </div>

    {/* Botão copiar todos */}
    <Button variant="outline" className="w-full" onClick={() => copyAllFields(resolvedFields)}>
      <Copy className="mr-2 h-4 w-4" />
      Copiar Todos os Campos
    </Button>

    {/* Links externos */}
    <Separator />
    <div>
      <h4 className="text-sm font-medium mb-2">Portais Externos</h4>
      <div className="space-y-1.5">
        {config.external_links.map(link => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded-md border hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{link.site_name}</span>
            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  </DialogContent>
</Dialog>
```

---

## 2. Gestão de Estágios com Conclusão Explícita

### 2.1 Conceito

Actualmente, o estágio "actual" é calculado automaticamente como "a primeira fase com tarefas incompletas" (ver `recalculateProgress()` em [lib/process-engine.ts:164-186](lib/process-engine.ts#L164)).

A nova funcionalidade adiciona:

1. **Conclusão explícita de estágio** — O utilizador confirma manualmente que um estágio está concluído (botão + dialog de confirmação)
2. **Estágios paralelos** — Um estágio pode ter "sub-estágios" (2.1, 2.2) que correm em paralelo
3. **Dependências entre estágios** — No template, definir que estágio X depende dos estágios Y e Z
4. **Cores dinâmicas no Kanban** — Azul (actual), Verde (concluído), Cinza (aguardando)
5. **Estágio actual inteligente** — Se o estágio 4 foi concluído antes do 2, quando o 2 concluir, o 3 passa a ser actual (não o 5)

### 2.2 Regras de Negócio

1. As tarefas podem ser executadas em qualquer ordem (não bloqueadas pelo estágio), excepto dependências de tarefa já implementadas
2. Um estágio NÃO é bloqueado por não ser o actual — apenas não está em evidência visual
3. A conclusão do estágio é uma acção explícita (botão "Concluir Estágio" com dialog de confirmação)
4. O estágio actual avança para o próximo estágio incompleto na ordem, respeitando dependências
5. Se um estágio tem dependências de outros estágios, só pode ser concluído após esses estágios estarem concluídos
6. Múltiplos estágios podem ser "actuais" se estiverem no mesmo nível de paralelismo

### 2.3 Ficheiros Afectados

#### Schema de Base de Dados

| Tabela | Alteração | Detalhe |
|--------|-----------|---------|
| `tpl_stages` | Adicionar colunas | `depends_on_stages UUID[]` (array de IDs de estágios dependentes) |
| `proc_instances` | Alterar coluna | `current_stage_id` → `current_stage_ids UUID[]` (suporte a múltiplos estágios actuais) |
| `proc_instances` | Adicionar coluna | `completed_stage_ids UUID[]` (estágios explicitamente concluídos) |

#### Migração SQL

```sql
-- 1. Dependências entre estágios (template)
ALTER TABLE tpl_stages
  ADD COLUMN depends_on_stages UUID[] DEFAULT '{}';

-- 2. Suporte a múltiplos estágios actuais + tracking de conclusão
ALTER TABLE proc_instances
  ADD COLUMN current_stage_ids UUID[] DEFAULT '{}',
  ADD COLUMN completed_stage_ids UUID[] DEFAULT '{}';

-- 3. Migrar dados existentes (current_stage_id → current_stage_ids)
UPDATE proc_instances
SET current_stage_ids = ARRAY[current_stage_id]
WHERE current_stage_id IS NOT NULL;
```

#### Ficheiros do Codebase

| Ficheiro | Alteração Necessária |
|----------|---------------------|
| [lib/process-engine.ts](lib/process-engine.ts#L110-237) | Refactoring de `recalculateProgress()` para usar `completed_stage_ids` e `current_stage_ids` |
| [types/process.ts](types/process.ts#L78-85) | `ProcessStageWithTasks` — adicionar `is_current`, `is_completed_explicit`, `depends_on_stages` |
| [types/template.ts](types/template.ts#L23-25) | `TemplateStage` — adicionar `depends_on_stages` |
| [components/processes/process-kanban-view.tsx](components/processes/process-kanban-view.tsx#L10-17) | Substituir `STAGE_COLORS` por cores dinâmicas baseadas no estado |
| [components/processes/process-stepper.tsx](components/processes/process-stepper.tsx) | Actualizar indicadores para mostrar múltiplos estágios actuais |
| [components/templates/template-stage-dialog.tsx](components/templates/template-stage-dialog.tsx) | Adicionar selector de dependências de estágios |
| [components/templates/template-builder.tsx](components/templates/template-builder.tsx#L55-59) | `StageData` — adicionar `depends_on_stages: string[]` |
| [lib/validations/template.ts](lib/validations/template.ts#L190-195) | `stageSchema` — adicionar `depends_on_stages` |
| [app/api/processes/[id]/route.ts](app/api/processes/[id]/route.ts) | GET — incluir `current_stage_ids`, `completed_stage_ids` na resposta |
| [app/api/templates/route.ts](app/api/templates/route.ts) | POST — persistir `depends_on_stages` |
| [app/api/templates/[id]/route.ts](app/api/templates/[id]/route.ts) | PUT — actualizar `depends_on_stages` |

#### Nova API Route

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/processes/[id]/stages/[stageId]/complete` | POST | Concluir estágio explicitamente (com confirmação) |

### 2.4 Lógica de Estágio Actual — Algoritmo

```typescript
/**
 * Calcula quais estágios são "actuais" após uma conclusão de estágio.
 *
 * Regras:
 * 1. Um estágio é "actual" se:
 *    - NÃO está concluído
 *    - Todas as suas dependências de estágio estão concluídas
 *    - É o próximo na ordem sequencial OU não tem dependências
 * 2. Ao concluir um estágio, o próximo estágio incompleto (respeitando dependências) torna-se actual
 * 3. Se o estágio 4 foi concluído antes do 2:
 *    - Concluir 2 → 3 torna-se actual (não 5, porque 4 já foi concluído)
 *    - Concluir 3 → 5 torna-se actual (porque 4 já foi concluído)
 */
function calculateCurrentStages(
  allStages: { id: string; order_index: number; depends_on_stages: string[] }[],
  completedStageIds: string[]
): string[] {
  const completed = new Set(completedStageIds)
  const sorted = [...allStages].sort((a, b) => a.order_index - b.order_index)

  const currentStages: string[] = []

  for (const stage of sorted) {
    if (completed.has(stage.id)) continue // já concluído

    // Verificar dependências
    const depsOk = stage.depends_on_stages.every(depId => completed.has(depId))
    if (!depsOk) continue // dependências não satisfeitas

    currentStages.push(stage.id)

    // Se não tem dependências explícitas, parar no primeiro não-concluído (comportamento sequencial)
    if (stage.depends_on_stages.length === 0 && currentStages.length > 0) {
      // Verificar se há estágios paralelos (que dependem dos mesmos predecessores)
      // Se não há dependências configuradas, o fluxo é sequencial
      break
    }
  }

  return currentStages
}
```

### 2.5 Cores do Kanban — Substituição

**Código actual** ([process-kanban-view.tsx:10-17](components/processes/process-kanban-view.tsx#L10)):

```typescript
// ACTUAL (cores variadas por índice — a substituir)
const STAGE_COLORS = [
  { dot: 'bg-indigo-500', headerBg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { dot: 'bg-sky-500', headerBg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  // ...
]
```

**Proposta (cores dinâmicas por estado)**:

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

function getStageColor(stage: ProcessStageWithTasks, currentStageIds: string[], completedStageIds: string[]) {
  if (completedStageIds.includes(stage.id)) return STAGE_STATUS_COLORS.completed
  if (currentStageIds.includes(stage.id)) return STAGE_STATUS_COLORS.current
  return STAGE_STATUS_COLORS.waiting
}
```

### 2.6 UI do Botão de Conclusão de Estágio

```tsx
// No Kanban, abaixo do nome do estágio — botão de concluir
{isCurrentStage && !isCompletedStage && (
  <Button
    variant="outline"
    size="sm"
    className="w-full mt-2 text-xs"
    onClick={() => setConfirmStageDialogOpen(true)}
  >
    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
    Concluir Estágio
  </Button>
)}

// Dialog de confirmação
<AlertDialog open={confirmStageDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Concluir Estágio</AlertDialogTitle>
      <AlertDialogDescription>
        Tem a certeza de que pretende marcar o estágio "{stage.name}" como concluído?
        Após confirmação, o próximo estágio ficará em evidência.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleCompleteStage(stage.id)}>
        Confirmar Conclusão
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 2.7 Dependências de Estágio no Template Builder

No dialog de criação/edição de fase ([template-stage-dialog.tsx](components/templates/template-stage-dialog.tsx)):

```tsx
// Adicionar ao dialog existente (após os campos nome e descrição)
<div className="space-y-2">
  <Label>Depende dos Estágios</Label>
  <p className="text-xs text-muted-foreground">
    Este estágio só pode ser concluído após os estágios seleccionados.
  </p>
  {/* MultiSelect dos estágios existentes (excluindo o próprio) */}
  <MultiSelect
    options={otherStages.map(s => ({ value: s.id, label: s.name }))}
    selected={dependsOnStages}
    onChange={setDependsOnStages}
    placeholder="Seleccionar estágios..."
  />
</div>
```

### 2.8 Actualização do `recalculateProgress()`

A função actual em [lib/process-engine.ts:110-237](lib/process-engine.ts#L110) calcula o estágio actual automaticamente como "primeira fase não-completa". Precisa ser refactorizada para:

1. Usar `completed_stage_ids` em vez de calcular a partir de tarefas
2. Calcular `current_stage_ids` (plural) baseado em dependências
3. Manter o cálculo de `percent_complete` inalterado (baseado em tarefas/subtarefas)

```typescript
// Lógica actual (L164-186) — a substituir:
// Encontra primeira fase não-completa por stage_order_index

// Nova lógica:
// 1. Buscar completed_stage_ids do proc_instances
// 2. Buscar depends_on_stages de cada tpl_stage
// 3. Calcular current_stage_ids com calculateCurrentStages()
// 4. Actualizar proc_instances com current_stage_ids
```

---

## 3. Padrões de Implementação Externos

### 3.1 Clipboard API (MDN)

```typescript
// navigator.clipboard.writeText() — Async, retorna Promise
// Requer contexto seguro (HTTPS ou localhost)
// Suportado: Chrome 66+, Firefox 63+, Safari 13.1+
navigator.clipboard.writeText(text).then(() => {
  // sucesso
}).catch(err => {
  // fallback com document.execCommand('copy')
})
```

**Referência**: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText

### 3.2 Workflow Stage Patterns

Os padrões de workflow com estágios paralelos são comuns em:

- **BPMN (Business Process Model and Notation)**: Usa "gateways" para paralelismo
  - **Parallel Gateway (AND)**: Todos os ramos devem completar antes de avançar
  - **Inclusive Gateway (OR)**: Um ou mais ramos completam
  - No nosso caso, usamos `depends_on_stages` como um Parallel Gateway implícito

- **GitHub Actions**: Jobs com `needs: [job1, job2]` — exactamente o mesmo padrão que `depends_on_stages`

- **DAG (Directed Acyclic Graph)**: Estágios formam um DAG onde as dependências definem a ordem de execução

### 3.3 shadcn/ui AlertDialog (Confirmação)

Já utilizado no projecto para confirmações destrutivas. O padrão está implementado em múltiplos locais:

```tsx
// Padrão existente (processo detalhe, L27-35):
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
```

### 3.4 PostgreSQL Arrays (UUID[])

```sql
-- Adicionar dependência
ALTER TABLE tpl_stages ADD COLUMN depends_on_stages UUID[] DEFAULT '{}';

-- Query para verificar dependências satisfeitas
SELECT id FROM tpl_stages
WHERE tpl_process_id = $1
  AND depends_on_stages <@ $2::uuid[];  -- <@ = "está contido em"

-- Supabase query com arrays
const { data } = await supabase
  .from('tpl_stages')
  .select('id, depends_on_stages')
  .eq('tpl_process_id', templateId)

// Verificar se todas as dependências estão concluídas
const depsOk = stage.depends_on_stages.every(
  depId => completedStageIds.includes(depId)
)
```

---

## 4. Resumo de Alterações por Ficheiro

### Ficheiros a CRIAR

| Ficheiro | Descrição |
|----------|-----------|
| `app/api/processes/[id]/stages/[stageId]/complete/route.ts` | API de conclusão de estágio |
| `components/processes/external-form-dialog.tsx` | Dialog do formulário externo (campos + copiar + links) |
| `components/processes/stage-complete-dialog.tsx` | Dialog de confirmação de conclusão de estágio |
| `components/shared/copy-button.tsx` | Botão de copiar reutilizável |

### Ficheiros a MODIFICAR

| Ficheiro | Alteração |
|----------|-----------|
| `types/subtask.ts` | Adicionar `'external_form'` ao `SubtaskType`, interface `ExternalFormConfig` |
| `lib/validations/template.ts` | Adicionar `'external_form'` ao enum Zod, validação de config |
| `lib/constants.ts` | Adicionar `external_form` ao `SUBTASK_TYPE_LABELS` |
| `lib/process-engine.ts` | Refactoring de `recalculateProgress()` para estágios explícitos |
| `types/process.ts` | `ProcessStageWithTasks` — adicionar campos de estado do estágio |
| `types/template.ts` | `TemplateStage` — adicionar `depends_on_stages` |
| `components/processes/process-kanban-view.tsx` | Cores dinâmicas + botão concluir estágio |
| `components/processes/process-stepper.tsx` | Múltiplos estágios actuais |
| `components/processes/subtask-card-base.tsx` | Renderizar subtarefa `external_form` |
| `components/processes/task-detail-actions.tsx` | Acção de external_form (abrir dialog) |
| `components/templates/template-stage-dialog.tsx` | Selector de dependências de estágios |
| `components/templates/template-builder.tsx` | `StageData` com `depends_on_stages` |
| `components/templates/subtask-config-dialog.tsx` | Configuração do tipo `external_form` |
| `app/api/processes/[id]/route.ts` | GET — incluir stage state info |
| `app/api/templates/route.ts` | POST — persistir `depends_on_stages` |
| `app/api/templates/[id]/route.ts` | PUT — actualizar `depends_on_stages` |

### Migração SQL

```sql
-- Executar via Supabase MCP ou migration
ALTER TABLE tpl_stages ADD COLUMN depends_on_stages UUID[] DEFAULT '{}';
ALTER TABLE proc_instances ADD COLUMN current_stage_ids UUID[] DEFAULT '{}';
ALTER TABLE proc_instances ADD COLUMN completed_stage_ids UUID[] DEFAULT '{}';

-- Migrar dados existentes
UPDATE proc_instances
SET current_stage_ids = CASE
  WHEN current_stage_id IS NOT NULL THEN ARRAY[current_stage_id]
  ELSE '{}'
END;
```

---

## 5. Dependências Externas

Nenhuma nova dependência é necessária. Todas as ferramentas já estão disponíveis:

- `navigator.clipboard` — API nativa do browser
- `sonner` — já instalado para toasts
- `shadcn/ui` — AlertDialog, Dialog, Button, Badge já instalados
- `lucide-react` — ícones (Copy, Check, ExternalLink, ArrowUpRight)
- PostgreSQL arrays — suportado nativamente pelo Supabase

---

## 6. Ordem de Implementação Sugerida

### Fase A: Formulário Externo (menor risco, mais independente)
1. Tipos + validação Zod + constantes
2. Configuração no template builder (subtask-config-dialog)
3. Resolução de valores no frontend
4. Dialog de exibição com copiar + links
5. Integração no subtask-card-base

### Fase B: Gestão de Estágios (maior impacto, mais cuidado)
1. Migração SQL (adicionar colunas)
2. Actualizar tipos TypeScript
3. API de conclusão de estágio
4. Refactoring do recalculateProgress()
5. Dependências no template builder (stage dialog)
6. Cores dinâmicas no Kanban
7. Botão + dialog de conclusão no Kanban
8. Actualizar stepper
